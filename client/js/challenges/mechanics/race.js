
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

    if (!currentChallenge.progressions) currentChallenge.progressions = {};

    const participantTotals = currentChallenge.participants
        .map(p => {
            const id = p.type === 'team' ? p.teamId : p.username;
            const times = config.times?.[id] || {};

            let rawTotal = 0;
            let weightedTotal = 0;

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
        })
        .filter(p => p.rawTotal > 0)
        .sort((a, b) => a.rawTotal - b.rawTotal);

    if (participantTotals.length === 0) {
        document.getElementById('raceRankings').innerHTML = `
            <div class="info-card"><p>Aucun temps renseigné</p></div>
        `;
        return;
    }

    const bestTime = participantTotals[0].weightedTotal;

    participantTotals.forEach(p => {
        const delta = p.weightedTotal - bestTime;
        const score = Math.max(0, Math.round(1000 - delta / 10)/10);
        currentChallenge.progressions[p.id].score = score;
    });
    
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
                        const score = Math.max(0, Math.round(1000 - delta / 10)/10);
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

    // 🔄 Rafraîchir affichage / classement
    renderRace();

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
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

