// Description des formats
const formatDescriptions = {
    tournoi: 'Affrontement direct entre les joueurs selon un tirage au sort ou une phase de poule. Le gagnant du match A affronte le gagnant du match B au round suivant.',
    course: 'Le premier à remporter le défi remporte le plus de points, le deuxième un peu moins et ainsi de suite.',
    marathon: 'Les joueurs ont plusieurs objectifs à accomplir en jeu. Chaque objectif accompli fait augmenter le score.',
    bingo: 'Les joueurs doivent compléter une grille de Bingo correspondant à divers objectifs en jeu. Chaque case, ligne/colonne/diagonale, bingo augmentent le score.'
};

let marathonObjectives = [];
let negativeObjectives = [];
let runSteps = [];
let bingoObjectives = [];
let bingoSize = 3;

// --- Sélecteurs équipe ---
const teamFormatSelect = document.getElementById('teamFormat');
const teamConfig = document.getElementById('teamConfig');
const playersInput = document.getElementById('players');

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
        if(format === 'marathon') {
            document.getElementById('marathonConfig').classList.remove('hidden');
            renderObjectivesList();
        } else if(format === 'course') {
            document.getElementById('courseConfig').classList.remove('hidden');
            renderStepsList();
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

    // Liste des points possibles
    const pointsOptions = [5, 10, 15, 20, 25, 30];

    list.innerHTML = marathonObjectives.map((obj, index) => `
        <div class="objective-item" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
            <input type="text" placeholder="Nom de l'objectif" value="${obj.name}" 
                   onchange="marathonObjectives[${index}].name = this.value" 
                   style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
            
            <select onchange="marathonObjectives[${index}].points = parseInt(this.value)" 
                    style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                ${pointsOptions.map(p => `
                    <option value="${p}" ${obj.points === p ? 'selected' : ''}>${p}</option>
                `).join('')}
            </select>
            
            <label style="display: flex; align-items: center; gap: 0.25rem; white-space: nowrap;">
                <input type="checkbox" ${obj.repeatable ? 'checked' : ''} 
                       onchange="marathonObjectives[${index}].repeatable = this.checked">
                Répétable
            </label>

            <button type="button" class="btn btn-danger btn-sm" onclick="removeObjective('${obj.id}')">✕</button>
        </div>
    `).join('');
}

function addNegativeObjective() {
    negativeObjectives.push({
        id: '_' + Math.random().toString(36).substr(2, 9),
        name: '',
        points: -10, // points négatifs par défaut
        repeatable: false
    });
    renderNegativeObjectivesList();
}

function removeNegativeObjective(id) {
    negativeObjectives = negativeObjectives.filter(o => o.id !== id);
    renderNegativeObjectivesList();
}

function renderNegativeObjectivesList() {
    const list = document.getElementById('negativeObjectivesList');
    
    if(negativeObjectives.length === 0) {
        list.innerHTML = '<p style="color: var(--gray); font-style: italic;">Aucun objectif à éviter défini</p>';
        return;
    }

    const pointsOptions = [-5, -10, -15, -20];

    list.innerHTML = negativeObjectives.map((obj, index) => `
        <div class="objective-item" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
            <input type="text" placeholder="Nom de l'objectif" value="${obj.name}" 
                   onchange="negativeObjectives[${index}].name = this.value" 
                   style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
            
            <select onchange="negativeObjectives[${index}].points = parseInt(this.value)" 
                    style="width: 80px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                ${pointsOptions.map(p => `
                    <option value="${p}" ${obj.points === p ? 'selected' : ''}>${p}</option>
                `).join('')}
            </select>
            
            <label style="display: flex; align-items: center; gap: 0.25rem; white-space: nowrap;">
                <input type="checkbox" ${obj.repeatable ? 'checked' : ''} 
                       onchange="negativeObjectives[${index}].repeatable = this.checked">
                Répétable
            </label>

            <button type="button" class="btn btn-danger btn-sm" onclick="removeNegativeObjective('${obj.id}')">✕</button>
        </div>
    `).join('');
}


// --- Gestion de la Course ---
function renderStepsList() {
    const list = document.getElementById('stepsList');
    
    if(runSteps.length === 0) {
        list.innerHTML = '<p style="color: var(--gray); font-style: italic;">Aucune étape définie</p>';
        return;
    }

    list.innerHTML = runSteps.map((obj, index) => `
        <div class="objective-item" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
            <input type="text" placeholder="Nom de l'étape" value="${obj.name}" 
                   onchange="runSteps[${index}].name = this.value" 
                   style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">

            <button type="button" class="btn btn-danger btn-sm" onclick="removeStep('${obj.id}')">✕</button>
        </div>
    `).join('');
}

function removeStep(id) {
    runSteps = runSteps.filter(o => o.id !== id);
    renderStepsList();
}

function addStep() {
    runSteps.push({
        id: '_' + Math.random().toString(36).substr(2, 9),
        name: '',
    });
    renderStepsList();
}

// --- Gestion de la grille Bingo ---
function generateBingoGrid() {
    bingoSize = parseInt(document.getElementById('bingoSize').value);
    const totalCases = bingoSize * bingoSize;

    bingoObjectives = Array(totalCases).fill(null).map((_, i) => ({
        id: i,
        name: '',
        position: i
    }));

    renderBingoGrid();
}


function renderBingoGrid() {
    const grid = document.getElementById('bingoGrid');

    if (bingoObjectives.length === 0) {
        grid.innerHTML = '<p style="color: var(--gray); font-style: italic;">Cliquez sur "Générer la grille"</p>';
        return;
    }

    // Taille maximale d'une case
    const maxCaseSize = 120; // px
    const gap = 5; // px

    // Calcul dynamique pour que toutes les cases tiennent dans le conteneur
    const containerWidth = grid.clientWidth || (maxCaseSize * bingoSize + gap * (bingoSize - 1));
    const caseSize = Math.min(maxCaseSize, (containerWidth - gap * (bingoSize - 1)) / bingoSize);

    grid.innerHTML = `
        <div style="
            display: grid;
            grid-template-columns: repeat(${bingoSize}, ${caseSize}px);
            gap: ${gap}px;
            justify-content: center;
            margin-top: 0.5rem;
        ">
            ${bingoObjectives.map((obj, index) => `
                <input type="text"
                       placeholder="Case ${index + 1}"
                       value="${obj.name}"
                       onchange="bingoObjectives[${index}].name = this.value"
                       style="
                           width: ${caseSize}px;
                           height: ${caseSize}px;
                           padding: 0.3rem;
                           border: 1px solid var(--border);
                           border-radius: 4px;
                           font-size: 0.85rem;
                           text-align: center;
                       ">
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
    const formatMalus = document.getElementById('toggleMalus').checked;
    const rulesChallenge = document.getElementById('rulesChallenge').value;
    const minPoints = parseInt(document.getElementById('minPoints').value);
    const maxPoints = parseInt(document.getElementById('maxPoints').value);
    const visibility = document.getElementById('visibility').value;
    const challengePassword = document.getElementById('challengePassword').value;
    const allowCheaters = document.getElementById('toggleCheaters').checked;
    
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
        malus: formatMalus,
        rules: rulesChallenge,
        minBet: minPoints,
        maxBet: maxPoints,
        visibility: visibility,
        password: visibility === 'password' ? challengePassword : null,
        cheatersAllowed: allowCheaters,
        organizer: currentUser,
        participants: [],
        progressions: {},
        status: 'waiting',
        createdAt: Date.now()
    };

    // --- Ajouter la config équipe si nécessaire ---
    if(teamFormat === 'team') {
        const players = parseInt(playersInput.value);
        newChallenge.teamConfig = {
            playersPerTeam: players
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
        if(runSteps.length === 0) {
            showNotification('Veuillez ajouter au moins une étape pour la course', 'error');
            return;
        }
        if(runSteps.some(o => !o.name.trim())) {
            showNotification('Toutes les étapes doivent avoir un nom', 'error');
            return;
        }
        newChallenge.raceConfig = {
            steps: runSteps.map(o => ({...o})),
            times: {},
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
            negatives: negativeObjectives.map(o => ({...o})),
            completions: {}
        };
    } else if(formatChallenge === 'bingo') {
        const expectedCases = bingoSize * bingoSize;

        if (bingoObjectives.length !== expectedCases) {
            showNotification('Veuillez générer la grille de bingo', 'error');
            return;
        }

        if (bingoObjectives.some(o => !o.name.trim())) {
            showNotification('Toutes les cases du bingo doivent être remplies', 'error');
            return;
        }

        newChallenge.bingoConfig = {
            size: bingoSize,
            grid: bingoObjectives.map(o => ({ ...o })),
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
