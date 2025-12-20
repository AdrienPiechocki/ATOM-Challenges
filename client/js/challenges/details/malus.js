let malusTarget = null;
const MALUS_CONFIG = {
    maxPenalty: 30,
    cooldownMs: 60 * 1000,
    teamSplitRatio: 0.6,
    rankingMultiplier: { top: 0.5, middle: 1, bottom: 1.3 }
};

function canUseMalus(challenge, username) {
    if (!challenge.malusCooldowns) challenge.malusCooldowns = {};
    const last = challenge.malusCooldowns[username];
    return !last || Date.now() - last >= MALUS_CONFIG.cooldownMs;
}

function openMalusModal(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;
    if (!canUseMalus(challenge, currentUser)) {
        showNotification('⏱ Malus en cooldown', 'error');
        return;
    }

    malusTarget = username;
    document.getElementById('malusTargetName').textContent = username;
    document.getElementById('malusUserPoints').textContent = user.totalPoints;
    document.getElementById('malusCost').value = 10;
    updateMalusPreview();
    document.getElementById('malusModal').classList.remove('hidden');
}

function updateMalusPreview() {
    const cost = parseInt(document.getElementById('malusCost').value) || 0;
    const penalty = Math.floor(Math.sqrt(cost) * 5);
    document.getElementById('malusPreview').textContent = `Malus estimé : -${penalty} pts`;
}

function applyMalus() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const attacker = users.find(u => u.username === currentUser);
    if (!challenge || !attacker || !malusTarget) return;

    const cost = parseInt(document.getElementById('malusCost').value);
    if (!cost || cost <= 0) {
        showNotification('Montant invalide', 'error');
        return;
    }

    // 🔒 Vérification points disponibles
    if (attacker.totalPoints < cost) {
        showNotification('Points insuffisants', 'error');
        return;
    }

    const penalty = Math.floor(Math.sqrt(cost) * 5)

    // Déduction des points de l'attaquant
    attacker.totalPoints -= cost;
    const attackerParticipant = challenge.participants.find(p => p.username === currentUser);
    if (attackerParticipant) {
        if (attackerParticipant.type === 'team') {
            attackerParticipant.usedPoints[currentUser] += cost;
        } else {
            attackerParticipant.usedPoints += cost;
        }
    }


    // 🔄 Appliquer le malus
    const target = challenge.participants.find(p => p.username === malusTarget);
    if (!target) return;

    if (target.type === 'team') {
        const teamMembers = challenge.participants.filter(p => p.type === 'team' && p.teamId === target.teamId);
        const perPlayer = Math.ceil((penalty * (MALUS_CONFIG.teamSplitRatio || 1)) / teamMembers.length);

        // Appliquer le malus
        teamMembers.forEach(p => (p.modifier = (p.modifier || 0) - perPlayer));
    } else {
        target.modifier = (target.modifier || 0) - penalty;
    }

    // 🔹 Journal du malus
    if (!challenge.malusLog) challenge.malusLog = [];
    challenge.malusLog.push({ from: currentUser, to: malusTarget, cost, penalty, timestamp: Date.now() });
    challenge.malusCooldowns[currentUser] = Date.now();

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'notification', text: `⚡ ${currentUser} inflige -${penalty} à ${malusTarget}` }));

    closeMalusModal();
    showNotification(`Malus de -${penalty} appliqué`);
}

function closeMalusModal() {
    document.getElementById('malusModal').classList.add('hidden');
    malusTarget = null;
}