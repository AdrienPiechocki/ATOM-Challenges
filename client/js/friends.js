function updatePageData() {
    renderFriends();
}

function renderFriends() {
    const currentUserData = users.find(u => u.username === currentUser);
    if(!currentUserData) return;
    
    // Demandes en attente
    const pendingRequests = currentUserData.friendRequests || [];
    document.getElementById('pendingCount').textContent = pendingRequests.length;
    
    const pendingDiv = document.getElementById('pendingRequests');
    if(pendingRequests.length === 0) {
        pendingDiv.innerHTML = '<p class="empty-state">Aucune demande en attente</p>';
    } else {
        pendingDiv.innerHTML = pendingRequests.map(username => {
            const user = users.find(u => u.username === username);
            if(!user) return '';
            
            return `
                <div class="friend-card">
                    <div class="friend-info">
                        <span class="friend-name">${user.username}</span>
                        <span class="friend-points">💰 ${user.totalPoints} pts</span>
                    </div>
                    <div class="friend-actions">
                        <button class="btn btn-success btn-sm" onclick="acceptFriend('${username}')">✓ Accepter</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectFriend('${username}')">✗ Refuser</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Liste d'amis
    const friends = currentUserData.friends || [];
    document.getElementById('friendsCount').textContent = friends.length;
    
    const friendsDiv = document.getElementById('friendsList');
    if(friends.length === 0) {
        friendsDiv.innerHTML = '<p class="empty-state">Aucun ami pour le moment</p>';
    } else {
        friendsDiv.innerHTML = friends.map(username => {
            const user = users.find(u => u.username === username);
            if(!user) return '';
            
            return `
                <div class="friend-card">
                    <div class="friend-info">
                        <span class="friend-name">${user.username}</span>
                        <span class="friend-points">💰 ${user.totalPoints} pts</span>
                    </div>
                    <div class="friend-actions">
                        <button class="btn btn-danger btn-sm" onclick="removeFriend('${username}')">Retirer</button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function searchUsers() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if(!query) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    const currentUserData = users.find(u => u.username === currentUser);
    const friends = currentUserData.friends || [];
    const sentRequests = currentUserData.sentRequests || [];
    
    const results = users.filter(u => 
        u.username.toLowerCase().includes(query) && 
        u.username !== currentUser
    );
    
    if(results.length === 0) {
        resultsDiv.innerHTML = '<p class="empty-state">Aucun utilisateur trouvé</p>';
        return;
    }
    
    resultsDiv.innerHTML = results.map(user => {
        const isFriend = friends.includes(user.username);
        const requestSent = sentRequests.includes(user.username);
        
        let actionButton = '';
        if(isFriend) {
            actionButton = '<span style="color: var(--success); font-weight: 600;">✓ Ami</span>';
        } else if(requestSent) {
            actionButton = '<span style="color: var(--warning); font-weight: 600;">⏳ Demande envoyée</span>';
        } else {
            actionButton = `<button class="btn btn-primary btn-sm" onclick="sendFriendRequest('${user.username}')">+ Ajouter</button>`;
        }
        
        return `
            <div class="friend-card">
                <div class="friend-info">
                    <span class="friend-name">${user.username}</span>
                    <span class="friend-points">💰 ${user.totalPoints} pts</span>
                </div>
                <div class="friend-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    }).join('');
}

function sendFriendRequest(username) {
    const currentUserData = users.find(u => u.username === currentUser);
    const targetUser = users.find(u => u.username === username);
    
    if(!currentUserData || !targetUser) return;
    
    if(!currentUserData.sentRequests) currentUserData.sentRequests = [];
    if(!targetUser.friendRequests) targetUser.friendRequests = [];
    
    currentUserData.sentRequests.push(username);
    targetUser.friendRequests.push(currentUser);
    
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'notification', text: `Demande d'ami envoyée à ${username}` }));
    
    showNotification(`Demande d'ami envoyée à ${username}`);
    searchUsers();
}

function acceptFriend(username) {
    const currentUserData = users.find(u => u.username === currentUser);
    const targetUser = users.find(u => u.username === username);
    
    if(!currentUserData || !targetUser) return;
    
    if(!currentUserData.friends) currentUserData.friends = [];
    if(!targetUser.friends) targetUser.friends = [];
    
    currentUserData.friends.push(username);
    targetUser.friends.push(currentUser);
    
    currentUserData.friendRequests = currentUserData.friendRequests.filter(u => u !== username);
    targetUser.sentRequests = (targetUser.sentRequests || []).filter(u => u !== currentUser);
    
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} et ${username} sont maintenant amis !` }));
    
    showNotification(`Vous êtes maintenant ami avec ${username}`);
}

function rejectFriend(username) {
    const currentUserData = users.find(u => u.username === currentUser);
    const targetUser = users.find(u => u.username === username);
    
    if(!currentUserData || !targetUser) return;
    
    currentUserData.friendRequests = currentUserData.friendRequests.filter(u => u !== username);
    targetUser.sentRequests = (targetUser.sentRequests || []).filter(u => u !== currentUser);
    
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    
    showNotification('Demande refusée');
}

function removeFriend(username) {
    if(!confirm(`Êtes-vous sûr de vouloir retirer ${username} de vos amis ?`)) return;
    
    const currentUserData = users.find(u => u.username === currentUser);
    const targetUser = users.find(u => u.username === username);
    
    if(!currentUserData || !targetUser) return;
    
    currentUserData.friends = currentUserData.friends.filter(u => u !== username);
    targetUser.friends = targetUser.friends.filter(u => u !== currentUser);
    
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    
    showNotification(`${username} a été retiré de vos amis`);
}

document.getElementById('searchInput').addEventListener('input', searchUsers);
