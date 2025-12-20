let currentChallengeId = null;

// Récupérer l'ID du défi depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
currentChallengeId = urlParams.get('id');

if (!currentChallengeId) {
    window.location.href = 'challenges.html';
}

// MANDATORY
function updatePageData() {
    renderChallengeDetail();
}

// -------------------- RENDER CHALLENGE DETAIL --------------------
function renderChallengeDetail() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const currentOrganizerData = users.find(u => u.username === challenge.organizer);
    if (!challenge) {
        setTimeout(() => window.location.href = 'challenges.html', 2000);
        return;
    }

    const isParticipant = challenge.participants.some(
        p => p.username === currentUser || (p.type === 'team' && p.members.some(user => user.username === currentUser))
    );
    const isOrganizer = challenge.organizer === currentUser;

    // Header
    document.getElementById('challengeTitle').textContent = challenge.name;
    document.getElementById('challengeBadges').innerHTML = `
        <span class="badge type">${challenge.teamFormat || 'Solo'}</span>
        <span class="badge format">${getFormatText(challenge.format)}</span>
        ${getStatusBadge(challenge.status)}
    `;

    // Informations
    document.getElementById('gameInfo').textContent = challenge.game;
    document.getElementById('formatInfo').textContent = getFormatText(challenge.format);
    document.getElementById('betInfo').textContent = `${challenge.minBet} - ${challenge.maxBet} points`;
    document.getElementById('organizerInfo').textContent = `${challenge.organizer} ${currentOrganizerData.cheated.length >= 3 ? '⚠️' : ''}`;
    document.getElementById('statusInfo').innerHTML = getStatusBadge(challenge.status);
    document.getElementById('teamInfo').textContent  = challenge.teamFormat === "team"
                                                    ? `${challenge.teamConfig.playersPerTeam} joueurs`
                                                    : '1 joueur';
    
    // Règles
    const rulesSection = document.getElementById('rulesSection');
    rulesSection.innerHTML = challenge.rules
        ? `<h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: var(--dark);">Règles</h4>
           <p style="white-space: pre-wrap;">${challenge.rules}</p>`
        : '';

    // Participants
    document.getElementById('participantCount').textContent = challenge.participants.length;
    document.getElementById('participantsList').innerHTML = challenge.participants
        .map((p) => {
            const progress = challenge.progressions?.[p.username || p.teamName];
            const teamParticipant = challenge.participants.find((x) => x.type === 'team' && x.teamId === p.teamId);
            const teamIndex = challenge.participants.indexOf(teamParticipant);
            const isCheater = progress?.cheated || (p.type === "team" && challenge.participants[teamIndex].members.find(member => member.cheated === true)) || false;
            const displayName = p.type === 'team' ? p.teamName : p.username;
            const isOrganizerParticipant = p.username === challenge.organizer || (p.type === "team" && challenge.participants[teamIndex].members.find(member => member.username === challenge.organizer)) || false;
            
            return `
            <div class="participant-card ${isOrganizerParticipant ? 'organizer' : ''} ${
                isCheater ? 'cheated' : ''
            }"
                ${p.type === 'team' ? `onclick="toggleTeamMembers('${p.teamId}'); event.stopPropagation();"` : ''}>
                <div class="participant-name">
                    ${isOrganizerParticipant ? '👑 ' : ''}${displayName}
                    ${isCheater ? ' ⚠️' : ''}
                </div>
                <div class="participant-bet">
                    Mise: ${p.bet * (p.type === "team" ? challenge.participants[teamIndex].members.length : 1)} pts
                    ${p.modifier !== 0 ? `<br>Bonus/Malus: ${p.modifier > 0 ? '+' : ''}${p.modifier}` : ''}
                    ${progress ? `<br>Score: ${progress.score}` : ''}
                </div>
                ${
                    p.type === 'team'
                        ? `<div id="teamMembers-${p.teamId}" class="team-members" style="display:none; margin-top:0.5rem; padding-left:1rem;"></div>`
                        : ''
                }
                ${
                    isOrganizer && !isCheater && challenge.status === 'active' && ((p.type === 'player' && p.username !== currentUser) || p.type === 'team' && !p.members.some(user => user.username === currentUser))
                        ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); addCheater('${p.username || p.teamId}')" style="margin-top: 0.5rem;">⚠️ Signaler</button>`
                        : ''
                }
                ${
                    isOrganizer && isCheater && challenge.status === 'active' && ((p.type === 'player' && p.username !== currentUser) || p.type === 'team' && !p.members.some(user => user.username === currentUser))
                        ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); removeCheater('${p.username || p.teamId}')" style="margin-top: 0.5rem;">😇 Gracier</button>`
                        : ''
                }
                ${
                    isParticipant && challenge.malus && challenge.status === 'active' && ((p.type === 'player' && p.username !== currentUser) || p.type === 'team' && !p.members.some(user => user.username === currentUser))
                        ? `<button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); openMalusModal('${p.username}')" style="margin-top: 0.5rem;">⚡ Malus</button>`
                        : ''
                }
            </div>`;
        })
        .join('');

    renderActions(challenge, isParticipant, isOrganizer);
}

// -------------------- TOGGLE TEAM MEMBERS --------------------
function toggleTeamMembers(teamId) {
    const teamCardMembersDiv = document.getElementById(`teamMembers-${teamId}`);
    if (!teamCardMembersDiv) return;

    const challenge = challenges.find((c) => c.id === currentChallengeId);
    if (!challenge) return;

    const teamParticipant = challenge.participants.find((p) => p.type === 'team' && p.teamId === teamId);
    if (!teamParticipant) return;
    if (teamCardMembersDiv.style.display === 'none') {
        teamCardMembersDiv.innerHTML = teamParticipant.members
            .map((username) => `<div class="team-member">- ${username.username} ${username.username === challenge.organizer ? '👑' : ''} ${username.cheated ? '⚠️' : ''}</div>`)
            .join('');
        teamCardMembersDiv.style.display = 'block';
    } else {
        teamCardMembersDiv.style.display = 'none';
    }
}

// -------------------- ACTIONS --------------------
function renderActions(challenge, isParticipant, isOrganizer) {
    const actionsDiv = document.getElementById('challengeActions');
    let html = '';

    if (!isParticipant && challenge.status === 'waiting') {
        html += `<button class="btn btn-success btn-sm" onclick="openJoinModal('${challenge.id}')">Rejoindre</button>`;
    }

    if (isOrganizer && challenge.status === 'waiting') {
        html += '<button class="btn btn-primary" onclick="startChallenge()">Démarrer le défi</button>';
    }

    if (isOrganizer && challenge.status === 'active') {
        html += '<button class="btn btn-success" onclick="finishChallenge()">🏁 Terminer le défi</button>';
    }

    if (challenge.status === 'active' && isParticipant) {
        html += `<button class="btn btn-primary" onclick="window.location.href='challenge-mechanics.html?id=${challenge.id}'">🎮 Mécaniques de jeu</button>`;
    }

    if (challenge.status === 'finished') {
        html += `<button class="btn btn-primary" onclick="showResults()">🏆 Voir les résultats</button>`;
    }

    if (isParticipant && challenge.status === 'waiting') {
        html += '<button class="btn btn-danger" onclick="leaveChallenge()">Quitter le défi</button>';
    }

    if (isOrganizer) {
        html += '<button class="btn btn-danger" onclick="deleteChallenge()">Supprimer le défi</button>';
    }

    actionsDiv.innerHTML = html || '<p style="color: var(--gray); font-style: italic;">Aucune action disponible</p>';
}

