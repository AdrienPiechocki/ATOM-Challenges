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

// ================= TOURNOI =================
function renderTournament() {
    const config = currentChallenge.tournamentConfig;
    const isOrganizer = currentChallenge.organizer === currentUser;

    // Phase de poule
    const groupsDisplay = document.getElementById('groupsDisplay');
    const groupsActions = document.getElementById('groupsActions');

    if (config.currentPhase === 'waiting' && isOrganizer) {
        groupsActions.innerHTML = '<button class="btn btn-primary btn-lg" onclick="generateGroups()">🎲 Générer les groupes</button>';
        groupsDisplay.innerHTML = '<div class="info-card"><p>Les groupes seront générés au démarrage du tournoi</p></div>';
    } else if (config.groups && config.groups.length > 0) {
        groupsDisplay.innerHTML = config.groups.map((group, gIndex) => `
            <div class="tournament-group">
                <div class="group-header">
                    <h4>Groupe ${String.fromCharCode(65 + gIndex)}</h4>
                    <span class="group-badge">${group.length} participants</span>
                </div>
                <div class="group-standings">
                    ${group.map((player, pIndex) => `
                        <div class="standing-row ${pIndex === 0 ? 'first-place' : ''}">
                            <div class="standing-position">${pIndex + 1}</div>
                            <div class="standing-player">
                                <span class="player-name">${player.name}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        groupsActions.innerHTML = isOrganizer && config.currentPhase === 'groups' 
            ? '<button class="btn btn-primary btn-lg" onclick="startBracket()">🏆 Démarrer la phase éliminatoire</button>'
            : '';
    }

    // Arbre éliminatoire
    const bracketDisplay = document.getElementById('bracketDisplay');
    if (config.bracket && config.bracket.length > 0) {
        bracketDisplay.innerHTML = renderBracket(config.bracket, isOrganizer);
    } else {
        bracketDisplay.innerHTML = '<div class="info-card"><p>L\'arbre éliminatoire sera disponible après le tirage au sort</p></div>';
    }
}

// ================= GENERATION DES GROUPES DYNAMIQUE =================
function generateGroups() {
    const config = currentChallenge.tournamentConfig;
    const participants = [...currentChallenge.participants];
    if (participants.length === 0) return showNotification('Aucun participant pour générer les groupes', 'error');

    // Mélanger les participants
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }

    // Déterminer le nombre de groupes dynamiquement (≈4 participants par groupe)
    let numberOfGroups = Math.ceil(participants.length / 4);
    if (numberOfGroups < 2) numberOfGroups = 2;

    const groups = Array.from({ length: numberOfGroups }, () => []);

    participants.forEach((p, index) => {
        const groupIndex = index % numberOfGroups;
        groups[groupIndex].push({
            id: p.type === 'team' ? p.teamId : p.username,
            name: p.type === 'team' ? p.teamName : p.username,
            groupScore: 0
        });
    });

    config.groups = groups;
    config.currentPhase = 'groups';

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    showNotification('Groupes générés dynamiquement !');
}

// ================= AJOUT D’UNE VICTOIRE DANS LE GROUPE =================
function addGroupWin(name, groupIndex) {
    const config = currentChallenge.tournamentConfig;
    const player = config.groups[groupIndex].find(p => p.name === name);
    if (player) {
        player.groupScore = (player.groupScore || 0) + 1;
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        showNotification(`+1 victoire pour ${name}`);
    }
}

// ================= PHASE ELIMINATOIRE =================
function startBracket() {
    const config = currentChallenge.tournamentConfig;

    // Trier chaque groupe par score
    config.groups.forEach(group => group.sort((a, b) => (b.groupScore || 0) - (a.groupScore || 0)));

    // Récupérer les qualifiés
    const qualified = [];
    config.groups.forEach(group => {
        const count = config.qualifiedPerGroup || 2; // par défaut 2 qualifiés par groupe
        for (let i = 0; i < count; i++) {
            if (group[i]) qualified.push({ id: group[i].id, name: group[i].name });
        }
    });

    // Créer le bracket simple
    const bracket = [];
    for (let i = 0; i < qualified.length; i += 2) {
        if (qualified[i + 1]) {
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

// ================= RENDER BRACKET =================
function renderBracket(bracket, isOrganizer) {
    // Organiser les matchs par round
    const rounds = {};
    bracket.forEach(match => {
        if (!rounds[match.round]) rounds[match.round] = [];
        rounds[match.round].push(match);
    });

    return Object.keys(rounds).sort((a, b) => a - b).map(round => `
        <div class="bracket-round">
            <div class="round-header">
                <h4>Round ${round}</h4>
                <span class="round-badge">${rounds[round].length} match${rounds[round].length > 1 ? 's' : ''}</span>
            </div>
            <div class="bracket-matches">
                ${rounds[round].map((match, index) => {
                    const p1 = match.player1 ? match.player1.name : '';
                    const p2 = match.player2 ? match.player2.name : '';
                    if (p1 == '' || p2 == '') return `
                        <div class="bracket-match ${match.winner ? 'finished' : 'pending'}">
                            <div class="match-players">
                                <div class="match-player winner">
                                    <span class="player-icon">👑</span>
                                    <span class="player-name">${match.winner && match.winner.id === match.player1?.id ? p2 : p1}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    return `
                        <div class="bracket-match ${match.winner ? 'finished' : 'pending'}">
                            <div class="match-players">
                                <div class="match-player ${match.winner && match.winner.id === match.player1?.id ? 'winner' : match.winner ? 'loser' : ''}">
                                    <span class="player-icon">${match.winner && match.winner.id === match.player1?.id ? '👑' : '🎮'}</span>
                                    <span class="player-name">${p1}</span>
                                </div>
                                <div class="match-vs">VS</div>
                                <div class="match-player ${match.winner && match.winner.id === match.player2?.id ? 'winner' : match.winner ? 'loser' : ''}">
                                    <span class="player-icon">${match.winner && match.winner.id === match.player2?.id ? '👑' : '🎮'}</span>
                                    <span class="player-name">${p2}</span>
                                </div>
                            </div>
                            ${!match.winner && isOrganizer && match.player1 && match.player2 ? `
                                <div class="match-actions">
                                    <button class="btn btn-success btn-sm" onclick="setMatchWinner(${round}, ${index}, '${match.player1.id}')">
                                        Victoire ${p1}
                                    </button>
                                    <button class="btn btn-success btn-sm" onclick="setMatchWinner(${round}, ${index}, '${match.player2.id}')">
                                        Victoire ${p2}
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

// ================= SET MATCH WINNER =================
function setMatchWinner(round, matchIndex, winnerId) {
    const config = currentChallenge.tournamentConfig;
    round = parseInt(round);

    // Récupérer le match courant dans ce round
    const matchesInRound = config.bracket.filter(m => m.round === round);
    const match = matchesInRound[matchIndex];
    if (!match) return;

    // Déterminer le gagnant et s'assurer qu'il est un objet complet
    const winner = (match.player1 && match.player1.id === winnerId) ? match.player1 :
                   (match.player2 && match.player2.id === winnerId) ? match.player2 : null;
    if (!winner) return;

    match.winner = winner;

    // ✅ AJOUT DES POINTS
    const WIN_POINTS = 10;
    currentChallenge.progressions[winner.name].score += 10;

    // Préparer le round suivant
    const nextRound = round + 1;
    const nextMatchIndex = Math.floor(matchIndex / 2);

    // Filtrer les matches déjà existants pour le round suivant
    let nextRoundMatches = config.bracket.filter(m => m.round === nextRound);
    let nextMatch = nextRoundMatches[nextMatchIndex];

    // Si le match n'existe pas, le créer
    if (!nextMatch) {
        nextMatch = { player1: null, player2: null, winner: null, round: nextRound };
        config.bracket.push(nextMatch);
    }

    // Assigner le gagnant à player1 ou player2
    if (!nextMatch.player1) nextMatch.player1 = { ...winner }; 
    else if (!nextMatch.player2) nextMatch.player2 = { ...winner };

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    showNotification(`${winner.name} remporte le match !`);
}

// ========== COURSE ==========
function renderRace() {
    const config = currentChallenge.raceConfig;
    const userTeams = teams.filter(t => t.members.some(m => m.username === currentUser));

    let isParticipant = false;
    let participantId = null;

    if (currentChallenge.teamFormat === 'team') {
        const participantTeam = currentChallenge.participants.find(p =>
            p.type === 'team' && userTeams.some(t => t.id === p.teamId)
        );
        if (participantTeam) {
            isParticipant = true;
            participantId = participantTeam.teamId;
        }
    } else {
        isParticipant = currentChallenge.participants.some(
            p => p.type === 'player' && p.username === currentUser
        );
        participantId = currentUser;
    }

    const userTimes = config.times?.[participantId] || {};

    /* =========================
       ÉTAPES + INPUTS
    ========================= */

    const raceDiv = document.getElementById('raceTimer');

    if (currentChallenge.status === 'active' && isParticipant) {
        raceDiv.innerHTML = `
            <div class="race-steps">
                <h3>🏁 Étapes de la course</h3>
                ${config.steps.map(step => {
                    const ms = userTimes[step.id] || 0;
                    const min = Math.floor(ms / 60000);
                    const sec = Math.floor((ms % 60000) / 1000);
                    const milli = ms % 1000;

                    return `
                        <div class="race-step">
                            <div class="step-header">
                                <strong>${step.name}</strong>
                            </div>

                            <div class="race-step-time">
                                <input type="number" min="0"
                                    value="${min}"
                                    onchange="updateRaceStepTime('${step.id}', this)">
                                <span> min </span>
                                <input type="number" min="0" max="59"
                                    value="${sec}"
                                    onchange="updateRaceStepTime('${step.id}', this)">
                                <span> sec </span>
                                <input type="number" min="0" max="999"
                                    value="${milli}"
                                    onchange="updateRaceStepTime('${step.id}', this)">
                                <span> ms </span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        raceDiv.innerHTML = `
            <div class="info-card">
                <p>⏳ La course n’est pas active ou vous ne participez pas</p>
            </div>
        `;
    }

    /* =========================
       CALCUL DES SCORES
    ========================= */

    const participantTotals = currentChallenge.participants.map(p => {
        const id = p.type === 'team' ? p.teamId : p.username;
        const times = config.times?.[id] || {};

        let rawTotal = 0;        // ⏱️ vrai temps
        let weightedTotal = 0;   // 🧮 score

        config.steps.forEach(step => {
            const t = times[step.id];
            if (typeof t === 'number') {
                rawTotal += t;
                weightedTotal += t * (step.coef ?? 1);
            }
        });

        return {
            id,
            name: p.type === 'team' ? p.teamName : p.username,
            rawTotal,
            weightedTotal
        };
    }).filter(p => p.rawTotal > 0);

    
    participantTotals.sort((a, b) => a.rawTotal - b.rawTotal);

    if (!currentChallenge.progressions) {
        currentChallenge.progressions = {};
    }

    const bestWeightedTime = participantTotals[0]?.weightedTotal ?? 0;

    participantTotals.forEach((p, index) => {
        const delta = p.weightedTotal - bestWeightedTime;
        const score = Math.max(0, Math.round(1000 - delta / 10));

        // 🧱 Init progression si absente
        if (!currentChallenge.progressions[p.id]) {
            currentChallenge.progressions[p.id] = {};
        }

        // 💾 Sauvegarde du score
        currentChallenge.progressions[p.id].score = score;
    });

    const bestTime = participantTotals[0]?.weightedTotal ?? 0;

    /* =========================
       CLASSEMENT
    ========================= */

    const rankingsDiv = document.getElementById('raceRankings');

    if (participantTotals.length === 0) {
        rankingsDiv.innerHTML = `
            <div class="info-card">
                <p>Aucun temps renseigné</p>
            </div>
        `;
        return;
    }

    rankingsDiv.innerHTML = `
        <div class="rankings-container">
            <h3>📊 Classement</h3>
            <table class="rankings-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Participant</th>
                        <th>Temps total</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${participantTotals.map((p, index) => {
                        const delta = p.weightedTotal - bestTime;
                        const score = Math.max(0, Math.round(1000 - delta / 10));
                        
                        const medal =
                            index === 0 ? '🥇' :
                            index === 1 ? '🥈' :
                            index === 2 ? '🥉' : '';

                        return `
                            <tr class="${index < 3 ? 'podium-row' : ''}">
                                <td><strong>${medal} ${index + 1}</strong></td>
                                <td>${p.name}</td>
                                <td>${formatTime(p.rawTotal)}</td>
                                <td><strong>${score} pts</strong></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


function updateRaceStepTime(stepId, input) {
    const config = currentChallenge.raceConfig;

    // 🔎 Identifier le participant
    let participantId = null;

    if (currentChallenge.teamFormat === 'team') {
        const userTeams = teams.filter(t =>
            t.members.some(m => m.username === currentUser)
        );

        const participantTeam = currentChallenge.participants.find(p =>
            p.type === 'team' && userTeams.some(t => t.id === p.teamId)
        );

        if (participantTeam) {
            participantId = participantTeam.teamId;
        }
    } else {
        participantId = currentUser;
    }

    if (!participantId) return;

    // 🧱 Init des structures
    if (!config.times) config.times = {};
    if (!config.times[participantId]) config.times[participantId] = {};

    // 📥 Lire les 3 inputs de l’étape
    const stepDiv = input.closest('.race-step');
    const inputs = stepDiv.querySelectorAll('input');

    const minutes = parseInt(inputs[0].value) || 0;
    const seconds = parseInt(inputs[1].value) || 0;
    const millis  = parseInt(inputs[2].value) || 0;

    const totalMs =
        minutes * 60000 +
        seconds * 1000 +
        Math.min(millis, 999);

    // 💾 Sauvegarde
    config.times[participantId][stepId] = totalMs;
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));

    // 🔄 Rafraîchir affichage / classement
    renderRace();
}

function formatTime(ms) {
    if (typeof ms !== 'number' || ms < 0) return '00:00.000';

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis  = Math.floor(ms % 1000);

    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const mmm = String(millis).padStart(3, '0');

    return `${mm}:${ss}.${mmm}`;
}


// ========== MARATHON ==========
function renderMarathon() {
    const config = currentChallenge.marathonConfig;
    const currentUserData = users.find(u => u.username === currentUser);
    const userTeams = teams.filter(t => t.members.some(m => m.username === currentUser));
    
    let isParticipant = false;
    let participantId = null;
    
    if(currentChallenge.teamFormat === 'team') {
        const participantTeam = currentChallenge.participants.find(p => 
            p.type === 'team' && userTeams.some(t => t.id === p.teamId)
        );
        if(participantTeam) {
            isParticipant = true;
            participantId = participantTeam.teamId;
        }
    } else {
        isParticipant = currentChallenge.participants.some(p => p.type === 'player' && p.username === currentUser);
        participantId = currentUser;
    }

    const userCompletions = config.completions[participantId] || [];
    
    const objectivesDiv = document.getElementById('marathonObjectives');
    objectivesDiv.innerHTML = `
        <div class="objectives-grid">
            ${[...config.objectives, ...(config.negatives || [])].map(obj => {
                const completionCount = userCompletions.filter(id => id === obj.id).length;
                const isNegative = obj.points < 0;

                return `
                    <div class="marathon-objective ${completionCount > 0 ? 'completed' : ''} ${isNegative ? 'negative' : ''}">
                        <div class="objective-header">
                            <div class="objective-icon">${completionCount > 0 ? (isNegative ? '❌' : '✅') : (isNegative ? '⚠️' : '🎯')}</div>
                            <h4>${obj.name}</h4>
                        </div>
                        <div class="objective-details">
                            <span class="objective-points">${isNegative ? '' : '+'}${obj.points} pts</span>
                            ${obj.repeatable ? '<span class="objective-badge repeatable">♻️ Répétable</span>' : ''}
                            <span class="objective-count">×${completionCount}</span>
                        </div>
                        ${isParticipant && currentChallenge.status === 'active' ? `
                            <div class="objective-buttons" style="display:flex; gap:0.25rem; margin-top:0.25rem;">
                                <button class="btn btn-sm btn-success" onclick="changeObjectiveCount('${obj.id}', 1)">+</button>
                                <button class="btn btn-sm btn-danger" onclick="changeObjectiveCount('${obj.id}', -1)" ${completionCount === 0 ? 'disabled' : ''}>-</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Progression des participants
    const progressDiv = document.getElementById('marathonProgress');
    const participantScores = currentChallenge.participants.map(p => {
        const id = p.type === 'team' ? p.teamId : p.username;
        const name = p.type === 'team' ? p.teamName : p.username;
        const completions = config.completions[id] || [];
        const score = completions.reduce((sum, objId) => {
            const obj = [...config.objectives, ...(config.negatives || [])].find(o => o.id === objId);
            return sum + (obj ? obj.points : 0);
        }, 0);
        
        return { name, score, completions: completions.length };
    }).sort((a, b) => b.score - a.score);

    // Mettre à jour la progression de l'utilisateur courant
    if(!currentChallenge.progressions) currentChallenge.progressions = {};
    const currentParticipant = participantScores.find(p => p.name === currentUser);
    if(currentParticipant) {
        currentChallenge.progressions[currentUser] = {
            score: currentParticipant.score,
            completions: currentParticipant.completions
        };
    }

    progressDiv.innerHTML = `
        <div class="progress-container">
            <h3>📊 Progression</h3>
            <table class="progress-table">
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Participant</th>
                        <th>Objectifs</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${participantScores.map((p, index) => {
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                        return `
                            <tr class="${index < 3 ? 'podium-row' : ''}">
                                <td><strong>${medal} ${index + 1}</strong></td>
                                <td>${p.name}</td>
                                <td>${p.completions}</td>
                                <td><strong>${p.score} pts</strong></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ======== Nouvelle fonction pour gérer + / - ========
function changeObjectiveCount(objectiveId, delta) {
    const config = currentChallenge.marathonConfig;
    const obj = [...config.objectives, ...(config.negatives || [])].find(o => o.id === objectiveId);
    if(!obj) return;

    const userTeams = teams.filter(t => t.members.some(m => m.username === currentUser));
    let participantId = null;
    let participantName = null;
    
    if(currentChallenge.teamFormat === 'team') {
        const participantTeam = currentChallenge.participants.find(p => 
            p.type === 'team' && userTeams.some(t => t.id === p.teamId)
        );
        if(participantTeam) {
            participantId = participantTeam.teamId;
            participantName = participantTeam.teamName;
        }
    } else {
        participantId = currentUser;
        participantName = currentUser;
    }
    if(!participantId) return;

    if(!config.completions[participantId]) config.completions[participantId] = [];
    
    const currentCount = config.completions[participantId].filter(id => id === objectiveId).length;

    if(delta > 0) {
        // Ajouter une occurrence
        config.completions[participantId].push(objectiveId);
        showNotification(`${participantName} a complété "${obj.name}" (${obj.points > 0 ? '+' : ''}${obj.points} pts)`);
    } else if(delta < 0 && currentCount > 0) {
        // Retirer une occurrence
        const index = config.completions[participantId].indexOf(objectiveId);
        if(index !== -1) config.completions[participantId].splice(index, 1);
        showNotification(`${participantName} a retiré une validation de "${obj.name}" (${obj.points > 0 ? '-' : ''}${obj.points} pts)`);
    }

    // Mettre à jour la progression de l'utilisateur courant
    if(!currentChallenge.progressions) currentChallenge.progressions = {};
    const completions = config.completions[participantId] || [];
    const score = completions.reduce((sum, objId) => {
        const o = [...config.objectives, ...(config.negatives || [])].find(o => o.id === objId);
        return sum + (o ? o.points : 0);
    }, 0);

    currentChallenge.progressions[currentUser] = {
        score,
        completions: completions.length
    };

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    renderMarathon(); // Re-render pour mettre à jour les compteurs et boutons
}

// ========== Compléter un objectif ==========
function completeObjective(objectiveId) {
    const config = currentChallenge.marathonConfig;
    const obj = [...config.objectives, ...(config.negatives || [])].find(o => o.id === objectiveId);
    if(!obj) return;

    const userTeams = teams.filter(t => t.members.some(m => m.username === currentUser));
    
    let participantId = null;
    let participantName = null;
    
    if(currentChallenge.teamFormat === 'team') {
        const participantTeam = currentChallenge.participants.find(p => 
            p.type === 'team' && userTeams.some(t => t.id === p.teamId)
        );
        if(participantTeam) {
            participantId = participantTeam.teamId;
            participantName = participantTeam.teamName;
        }
    } else {
        participantId = currentUser;
        participantName = currentUser;
    }
    
    if(!participantId) return;
    
    if(!config.completions[participantId]) config.completions[participantId] = [];
    
    const alreadyCompleted = config.completions[participantId].includes(objectiveId);
    
    if(!obj.repeatable && alreadyCompleted) {
        showNotification('Objectif déjà complété', 'error');
        return;
    }

    config.completions[participantId].push(objectiveId);

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `${participantName} a complété "${obj.name}" (${obj.points > 0 ? '+' : ''}${obj.points} pts)` }));

    showNotification(`Objectif complété ! ${obj.points > 0 ? '+' : ''}${obj.points} pts`);
}


function calculateMarathonScore(userCompletions) {
    let score = 0;

    // Objectifs positifs
    marathonObjectives.forEach((obj, index) => {
        const completedTimes = userCompletions.filter(id => id === index).length;
        score += obj.points * (obj.repeatable ? completedTimes : (completedTimes > 0 ? 1 : 0));
    });

    // Objectifs négatifs
    negativeObjectives.forEach((obj, index) => {
        const completedTimes = userCompletions.filter(id => id === index).length;
        score += obj.points * (obj.repeatable ? completedTimes : (completedTimes > 0 ? 1 : 0));
    });

    return score;
}


// ========== BINGO ==========
function renderBingo() {
    const config = currentChallenge.bingoConfig;
    const bingoSize = config.size || 3;
    const currentUserData = users.find(u => u.username === currentUser);
    const userTeams = teams.filter(t => t.members.some(m => m.username === currentUser));

    let isParticipant = false;
    let participantId = null;

    if(currentChallenge.teamFormat === 'team') {
        const participantTeam = currentChallenge.participants.find(p => 
            p.type === 'team' && userTeams.some(t => t.id === p.teamId)
        );
        if(participantTeam) {
            isParticipant = true;
            participantId = participantTeam.teamId;
        }
    } else {
        isParticipant = currentChallenge.participants.some(p => p.type === 'player' && p.username === currentUser);
        participantId = currentUser;
    }

    const userCompletions = config.completions[participantId] || [];
    const gridDiv = document.getElementById('bingoGrid');

    // Taille maximale d'une case
    const maxCaseSize = 120; // px
    const gap = 5; // px
    const containerWidth = gridDiv.clientWidth || (maxCaseSize * bingoSize + gap * (bingoSize - 1));
    const caseSize = Math.min(maxCaseSize, (containerWidth - gap * (bingoSize - 1)) / bingoSize);

    gridDiv.innerHTML = `
        <div class="bingo-grid-container" style="
            display: grid;
            grid-template-columns: repeat(${bingoSize}, ${caseSize}px);
            gap: ${gap}px;
            justify-content: center;
        ">
            ${config.grid.map(cell => {
                const isCompleted = userCompletions.includes(cell.position);
                return `
                    <div class="bingo-cell ${isCompleted ? 'completed' : ''}" 
                         ${isParticipant && currentChallenge.status === 'active' ? `onclick="toggleBingoCell(${cell.position})"` : ''} 
                         style="width: ${caseSize}px; height: ${caseSize}px;">
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
        const id = p.type === 'team' ? p.teamId : p.username;
        const name = p.type === 'team' ? p.teamName : p.username;
        const completions = config.completions[id] || [];
        const lines = countBingoLines(completions, bingoSize); // adapte countBingoLines pour taille variable

        return { 
            name,
            completed: completions.length,
            lines: lines.total,
            bingo: lines.total >= bingoSize
        };
    }).sort((a, b) => b.lines - a.lines || b.completed - a.completed);

    progressDiv.innerHTML = `
        <div class="progress-container">
            <h3>🎲 Progression</h3>
            <table class="progress-table">
                <thead>
                    <tr>
                        <th>Participant</th>
                        <th>Cases</th>
                        <th>Lignes</th>
                        <th>Statut</th>
                    </tr>
                </thead>
                <tbody>
                    ${participantProgress.map(p => `
                        <tr class="${p.bingo ? 'bingo-winner' : ''}">
                            <td><strong>${p.name}</strong></td>
                            <td>${p.completed}/${config.grid.length}</td>
                            <td>${p.lines}</td>
                            <td>${p.bingo ? '<span class="bingo-badge">🎉 BINGO!</span>' : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function toggleBingoCell(position) {
    const config = currentChallenge.bingoConfig;
    const bingoSize = config.size || 3;
    const currentUserData = users.find(u => u.username === currentUser);
    const userTeams = teams.filter(t => t.members.some(m => m.username === currentUser));
    
    let participantId = null;
    let participantName = null;
    
    if(currentChallenge.teamFormat === 'team') {
        const participantTeam = currentChallenge.participants.find(p => 
            p.type === 'team' && userTeams.some(t => t.id === p.teamId)
        );
        if(participantTeam) {
            participantId = participantTeam.teamId;
            participantName = participantTeam.teamName;
        }
    } else {
        participantId = currentUser;
        participantName = currentUser;
    }
    
    if(!participantId) return;
    
    if(!config.completions[participantId]) {
        config.completions[participantId] = [];
    }
    
    const index = config.completions[participantId].indexOf(position);
    
    if(index > -1) {
        config.completions[participantId].splice(index, 1);
    } else {
        config.completions[participantId].push(position);
    }
    
    const lines = countBingoLines(config.completions[participantId], bingoSize);
    let bingoPoints = (lines.total > bingoSize && index === -1) ? 20
                    : (lines.total === bingoSize && index === -1) ? 30
                    : 20;
    currentChallenge.progressions[currentUser].score = calculateBingoScore(config.completions[participantId], bingoSize, 10, bingoPoints);

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    
    if(lines.total >= bingoSize && index === -1) {
        ws.send(JSON.stringify({ type: 'notification', text: `🎉 ${participantName} a fait BINGO !` }));
        showNotification('🎉 BINGO !');
    }
}

function countBingoLines(completions, size) {
    let lines = 0, cols = 0, diags = 0;

    // Lignes
    for(let row = 0; row < size; row++) {
        let complete = true;
        for(let col = 0; col < size; col++) {
            if(!completions.includes(row * size + col)) {
                complete = false;
                break;
            }
        }
        if(complete) lines++;
    }

    // Colonnes
    for(let col = 0; col < size; col++) {
        let complete = true;
        for(let row = 0; row < size; row++) {
            if(!completions.includes(row * size + col)) {
                complete = false;
                break;
            }
        }
        if(complete) cols++;
    }

    // Diagonales
    let diag1 = true, diag2 = true;
    for(let i = 0; i < size; i++) {
        if(!completions.includes(i * size + i)) diag1 = false;
        if(!completions.includes(i * size + (size - 1 - i))) diag2 = false;
    }
    if(diag1) diags++;
    if(diag2) diags++;

    return { lines, cols, diags, total: lines + cols + diags };
}

function calculateBingoScore(completions, size, pointsPerCell, pointsPerLine) {
    // Score de base = nombre de cases cochées
    let score = completions.length * pointsPerCell;

    // Bonus lignes/colonnes/diagonales
    const linesData = countBingoLines(completions, size);
    score += linesData.total * pointsPerLine;

    return score;
}