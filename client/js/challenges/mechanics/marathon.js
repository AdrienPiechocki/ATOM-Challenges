
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
                                <button class="btn btn-sm btn-success" onclick="changeObjectiveCount('${obj.id}', 1)" ${completionCount > 0 && !obj.repeatable ? 'disabled' : ''}>+</button>
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

