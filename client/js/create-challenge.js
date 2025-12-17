// Description des formats
const formatDescriptions = {
    tournoi: 'Affrontement direct entre les joueurs selon un tirage au sort ou une phase de poule. Le gagnant du match A affronte le gagnant du match B au round suivant.',
    course: 'Le premier à remporter le défi remporte le plus de points, le deuxième un peu moins et ainsi de suite. Avec des modificateurs pour les écarts de temps.',
    marathon: 'Les joueurs ont plusieurs objectifs à accomplir en jeu en un temps donné fixe. Chaque objectif accompli fait augmenter le score.',
    bingo: 'Les joueurs doivent compléter une grille de Bingo correspondant à divers objectifs en jeu. Chaque ligne/colonne/diagonale apporte du score.'
};

let marathonObjectives = [];
let bingoObjectives = [];

// --- Sélecteurs équipe ---
const teamFormatSelect = document.getElementById('teamFormat');
const teamConfig = document.getElementById('teamConfig');
const minPlayersInput = document.getElementById('minPlayers');
const maxPlayersInput = document.getElementById('maxPlayers');

// --- Affichage description format + configuration associée ---
document.getElementById('formatChallenge').addEventListener('change', (e) => {
    const format = e.target.value;
    const descEl = document.getElementById('formatDescription');
    
    // Masquer toutes les configs
    document.getElementById('courseConfig').classList.add('hidden');
    document.getElementById('marathonConfig').classList.add('hidden');
    document.getElementById('bingoConfig').classList.add('hidden');
    
    if(format && formatDescriptions[format]) {
        descEl.textContent = formatDescriptions[format];
        descEl.style.display = 'block';
        
        // Afficher la config correspondante
        if(format === 'tournoi') {
            document.getElementById('tournoiConfig').classList.remove('hidden');
        } else if(format === 'course') {
            document.getElementById('courseConfig').classList.remove('hidden');
        } else if(format === 'marathon') {
            document.getElementById('marathonConfig').classList.remove('hidden');
            renderObjectivesList();
        } else if(format === 'bingo') {
            document.getElementById('bingoConfig').classList.remove('hidden');
        }
    } else {
        descEl.style.display = 'none';
    }
});

// --- Afficher/masquer mot de passe ---
document.getElementById('visibility').addEventListener('change', (e) => {
    const passwordGroup = document.getElementById('passwordGroup');
    if(e.target.value === 'password') {
        passwordGroup.classList.remove('hidden');
    } else {
        passwordGroup.classList.add('hidden');
    }
});

// --- Affichage section équipe si besoin ---
teamFormatSelect.addEventListener('change', () => {
    if (teamFormatSelect.value === 'team') {
        teamConfig.classList.remove('hidden');
    } else {
        teamConfig.classList.add('hidden');
    }
});

// --- Gestion des objectifs Marathon ---
function addObjective() {
    marathonObjectives.push({
        id: '_' + Math.random().toString(36).substr(2, 9),
        name: '',
        points: 10,
        repeatable: false
    });
    renderObjectivesList();
}

function removeObjective(id) {
    marathonObjectives = marathonObjectives.filter(o => o.id !== id);
    renderObjectivesList();
}

function renderObjectivesList() {
    const list = document.getElementById('objectivesList');
    
    if(marathonObjectives.length === 0) {
        list.innerHTML = '<p style="color: var(--gray); font-style: italic;">Aucun objectif défini</p>';
        return;
    }
    
    list.innerHTML = marathonObjectives.map((obj, index) => `
        <div class="objective-item" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
            <input type="text" placeholder="Nom de l'objectif" value="${obj.name}" 
                   onchange="marathonObjectives[${index}].name = this.value" 
                   style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
            <input type="number" placeholder="Points" value="${obj.points}" min="1"
                   onchange="marathonObjectives[${index}].points = parseInt(this.value)" 
                   style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
            <label style="display: flex; align-items: center; gap: 0.25rem; white-space: nowrap;">
                <input type="checkbox" ${obj.repeatable ? 'checked' : ''} 
                       onchange="marathonObjectives[${index}].repeatable = this.checked">
                Répétable
            </label>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeObjective('${obj.id}')">✕</button>
        </div>
    `).join('');
}

// --- Gestion de la grille Bingo ---
function generateBingoGrid() {
    bingoObjectives = Array(25).fill(null).map((_, i) => ({
        id: i,
        name: '',
        position: i
    }));
    renderBingoGrid();
}

function renderBingoGrid() {
    const grid = document.getElementById('bingoGrid');
    
    if(bingoObjectives.length === 0) {
        grid.innerHTML = '<p style="color: var(--gray); font-style: italic;">Cliquez sur "Générer la grille" pour créer 25 cases</p>';
        return;
    }
    
    grid.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; margin-top: 0.5rem;">
            ${bingoObjectives.map((obj, index) => `
                <input type="text" placeholder="Case ${index + 1}" value="${obj.name}"
                       onchange="bingoObjectives[${index}].name = this.value"
                       style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.85rem;">
            `).join('')}
        </div>
    `;
}

// --- Création du défi ---
let lastChallengeSubmit = 0;
const CHALLENGE_SUBMIT_COOLDOWN = 5000; // 5 secondes

document.getElementById('createChallengeForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const now = Date.now();
    if (now - lastChallengeSubmit < CHALLENGE_SUBMIT_COOLDOWN) {
        const remaining = Math.ceil(
            (CHALLENGE_SUBMIT_COOLDOWN - (now - lastChallengeSubmit)) / 1000
        );
        showNotification(`⏳ Veuillez attendre ${remaining}s avant de recréer un défi`, 'error');
        return;
    }

    lastChallengeSubmit = now;
    
    const user = users.find(u => u.username === currentUser);
    if(!user) return;
    
    const challengeName = document.getElementById('challengeName').value;
    const gameName = document.getElementById('gameName').value;
    const teamFormat = document.getElementById('teamFormat').value;
    const formatChallenge = document.getElementById('formatChallenge').value;
    const rulesChallenge = document.getElementById('rulesChallenge').value;
    const minPoints = parseInt(document.getElementById('minPoints').value);
    const maxPoints = parseInt(document.getElementById('maxPoints').value);
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
        participants: [],
        progressions: {},
        status: 'waiting',
        createdAt: Date.now()
    };

    // --- Ajouter la config équipe si nécessaire ---
    if(teamFormat === 'team') {
        const minPlayers = parseInt(minPlayersInput.value);
        const maxPlayers = parseInt(maxPlayersInput.value);

        if(isNaN(minPlayers) || isNaN(maxPlayers) || minPlayers > maxPlayers) {
            showNotification('Le nombre minimum de joueurs par équipe doit être inférieur ou égal au maximum', 'error');
            return;
        }

        newChallenge.teamConfig = {
            minPlayersPerTeam: minPlayers,
            maxPlayersPerTeam: maxPlayers
        };
    }

    // --- Ajouter la configuration spécifique selon le format ---
    if(formatChallenge === 'tournoi') {
        newChallenge.tournamentConfig = {
            groups: [],
            bracket: [],
            currentPhase: 'waiting'
        };
    } else if(formatChallenge === 'course') {
        newChallenge.raceConfig = {
            baseScore: parseInt(document.getElementById('baseScore').value) || 100,
            scoreDecrement: parseInt(document.getElementById('scoreDecrement').value) || 10,
            finishTimes: {},
            rankings: []
        };
    } else if(formatChallenge === 'marathon') {
        if(marathonObjectives.length === 0) {
            showNotification('Veuillez ajouter au moins un objectif pour le marathon', 'error');
            return;
        }
        if(marathonObjectives.some(o => !o.name.trim())) {
            showNotification('Tous les objectifs doivent avoir un nom', 'error');
            return;
        }
        newChallenge.marathonConfig = {
            objectives: marathonObjectives.map(o => ({...o})),
            completions: {}
        };
    } else if(formatChallenge === 'bingo') {
        if(bingoObjectives.length !== 25) {
            showNotification('Veuillez générer la grille de bingo (25 cases)', 'error');
            return;
        }
        if(bingoObjectives.some(o => !o.name.trim())) {
            showNotification('Toutes les cases du bingo doivent être remplies', 'error');
            return;
        }
        newChallenge.bingoConfig = {
            grid: bingoObjectives.map(o => ({...o})),
            completions: {}
        };
    }
    
    challenges.push(newChallenge);
    ws.send(JSON.stringify({ type: 'updateChallenges', challenges }));
    
    showNotification('Défi créé avec succès ! Vous pouvez maintenant le rejoindre depuis la liste des défis.');
    setTimeout(() => {
        window.location.href = `challenge-detail.html?id=${newChallenge.id}`;
    }, 1500);
});
