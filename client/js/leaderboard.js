function updatePageData() {
    renderLeaderboard();
}

function renderLeaderboard() {
    const sortedUsers = [...users].sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Podium
    if(sortedUsers.length >= 1) {
        const place1 = document.getElementById('place1');
        place1.querySelector('h3').textContent = sortedUsers[0].username;
        place1.querySelector('p').textContent = `${sortedUsers[0].totalPoints} pts`;
    }
    
    if(sortedUsers.length >= 2) {
        const place2 = document.getElementById('place2');
        place2.querySelector('h3').textContent = sortedUsers[1].username;
        place2.querySelector('p').textContent = `${sortedUsers[1].totalPoints} pts`;
    }
    
    if(sortedUsers.length >= 3) {
        const place3 = document.getElementById('place3');
        place3.querySelector('h3').textContent = sortedUsers[2].username;
        place3.querySelector('p').textContent = `${sortedUsers[2].totalPoints} pts`;
    }
    
    // Tableau
    const tbody = document.getElementById('leaderboardBody');
    
    if(sortedUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Aucun joueur</td></tr>';
        return;
    }
    
    tbody.innerHTML = sortedUsers.map((user, index) => {
        const userChallenges = challenges.filter(c => 
            c.participants.some(p => p.username === user.username)
        ).length;
        
        return `
            <tr ${user.username === currentUser ? 'style="background: var(--light); font-weight: 600;"' : ''}>
                <td class="rank-cell">#${index + 1}</td>
                <td>${user.username}${user.cheated ? ' ⚠️' : ''}${user.username === currentUser ? ' (Vous)' : ''}</td>
                <td style="font-weight: bold; color: var(--warning);">${user.totalPoints} pts</td>
                <td>${userChallenges}</td>
            </tr>
        `;
    }).join('');
}
