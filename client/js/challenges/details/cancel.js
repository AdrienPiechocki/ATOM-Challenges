
// -------------------- LEAVE / DELETE --------------------
function leaveChallenge() {
    if (!confirm('Voulez-vous vraiment quitter ce défi ?')) return;

    const challenge = challenges.find(c => String(c.id) === String(currentChallengeId));
    if (!challenge) return;

    // 🔍 Chercher une participation d'équipe
    const teamParticipant = challenge.participants.find(
        p => p.type === 'team' && p.members.some(user => user.username === currentUser)
    );

    // ================== ÉQUIPE ==================
    if (teamParticipant) {
        
        const team = teams.find(t => t.id === teamParticipant.teamId && t.members.some(user => user.username === currentUser));
        if (!team) return showNotification('Équipe invalide', 'error');

        const isLeader = team.isLeader || team.members[0].username === currentUser;
        if (!isLeader) return showNotification('Seul le leader peut retirer l’équipe du défi', 'error');

        // 💰 Rembourser chaque membre
        teamParticipant.members.forEach(username => {
            const user = users.find(u => u.username === username.username);
            if (user) user.totalPoints += teamParticipant.bet;
        });

        // ❌ Retirer l’équipe du défi
        challenge.participants = challenge.participants.filter(
            p => p.teamId !== teamParticipant.teamId
        );

        showNotification('Équipe retirée du défi, mises remboursées');
    }

    // ================== SOLO ==================
    else {
        const soloParticipant = challenge.participants.find(
            p => p.type === 'player' && p.username === currentUser
        );

        if (!soloParticipant) return;

        // 💰 Remboursement
        const user = users.find(u => u.username === currentUser);
        if (user) user.totalPoints += soloParticipant.bet;

        // ❌ Retirer le joueur
        challenge.participants = challenge.participants.filter(
            p => p.username !== currentUser
        );

        showNotification('Vous avez quitté le défi, mise remboursée');
    }

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
}

function refundAllBets(challenge) {
    challenge.participants.forEach(p => {

        // 👤 Joueur solo
        if (p.type === 'player') {
            const user = users.find(u => u.username === p.username);
            if (user && p.usedPoints !== undefined) {
                user.totalPoints += p.usedPoints; // Rembourser les points utilisés
            }
        }

        // 👥 Équipe
        if (p.type === 'team') {
            p.members.forEach(username => {
                const user = users.find(u => u.username === username.username);
                if (user && p.usedPoints[username.username] !== undefined) {
                    user.totalPoints += p.usedPoints[username.username]; // Rembourser les points utilisés
                }
            });
        }
    });
}



function deleteChallenge() {
    if (!confirm('Supprimer ce défi ? Cette action est irréversible !')) return;

    const index = challenges.findIndex(c => c.id === currentChallengeId);
    if (index === -1) return;

    const challenge = challenges[index];

    // 🗑️ Suppression du défi
    challenges.splice(index, 1);
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));

    if (challenge.status === "finished") {
        showNotification('Défi supprimé');
    }else {
        showNotification('Défi supprimé et mises remboursées');
        // 🔄 Remboursement des mises
        if (challenge.participants && challenge.participants.length > 0) {
            refundAllBets(challenge)
            ws.send(JSON.stringify({ type: 'updateUsers', users }));
        }
    }    

    setTimeout(() => window.location.href = 'challenges.html', 800);
}


