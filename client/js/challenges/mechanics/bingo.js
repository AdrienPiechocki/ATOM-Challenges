
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