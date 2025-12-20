

function addCheater(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;
    
    const target = challenge.participants.find(p => p.username === username || p.teamId === username);
    if (!target) return;

    if (target.type === 'team') {
        openCheatModal(target.teamId)
    } else {
        users.forEach(u => {
            if (u.username === username) {
                u.cheated.push(currentChallengeId);
                challenge.progressions[u.username].cheated = true;
            }
        });
        showNotification(`Utilisateur signalé`);
    }
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    renderChallengeDetail();
}

function addCheaterFromTeam(username, teamId) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;

    const teamParticipant = challenge.participants.find((p) => p.type === 'team' && p.teamId === teamId);
    const teamIndex = challenge.participants.indexOf(teamParticipant);
    const target = challenge.participants[teamIndex].members.find(member => member.username === username);
    const targetIndex = challenge.participants[teamIndex].members.indexOf(target);

    if(teamParticipant.members.some(user => user.username === username)) {
        users.forEach(u => {
            if (u.username === username) {
                u.cheated.push(currentChallengeId);
                challenge.participants[teamIndex].members[targetIndex].cheated = true;
            }
        });
        showNotification(`Utilisateur signalé`);
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        renderChallengeDetail();
        closeCheatModal();
    }
}

function removeCheater(username) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;

    const target = challenge.participants.find(p => p.username === username || p.teamId === username);
    if (!target) return;

    if (target.type === 'team') {
        openCheatModal(target.teamId)
    } else {
        users.forEach(u => {
            if (u.username === username) {
                u.cheated.splice(u.cheated.indexOf(currentChallengeId));
                challenge.progressions[u.username].cheated = false;
            }
        })
        showNotification(`Utilisateur gracié`);
    }
    ws.send(JSON.stringify({ type: 'updateUsers', users }));
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    renderChallengeDetail();
}

function removeCheaterFromTeam(username, teamId) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;

    const teamParticipant = challenge.participants.find((p) => p.type === 'team' && p.teamId === teamId);
    const teamIndex = challenge.participants.indexOf(teamParticipant);
    const target = challenge.participants[teamIndex].members.find(member => member.username === username);
    const targetIndex = challenge.participants[teamIndex].members.indexOf(target);

    if(teamParticipant.members.some(user => user.username === username)) {
        users.forEach(u => {
            if (u.username === username) {
                u.cheated.splice(u.cheated.indexOf(currentChallengeId));
                challenge.participants[teamIndex].members[targetIndex].cheated = false;
            }
        });
        showNotification(`Utilisateur gracié`);
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        renderChallengeDetail();
        closeCheatModal();
    }
}

function openCheatModal(teamId) {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    const user = users.find(u => u.username === currentUser);
    if (!challenge || !user) return;

    const teamParticipant = challenge.participants.find((p) => p.type === 'team' && p.teamId === teamId);
    document.getElementById('teamUsers').innerHTML = teamParticipant.members
        .map(member => `
            <div class="team-member">- ${member.username}</div>

            ${
            !member.cheated
                ? `<button class="btn btn-danger btn-sm"
                    onclick="event.stopPropagation(); addCheaterFromTeam('${member.username}', '${teamId}')">
                    ⚠️ Signaler
                </button>`
                : ''
            }

            ${
            member.cheated
                ? `<button class="btn btn-success btn-sm"
                    onclick="event.stopPropagation(); removeCheaterFromTeam('${member.username}', '${teamId}')">
                    😇 Gracier
                </button>`
                : ''
            }
        `)
        .join('');


    document.getElementById('cheatModal').classList.remove('hidden');
}

function closeCheatModal() {
    document.getElementById('cheatModal').classList.add('hidden');
}
