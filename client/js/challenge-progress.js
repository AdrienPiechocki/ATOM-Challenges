let currentChallengeId = null;

const urlParams = new URLSearchParams(window.location.search);
currentChallengeId = urlParams.get('id');

if(!currentChallengeId) {
    window.location.href = 'challenges.html';
}

function goBackToDetail() {
    window.location.href = `challenge-detail.html?id=${currentChallengeId}`;
}

function updatePageData() {
    renderProgress();
}

function renderProgress() {
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
    
    // Initialiser les progressions si nécessaire
    if(!challenge.progressions) {
        challenge.progressions = {};
        challenge.participants.forEach(p => {
            challenge.progressions[p.username] = {
                submissions: [],
                score: 0,
                validated: 0,
                rejected: 0,
                cheated: false
            };
        });
    }
    
    // Section participant
    if(isParticipant) {
        document.getElementById('participantSection').style.display = 'block';
        renderMyProgress(challenge);
    } else {
        document.getElementById('participantSection').style.display = 'none';
    }
    
    // Section organisateur
    if(isOrganizer) {
        document.getElementById('organizerSection').style.display = 'block';
        renderValidation(challenge);
    } else {
        document.getElementById('organizerSection').style.display = 'none';
    }
    
    // Classement
    renderScoreboard(challenge);
}

function renderMyProgress(challenge) {
    const myProgress = challenge.progressions[currentUser];
    const content = document.getElementById('myProgressContent');
    
    const formatInstructions = {
        tournoi: 'Indiquez vos victoires dans les matchs',
        course: 'Indiquez votre temps de complétion',
        marathon: 'Cochez les objectifs accomplis',
        bingo: 'Cochez les cases de votre grille Bingo'
    };
    
    let html = `
        <div class="progress-card">
            <h4>${formatInstructions[challenge.format]}</h4>
            <p style="margin: 1rem 0;">
                ✅ Validées: ${myProgress.validated} | 
                ⏳ En attente: ${myProgress.submissions.filter(s => s.status === 'pending').length} | 
                ❌ Rejetées: ${myProgress.rejected}
            </p>
            ${myProgress.cheated ? '<p style="color: var(--danger); font-weight: 600;">⚠️ Vous êtes suspecté de triche</p>' : ''}
            <button class="btn btn-primary" onclick="openSubmitModal()">+ Soumettre une progression</button>
        </div>
        
        <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Mes soumissions</h4>
    `;
    
    if(myProgress.submissions.length === 0) {
        html += '<p class="empty-state">Aucune soumission pour le moment</p>';
    } else {
        html += myProgress.submissions.map((sub, index) => `
            <div class="progress-card">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4>Soumission #${index + 1}</h4>
                        <p style="margin-top: 0.5rem;">${sub.description}</p>
                        <p style="margin-top: 0.5rem; color: var(--gray); font-size: 0.875rem;">
                            ${new Date(sub.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <span class="progress-status ${sub.status}">${getStatusText(sub.status)}</span>
                </div>
                ${sub.organizerNote ? `<p style="margin-top: 1rem; padding: 0.5rem; background: var(--light); border-radius: 4px;"><strong>Note:</strong> ${sub.organizerNote}</p>` : ''}
            </div>
        `).join('');
    }
    
    content.innerHTML = html;
}

function renderValidation(challenge) {
    const content = document.getElementById('validationContent');
    
    let html = '';
    
    challenge.participants.forEach(participant => {
        const progress = challenge.progressions[participant.username];
        const pendingSubmissions = progress.submissions.filter(s => s.status === 'pending');
        
        if(pendingSubmissions.length === 0) return;
        
        html += `
            <div class="validation-card">
                <div class="validation-header">
                    <h4>${participant.username}</h4>
                    <span class="badge">${pendingSubmissions.length} en attente</span>
                </div>
                ${pendingSubmissions.map((sub, index) => `
                    <div style="margin: 1rem 0; padding: 1rem; background: var(--light); border-radius: 8px;">
                        <p><strong>Soumission:</strong> ${sub.description}</p>
                        <p style="margin-top: 0.5rem; color: var(--gray); font-size: 0.875rem;">
                            ${new Date(sub.timestamp).toLocaleString()}
                        </p>
                        <div class="validation-actions" style="margin-top: 1rem;">
                            <button class="btn btn-success btn-sm" onclick="validateSubmission('${participant.username}', ${progress.submissions.indexOf(sub)})">✓ Valider</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectSubmission('${participant.username}', ${progress.submissions.indexOf(sub)})">✗ Rejeter</button>
                            <button class="btn btn-warning btn-sm" onclick="markAsCheater('${participant.username}')">⚠️ Triche</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    });
    
    if(!html) {
        html = '<p class="empty-state">Aucune soumission en attente de validation</p>';
    }
    
    content.innerHTML = html;
}

function renderScoreboard(challenge) {
    const content = document.getElementById('scoreboardContent');
    
    const sorted = [...challenge.participants].sort((a, b) => {
        const scoreA = (challenge.progressions[a.username]?.score || 0) * a.multiplier + a.modifier;
        const scoreB = (challenge.progressions[b.username]?.score || 0) * b.multiplier + b.modifier;
        return scoreB - scoreA;
    });
    
    const html = `
        <table class="scoreboard-table">
            <thead>
                <tr>
                    <th>Rang</th>
                    <th>Participant</th>
                    <th>Score</th>
                    <th>Validées</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map((p, index) => {
                    const progress = challenge.progressions[p.username];
                    const finalScore = (progress?.score || 0) * p.multiplier + p.modifier;
                    
                    return `
                        <tr>
                            <td class="rank-cell">#${index + 1}</td>
                            <td>${p.username}${p.username === challenge.organizer ? ' 👑' : ''}</td>
                            <td style="font-weight: bold; color: var(--primary);">${finalScore.toFixed(1)}</td>
                            <td>${progress?.validated || 0}</td>
                            <td>${progress?.cheated ? '<span style="color: var(--danger);">⚠️ Suspecté</span>' : '✓'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    content.innerHTML = html;
}

function openSubmitModal() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge) return;
    
    const modalContent = document.getElementById('submitModalContent');
    
    modalContent.innerHTML = `
        <div class="form-group">
            <label for="submissionDescription">Description de votre progression *</label>
            <textarea id="submissionDescription" rows="4" required placeholder="Ex: J'ai terminé le niveau 3 en 2:45"></textarea>
        </div>
        <button class="btn btn-primary" onclick="submitProgress()">Soumettre</button>
    `;
    
    document.getElementById('submitModal').classList.remove('hidden');
}

function closeSubmitModal() {
    document.getElementById('submitModal').classList.add('hidden');
}

function submitProgress() {
    const description = document.getElementById('submissionDescription').value.trim();
    
    if(!description) {
        showNotification('Veuillez décrire votre progression', 'error');
        return;
    }
    
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge) return;
    
    const myProgress = challenge.progressions[currentUser];
    
    myProgress.submissions.push({
        description: description,
        timestamp: Date.now(),
        status: 'pending',
        organizerNote: null
    });
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `${currentUser} a soumis une progression dans "${challenge.name}"` }));
    
    closeSubmitModal();
    showNotification('Progression soumise avec succès !');
}

function validateSubmission(username, submissionIndex) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge || challenge.organizer !== currentUser) return;
    
    const progress = challenge.progressions[username];
    const submission = progress.submissions[submissionIndex];
    
    submission.status = 'validated';
    progress.validated++;
    progress.score += 10; // Points par validation
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `Progression de ${username} validée dans "${challenge.name}"` }));
    
    showNotification('Progression validée');
}

function rejectSubmission(username, submissionIndex) {
    const note = prompt('Raison du rejet (optionnel):');
    
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge || challenge.organizer !== currentUser) return;
    
    const progress = challenge.progressions[username];
    const submission = progress.submissions[submissionIndex];
    
    submission.status = 'rejected';
    submission.organizerNote = note || 'Rejeté par l\'organisateur';
    progress.rejected++;
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `Progression de ${username} rejetée dans "${challenge.name}"` }));
    
    showNotification('Progression rejetée');
}

function markAsCheater(username) {
    if(!confirm(`Êtes-vous sûr de vouloir marquer ${username} comme tricheur ?`)) return;
    
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if(!challenge || challenge.organizer !== currentUser) return;
    
    const progress = challenge.progressions[username];
    progress.cheated = true;
    
    // Marquer aussi l'utilisateur globalement
    const user = users.find(u => u.username === username);
    if(user) {
        user.cheated = true;
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
    }
    
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `${username} a été marqué comme tricheur dans "${challenge.name}"` }));
    
    showNotification(`${username} marqué comme tricheur`);
}

function getStatusText(status) {
    const texts = {
        pending: '⏳ En attente',
        validated: '✅ Validée',
        rejected: '❌ Rejetée'
    };
    return texts[status] || status;
}
