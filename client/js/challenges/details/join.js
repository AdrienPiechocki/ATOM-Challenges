
// -------------------- JOIN CHALLENGE --------------------
function openJoinModal(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;
    
    const currentUserData = users.find(u => u.username === currentUser);
    if (challenge.organizer != currentUserData.username && !challenge.cheatersAllowed && currentUserData.cheated.length >= 3) {
        showNotification('Les utilisateurs suspects ne sont pas le bienvenue dans ce défi', 'error');
        return;
    }

    selectedChallengeForJoin = challengeId;
    document.getElementById('joinChallengeName').textContent = challenge.name;

    const teamSection = document.getElementById('teamSelectionSection');
    const teamSelect = document.getElementById('teamSelect');

    if (challenge.teamFormat === "team") {
        teamSection.classList.remove('hidden');
        
        // On récupère les équipes de l'utilisateur qui ne sont pas déjà inscrites au défi
        const userTeams = teams.filter(t =>
            t.members.some(user => user.username === currentUser) &&
            !challenge.participants.some(p => p.type === 'team' && p.teamId === t.id)
        );

        if(userTeams.length === 0){
            showNotification('Vous devez faire partie d\'une équipe pour rejoindre ce défi', 'error');
            return;
        }

        teamSelect.innerHTML = userTeams
            .map(t => `<option value="${t.id}">${t.name}</option>`)
            .join('');
    } else {
        teamSection.classList.add('hidden');
    }


    document.getElementById('minBet').textContent = challenge.minBet;
    document.getElementById('maxBet').textContent = challenge.maxBet;

    if (challenge.password) document.getElementById('passwordSection').classList.remove('hidden');
    else document.getElementById('passwordSection').classList.add('hidden');

    document.getElementById('joinModal').classList.remove('hidden');
}

function closeJoinModal() {
    document.getElementById('joinModal').classList.add('hidden');
    selectedChallengeForJoin = null;
}

function confirmJoin() {
    if (!selectedChallengeForJoin) return;

    const challenge = challenges.find(c => String(c.id) === String(selectedChallengeForJoin));
    if (!challenge) return;

    let participant = { username: currentUser, type: 'player', bet: 0, modifier: 0, usedPoints: 0 };

    if (challenge.teamFormat === "team") {
        const teamId = document.getElementById('teamSelect').value;

        const team = teams.find(t => t.id === teamId && t.members.some(user => user.username === currentUser));
        if (!team) return showNotification('Équipe invalide', 'error');

        const isLeader = team.isLeader || team.members[0].username === currentUser;
        if (!isLeader) return showNotification('Seul le leader peut inscrire l’équipe', 'error');

        participant = {
            teamId: team.id,
            teamName: team.name,
            type: 'team',
            members: team.members,
            bet: 0,
            modifier: 0,
            isLeader: true,
            usedPoints: Object.fromEntries(
                team.members.map(u => [u.username, 0])
            )
        };
    }

    const betAmount = parseInt(document.getElementById('betAmount').value);

    if (isNaN(betAmount) || betAmount < challenge.minBet || betAmount > challenge.maxBet) {
        return showNotification('Mise invalide', 'error');
    }
    participant.bet = betAmount;
    if (challenge.password) {
        const pass = document.getElementById('joinPassword').value;
        if (pass !== challenge.password) return showNotification('Mot de passe incorrect', 'error');
    }

    if (participant.type === 'team') {
        if (participant.members.length < challenge.teamConfig.playersPerTeam) return showNotification("Pas assez de membres dans l'équipe", 'error');
        if (participant.members.length > challenge.teamConfig.playersPerTeam) return showNotification("Trop de membres dans l'équipe", 'error');
        
        const membersList = [];
        users.forEach(u => {
            if (participant.members.some(user => user.username === u.username)) {
                membersList.push(u.username)
            }
        })
        for (const username of membersList) {
            const user = users.find(u => u.username === username);
            if (!user || user.totalPoints < betAmount) {
                return showNotification(`Le membre ${username} n'a pas assez de points pour miser`, 'error');
            }
        }
        // Déduire les points et stocker les points initiaux
        participant.members.forEach(username => {
            const user = users.find(u => u.username === username.username);
            if(user) {
                participant.usedPoints[username.username] += betAmount;
                user.totalPoints -= betAmount;
            }
        });
    } else {
        const user = users.find(u => u.username === currentUser);
        if (!user || user.totalPoints < betAmount) {
            return showNotification(`Vous n'avez pas assez de points pour miser`, 'error');
        }
        participant.usedPoints += betAmount;
        user.totalPoints -= betAmount;
    }

    challenge.participants.push(participant);

    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'updateUsers', users }));

    closeJoinModal();
    showNotification('Vous avez rejoint le défi');
}
