let currentChallengeId = null;
let selectedParticipant = null;

// Récupérer l'ID du défi depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
currentChallengeId = urlParams.get('id');

if(!currentChallengeId) {
    window.location.href = 'challenges.html';
}

function updatePageData() {
    renderChallengeDetail();
    updateChat();
}

function renderChallengeDetail() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge) {
        showNotification('Défi introuvable', 'error');
        setTimeout(() => window.location.href = 'challenges.html', 2000);
        return;
    }
    
    const isParticipant = challenge.participants.some(p => p.username === currentUser);
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
    document.getElementById('typeInfo').textContent = challenge.teamFormat || 'Solo';
    document.getElementById('formatInfo').textContent = getFormatText(challenge.format);
    document.getElementById('betInfo').textContent = `${challenge.minBet} - ${challenge.maxBet} points`;
    document.getElementById('organizerInfo').textContent = challenge.organizer;
    document.getElementById('statusInfo').innerHTML = getStatusBadge(challenge.status);
    
    // Règles
    const rulesSection = document.getElementById('rulesSection');
    if(challenge.rules) {
        rulesSection.innerHTML = `
            <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: var(--dark);">Règles</h4>
            <p style="white-space: pre-wrap;">${challenge.rules}</p>
        `;
    } else {
        rulesSection.innerHTML = '';
    }
    
    // Participants
    document.getElementById('participantCount').textContent = challenge.participants.length;
    document.getElementById('participantsList').innerHTML = challenge.participants.map(p => {
        const progress = challenge.progressions?.[p.username];
        const isCheater = progress?.cheated || false;
        
        return `
            <div class="participant-card ${p.username === challenge.organizer ? 'organizer' : ''} ${isCheater ? 'cheated' : ''}"
                 ${isOrganizer ? `onclick="openModifierModal('${p.username}')"` : ''}>
                <div class="participant-name">
                    ${p.username === challenge.organizer ? '👑 ' : ''}${p.username}
                    ${isCheater ? ' ⚠️' : ''}
                </div>
                <div class="participant-bet">
                    Mise: ${p.bet} pts
                    ${p.modifier !== 0 ? `<br>Bonus/Malus: ${p.modifier > 0 ? '+' : ''}${p.modifier}` : ''}
                    ${p.multiplier !== 1 ? `<br>Multiplicateur: x${p.multiplier}` : ''}
                    ${progress ? `<br>Score: ${progress.score} (${progress.validated} validées)` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Actions
    renderActions(challenge, isParticipant, isOrganizer);
    
    // Chat
    if(isParticipant) {
        document.getElementById('chatInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
    }
}

function renderActions(challenge, isParticipant, isOrganizer) {
    const actionsDiv = document.getElementById('challengeActions');
    let html = '';
    
    if(isOrganizer && challenge.status === 'waiting') {
        html += '<button class="btn btn-primary" onclick="startChallenge()">Démarrer le défi</button>';
    }
    
    if(challenge.status === 'active' && isParticipant) {
        html += `<button class="btn btn-success" onclick="window.location.href='challenge-progress.html?id=${challenge.id}'">📊 Voir la progression</button>`;
    }
    
    if(isParticipant && !isOrganizer && challenge.status === 'waiting') {
        html += '<button class="btn btn-danger" onclick="leaveChallenge()">Quitter le défi</button>';
    }
    
    if(isOrganizer) {
        html += '<button class="btn btn-danger" onclick="deleteChallenge()">Supprimer le défi</button>';
    }
    
    if(!html) {
        html = '<p style="color: var(--gray); font-style: italic;">Aucune action disponible</p>';
    }
    
    actionsDiv.innerHTML = html;
}

function startChallenge() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge) return;
    
    if(challenge.participants.length < 2) {
        showNotification('Il faut au moins 2 participants pour démarrer', 'error');
        return;
    }
    
    // Initialiser les progressions pour tous les participants
    if(!challenge.progressions) challenge.progressions = {};
    challenge.participants.forEach(p => {
        if(!challenge.progressions[p.username]) {
            challenge.progressions[p.username] = {
                submissions: [],
                score: 0,
                validated: 0,
                rejected: 0,
                cheated: false
            };
        }
    });
    
    challenge.status = 'active';
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a commencé !` }));
    
    showNotification('Défi démarré !');
}

function leaveChallenge() {
    if(!confirm('Êtes-vous sûr de vouloir quitter ce défi ?')) return;
    
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    
    if(!challenge || !user) return;
    
    const participant = challenge.participants.find(p => p.username === currentUser);
    if(participant) {
        user.totalPoints += participant.bet;
        challenge.participants = challenge.participants.filter(p => p.username !== currentUser);
        
        // Supprimer les progressions
        if(challenge.progressions) {
            delete challenge.progressions[currentUser];
        }
        
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} a quitté le défi "${challenge.name}"` }));
        
        showNotification('Vous avez quitté le défi');
        setTimeout(() => window.location.href = 'challenges.html', 1000);
    }
}

function deleteChallenge() {
    if(!confirm('Êtes-vous sûr de vouloir supprimer ce défi ?')) return;
    
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge) return;
    
    // Rembourser les participants
    challenge.participants.forEach(p => {
        const user = users.find(u => u.username === p.username);
        if(user) user.totalPoints += p.bet;
    });
    
    challenges = challenges.filter(c => c.id !== currentChallengeId);
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    
    showNotification('Défi supprimé');
    setTimeout(() => window.location.href = 'challenges.html', 1000);
}

// Modal modificateurs
function openModifierModal(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge || challenge.organizer !== currentUser) return;
    
    selectedParticipant = username;
    const participant = challenge.participants.find(p => p.username === username);
    
    document.getElementById('modifierParticipantName').textContent = username;
    document.getElementById('scoreModifier').value = participant.modifier || 0;
    document.getElementById('scoreMultiplier').value = participant.multiplier || 1;
    document.getElementById('modifierModal').classList.remove('hidden');
}

function closeModifierModal() {
    document.getElementById('modifierModal').classList.add('hidden');
    selectedParticipant = null;
}

function applyModifier() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge) return;
    
    const participant = challenge.participants.find(p => p.username === selectedParticipant);
    if(!participant) return;
    
    participant.modifier = parseFloat(document.getElementById('scoreModifier').value) || 0;
    participant.multiplier = parseFloat(document.getElementById('scoreMultiplier').value) || 1;
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    
    closeModifierModal();
    showNotification('Modificateurs appliqués');
}

// Chat
function updateChat() {
    const chatMessages = document.getElementById('chatMessages');
    const challengeMessages = messages[currentChallengeId] || [];
    
    if(challengeMessages.length === 0) {
        chatMessages.innerHTML = '<p style="text-align:center; color: var(--gray);">Aucun message</p>';
        return;
    }
    
    chatMessages.innerHTML = challengeMessages.map(msg => `
        <div class="chat-message">
            <div>
                <span class="chat-sender">${msg.player}</span>
                <span class="chat-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="chat-text">${msg.text}</div>
        </div>
    `).join('');
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if(!text) return;
    
    ws.send(JSON.stringify({
        type: 'newMessage',
        challengeId: currentChallengeId,
        player: currentUser,
        text: text
    }));
    
    input.value = '';
}

document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});
