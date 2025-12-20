let currentFilters = {
    status: 'all',
    type: 'all',
    format: 'all'
};

let selectedChallengeForJoin = null;

function updatePageData() {
    console.log('updatePageData called, challenges:', challenges);
    renderChallenges();
}

// Filtres
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, challenges:', challenges);
    
    document.getElementById('filterStatus').addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        renderChallenges();
    });

    document.getElementById('filterFormat').addEventListener('change', (e) => {
        currentFilters.format = e.target.value;
        renderChallenges();
    });

    document.getElementById('filterTeamFormat').addEventListener('change', (e) => {
        currentFilters.type = e.target.value;
        renderChallenges();
    });
    
    // Render initial challenges
    renderChallenges();
});

function renderChallenges() {
    console.log('renderChallenges called');
    const list = document.getElementById('challengesList');
    
    if(!list) {
        console.error('challengesList element not found');
        return;
    }
    
    if(!challenges || challenges.length === 0) {
        console.log('No challenges found');
        list.innerHTML = '<p class="empty-state">Aucun défi disponible</p>';
        return;
    }
    
    console.log('Filtering challenges, total:', challenges.length);
    
    let filtered = challenges.filter(c => {
        // Filtre statut
        if (currentFilters.status !== 'all' && c.status !== currentFilters.status) {
            return false;
        }
        // Filtre format de défi (tournoi, course, etc.)
        if (currentFilters.format !== 'all' && c.format !== currentFilters.format) {
            return false;
        }
        // Filtre SOLO / ÉQUIPE
        if (currentFilters.type !== 'all') {
            if (currentFilters.type === 'solo' && c.teamFormat !== 'solo') return false;
            if (currentFilters.type === 'team' && c.teamFormat !== 'team') return false;
        }
        return true;
    });


    console.log('Filtered challenges:', filtered.length);
    
    if(filtered.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucun défi trouvé</p>';
        return;
    }
    
    list.innerHTML = filtered.map(challenge => {
        const currentUserData = users.find(u => u.username === currentUser);
        const currentOrganizerData = users.find(u => u.username === challenge.organizer);
        
        // Vérifier si l'utilisateur ou son équipe participe
        let isParticipant = false;
        let participantType = null;
        
        if(challenge.teamFormat === 'team') {
            // Défi en équipe : vérifier si une équipe de l'utilisateur participe
            isParticipant = challenge.participants.some(
                p => p.username === currentUser || (p.type === 'team' && p.members.some(user => user.username === currentUser))
            );
            participantType = 'team';
        } else {
            // Défi solo : vérifier si l'utilisateur participe
            isParticipant = challenge.participants && challenge.participants.some(p => 
                p.type === 'player' && p.username === currentUser
            );
            participantType = 'player';
        }
        
        const canJoin = !isParticipant && challenge.status === 'waiting' && ((!challenge.cheatersAllowed && currentUserData.cheated.length < 3) || challenge.organizer === currentUser);

        return `
            <div class="challenge-card">
                <div onclick="window.location.href='challenge-detail.html?id=${challenge.id}'">
                    <h3>${challenge.name}</h3>
                    <p><strong>Jeu:</strong> ${challenge.game}</p>
                    <div class="challenge-meta">
                        <span class="badge type">${challenge.teamFormat === 'team' ? 'Équipe' : 'Solo'}</span>
                        <span class="badge format">${getFormatText(challenge.format)}</span>
                        ${getStatusBadge(challenge.status)}
                        <span class="badge">Mise: ${challenge.minBet}-${challenge.maxBet} pts</span>
                    </div>
                    <p style="margin-top: 0.5rem; color: var(--gray);">
                        ${challenge.participants ? challenge.participants.length : 0} participant(s) • Organisé par ${challenge.organizer} ${currentOrganizerData.cheated.length >= 3 ? '⚠️' : ''}
                    </p>
                </div>
                <div class="challenge-actions">
                    ${canJoin ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation(); openJoinModal('${challenge.id}')">Rejoindre</button>` : ''}
                    ${isParticipant ? '<span style="color: var(--success); font-weight: 600;">✓ Inscrit</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
    
    console.log('Challenges rendered');
}
