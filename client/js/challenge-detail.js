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
                ${isParticipant && p.username !== currentUser && challenge.status === 'active' ? `
                    <button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); openMalusModal('${p.username}')" style="margin-top: 0.5rem;">⚡ Malus</button>
                ` : ''}
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
    
    if(isOrganizer && challenge.status === 'active') {
        html += '<button class="btn btn-success" onclick="finishChallenge()">🏁 Terminer le défi</button>';
    }
    
    if(challenge.status === 'active' && isParticipant) {
        html += `<button class="btn btn-success" onclick="window.location.href='challenge-progress.html?id=${challenge.id}'">📊 Voir la progression</button>`;
        
        // Bouton pour accéder aux mécaniques de jeu
        if(['tournoi', 'course', 'marathon', 'bingo'].includes(challenge.format)) {
            html += `<button class="btn btn-primary" onclick="window.location.href='challenge-mechanics.html?id=${challenge.id}'">🎮 Mécaniques de jeu</button>`;
        }
    }
    
    if(challenge.status === 'finished') {
        html += `<button class="btn btn-primary" onclick="showResults()">🏆 Voir les résultats</button>`;
    }
    
    if(isParticipant && !isOrganizer && challenge.status === 'waiting') {
        html += '<button class="btn btn-danger" onclick="leaveChallenge()">Quitter le défi</button>';
    }
    
    if(isOrganizer && challenge.status !== 'finished') {
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
    
    // Initialiser les mécaniques spécifiques
    if(challenge.format === 'course' && challenge.raceConfig) {
        challenge.raceConfig.finishTimes = {};
        challenge.raceConfig.rankings = [];
    }
    
    if(challenge.format === 'marathon' && challenge.marathonConfig) {
        challenge.marathonConfig.completions = {};
    }
    
    if(challenge.format === 'bingo' && challenge.bingoConfig) {
        challenge.bingoConfig.completions = {};
    }
    
    challenge.status = 'active';
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a commencé !` }));
    
    showNotification('Défi démarré !');
}

function finishChallenge() {
    if(!confirm('Êtes-vous sûr de vouloir terminer ce défi ? Les résultats seront calculés automatiquement.')) return;
    
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge || challenge.organizer !== currentUser) return;
    
    // Calculer les scores finaux
    const results = challenge.participants.map(p => {
        const progress = challenge.progressions[p.username] || { score: 0, cheated: false };
        const finalScore = (progress.score * p.multiplier) + p.modifier;
        
        return {
            username: p.username,
            bet: p.bet,
            score: finalScore,
            cheated: progress.cheated
        };
    });
    
    // Trier par score décroissant (les tricheurs en dernier)
    results.sort((a, b) => {
        if(a.cheated && !b.cheated) return 1;
        if(!a.cheated && b.cheated) return -1;
        return b.score - a.score;
    });
    
    // Calculer les gains
    const totalPot = challenge.participants.reduce((sum, p) => sum + p.bet, 0);
    const nonCheaters = results.filter(r => !r.cheated);
    
    if(nonCheaters.length > 0) {
        const winner = nonCheaters[0];
        const winnerUser = users.find(u => u.username === winner.username);
        
        if(winnerUser) {
            // Le gagnant remporte tout le pot
            winnerUser.totalPoints += totalPot;
            
            // Sauvegarder les résultats dans le défi
            challenge.results = {
                winner: winner.username,
                totalPot: totalPot,
                rankings: results,
                finishedAt: Date.now()
            };
            
            challenge.status = 'finished';
            
            ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
            ws.send(JSON.stringify({ type: 'updateUsers', users }));
            ws.send(JSON.stringify({ type: 'notification', text: `🏆 ${winner.username} a gagné le défi "${challenge.name}" et remporte ${totalPot} points !` }));
            
            showNotification('Défi terminé ! Les résultats ont été calculés.');
            setTimeout(() => showResults(), 1000);
        }
    } else {
        // Tous les participants ont triché - rembourser tout le monde
        challenge.participants.forEach(p => {
            const user = users.find(u => u.username === p.username);
            if(user) user.totalPoints += p.bet;
        });
        
        challenge.results = {
            winner: null,
            totalPot: 0,
            rankings: results,
            finishedAt: Date.now(),
            message: 'Tous les participants ont été disqualifiés pour triche'
        };
        
        challenge.status = 'finished';
        
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a été annulé - tous les participants ont triché` }));
        
        showNotification('Défi annulé - tous les participants disqualifiés');
    }
}

function showResults() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge || !challenge.results) return;
    
    const results = challenge.results;
    
    let html = `
        <h3>🏆 Résultats du défi</h3>
        <div style="margin: 1.5rem 0; text-align: center;">
            ${results.winner ? `
                <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                    <h2 style="margin: 0; color: #92400e;">👑 ${results.winner}</h2>
                    <p style="margin: 0.5rem 0 0 0; font-size: 1.5rem; font-weight: bold; color: #92400e;">+${results.totalPot} points</p>
                </div>
            ` : `
                <div style="background: var(--danger); color: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                    <h2 style="margin: 0;">⚠️ Défi annulé</h2>
                    <p style="margin: 0.5rem 0 0 0;">${results.message}</p>
                </div>
            `}
        </div>
        
        <h4 style="margin-bottom: 1rem;">Classement final</h4>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: var(--light);">
                    <th style="padding: 0.75rem; text-align: left;">Rang</th>
                    <th style="padding: 0.75rem; text-align: left;">Participant</th>
                    <th style="padding: 0.75rem; text-align: right;">Score</th>
                    <th style="padding: 0.75rem; text-align: right;">Mise</th>
                </tr>
            </thead>
            <tbody>
                ${results.rankings.map((r, index) => `
                    <tr style="border-bottom: 1px solid var(--border); ${r.cheated ? 'background: #fee;' : ''}">
                        <td style="padding: 0.75rem;">#${index + 1}</td>
                        <td style="padding: 0.75rem; font-weight: 600;">
                            ${r.username}
                            ${r.username === results.winner ? ' 👑' : ''}
                            ${r.cheated ? ' ⚠️' : ''}
                        </td>
                        <td style="padding: 0.75rem; text-align: right; font-weight: bold; color: var(--primary);">${r.score.toFixed(1)}</td>
                        <td style="padding: 0.75rem; text-align: right;">${r.bet} pts</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <p style="margin-top: 1rem; color: var(--gray); font-size: 0.875rem; text-align: center;">
            Terminé le ${new Date(results.finishedAt).toLocaleString()}
        </p>
    `;
    
    document.getElementById('resultsContent').innerHTML = html;
    document.getElementById('resultsModal').classList.remove('hidden');
}

function closeResultsModal() {
    document.getElementById('resultsModal').classList.add('hidden');
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

// Modal malus
let malusTarget = null;

function openMalusModal(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge || challenge.status !== 'active') return;
    
    const currentUserData = users.find(u => u.username === currentUser);
    if(!currentUserData) return;
    
    malusTarget = username;
    
    document.getElementById('malusTargetName').textContent = username;
    document.getElementById('malusUserPoints').textContent = currentUserData.totalPoints;
    document.getElementById('malusCost').value = 10;
    document.getElementById('malusPenalty').value = 5;
    
    document.getElementById('malusModal').classList.remove('hidden');
}

function closeMalusModal() {
    document.getElementById('malusModal').classList.add('hidden');
    malusTarget = null;
}

function applyMalus() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const currentUserData = users.find(u => u.username === currentUser);
    
    if(!challenge || !currentUserData || !malusTarget) return;
    
    const cost = parseInt(document.getElementById('malusCost').value) || 10;
    const penalty = parseInt(document.getElementById('malusPenalty').value) || 5;
    
    // Vérifier que l'utilisateur a assez de points
    if(currentUserData.totalPoints < cost) {
        showNotification('Vous n\'avez pas assez de points', 'error');
        return;
    }
    
    // Déduire les points
    currentUserData.totalPoints -= cost;
    
    // Appliquer le malus au participant cible
    const targetParticipant = challenge.participants.find(p => p.username === malusTarget);
    if(targetParticipant) {
        targetParticipant.modifier = (targetParticipant.modifier || 0) - penalty;
    }
    
    // Logger l'action
    if(!challenge.malusLog) challenge.malusLog = [];
    challenge.malusLog.push({
        from: currentUser,
        to: malusTarget,
        cost: cost,
        penalty: penalty,
        timestamp: Date.now()
    });
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'notification', text: `⚡ ${currentUser} a infligé un malus de -${penalty} à ${malusTarget}` }));
    
    closeMalusModal();
    showNotification(`Malus de -${penalty} appliqué à ${malusTarget}`);
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
