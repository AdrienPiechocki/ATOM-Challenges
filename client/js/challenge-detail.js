let currentChallengeId = null;
let selectedParticipant = null;
let selectedChallengeForJoin = null;

// Récupérer l'ID du défi depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
currentChallengeId = urlParams.get('id');

if (!currentChallengeId) {
    window.location.href = 'challenges.html';
}

// -------------------- UPDATE PAGE --------------------
function updatePageData() {
    renderChallengeDetail();
    updateChat();
}

// -------------------- RENDER CHALLENGE DETAIL --------------------
function renderChallengeDetail() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if (!challenge) {
        setTimeout(() => window.location.href = 'challenges.html', 2000);
        return;
    }

    const isParticipant = challenge.participants.some(
        p => p.username === currentUser || (p.type === 'team' && p.members.includes(currentUser))
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
    document.getElementById('organizerInfo').textContent = challenge.organizer;
    document.getElementById('statusInfo').innerHTML = getStatusBadge(challenge.status);
    document.getElementById('teamInfo').textContent  = challenge.teamFormat === "team"
                                                    ? challenge.teamConfig.minPlayersPerTeam == challenge.teamConfig.maxPlayersPerTeam
                                                    ? `${challenge.teamConfig.minPlayersPerTeam} joueurs`
                                                    : `${challenge.teamConfig.minPlayersPerTeam} à ${challenge.teamConfig.maxPlayersPerTeam} joueurs` 
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
            const progress = challenge.progressions?.[p.username || p.teamId];
            const isCheater = progress?.cheated || false;
            const displayName = p.type === 'team' ? p.teamName : p.username;
            const isOrganizerParticipant = p.username === challenge.organizer;
            
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
                    Mise: ${p.bet} pts
                    ${p.modifier !== 0 ? `<br>Bonus/Malus: ${p.modifier > 0 ? '+' : ''}${p.modifier}` : ''}
                    ${progress ? `<br>Score: ${progress.score}` : ''}
                </div>
                ${
                    p.type === 'team'
                        ? `<div id="teamMembers-${p.teamId}" class="team-members" style="display:none; margin-top:0.5rem; padding-left:1rem;"></div>`
                        : ''
                }
                ${
                    isOrganizer && !isCheater && challenge.status === 'active' && ((p.type === 'player' && p.username !== currentUser) || p.type === 'team' && !p.members.includes(currentUser))
                        ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); addCheater('${p.username}')" style="margin-top: 0.5rem;">⚠️ Signaler</button>`
                        : ''
                }
                ${
                    isOrganizer && isCheater && challenge.status === 'active' && ((p.type === 'player' && p.username !== currentUser) || p.type === 'team' && !p.members.includes(currentUser))
                        ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); removeCheater('${p.username}')" style="margin-top: 0.5rem;">😇 Gracier</button>`
                        : ''
                }
                ${
                    isParticipant && challenge.malus && challenge.status === 'active' && ((p.type === 'player' && p.username !== currentUser) || p.type === 'team' && !p.members.includes(currentUser))
                        ? `<button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); openMalusModal('${p.username}')" style="margin-top: 0.5rem;">⚡ Malus</button>`
                        : ''
                }
            </div>`;
        })
        .join('');

    renderActions(challenge, isParticipant, isOrganizer);

    // Chat
    if (isParticipant) {
        document.getElementById('chatInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
    }
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
            .map((username) => `<div class="team-member">- ${username}</div>`)
            .join('');
        teamCardMembersDiv.style.display = 'block';
    } else {
        teamCardMembersDiv.style.display = 'none';
    }
}

// -------------------- MALUS --------------------
let malusTarget = null;
const MALUS_CONFIG = {
    maxPenalty: 30,
    cooldownMs: 60 * 1000,
    teamSplitRatio: 0.6,
    rankingMultiplier: { top: 0.5, middle: 1, bottom: 1.3 }
};

function canUseMalus(challenge, username) {
    if (!challenge.malusCooldowns) challenge.malusCooldowns = {};
    const last = challenge.malusCooldowns[username];
    return !last || Date.now() - last >= MALUS_CONFIG.cooldownMs;
}

function openMalusModal(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;
    if (!canUseMalus(challenge, currentUser)) {
        showNotification('⏱ Malus en cooldown', 'error');
        return;
    }

    malusTarget = username;
    document.getElementById('malusTargetName').textContent = username;
    document.getElementById('malusUserPoints').textContent = user.totalPoints;
    document.getElementById('malusCost').value = 10;
    updateMalusPreview();
    document.getElementById('malusModal').classList.remove('hidden');
}

function updateMalusPreview() {
    const cost = parseInt(document.getElementById('malusCost').value) || 0;
    const penalty = Math.floor(Math.sqrt(cost) * 5);
    document.getElementById('malusPreview').textContent = `Malus estimé : -${penalty} pts`;
}

function applyMalus() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const attacker = users.find(u => u.username === currentUser);
    if (!challenge || !attacker || !malusTarget) return;

    const cost = parseInt(document.getElementById('malusCost').value);
    if (!cost || cost <= 0) {
        showNotification('Montant invalide', 'error');
        return;
    }

    // 🔒 Vérification points disponibles
    if (attacker.totalPoints < cost) {
        showNotification('Points insuffisants', 'error');
        return;
    }

    const penalty = Math.floor(Math.sqrt(cost) * 5)

    // Déduction des points de l'attaquant
    attacker.totalPoints -= cost;
    const attackerParticipant = challenge.participants.find(p => p.username === currentUser);
    if (attackerParticipant) {
        if (attackerParticipant.type === 'team') {
            attackerParticipant.usedPoints[currentUser] += cost;
        } else {
            attackerParticipant.usedPoints += cost;
        }
    }


    // 🔄 Appliquer le malus
    const target = challenge.participants.find(p => p.username === malusTarget);
    if (!target) return;

    if (target.type === 'team') {
        const teamMembers = challenge.participants.filter(p => p.type === 'team' && p.teamId === target.teamId);
        const perPlayer = Math.ceil((penalty * (MALUS_CONFIG.teamSplitRatio || 1)) / teamMembers.length);

        // Appliquer le malus
        teamMembers.forEach(p => (p.modifier = (p.modifier || 0) - perPlayer));
    } else {
        target.modifier = (target.modifier || 0) - penalty;
    }

    // 🔹 Journal du malus
    if (!challenge.malusLog) challenge.malusLog = [];
    challenge.malusLog.push({ from: currentUser, to: malusTarget, cost, penalty, timestamp: Date.now() });
    challenge.malusCooldowns[currentUser] = Date.now();

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'notification', text: `⚡ ${currentUser} inflige -${penalty} à ${malusTarget}` }));

    closeMalusModal();
    showNotification(`Malus de -${penalty} appliqué`);
}

function closeMalusModal() {
    document.getElementById('malusModal').classList.add('hidden');
    malusTarget = null;
}

// -------------------- CHEAT --------------------

function addCheater(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;

    const target = challenge.participants.find(p => p.username === username);
    if (!target) return;

    if (target.type === 'team') {
        openCheatModal(target.teamId)
    } else {
        users.forEach(u => {
            if (u.username === username) {
                u.cheated.push(currentChallengeId);
                challenge.progressions[u.username].cheated = true;
            }
        });
    }
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    showNotification(`Utilisateur signalé`);
    renderChallengeDetail();
}

function removeCheater(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;

    const target = challenge.participants.find(p => p.username === username);
    if (!target) return;

    if (target.type === 'team') {
        openCheatModal(target.teamId)
    } else {
        users.forEach(u => {
            if (u.username === username) {
                u.cheated.splice(u.cheated.indexOf(currentChallengeId));
                challenge.progressions[u.username].cheated = false;
            }
        })
    }
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    showNotification(`Utilisateur gracié`);
    renderChallengeDetail();
}

function openCheatModal(teamId) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;

    const teamParticipant = challenge.participants.find((p) => p.type === 'team' && p.teamId === teamId);
    document.getElementById('teamUsers').innerHTML = teamParticipant.members
            .map((username) => {
                `<div class="team-member">- ${username}</div>
                ${
                    !username.cheated
                        ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); addCheater('${username}')" style="margin-top: 0.5rem;">⚠️ Signaler</button>`
                        : ''
                }
                ${
                    username.cheated
                        ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); removeCheater('${username}')" style="margin-top: 0.5rem;">😇 Gracier</button>`
                        : ''
                }`
            }).join('');

    document.getElementById('cheatModal').classList.remove('hidden');
}

function closeCheatModal() {
    document.getElementById('cheatModal').classList.add('hidden');
}

// -------------------- CHAT --------------------
function updateChat() {
    const chatMessages = document.getElementById('chatMessages');
    const challengeMessages = messages[currentChallengeId] || [];
    if (challengeMessages.length === 0) {
        chatMessages.innerHTML = '<p style="text-align:center; color: var(--gray);">Aucun message</p>';
        return;
    }
    chatMessages.innerHTML = challengeMessages
        .map(
            msg => `<div class="chat-message">
                        <div>
                            <span class="chat-sender">${msg.player}</span>
                            <span class="chat-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="chat-text">${msg.text}</div>
                    </div>`
        )
        .join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    ws.send(JSON.stringify({ type: 'newMessage', challengeId: currentChallengeId, player: currentUser, text }));
    input.value = '';
}

document.getElementById('chatInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
});

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

    if ((isParticipant || (challenge.teamFormat == "team" && isTeamLeader(currentUser, challenge))) && challenge.status === 'waiting') {
        html += '<button class="btn btn-danger" onclick="leaveChallenge()">Quitter le défi</button>';
    }

    if (isOrganizer) {
        html += '<button class="btn btn-danger" onclick="deleteChallenge()">Supprimer le défi</button>';
    }

    actionsDiv.innerHTML = html || '<p style="color: var(--gray); font-style: italic;">Aucune action disponible</p>';
}

function isTeamLeader(username, challenge) {
    if (!challenge.teamFormat || !challenge.participants) return false;

    // Trouver l'équipe du joueur
    const participantTeam = challenge.participants.find(p => p.type === 'team' && p.members.includes(username));
    if (!participantTeam) return false;

    // Vérifier la propriété isLeader (ou le premier membre de la liste par défaut)
    return participantTeam.isLeader || (participantTeam.members[0] === username);
}


// -------------------- START/FINISH CHALLENGE --------------------
function startChallenge() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if (!challenge) return;

    if (challenge.participants.length < 2) {
        showNotification('Il faut au moins 2 participants pour démarrer', 'error');
        return;
    }

    if (!challenge.progressions) challenge.progressions = {};
    challenge.participants.forEach(p => {
        if (!challenge.progressions[p.username || p.teamId]) {
            challenge.progressions[p.username || p.teamId] = { score: 0, cheated: false };
        }
    });

    challenge.status = 'active';
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a commencé !` }));
    showNotification('Défi démarré !');
}

// -------------------- FINISH CHALLENGE --------------------
function finishChallenge() {
    if (!confirm('Êtes-vous sûr de vouloir terminer ce défi ? Les remboursements en cas de suppression ne seront plus effectifs')) return;

    const challenge = challenges.find(c => c.id === currentChallengeId);
    if (!challenge || challenge.organizer !== currentUser) return;

    const results = challenge.participants.map(p => {
        const progress = challenge.progressions[p.username || p.teamId] || { score: 0, cheated: false };
        const finalScore = progress.score + (p.modifier || 0);

        // Utiliser le nom stocké directement
        const displayName = p.type === 'team' ? p.teamName || `#${p.teamId}` : p.username;

        return { ...p, displayName, score: finalScore, cheated: progress.cheated || false };
    });


    results.sort((a, b) => {
        if (a.cheated && !b.cheated) return 1;
        if (!a.cheated && b.cheated) return -1;
        return b.score - a.score;
    });

    const totalPot = challenge.participants.reduce((sum, p) => sum + p.bet, 0);
    const nonCheaters = results.filter(r => !r.cheated);

    if (nonCheaters.length > 0) {
        const winner = nonCheaters[0];
        const winnerUser = users.find(u => u.username === winner.username);
        if (winnerUser) winnerUser.totalPoints += totalPot;

        challenge.participants.forEach(p => {
            if (p.type === 'team') {
                p.members.forEach(username => {
                    const user = users.find(u => u.username === username);
                    if (user) {
                        user.challengesCompleted += 1;
                    }
                });
            } else {
                const user = users.find(u => u.username === p.username);
                if (user) {
                    user.challengesCompleted += 1;
                }
            }
        });


        challenge.results = { winner: winner.displayName, totalPot, rankings: results, finishedAt: Date.now() };
        challenge.status = 'finished';

        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'notification', text: `🏆 ${winner.displayName} a gagné ${totalPot} points !` }));
        showNotification('Défi terminé !');
        setTimeout(() => showResults(), 1000);
    } else {
        challenge.participants.forEach(p => {
            if (p.type === 'team') {
                p.members.forEach(username => {
                    const user = users.find(u => u.username === username);
                    if (user) {
                        user.totalPoints += p.bet;
                        user.challengesCompleted += 1;
                    }
                });
            } else {
                const user = users.find(u => u.username === p.username);
                if (user) {
                    user.totalPoints += p.bet;
                    user.challengesCompleted += 1;
                }
            }
        });

        challenge.results = { winner: null, totalPot: 0, rankings: results, finishedAt: Date.now(), message: 'Tous les participants ont été disqualifiés' };
        challenge.status = 'finished';

        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a été annulé - tous les participants ont triché` }));
        showNotification('Défi annulé - tous les participants disqualifiés');
    }
}

// -------------------- SHOW RESULTS --------------------
function showResults() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if (!challenge || !challenge.results) return;

    const results = challenge.results;
    let html = `
        <h3>🏆 Résultats du défi</h3>
        ${results.message ? `<p>${results.message}</p>` : ''}
        <ol>
            ${results.rankings.map(r => `<li>${r.displayName} - ${r.score} pts ${r.cheated ? '⚠️' : ''}</li>`).join('')}
        </ol>
        ${results.winner ? `<p>🎉 Gagnant : ${results.winner} - Total du pot : ${results.totalPot} pts</p>` : ''}
    `;
    document.getElementById('resultsContent').innerHTML = html;
    document.getElementById('resultsModal').classList.remove('hidden');
}


function closeResultsModal() {
    document.getElementById('resultsModal').classList.add('hidden');
}

// -------------------- LEAVE / DELETE --------------------
function leaveChallenge() {
    if (!confirm('Voulez-vous vraiment quitter ce défi ?')) return;

    const challenge = challenges.find(c => String(c.id) === String(currentChallengeId));
    if (!challenge) return;

    // 🔍 Chercher une participation d'équipe
    const teamParticipant = challenge.participants.find(
        p => p.type === 'team' && p.members.includes(currentUser)
    );

    // ================== ÉQUIPE ==================
    if (teamParticipant) {

        if (!isTeamLeader(currentUser, challenge)) {
            return showNotification('Seul le leader peut retirer l’équipe du défi', 'error');
        }

        // 💰 Rembourser chaque membre
        teamParticipant.members.forEach(username => {
            const user = users.find(u => u.username === username);
            if (user) user.totalPoints += teamParticipant.bet;
        });

        // ❌ Retirer l’équipe du défi
        challenge.participants = challenge.participants.filter(
            p => p.teamId !== teamParticipant.teamId
        );

        showNotification('Équipe retirée du défi, mises remboursées');
    }

    // ================== SOLO ==================
    else {
        const soloParticipant = challenge.participants.find(
            p => p.type === 'player' && p.username === currentUser
        );

        if (!soloParticipant) return;

        // 💰 Remboursement
        const user = users.find(u => u.username === currentUser);
        if (user) user.totalPoints += soloParticipant.bet;

        // ❌ Retirer le joueur
        challenge.participants = challenge.participants.filter(
            p => p.username !== currentUser
        );

        showNotification('Vous avez quitté le défi, mise remboursée');
    }

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
}

function refundAllBets(challenge) {
    challenge.participants.forEach(p => {

        // 👤 Joueur solo
        if (p.type === 'player') {
            const user = users.find(u => u.username === p.username);
            if (user && p.usedPoints !== undefined) {
                user.totalPoints += p.usedPoints; // Rembourser les points utilisés
            }
        }

        // 👥 Équipe
        if (p.type === 'team') {
            p.members.forEach(username => {
                const user = users.find(u => u.username === username);
                if (user && p.usedPoints[username] !== undefined) {
                    console.log(p.usedPoints[username])
                    user.totalPoints += p.usedPoints[username]; // Rembourser les points utilisés
                }
            });
        }
    });
}



function deleteChallenge() {
    if (!confirm('Supprimer ce défi ? Cette action est irréversible !')) return;

    const index = challenges.findIndex(c => c.id === currentChallengeId);
    if (index === -1) return;

    const challenge = challenges[index];

    // 🗑️ Suppression du défi
    challenges.splice(index, 1);
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));

    if (challenge.status === "finished") {
        showNotification('Défi supprimé');
    }else {
        showNotification('Défi supprimé et mises remboursées');
        // 🔄 Remboursement des mises
        if (challenge.participants && challenge.participants.length > 0) {
            refundAllBets(challenge)
            ws.send(JSON.stringify({ type: 'updateUsers', users }));
        }
    }    

    setTimeout(() => window.location.href = 'challenges.html', 800);
}


// -------------------- JOIN CHALLENGE --------------------
function openJoinModal(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    selectedChallengeForJoin = challengeId;
    document.getElementById('joinChallengeName').textContent = challenge.name;

    const teamSection = document.getElementById('teamSelectionSection');
    const teamSelect = document.getElementById('teamSelect');

    if (challenge.teamFormat === "team") {
        teamSection.classList.remove('hidden');
        
        // On récupère les équipes de l'utilisateur qui ne sont pas déjà inscrites au défi
        const userTeams = teams.filter(t =>
            t.members.includes(currentUser) &&
            !challenge.participants.some(p => p.type === 'team' && p.teamId === t.id)
        );

        if(userTeams.length === 0){
            showNotification('Vous devez faire partie d\'une équipe pour rejoindre ce défi', 'error');
            return;
        }

        teamSelect.innerHTML = userTeams
            .map(t => `<option value="${t.id}">${t.name}</option>`)
            .join('');
    } else {
        teamSection.classList.add('hidden');
    }


    document.getElementById('minBet').textContent = challenge.minBet;
    document.getElementById('maxBet').textContent = challenge.maxBet;

    if (challenge.password) document.getElementById('passwordSection').classList.remove('hidden');
    else document.getElementById('passwordSection').classList.add('hidden');

    document.getElementById('joinModal').classList.remove('hidden');
}

function closeJoinModal() {
    document.getElementById('joinModal').classList.add('hidden');
    selectedChallengeForJoin = null;
}

function confirmJoin() {
    if (!selectedChallengeForJoin) return;

    const challenge = challenges.find(c => String(c.id) === String(selectedChallengeForJoin));
    if (!challenge) return;

    let participant = { username: currentUser, type: 'player', bet: 0, modifier: 0, usedPoints: 0 };

    if (challenge.teamFormat === "team") {
        const teamId = document.getElementById('teamSelect').value;

        const team = teams.find(t => t.id === teamId && t.members.includes(currentUser));
        if (!team) return showNotification('Équipe invalide', 'error');

        const isLeader = team.isLeader || team.members[0] === currentUser;
        if (!isLeader) return showNotification('Seul le leader peut inscrire l’équipe', 'error');

        participant = {
            teamId: team.id,
            teamName: team.name,
            type: 'team',
            members: team.members,
            bet: 0,
            modifier: 0,
            isLeader: true,
            usedPoints: Object.fromEntries(
                team.members.map(u => [u, 0])
            )
        };
    }

    const betAmount = parseInt(document.getElementById('betAmount').value);

    if (isNaN(betAmount) || betAmount < challenge.minBet || betAmount > challenge.maxBet) {
        return showNotification('Mise invalide', 'error');
    }
    participant.bet = betAmount;
    if (challenge.password) {
        const pass = document.getElementById('joinPassword').value;
        if (pass !== challenge.password) return showNotification('Mot de passe incorrect', 'error');
    }

    if (participant.type === 'team') {
        if (participant.members.length < challenge.teamConfig.minPlayersPerTeam) return showNotification("Pas assez de membres dans l'équipe", 'error');

        for (const username of participant.members) {
            const user = users.find(u => u.username === username);
            if (!user || user.totalPoints < betAmount) {
                return showNotification(`Le membre ${username} n'a pas assez de points pour miser`, 'error');
            }
        }
        // Déduire les points et stocker les points initiaux
        participant.members.forEach(username => {
            const user = users.find(u => u.username === username);
            if(user) {
                participant.usedPoints[username] += betAmount;
                user.totalPoints -= betAmount;
            }
        });
    } else {
        const user = users.find(u => u.username === currentUser);
        if (!user || user.totalPoints < betAmount) {
            return showNotification(`Vous n'avez pas assez de points pour miser`, 'error');
        }
        participant.usedPoints += betAmount;
        user.totalPoints -= betAmount;
    }

    challenge.participants.push(participant);

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));

    closeJoinModal();
    showNotification('Vous avez rejoint le défi');
}
