let ws;
let currentUser = null;
let token = null;
let challenges = [];
let users = [];
let messages = {};

// Vérifier l'authentification
function checkAuth() {
    token = localStorage.getItem('token');
    currentUser = localStorage.getItem('username');
    
    if(!token || !currentUser) {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// Déconnexion
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    if(ws) ws.close();
    window.location.href = 'index.html';
}

// Connexion WebSocket
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('WebSocket connecté');
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket déconnecté');
        setTimeout(connectWebSocket, 3000);
    };
}

// Gérer les messages WebSocket
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'init':
            challenges = data.challenges;
            users = data.users;
            messages = data.messages;
            updateUserInfo();
            if(typeof updatePageData === 'function') {
                updatePageData();
            }
            break;
        case 'updateChallenges':
            challenges = data.challenges;
            if(typeof updatePageData === 'function') {
                updatePageData();
            }
            break;
        case 'updateUsers':
            users = data.users;
            updateUserInfo();
            if(typeof updatePageData === 'function') {
                updatePageData();
            }
            break;
        case 'newMessage':
            if(!messages[data.challengeId]) messages[data.challengeId] = [];
            messages[data.challengeId].push(data.message);
            if(typeof updateChat === 'function') {
                updateChat();
            }
            break;
        case 'notification':
            showNotification(data.text);
            break;
    }
}

// Mettre à jour les infos utilisateur dans la navbar
function updateUserInfo() {
    const user = users.find(u => u.username === currentUser);
    if(user) {
        const userPointsEl = document.getElementById('userPoints');
        const userNameEl = document.getElementById('userName');
        
        if(userPointsEl) userPointsEl.textContent = `💰 ${user.totalPoints} pts`;
        if(userNameEl) userNameEl.textContent = user.username;
    }
}

// Notifications
function showNotification(text, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = text;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Formater la date
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Obtenir le badge de statut
function getStatusBadge(status) {
    const badges = {
        waiting: '<span class="badge status-waiting">⏳ En attente</span>',
        active: '<span class="badge status-active">🎮 En cours</span>',
        completed: '<span class="badge status-completed">✅ Terminé</span>'
    };
    return badges[status] || '';
}

// Obtenir le texte du format
function getFormatText(format) {
    const formats = {
        tournoi: 'Tournoi',
        course: 'Course',
        marathon: 'Marathon',
        bingo: 'Bingo'
    };
    return formats[format] || format;
}

// Obtenir la description du format
function getFormatDescription(format) {
    const descriptions = {
        tournoi: 'Affrontement direct entre les joueurs selon un tirage au sort ou une phase de poule.',
        course: 'Le premier à remporter le défi remporte le plus de points, avec des modificateurs pour les écarts de temps.',
        marathon: 'Les joueurs ont plusieurs objectifs à accomplir en un temps donné fixe.',
        bingo: 'Les joueurs doivent compléter une grille de Bingo correspondant à divers objectifs en jeu.'
    };
    return descriptions[format] || '';
}

// Initialiser la page
if(checkAuth()) {
    connectWebSocket();
}
