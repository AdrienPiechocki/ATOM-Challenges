// Description des formats
const formatDescriptions = {
    tournoi: 'Affrontement direct entre les joueurs selon un tirage au sort ou une phase de poule. Le gagnant du match A affronte le gagnant du match B au round suivant.',
    course: 'Le premier à remporter le défi remporte le plus de points, le deuxième un peu moins et ainsi de suite. Avec des modificateurs pour les écarts de temps.',
    marathon: 'Les joueurs ont plusieurs objectifs à accomplir en jeu en un temps donné fixe. Chaque objectif accompli fait augmenter le score.',
    bingo: 'Les joueurs doivent compléter une grille de Bingo correspondant à divers objectifs en jeu. Chaque ligne/colonne/diagonale apporte du score.'
};

// Afficher la description du format
document.getElementById('formatChallenge').addEventListener('change', (e) => {
    const format = e.target.value;
    const descEl = document.getElementById('formatDescription');
    
    if(format && formatDescriptions[format]) {
        descEl.textContent = formatDescriptions[format];
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }
});

// Afficher/masquer le champ mot de passe
document.getElementById('visibility').addEventListener('change', (e) => {
    const passwordGroup = document.getElementById('passwordGroup');
    if(e.target.value === 'password') {
        passwordGroup.classList.remove('hidden');
    } else {
        passwordGroup.classList.add('hidden');
    }
});

// Création du défi
document.getElementById('createChallengeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const user = users.find(u => u.username === currentUser);
    if(!user) return;
    
    const challengeName = document.getElementById('challengeName').value;
    const gameName = document.getElementById('gameName').value;
    const teamFormat = document.getElementById('teamFormat').value;
    const formatChallenge = document.getElementById('formatChallenge').value;
    const rulesChallenge = document.getElementById('rulesChallenge').value;
    const minPoints = parseInt(document.getElementById('minPoints').value) || 0;
    const maxPoints = parseInt(document.getElementById('maxPoints').value) || 100;
    const visibility = document.getElementById('visibility').value;
    const challengePassword = document.getElementById('challengePassword').value;
    
    if(minPoints > maxPoints) {
        showNotification('La mise minimum ne peut pas être supérieure à la mise maximum', 'error');
        return;
    }
    
    const newChallenge = {
        id: '_' + Math.random().toString(36).substr(2, 9),
        name: challengeName,
        game: gameName,
        teamFormat: teamFormat,
        format: formatChallenge,
        rules: rulesChallenge,
        minBet: minPoints,
        maxBet: maxPoints,
        visibility: visibility,
        password: visibility === 'password' ? challengePassword : null,
        organizer: currentUser,
        participants: [{
            username: currentUser,
            bet: 0,
            score: 0,
            modifier: 0,
            multiplier: 1
        }],
        progressions: {},
        status: 'waiting',
        createdAt: Date.now()
    };
    
    // Initialiser les progressions
    newChallenge.progressions[currentUser] = {
        submissions: [],
        score: 0,
        validated: 0,
        rejected: 0,
        cheated: false
    };
    
    challenges.push(newChallenge);
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    
    showNotification('Défi créé avec succès !');
    setTimeout(() => {
        window.location.href = `challenge-detail.html?id=${newChallenge.id}`;
    }, 1000);
});
