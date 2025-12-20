let currentChallengeId = null;
let currentChallenge = null;
let raceStartTime = null;

const urlParams = new URLSearchParams(window.location.search);
currentChallengeId = urlParams.get('id');

if(!currentChallengeId) {
    window.location.href = 'challenges.html';
}

function goBack() {
    window.location.href = `challenge-detail.html?id=${currentChallengeId}`;
}

function updatePageData() {
    currentChallenge = challenges.find(c => c.id === currentChallengeId);
    if(!currentChallenge) {
        window.location.href = 'challenges.html';
        return;
    }
    
    document.getElementById('challengeTitle').textContent = currentChallenge.name;
    
    // Afficher la mécanique appropriée
    document.getElementById('tournamentMechanics').classList.add('hidden');
    document.getElementById('raceMechanics').classList.add('hidden');
    document.getElementById('marathonMechanics').classList.add('hidden');
    document.getElementById('bingoMechanics').classList.add('hidden');
    
    if(currentChallenge.format === 'tournoi') {
        document.getElementById('tournamentMechanics').classList.remove('hidden');
        renderTournament();
    } else if(currentChallenge.format === 'course') {
        document.getElementById('raceMechanics').classList.remove('hidden');
        renderRace();
    } else if(currentChallenge.format === 'marathon') {
        document.getElementById('marathonMechanics').classList.remove('hidden');
        renderMarathon();
    } else if(currentChallenge.format === 'bingo') {
        document.getElementById('bingoMechanics').classList.remove('hidden');
        renderBingo();
    }
}
