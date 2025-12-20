
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

    // Mélanger pour éviter des patterns fixes
    for (let i = qualified.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qualified[i], qualified[j]] = [qualified[j], qualified[i]];
    }

    // Créer le bracket simple
    const bracket = [];
    let i = 0;
    while (i < qualified.length) {
        const player1 = qualified[i];
        const player2 = qualified[i + 1] || null; // si nombre impair, player2 sera null
        bracket.push({
            player1,
            player2,
            winner: player2 ? null : player1, // joueur seul passe automatiquement
            round: 1
        });
        i += 2;
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
                    
                    // Si un joueur est seul, on n’affiche pas de BYE
                    if (!match.player2) {
                        return `
                            <div class="bracket-match bye">
                                <div class="match-player">
                                    <span class="player-name">${p1} passe automatiquement</span>
                                </div>
                            </div>
                        `;
                    }

                    return `
                        <div class="bracket-match ${match.winner ? 'finished' : 'pending'}">
                            <div class="match-players">
                                <div class="match-player ${match.winner && match.winner.id === match.player1?.id ? 'winner' : match.winner ? 'loser' : ''}">
                                    <span class="player-name">${p1}</span>
                                </div>
                                <div class="match-vs">VS</div>
                                <div class="match-player ${match.winner && match.winner.id === match.player2?.id ? 'winner' : match.winner ? 'loser' : ''}">
                                    <span class="player-name">${p2}</span>
                                </div>
                            </div>
                            ${!match.winner && isOrganizer ? `
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

    const matchesInRound = config.bracket.filter(m => m.round === round);
    const match = matchesInRound[matchIndex];
    if (!match) return;

    const winner = (match.player1 && match.player1.id === winnerId) ? match.player1 :
                   (match.player2 && match.player2.id === winnerId) ? match.player2 : null;
    if (!winner) return;

    match.winner = winner;

    // Ajouter les points
    const WIN_POINTS = 10;
    if (!currentChallenge.progressions[winner.name]) currentChallenge.progressions[winner.name] = { score: 0 };
    currentChallenge.progressions[winner.name].score += WIN_POINTS;

    // Vérifier s’il y a un round suivant
    const winnersCurrentRound = matchesInRound.map(m => m.winner).filter(Boolean);

    if (winnersCurrentRound.length < 2) {
        // 👑 Dernier match : plus de round suivant
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        showNotification(`${winner.name} remporte le tournoi !`);
        return;
    }

    // Supprimer les matches existants du round suivant
    const nextRound = round + 1;
    config.bracket = config.bracket.filter(m => m.round <= round);

    // Créer les matches du round suivant
    for (let i = 0; i < winnersCurrentRound.length; i += 2) {
        const player1 = winnersCurrentRound[i];
        const player2 = winnersCurrentRound[i + 1] || null;
        config.bracket.push({
            player1,
            player2,
            winner: player2 ? null : player1, // passe automatiquement si seul
            round: nextRound
        });
    }

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    showNotification(`${winner.name} remporte le match !`);
}

