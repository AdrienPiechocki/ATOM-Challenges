let currentFilters = {
    status: 'all',
    type: 'all',
    format: 'all'
};

let selectedChallengeForJoin = null;

function updatePageData() {
    renderChallenges();
}

// Filtres
document.getElementById('filterStatus').addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    renderChallenges();
});

document.getElementById('filterFormat').addEventListener('change', (e) => {
    currentFilters.format = e.target.value;
    renderChallenges();
});

function renderChallenges() {
    const list = document.getElementById('challengesList');
    
    if(!challenges || challenges.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucun défi disponible</p>';
        return;
    }
    
    let filtered = challenges.filter(c => {
        if(currentFilters.status !== 'all' && c.status !== currentFilters.status) return false;
        if(currentFilters.format !== 'all' && c.format !== currentFilters.format) return false;
        return true;
    });
    
    if(filtered.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucun défi trouvé</p>';
        return;
    }
    
    list.innerHTML = filtered.map(challenge => {
        const isParticipant = challenge.participants && challenge.participants.some(p => p.username === currentUser);
        const canJoin = !isParticipant && challenge.status === 'waiting';
        
        return `
            <div class="challenge-card">
                <div onclick="window.location.href='challenge-detail.html?id=${challenge.id}'">
                    <h3>${challenge.name}</h3>
                    <p><strong>Jeu:</strong> ${challenge.game}</p>
                    <div class="challenge-meta">
                        <span class="badge type">${challenge.teamFormat || 'Solo'}</span>
                        <span class="badge format">${getFormatText(challenge.format)}</span>
                        ${getStatusBadge(challenge.status)}
                        <span class="badge">Mise: ${challenge.minBet}-${challenge.maxBet} pts</span>
                    </div>
                    <p style="margin-top: 0.5rem; color: var(--gray);">
                        ${challenge.participants ? challenge.participants.length : 0} participant(s) • Organisé par ${challenge.organizer}
                    </p>
                </div>
                <div class="challenge-actions">
                    ${canJoin ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation(); openJoinModal('${challenge.id}')">Rejoindre</button>` : ''}
                    ${isParticipant ? '<span style="color: var(--success); font-weight: 600;">✓ Inscrit</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

function openJoinModal(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if(!challenge) return;
    
    selectedChallengeForJoin = challengeId;
    
    document.getElementById('joinChallengeName').textContent = challenge.name;
    document.getElementById('minBet').textContent = challenge.minBet;
    document.getElementById('maxBet').textContent = challenge.maxBet;
    document.getElementById('betAmount').value = challenge.minBet;
    document.getElementById('betAmount').min = challenge.minBet;
    document.getElementById('betAmount').max = challenge.maxBet;
    
    if(challenge.visibility === 'password') {
        document.getElementById('passwordSection').classList.remove('hidden');
    } else {
        document.getElementById('passwordSection').classList.add('hidden');
    }
    
    document.getElementById('joinModal').classList.remove('hidden');
}

function closeJoinModal() {
    document.getElementById('joinModal').classList.add('hidden');
    selectedChallengeForJoin = null;
    document.getElementById('joinPassword').value = '';
    document.getElementById('betAmount').value = '';
}

function confirmJoin() {
    const challenge = challenges.find(c => c.id === selectedChallengeForJoin);
    const user = users.find(u => u.username === currentUser);
    
    if(!challenge || !user) return;
    
    if(challenge.visibility === 'password') {
        const password = document.getElementById('joinPassword').value;
        if(password !== challenge.password) {
            showNotification('Mot de passe incorrect', 'error');
            return;
        }
    }
    
    const bet = parseInt(document.getElementById('betAmount').value);
    
    if(isNaN(bet) || bet < challenge.minBet || bet > challenge.maxBet) {
        showNotification('Mise invalide', 'error');
        return;
    }
    
    if(bet > user.totalPoints) {
        showNotification('Vous n\'avez pas assez de points', 'error');
        return;
    }
    
    // Initialiser participants si nécessaire
    if(!challenge.participants) challenge.participants = [];
    
    challenge.participants.push({
        username: currentUser,
        bet: bet,
        score: 0,
        modifier: 0,
        multiplier: 1
    });
    
    user.totalPoints -= bet;
    
    // Initialiser progressions si nécessaire
    if(!challenge.progressions) challenge.progressions = {};
    challenge.progressions[currentUser] = {
        submissions: [],
        score: 0,
        validated: 0,
        rejected: 0,
        cheated: false
    };
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} a rejoint le défi "${challenge.name}"` }));
    
    closeJoinModal();
    showNotification('Vous avez rejoint le défi !');
}
