let ws;
let currentUser = null;
let token = null;
let challenges = [];
let users = [];
let messages = {};
let selectedChallengeId = null;
let selectedParticipant = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('token');
    const savedUsername = localStorage.getItem('username');
    
    if(savedToken && savedUsername) {
        token = savedToken;
        currentUser = savedUsername;
        showApp();
        connectWebSocket();
    }
    
    document.getElementById('challengeForm').addEventListener('submit', createChallenge);
});

// Authentification
async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if(!username || !password) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if(response.ok) {
            showNotification('Inscription réussie ! Connectez-vous maintenant.');
        } else {
            showNotification(data.error || 'Erreur lors de l\'inscription', 'error');
        }
    } catch(error) {
        showNotification('Erreur de connexion au serveur', 'error');
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if(!username || !password) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if(response.ok) {
            token = data.token;
            currentUser = data.username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', currentUser);
            showApp();
            connectWebSocket();
            showNotification('Connexion réussie !');
        } else {
            showNotification(data.error || 'Erreur lors de la connexion', 'error');
        }
    } catch(error) {
        showNotification('Erreur de connexion au serveur', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    token = null;
    currentUser = null;
    if(ws) ws.close();
    document.getElementById('auth').style.display = 'block';
    document.getElementById('app').style.display = 'none';
    showNotification('Déconnexion réussie');
}

function showApp() {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'grid';
    updateUserInfo();
}

// WebSocket
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('WebSocket connecté');
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'init':
                challenges = data.challenges;
                users = data.users;
                messages = data.messages;
                updateUI();
                break;
            case 'updateChallenges':
                challenges = data.challenges;
                renderChallenges();
                updateChatSelect();
                break;
            case 'updateUsers':
                users = data.users;
                updateUserInfo();
                renderLeaderboard();
                break;
            case 'newMessage':
                if(!messages[data.challengeId]) messages[data.challengeId] = [];
                messages[data.challengeId].push(data.message);
                if(selectedChallengeId === data.challengeId) {
                    renderChat();
                }
                break;
            case 'notification':
                showNotification(data.text);
                break;
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showNotification('Erreur de connexion temps réel', 'error');
    };
    
    ws.onclose = () => {
        console.log('WebSocket déconnecté');
        setTimeout(connectWebSocket, 3000);
    };
}

// UI Updates
function updateUI() {
    updateUserInfo();
    renderChallenges();
    renderLeaderboard();
    updateChatSelect();
}

function updateUserInfo() {
    const user = users.find(u => u.username === currentUser);
    if(user) {
        const userInfoHTML = `
            <div class="user-info">
                <h2>Bienvenue, ${user.username} !</h2>
                <div class="points">💰 ${user.totalPoints} points</div>
                <button onclick="logout()">Déconnexion</button>
            </div>
        `;
        
        const existingInfo = document.querySelector('.user-info');
        if(existingInfo) {
            existingInfo.outerHTML = userInfoHTML;
        } else {
            document.getElementById('app').insertAdjacentHTML('afterbegin', userInfoHTML);
        }
    }
}

// Création de défi
function createChallenge(e) {
    e.preventDefault();
    
    const user = users.find(u => u.username === currentUser);
    if(!user) return;
    
    const challengeName = document.getElementById('challengeName').value;
    const gameName = document.getElementById('gameName').value;
    const typeChallenge = document.getElementById('typeChallenge').value;
    const formatChallenge = document.getElementById('formatChallenge').value;
    const rulesChallenge = document.getElementById('rulesChallenge').value;
    const minPoints = parseInt(document.getElementById('minPoints').value) || 0;
    const maxPoints = parseInt(document.getElementById('maxPoints').value) || 100;
    const visibility = document.getElementById('visibility').value;
    const challengePassword = document.getElementById('challengePassword').value;
    
    const newChallenge = {
        id: '_' + Math.random().toString(36).substr(2, 9),
        name: challengeName,
        game: gameName,
        type: typeChallenge,
        format: formatChallenge,
        rules: rulesChallenge,
        minBet: minPoints,
        maxBet: maxPoints,
        visibility: visibility,
        password: visibility === 'password' ? challengePassword : null,
        organizer: currentUser,
        participants: [{
            username: currentUser,
            bet: 0,
            score: 0,
            modifier: 0,
            multiplier: 1
        }],
        status: 'waiting',
        createdAt: Date.now()
    };
    
    challenges.push(newChallenge);
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    
    document.getElementById('challengeForm').reset();
    showNotification('Défi créé avec succès !');
}

// Affichage des défis
function renderChallenges() {
    const list = document.getElementById('challengeList');
    const user = users.find(u => u.username === currentUser);
    
    if(!challenges.length) {
        list.innerHTML = '<li style="text-align:center; color: #64748b;">Aucun défi disponible</li>';
        return;
    }
    
    list.innerHTML = challenges.map(challenge => {
        const isParticipant = challenge.participants.some(p => p.username === currentUser);
        const isOrganizer = challenge.organizer === currentUser;
        const canJoin = !isParticipant && challenge.status === 'waiting';
        
        return `
            <li class="challenge-item">
                <h3>${challenge.name}</h3>
                <p><strong>Jeu:</strong> ${challenge.game}</p>
                ${challenge.rules ? `<p><strong>Règles:</strong> ${challenge.rules}</p>` : ''}
                <div class="meta">
                    <span class="badge">${challenge.type}</span>
                    <span class="badge format">${challenge.format}</span>
                    <span class="badge visibility">${challenge.visibility}</span>
                    <span class="badge">Mise: ${challenge.minBet}-${challenge.maxBet} pts</span>
                    <span class="badge">Statut: ${challenge.status === 'waiting' ? '⏳ En attente' : challenge.status === 'active' ? '🎮 En cours' : '✅ Terminé'}</span>
                </div>
                <div class="participants">
                    <h4>Participants (${challenge.participants.length}):</h4>
                    <div class="participant-list">
                        ${challenge.participants.map(p => `
                            <span class="participant-tag ${p.username === challenge.organizer ? 'organizer' : ''}" 
                                  onclick="openParticipantModal('${challenge.id}', '${p.username}')">
                                ${p.username === challenge.organizer ? '👑 ' : ''}${p.username}
                                ${p.bet > 0 ? ` (${p.bet} pts)` : ''}
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="actions">
                    ${canJoin ? `<button class="btn-join" onclick="joinChallenge('${challenge.id}')">Rejoindre</button>` : ''}
                    ${isParticipant && !isOrganizer && challenge.status === 'waiting' ? `<button class="btn-leave" onclick="leaveChallenge('${challenge.id}')">Quitter</button>` : ''}
                    ${isOrganizer && challenge.status === 'waiting' ? `<button class="btn-start" onclick="startChallenge('${challenge.id}')">Démarrer</button>` : ''}
                    ${isOrganizer ? `<button class="btn-delete" onclick="deleteChallenge('${challenge.id}')">Supprimer</button>` : ''}
                </div>
            </li>
        `;
    }).join('');
}

// Actions sur les défis
function joinChallenge(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    const user = users.find(u => u.username === currentUser);
    
    if(!challenge || !user) return;
    
    if(challenge.visibility === 'password') {
        const password = prompt('Entrez le mot de passe du défi:');
        if(password !== challenge.password) {
            showNotification('Mot de passe incorrect', 'error');
            return;
        }
    }
    
    const bet = parseInt(prompt(`Combien de points voulez-vous miser ? (${challenge.minBet}-${challenge.maxBet})`));
    
    if(isNaN(bet) || bet < challenge.minBet || bet > challenge.maxBet) {
        showNotification('Mise invalide', 'error');
        return;
    }
    
    if(bet > user.totalPoints) {
        showNotification('Vous n\'avez pas assez de points', 'error');
        return;
    }
    
    challenge.participants.push({
        username: currentUser,
        bet: bet,
        score: 0,
        modifier: 0,
        multiplier: 1
    });
    
    user.totalPoints -= bet;
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} a rejoint le défi "${challenge.name}"` }));
    
    showNotification('Vous avez rejoint le défi !');
}

function leaveChallenge(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    const user = users.find(u => u.username === currentUser);
    
    if(!challenge || !user) return;
    
    const participant = challenge.participants.find(p => p.username === currentUser);
    if(participant) {
        user.totalPoints += participant.bet;
        challenge.participants = challenge.participants.filter(p => p.username !== currentUser);
        
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} a quitté le défi "${challenge.name}"` }));
        
        showNotification('Vous avez quitté le défi');
    }
}

function startChallenge(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if(!challenge) return;
    
    if(challenge.participants.length < 2) {
        showNotification('Il faut au moins 2 participants pour démarrer', 'error');
        return;
    }
    
    challenge.status = 'active';
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a commencé !` }));
    
    showNotification('Défi démarré !');
}

function deleteChallenge(challengeId) {
    if(!confirm('Êtes-vous sûr de vouloir supprimer ce défi ?')) return;
    
    const challenge = challenges.find(c => c.id === challengeId);
    if(!challenge) return;
    
    // Rembourser les participants
    challenge.participants.forEach(p => {
        const user = users.find(u => u.username === p.username);
        if(user) user.totalPoints += p.bet;
    });
    
    challenges = challenges.filter(c => c.id !== challengeId);
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    
    showNotification('Défi supprimé');
}

// Modal participant
function openParticipantModal(challengeId, username) {
    const challenge = challenges.find(c => c.id === challengeId);
    if(!challenge || challenge.organizer !== currentUser) return;
    
    selectedChallengeId = challengeId;
    selectedParticipant = username;
    
    const participant = challenge.participants.find(p => p.username === username);
    
    document.getElementById('participantName').textContent = username;
    document.getElementById('scoreModifier').value = participant.modifier || 0;
    document.getElementById('scoreMultiplier').value = participant.multiplier || 1;
    document.getElementById('participantModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('participantModal').classList.add('hidden');
    selectedChallengeId = null;
    selectedParticipant = null;
}

function applyModifier() {
    const challenge = challenges.find(c => c.id === selectedChallengeId);
    if(!challenge) return;
    
    const participant = challenge.participants.find(p => p.username === selectedParticipant);
    if(!participant) return;
    
    participant.modifier = parseFloat(document.getElementById('scoreModifier').value) || 0;
    participant.multiplier = parseFloat(document.getElementById('scoreMultiplier').value) || 1;
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    
    closeModal();
    showNotification('Modificateurs appliqués');
}

// Classement
function renderLeaderboard() {
    const list = document.getElementById('leaderboard');
    
    const sortedUsers = [...users].sort((a, b) => b.totalPoints - a.totalPoints);
    
    list.innerHTML = sortedUsers.map((user, index) => `
        <li class="leaderboard-item rank-${index + 1}">
            <span class="rank">#${index + 1}</span>
            <span class="username">${user.username}${user.cheated ? ' ⚠️' : ''}</span>
            <span class="points">${user.totalPoints} pts</span>
        </li>
    `).join('');
}

// Chat
function updateChatSelect() {
    const select = document.getElementById('chatChallengeSelect');
    const userChallenges = challenges.filter(c => 
        c.participants.some(p => p.username === currentUser)
    );
    
    select.innerHTML = '<option value="">Sélectionner un défi</option>' + 
        userChallenges.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    select.onchange = (e) => {
        selectedChallengeId = e.target.value;
        renderChat();
    };
}

function renderChat() {
    const chatWindow = document.getElementById('chatWindow');
    
    if(!selectedChallengeId) {
        chatWindow.innerHTML = '<p style="text-align:center; color: #64748b;">Sélectionnez un défi pour voir le chat</p>';
        return;
    }
    
    const challengeMessages = messages[selectedChallengeId] || [];
    
    if(!challengeMessages.length) {
        chatWindow.innerHTML = '<p style="text-align:center; color: #64748b;">Aucun message</p>';
        return;
    }
    
    chatWindow.innerHTML = challengeMessages.map(msg => `
        <div class="chat-message">
            <div>
                <span class="sender">${msg.player}</span>
                <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="text">${msg.text}</div>
        </div>
    `).join('');
    
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if(!text || !selectedChallengeId) return;
    
    ws.send(JSON.stringify({
        type: 'newMessage',
        challengeId: selectedChallengeId,
        player: currentUser,
        text: text
    }));
    
    input.value = '';
}

document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});

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
