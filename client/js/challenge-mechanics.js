let currentChallengeId = null;
let currentChallenge = null;
let raceStartTime = null;

const urlParams = new URLSearchParams(window.location.search);
currentChallengeId = urlParams.get('id');

if(!currentChallengeId) {
    window.location.href = 'challenges.html';
}

function goBack() {
    window.location.href = `challenge-detail.html?id=${currentChallengeId}`;
}

function updatePageData() {
    currentChallenge = challenges.find(c => c.id === currentChallengeId);
    if(!currentChallenge) {
        window.location.href = 'challenges.html';
        return;
    }
    
    document.getElementById('challengeTitle').textContent = currentChallenge.name;
    
    // Afficher la mécanique appropriée
    document.getElementById('tournamentMechanics').classList.add('hidden');
    document.getElementById('raceMechanics').classList.add('hidden');
    document.getElementById('marathonMechanics').classList.add('hidden');
    document.getElementById('bingoMechanics').classList.add('hidden');
    
    if(currentChallenge.format === 'tournoi') {
        document.getElementById('tournamentMechanics').classList.remove('hidden');
        renderTournament();
    } else if(currentChallenge.format === 'course') {
        document.getElementById('raceMechanics').classList.remove('hidden');
        renderRace();
    } else if(currentChallenge.format === 'marathon') {
        document.getElementById('marathonMechanics').classList.remove('hidden');
        renderMarathon();
    } else if(currentChallenge.format === 'bingo') {
        document.getElementById('bingoMechanics').classList.remove('hidden');
        renderBingo();
    }
}

// ========== TOURNOI ==========
function renderTournament() {
    const config = currentChallenge.tournamentConfig;
    const isOrganizer = currentChallenge.organizer === currentUser;
    
    // Phase de poule
    const groupsDisplay = document.getElementById('groupsDisplay');
    const groupsActions = document.getElementById('groupsActions');
    
    if(config.currentPhase === 'waiting' && isOrganizer) {
        groupsActions.innerHTML = '<button class="btn btn-primary" onclick="generateGroups()">Générer les groupes</button>';
        groupsDisplay.innerHTML = '<p style="color: var(--gray);">Les groupes seront générés au démarrage</p>';
    } else if(config.groups.length > 0) {
        groupsDisplay.innerHTML = config.groups.map((group, gIndex) => `
            <div class="tournament-group">
                <h4>Groupe ${String.fromCharCode(65 + gIndex)}</h4>
                <div class="group-standings">
                    ${group.map((player, pIndex) => `
                        <div class="standing-row">
                            <span>${pIndex + 1}. ${player.username}</span>
                            <span>Score: ${player.groupScore || 0}</span>
                            ${isOrganizer && config.currentPhase === 'groups' ? 
                                `<button class="btn btn-sm btn-success" onclick="addGroupWin('${player.username}', ${gIndex})">+1 Victoire</button>` 
                                : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        if(isOrganizer && config.currentPhase === 'groups') {
            groupsActions.innerHTML = '<button class="btn btn-primary" onclick="startBracket()">Démarrer la phase éliminatoire</button>';
        } else {
            groupsActions.innerHTML = '';
        }
    }
    
    // Arbre éliminatoire
    const bracketDisplay = document.getElementById('bracketDisplay');
    if(config.bracket.length > 0) {
        bracketDisplay.innerHTML = renderBracket(config.bracket, isOrganizer);
    } else {
        bracketDisplay.innerHTML = '<p style="color: var(--gray);">L\'arbre éliminatoire sera disponible après la phase de poule</p>';
    }
}

function generateGroups() {
    const config = currentChallenge.tournamentConfig;
    const participants = [...currentChallenge.participants];
    
    // Mélanger les participants
    for(let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    
    // Créer les groupes
    const groups = [];
    const groupSize = config.groupSize;
    
    for(let i = 0; i < participants.length; i += groupSize) {
        const group = participants.slice(i, i + groupSize).map(p => ({
            username: p.username,
            groupScore: 0
        }));
        groups.push(group);
    }
    
    config.groups = groups;
    config.currentPhase = 'groups';
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    showNotification('Groupes générés !');
}

function addGroupWin(username, groupIndex) {
    const config = currentChallenge.tournamentConfig;
    const player = config.groups[groupIndex].find(p => p.username === username);
    
    if(player) {
        player.groupScore = (player.groupScore || 0) + 1;
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        showNotification(`+1 victoire pour ${username}`);
    }
}

function startBracket() {
    const config = currentChallenge.tournamentConfig;
    
    // Trier chaque groupe par score
    config.groups.forEach(group => {
        group.sort((a, b) => (b.groupScore || 0) - (a.groupScore || 0));
    });
    
    // Prendre les qualifiés
    const qualified = [];
    config.groups.forEach(group => {
        for(let i = 0; i < config.qualifiedPerGroup; i++) {
            if(group[i]) qualified.push(group[i].username);
        }
    });
    
    // Créer l'arbre (simple bracket)
    const bracket = [];
    for(let i = 0; i < qualified.length; i += 2) {
        if(qualified[i + 1]) {
            bracket.push({
                player1: qualified[i],
                player2: qualified[i + 1],
                winner: null,
                round: 1
            });
        }
    }
    
    config.bracket = bracket;
    config.currentPhase = 'bracket';
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    showNotification('Phase éliminatoire démarrée !');
}

function renderBracket(bracket, isOrganizer) {
    const rounds = {};
    bracket.forEach(match => {
        if(!rounds[match.round]) rounds[match.round] = [];
        rounds[match.round].push(match);
    });
    
    return Object.keys(rounds).sort().map(round => `
        <div class="bracket-round">
            <h4>Round ${round}</h4>
            ${rounds[round].map((match, index) => `
                <div class="bracket-match ${match.winner ? 'finished' : ''}">
                    <div class="match-player ${match.winner === match.player1 ? 'winner' : ''}">${match.player1}</div>
                    <div class="match-vs">VS</div>
                    <div class="match-player ${match.winner === match.player2 ? 'winner' : ''}">${match.player2}</div>
                    ${!match.winner && isOrganizer ? `
                        <div class="match-actions">
                            <button class="btn btn-sm btn-success" onclick="setMatchWinner(${round}, ${index}, '${match.player1}')">Victoire ${match.player1}</button>
                            <button class="btn btn-sm btn-success" onclick="setMatchWinner(${round}, ${index}, '${match.player2}')">Victoire ${match.player2}</button>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `).join('');
}

function setMatchWinner(round, matchIndex, winner) {
    const config = currentChallenge.tournamentConfig;
    const match = config.bracket.filter(m => m.round === parseInt(round))[matchIndex];
    
    if(match) {
        match.winner = winner;
        
        // Créer le prochain match si nécessaire
        const nextRound = parseInt(round) + 1;
        const nextMatchIndex = Math.floor(matchIndex / 2);
        
        let nextMatch = config.bracket.find(m => m.round === nextRound && 
            (m.player1 === winner || m.player2 === winner || !m.player1 || !m.player2));
        
        if(!nextMatch) {
            nextMatch = { player1: null, player2: null, winner: null, round: nextRound };
            config.bracket.push(nextMatch);
        }
        
        if(!nextMatch.player1) {
            nextMatch.player1 = winner;
        } else if(!nextMatch.player2) {
            nextMatch.player2 = winner;
        }
        
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        showNotification(`${winner} remporte le match !`);
    }
}

// ========== COURSE ==========
function renderRace() {
    const config = currentChallenge.raceConfig;
    const isParticipant = currentChallenge.participants.some(p => p.username === currentUser);
    const hasFinished = config.finishTimes[currentUser];
    
    const timerDiv = document.getElementById('raceTimer');
    
    if(currentChallenge.status === 'active' && isParticipant && !hasFinished) {
        timerDiv.innerHTML = `
            <div class="timer-display">
                <h3>Votre chronomètre</h3>
                <div class="timer-value" id="timerValue">00:00:00</div>
                <button class="btn btn-success btn-lg" onclick="finishRace()">🏁 Terminer la course</button>
            </div>
        `;
        startTimer();
    } else if(hasFinished) {
        const time = config.finishTimes[currentUser];
        timerDiv.innerHTML = `
            <div class="timer-display">
                <h3>Vous avez terminé !</h3>
                <div class="timer-value">${formatTime(time)}</div>
            </div>
        `;
    } else {
        timerDiv.innerHTML = '<p style="color: var(--gray);">Le chronomètre sera disponible quand la course commencera</p>';
    }
    
    // Classement
    const rankingsDiv = document.getElementById('raceRankings');
    const rankings = Object.entries(config.finishTimes)
        .map(([username, time]) => ({ username, time }))
        .sort((a, b) => a.time - b.time);
    
    if(rankings.length > 0) {
        rankingsDiv.innerHTML = `
            <table class="rankings-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Joueur</th>
                        <th>Temps</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${rankings.map((r, index) => {
                        const score = config.baseScore - (index * config.scoreDecrement);
                        return `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${r.username}</td>
                                <td>${formatTime(r.time)}</td>
                                <td>${Math.max(0, score)} pts</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } else {
        rankingsDiv.innerHTML = '<p style="color: var(--gray);">Aucun participant n\'a terminé</p>';
    }
}

function startTimer() {
    if(!raceStartTime) {
        raceStartTime = Date.now();
    }
    
    const interval = setInterval(() => {
        const elapsed = Date.now() - raceStartTime;
        const timerEl = document.getElementById('timerValue');
        if(timerEl) {
            timerEl.textContent = formatTime(elapsed);
        } else {
            clearInterval(interval);
        }
    }, 100);
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor((ms % 1000) / 10);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

function finishRace() {
    const config = currentChallenge.raceConfig;
    const finishTime = Date.now() - raceStartTime;
    
    config.finishTimes[currentUser] = finishTime;
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} a terminé la course en ${formatTime(finishTime)} !` }));
    
    showNotification('Course terminée !');
}

// ========== MARATHON ==========
function renderMarathon() {
    const config = currentChallenge.marathonConfig;
    const isParticipant = currentChallenge.participants.some(p => p.username === currentUser);
    const userCompletions = config.completions[currentUser] || [];
    
    const objectivesDiv = document.getElementById('marathonObjectives');
    objectivesDiv.innerHTML = config.objectives.map(obj => {
        const completionCount = userCompletions.filter(id => id === obj.id).length;
        const isCompleted = completionCount > 0;
        
        return `
            <div class="marathon-objective ${isCompleted ? 'completed' : ''}">
                <div class="objective-info">
                    <h4>${obj.name}</h4>
                    <span class="objective-points">${obj.points} pts</span>
                    ${obj.repeatable ? '<span class="objective-badge">Répétable</span>' : ''}
                    ${obj.repeatable && completionCount > 0 ? `<span class="objective-count">×${completionCount}</span>` : ''}
                </div>
                ${isParticipant && currentChallenge.status === 'active' ? `
                    <button class="btn btn-success btn-sm" 
                            onclick="completeObjective('${obj.id}')"
                            ${!obj.repeatable && isCompleted ? 'disabled' : ''}>
                        ${isCompleted && !obj.repeatable ? '✓ Complété' : 'Valider'}
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
    
    // Progression des participants
    const progressDiv = document.getElementById('marathonProgress');
    const participantScores = currentChallenge.participants.map(p => {
        const completions = config.completions[p.username] || [];
        const score = completions.reduce((sum, objId) => {
            const obj = config.objectives.find(o => o.id === objId);
            return sum + (obj ? obj.points : 0);
        }, 0);
        
        return { username: p.username, score, completions: completions.length };
    }).sort((a, b) => b.score - a.score);
    
    progressDiv.innerHTML = `
        <table class="progress-table">
            <thead>
                <tr>
                    <th>Position</th>
                    <th>Joueur</th>
                    <th>Objectifs complétés</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                ${participantScores.map((p, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${p.username}</td>
                        <td>${p.completions}</td>
                        <td>${p.score} pts</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function completeObjective(objectiveId) {
    const config = currentChallenge.marathonConfig;
    const objective = config.objectives.find(o => o.id === objectiveId);
    
    if(!objective) return;
    
    if(!config.completions[currentUser]) {
        config.completions[currentUser] = [];
    }
    
    const alreadyCompleted = config.completions[currentUser].includes(objectiveId);
    
    if(!objective.repeatable && alreadyCompleted) {
        showNotification('Objectif déjà complété', 'error');
        return;
    }
    
    config.completions[currentUser].push(objectiveId);
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} a complété "${objective.name}" (+${objective.points} pts)` }));
    
    showNotification(`Objectif complété ! +${objective.points} pts`);
}

// ========== BINGO ==========
function renderBingo() {
    const config = currentChallenge.bingoConfig;
    const isParticipant = currentChallenge.participants.some(p => p.username === currentUser);
    const userCompletions = config.completions[currentUser] || [];
    
    const gridDiv = document.getElementById('bingoGrid');
    gridDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem;">
            ${config.grid.map(cell => {
                const isCompleted = userCompletions.includes(cell.position);
                return `
                    <div class="bingo-cell ${isCompleted ? 'completed' : ''}" 
                         ${isParticipant && currentChallenge.status === 'active' ? `onclick="toggleBingoCell(${cell.position})"` : ''}>
                        <div class="cell-content">${cell.name}</div>
                        ${isCompleted ? '<div class="cell-check">✓</div>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Progression
    const progressDiv = document.getElementById('bingoProgress');
    const participantProgress = currentChallenge.participants.map(p => {
        const completions = config.completions[p.username] || [];
        const lines = countBingoLines(completions);
        
        return { 
            username: p.username, 
            completed: completions.length,
            lines: lines.total,
            bingo: lines.total >= 5
        };
    }).sort((a, b) => b.lines - a.lines || b.completed - a.completed);
    
    progressDiv.innerHTML = `
        <table class="progress-table">
            <thead>
                <tr>
                    <th>Joueur</th>
                    <th>Cases complétées</th>
                    <th>Lignes/Colonnes/Diagonales</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody>
                ${participantProgress.map(p => `
                    <tr>
                        <td>${p.username}</td>
                        <td>${p.completed}/25</td>
                        <td>${p.lines}</td>
                        <td>${p.bingo ? '🎉 BINGO!' : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function toggleBingoCell(position) {
    const config = currentChallenge.bingoConfig;
    
    if(!config.completions[currentUser]) {
        config.completions[currentUser] = [];
    }
    
    const index = config.completions[currentUser].indexOf(position);
    
    if(index > -1) {
        config.completions[currentUser].splice(index, 1);
    } else {
        config.completions[currentUser].push(position);
    }
    
    const lines = countBingoLines(config.completions[currentUser]);
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    
    if(lines.total >= 5 && index === -1) {
        ws.send(JSON.stringify({ type: 'notification', text: `🎉 ${currentUser} a fait BINGO !` }));
        showNotification('🎉 BINGO !');
    }
}

function countBingoLines(completions) {
    let lines = 0, cols = 0, diags = 0;
    
    // Lignes
    for(let row = 0; row < 5; row++) {
        let complete = true;
        for(let col = 0; col < 5; col++) {
            if(!completions.includes(row * 5 + col)) {
                complete = false;
                break;
            }
        }
        if(complete) lines++;
    }
    
    // Colonnes
    for(let col = 0; col < 5; col++) {
        let complete = true;
        for(let row = 0; row < 5; row++) {
            if(!completions.includes(row * 5 + col)) {
                complete = false;
                break;
            }
        }
        if(complete) cols++;
    }
    
    // Diagonales
    let diag1 = true, diag2 = true;
    for(let i = 0; i < 5; i++) {
        if(!completions.includes(i * 5 + i)) diag1 = false;
        if(!completions.includes(i * 5 + (4 - i))) diag2 = false;
    }
    if(diag1) diags++;
    if(diag2) diags++;
    
    return { lines, cols, diags, total: lines + cols + diags };
}
