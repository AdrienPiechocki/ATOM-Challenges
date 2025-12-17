let teams = [];



const originalHandleMessage = window.handleWebSocketMessage;
window.handleWebSocketMessage = function(data) {
    originalHandleMessage(data);
    _handleWebSocketMessage(data);
};

function _handleWebSocketMessage(data) {
    if(data.type === 'init') {
        teams = data.teams || [];
    } else if(data.type === 'updateTeams') {
        teams = data.teams;
    }
    
    if(typeof updatePageData === 'function') {
        updatePageData();
    }
}

function updatePageData() {
    renderTeams();
}

function renderTeams() {
    const myTeams = teams.filter(t => t.members.includes(currentUser));
    const otherTeams = teams.filter(t => !t.members.includes(currentUser));
    
    // Mes équipes
    const myTeamsDiv = document.getElementById('myTeamsList');
    if(myTeams.length === 0) {
        myTeamsDiv.innerHTML = '<p class="empty-state">Vous n\'êtes dans aucune équipe</p>';
    } else {
        myTeamsDiv.innerHTML = myTeams.map(team => renderTeamCard(team, true)).join('');
    }
    
    // Toutes les équipes
    const allTeamsDiv = document.getElementById('allTeamsList');
    if(otherTeams.length === 0) {
        allTeamsDiv.innerHTML = '<p class="empty-state">Aucune équipe disponible</p>';
    } else {
        allTeamsDiv.innerHTML = otherTeams.map(team => renderTeamCard(team, false)).join('');
    }
}

function renderTeamCard(team, isMember) {
    const isFull = team.members.length >= team.maxMembers;
    const isLeader = team.leader === currentUser;
    
    // Vérifier si le chef de l'équipe est un ami
    const currentUserData = users.find(u => u.username === currentUser);
    const isFriend = currentUserData && currentUserData.friends && currentUserData.friends.includes(team.leader);
    const canJoin = !isMember && !isFull && isFriend;
    
    return `
        <div class="team-card" onclick="openTeamDetail('${team.id}')">
            <div class="team-header">
                <div class="team-name">${team.name}</div>
                <div class="team-tag">${team.tag}</div>
            </div>
            <div class="team-leader">👑 Chef: ${team.leader}</div>
            <div class="team-members">
                👥 ${team.members.length}/${team.maxMembers} membres
            </div>
            <div class="team-actions" onclick="event.stopPropagation()">
                ${canJoin ? `<button class="btn btn-success btn-sm" onclick="joinTeam('${team.id}')">Rejoindre</button>` : ''}
                ${!isMember && !isFull && !isFriend ? `<span style="color: var(--gray); font-size: 0.875rem;">🔒 Ami requis</span>` : ''}
                ${isMember && !isLeader ? `<button class="btn btn-danger btn-sm" onclick="leaveTeam('${team.id}')">Quitter</button>` : ''}
                ${isLeader ? `<button class="btn btn-danger btn-sm" onclick="deleteTeam('${team.id}')">Supprimer</button>` : ''}
            </div>
        </div>
    `;
}

function openCreateTeamModal() {
    document.getElementById('createTeamModal').classList.remove('hidden');
}

function closeCreateTeamModal() {
    document.getElementById('createTeamModal').classList.add('hidden');
    document.getElementById('createTeamForm').reset();
}

document.getElementById('createTeamForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('teamName').value;
    const tag = document.getElementById('teamTag').value.toUpperCase();
    const maxMembers = parseInt(document.getElementById('teamMaxMembers').value);
    
    // Vérifier si le tag existe déjà
    if(teams.some(t => t.tag === tag)) {
        showNotification('Ce tag est déjà utilisé', 'error');
        return;
    }
    
    const newTeam = {
        id: '_' + Math.random().toString(36).substr(2, 9),
        name: name,
        tag: tag,
        leader: currentUser,
        members: [currentUser],
        maxMembers: maxMembers,
        createdAt: Date.now()
    };
    
    teams.push(newTeam);
    ws.send(JSON.stringify({ type: 'updateTeams', teams }));
    
    closeCreateTeamModal();
    showNotification('Équipe créée avec succès !');
});

function joinTeam(teamId) {
    const team = teams.find(t => t.id === teamId);
    if(!team) return;
    
    if(team.members.length >= team.maxMembers) {
        showNotification('Cette équipe est complète', 'error');
        return;
    }
    
    if(team.members.includes(currentUser)) {
        showNotification('Vous êtes déjà dans cette équipe', 'error');
        return;
    }
    
    // Vérifier si le chef de l'équipe est un ami
    const currentUserData = users.find(u => u.username === currentUser);
    if(!currentUserData || !currentUserData.friends || !currentUserData.friends.includes(team.leader)) {
        showNotification('Vous devez être ami avec le chef de l\'équipe pour la rejoindre', 'error');
        return;
    }
    
    team.members.push(currentUser);
    ws.send(JSON.stringify({ type: 'updateTeams', teams }));
    
    showNotification(`Vous avez rejoint l'équipe ${team.name}`);
}

function leaveTeam(teamId) {
    if(!confirm('Êtes-vous sûr de vouloir quitter cette équipe ?')) return;
    
    const team = teams.find(t => t.id === teamId);
    if(!team) return;
    
    team.members = team.members.filter(m => m !== currentUser);
    
    // Si le chef quitte, promouvoir un autre membre ou supprimer l'équipe
    if(team.leader === currentUser) {
        if(team.members.length > 0) {
            team.leader = team.members[0];
            showNotification(`${team.members[0]} est maintenant le chef de l'équipe`);
        } else {
            teams = teams.filter(t => t.id !== teamId);
            showNotification('L\'équipe a été supprimée');
        }
    }
    
    ws.send(JSON.stringify({ type: 'updateTeams', teams }));
    showNotification('Vous avez quitté l\'équipe');
}

function deleteTeam(teamId) {
    if(!confirm('Êtes-vous sûr de vouloir supprimer cette équipe ?')) return;
    
    teams = teams.filter(t => t.id !== teamId);
    ws.send(JSON.stringify({ type: 'updateTeams', teams }));
    
    showNotification('Équipe supprimée');
}

function openTeamDetail(teamId) {
    const team = teams.find(t => t.id === teamId);
    if(!team) return;
    
    const isLeader = team.leader === currentUser;
    const isMember = team.members.includes(currentUser);
    
    const content = `
        <h3>${team.name} [${team.tag}]</h3>
        <div style="margin: 1.5rem 0;">
            <h4 style="color: var(--primary); margin-bottom: 0.5rem;">Chef d'équipe</h4>
            <p>👑 ${team.leader}</p>
        </div>
        <div style="margin: 1.5rem 0;">
            <h4 style="color: var(--primary); margin-bottom: 0.5rem;">Membres (${team.members.length}/${team.maxMembers})</h4>
            <div class="friends-list">
                ${team.members.map(member => {
                    const user = users.find(u => u.username === member);
                    return `
                        <div class="friend-card">
                            <div class="friend-info">
                                <span class="friend-name">${member}${member === team.leader ? ' 👑' : ''}</span>
                                ${user ? `<span class="friend-points">💰 ${user.totalPoints} pts</span>` : ''}
                            </div>
                            ${isLeader && member !== team.leader ? `
                                <button class="btn btn-danger btn-sm" onclick="kickMember('${teamId}', '${member}')">Expulser</button>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('teamDetailContent').innerHTML = content;
    document.getElementById('teamDetailModal').classList.remove('hidden');
}

function closeTeamDetailModal() {
    document.getElementById('teamDetailModal').classList.add('hidden');
}

function kickMember(teamId, username) {
    if(!confirm(`Êtes-vous sûr de vouloir expulser ${username} ?`)) return;
    
    const team = teams.find(t => t.id === teamId);
    if(!team || team.leader !== currentUser) return;
    
    team.members = team.members.filter(m => m !== username);
    ws.send(JSON.stringify({ type: 'updateTeams', teams }));
    
    showNotification(`${username} a été expulsé de l'équipe`);
    closeTeamDetailModal();
}
