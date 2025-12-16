const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const { router: authRouter, data, saveData } = require('./auth');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use(authRouter);

app.listen(port, () => console.log(`Server HTTP: http://localhost:${port}`));

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', ws => {
    console.log('Client connecté');

    // Envoyer état initial
    ws.send(JSON.stringify({ 
        type: 'init', 
        challenges: data.challenges, 
        messages: data.messages, 
        users: data.users,
        teams: data.teams || []
    }));

    ws.on('message', message => {
        const msg = JSON.parse(message);
        switch(msg.type){
            case 'updateChallenges':
                data.challenges = msg.challenges;
                saveData();
                broadcast({ type: 'updateChallenges', challenges: data.challenges });
                break;
            case 'updateUsers':
                data.users = msg.users;
                saveData();
                broadcast({ type: 'updateUsers', users: data.users });
                break;
            case 'updateTeams':
                data.teams = msg.teams;
                saveData();
                broadcast({ type: 'updateTeams', teams: data.teams });
                break;
            case 'newMessage':
                if(!data.messages[msg.challengeId]) data.messages[msg.challengeId] = [];
                const chatMsg = { player: msg.player, text: msg.text, timestamp: Date.now() };
                data.messages[msg.challengeId].push(chatMsg);
                saveData();
                broadcast({ type: 'newMessage', challengeId: msg.challengeId, message: chatMsg });
                break;
            case 'notification':
                broadcast({ type: 'notification', text: msg.text });
                break;
        }
    });

    ws.on('close', () => console.log('Client déconnecté'));
});

function broadcast(msg){
    wss.clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN){
            client.send(JSON.stringify(msg));
        }
    });
}
