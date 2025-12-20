
// -------------------- START/FINISH CHALLENGE --------------------
function startChallenge() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if (!challenge) return;

    if (challenge.participants.length < 2) {
        showNotification('Il faut au moins 2 participants pour démarrer', 'error');
        return;
    }

    if (!challenge.progressions) challenge.progressions = {};
    challenge.participants.forEach(p => {
        if (!challenge.progressions[p.username || p.teamName]) {
            challenge.progressions[p.username || p.teamName] = { score: 0, cheated: false };
        }
    });

    challenge.status = 'active';
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a commencé !` }));
    showNotification('Défi démarré !');
}

// -------------------- FINISH CHALLENGE --------------------
function finishChallenge() {
    if (!confirm('Êtes-vous sûr de vouloir terminer ce défi ? Les remboursements en cas de suppression ne seront plus effectifs')) return;

    const challenge = challenges.find(c => c.id === currentChallengeId);
    if (!challenge || challenge.organizer !== currentUser) return;

    const results = challenge.participants.map(p => {
        const progress = challenge.progressions[p.username || p.teamName] || { score: 0, cheated: false };
        const finalScore = progress.score + (p.modifier || 0);

        // Utiliser le nom stocké directement
        const displayName = p.type === 'team' ? p.teamName || `#${p.teamId}` : p.username;

        return { ...p, displayName, score: finalScore, cheated: progress.cheated || false };
    });


    results.sort((a, b) => {
        if (a.cheated && !b.cheated) return 1;
        if (!a.cheated && b.cheated) return -1;
        return b.score - a.score;
    });

    const totalPot = challenge.participants.reduce((sum, team) => {
        const playersCount = team.members?.length || 1;
        return sum + (team.bet * playersCount);
    }, 0);

    console.log(totalPot)
    const nonCheaters = results.filter(r => !r.cheated);

    if (nonCheaters.length > 0) {
        const winner = nonCheaters[0];
        const winnerUser = users.find(u => u.username === winner.username);
        const winnerTeam = teams.find(t => t.id === winner.teamId)
        if (winnerUser) winnerUser.totalPoints += totalPot;
        if (winnerTeam) {
            console.log("oui")
            winner.members.forEach(username => {
                const user = users.find(u => u.username === username.username);
                console.log(user)
                if (user) {
                    user.totalPoints += totalPot/winner.members.length;
                }
            });
        }
        challenge.participants.forEach(p => {
            if (p.type === 'team') {
                p.members.forEach(username => {
                    const user = users.find(u => u.username === username.username);
                    if (user) {
                        user.challengesCompleted += 1;
                    }
                });
            } else {
                const user = users.find(u => u.username === p.username);
                if (user) {
                    user.challengesCompleted += 1;
                }
            }
        });


        challenge.results = { winner: winner.displayName, totalPot: totalPot, rankings: results, finishedAt: Date.now() };
        challenge.status = 'finished';

        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'notification', text: `🏆 ${winner.displayName} a gagné ${totalPot} points !` }));
        showNotification('Défi terminé !');
        setTimeout(() => showResults(), 1000);
    } else {
        challenge.participants.forEach(p => {
            if (p.type === 'team') {
                p.members.forEach(username => {
                    const user = users.find(u => u.username === username.username);
                    if (user) {
                        user.totalPoints += p.bet;
                        user.challengesCompleted += 1;
                    }
                });
            } else {
                const user = users.find(u => u.username === p.username);
                if (user) {
                    user.totalPoints += p.bet;
                    user.challengesCompleted += 1;
                }
            }
        });

        challenge.results = { winner: null, totalPot: 0, rankings: results, finishedAt: Date.now(), message: 'Tous les participants ont été disqualifiés' };
        challenge.status = 'finished';

        ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
        ws.send(JSON.stringify({ type: 'updateUsers', users }));
        ws.send(JSON.stringify({ type: 'notification', text: `Le défi "${challenge.name}" a été annulé - tous les participants ont triché` }));
        showNotification('Défi annulé - tous les participants disqualifiés');
    }
}

// -------------------- SHOW RESULTS --------------------
function showResults() {
    const challenge = challenges.find(c => c.id === currentChallengeId);
    if (!challenge || !challenge.results) return;

    const results = challenge.results;
    let html = `
        <h3>🏆 Résultats du défi</h3>
        ${results.message ? `<p>${results.message}</p>` : ''}
        <ol>
            ${results.rankings.map(r => `<li>${r.displayName} - ${r.score} pts ${r.cheated ? '⚠️' : ''}</li>`).join('')}
        </ol>
        ${results.winner ? `<p>🎉 Gagnant : ${results.winner} - Total du pot : ${results.totalPot} pts</p>` : ''}
    `;
    document.getElementById('resultsContent').innerHTML = html;
    document.getElementById('resultsModal').classList.remove('hidden');
}


function closeResultsModal() {
    document.getElementById('resultsModal').classList.add('hidden');
}
