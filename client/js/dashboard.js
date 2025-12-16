function updatePageData() {
    updateStats();
    updateMyChallenges();
    updateRecentChallenges();
}

function updateStats() {
    const user = users.find(u => u.username === currentUser);
    if(!user) return;
    
    const myChallenges = challenges.filter(c => 
        c.participants.some(p => p.username === currentUser)
    );
    
    const active = myChallenges.filter(c => c.status === 'active').length;
    const waiting = myChallenges.filter(c => c.status === 'waiting').length;
    const completed = myChallenges.filter(c => c.status === 'completed').length;
    
    document.getElementById('welcomeName').textContent = currentUser;
    document.getElementById('activeChallenges').textContent = active;
    document.getElementById('waitingChallenges').textContent = waiting;
    document.getElementById('completedChallenges').textContent = completed;
    document.getElementById('totalPoints').textContent = user.totalPoints;
}

function updateMyChallenges() {
    const list = document.getElementById('myChallengesList');
    const myChallenges = challenges.filter(c => 
        c.participants.some(p => p.username === currentUser) && 
        (c.status === 'waiting' || c.status === 'active')
    );
    
    if(myChallenges.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucun défi en cours</p>';
        return;
    }
    
    list.innerHTML = myChallenges.map(challenge => `
        <div class="challenge-card" onclick="window.location.href='challenge-detail.html?id=${challenge.id}'">
            <h3>${challenge.name}</h3>
            <p><strong>Jeu:</strong> ${challenge.game}</p>
            <div class="challenge-meta">
                <span class="badge type">${challenge.type}</span>
                <span class="badge format">${getFormatText(challenge.format)}</span>
                ${getStatusBadge(challenge.status)}
            </div>
            <p style="margin-top: 0.5rem; color: var(--gray);">
                ${challenge.participants.length} participant(s)
            </p>
        </div>
    `).join('');
}

function updateRecentChallenges() {
    const list = document.getElementById('recentChallengesList');
    const recentChallenges = challenges
        .filter(c => !c.participants.some(p => p.username === currentUser))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);
    
    if(recentChallenges.length === 0) {
        list.innerHTML = '<p class="empty-state">Aucun défi récent</p>';
        return;
    }
    
    list.innerHTML = recentChallenges.map(challenge => `
        <div class="challenge-card" onclick="window.location.href='challenge-detail.html?id=${challenge.id}'">
            <h3>${challenge.name}</h3>
            <p><strong>Jeu:</strong> ${challenge.game}</p>
            <div class="challenge-meta">
                <span class="badge type">${challenge.type}</span>
                <span class="badge format">${getFormatText(challenge.format)}</span>
                ${getStatusBadge(challenge.status)}
            </div>
            <p style="margin-top: 0.5rem; color: var(--gray);">
                ${challenge.participants.length} participant(s)
            </p>
        </div>
    `).join('');
}
