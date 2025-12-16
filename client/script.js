let currentUser = null;
let ws = null;
let challenges = [];
let messages = [];
let users = [];

// ------------------ LOGIN / REGISTER ------------------
async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if(!username || !password) return alert("Remplissez tous les champs");

    const res = await fetch('/register', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username,password})
    });
    const data = await res.json();
    alert(data.success ? 'Inscription réussie' : data.error);
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if(!username || !password) return alert("Remplissez tous les champs");

    const res = await fetch('/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username,password})
    });
    const data = await res.json();
    if(data.token){
        localStorage.setItem('token', data.token);
        currentUser = { name: data.username };
        document.getElementById('auth').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initWebSocket();
        alert("Connexion réussie !");
    } else {
        alert(data.error);
    }
}

// ------------------ WEBSOCKET ------------------
function initWebSocket() {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => console.log('WebSocket connecté');

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch(data.type){
            case 'init':
                challenges = data.challenges || [];
                messages = data.messages || {};
                users = data.users || [];
                renderChallenges();
                renderLeaderboard();
                updateChatChallengeList();
                break;
            case 'updateChallenges':
                challenges = data.challenges;
                renderChallenges();
                updateChatChallengeList();
                break;
            case 'updateUsers':
                users = data.users;
                renderLeaderboard();
                break;
            case 'newMessage':
                if(chatChallengeSelect.value === data.challengeId){
                    displayChatMessage(data.message);
                }
                break;
            case 'notification':
                alert(`Notification : ${data.text}`);
                break;
        }
    };
}

// ------------------ CHALLENGES ------------------
const challengeForm = document.getElementById('challengeForm');
challengeForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const newChallenge = {
        id: "_" + Math.random().toString(36).substr(2,9),
        name: document.getElementById('challengeName').value,
        game: document.getElementById('gameName').value,
        type: document.getElementById('typeChallenge').value,
        format: document.getElementById('formatChallenge').value,
        rules: document.getElementById('rulesChallenge').value,
        minPoints: parseInt(document.getElementById('minPoints').value),
        maxPoints: parseInt(document.getElementById('maxPoints').value),
        visibility: document.getElementById('visibility').value,
        password: document.getElementById('challengePassword').value,
        participants: []
    };
    challenges.push(newChallenge);
    ws.send(JSON.stringify({ type:'updateChallenges', challenges }));
    challengeForm.reset();
});

function renderChallenges() {
    const list = document.getElementById('challengeList');
    list.innerHTML = '';
    challenges.forEach(ch => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${ch.name}</strong> (${ch.game}) - ${ch.type} / ${ch.format} <br>Participants: ${ch.participants.length}`;
        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'Rejoindre';
        joinBtn.onclick = ()=>joinChallenge(ch.id);
        li.appendChild(joinBtn);
        list.appendChild(li);
    });
}

function joinChallenge(chId) {
    const ch = challenges.find(c=>c.id===chId);
    if(!ch) return alert("Défi introuvable");
    if(ch.visibility==='password'){
        const pwd = prompt("Mot de passe du défi ?");
        if(pwd !== ch.password) return alert("Mot de passe incorrect");
    }
    if(ch.participants.includes(currentUser.name)) return alert("Vous êtes déjà inscrit");
    ch.participants.push(currentUser.name);
    ws.send(JSON.stringify({ type:'updateChallenges', challenges }));
    ws.send(JSON.stringify({ type:'notification', text: `${currentUser.name} a rejoint ${ch.name}` }));
}

// ------------------ LEADERBOARD ------------------
function renderLeaderboard() {
    const lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    users.sort((a,b)=>b.totalPoints-a.totalPoints);
    users.forEach(u=>{
        const li = document.createElement('li');
        li.textContent = `${u.username} - ${u.totalPoints} pts`;
        lb.appendChild(li);
    });
}

// ------------------ CHAT ------------------
const chatWindow = document.getElementById('chatWindow');
const chatInput = document.getElementById('chatInput');
const chatChallengeSelect = document.getElementById('chatChallengeSelect');

function updateChatChallengeList() {
    chatChallengeSelect.innerHTML = '';
    challenges.forEach(ch=>{
        const option = document.createElement('option');
        option.value = ch.id;
        option.textContent = ch.name;
        chatChallengeSelect.appendChild(option);
    });
    chatChallengeSelect.onchange = ()=>renderChat();
}

function renderChat() {
    chatWindow.innerHTML = '';
    const chId = chatChallengeSelect.value;
    if(messages[chId]){
        messages[chId].forEach(m=>displayChatMessage(m));
    }
}

function displayChatMessage(m){
    const div = document.createElement('div');
    const time = new Date(m.timestamp).toLocaleTimeString();
    div.textContent = `[${time}] ${m.player}: ${m.text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function sendMessage() {
    const chId = chatChallengeSelect.value;
    const text = chatInput.value.trim();
    if(!text || !chId) return;
    ws.send(JSON.stringify({ type:'newMessage', challengeId:chId, player:currentUser.name, text }));
    chatInput.value = '';
}

// ------------------ NOTIFICATIONS ------------------
function notifyAll(text){
    ws.send(JSON.stringify({ type:'notification', text }));
}
