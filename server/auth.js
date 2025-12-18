const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const SECRET_KEY = 'atom_challenges_secret_2025';
const DATA_FILE = path.join(__dirname, 'data.json');

// Charger les données
let data = { users: [], challenges: [], messages: {}, teams: [] };
if(fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Initialiser teams si absent
    if(!data.teams) data.teams = [];
    // Initialiser les champs amis si absents
    data.users.forEach(user => {
        if(!user.friends) user.friends = [];
        if(!user.friendRequests) user.friendRequests = [];
        if(!user.sentRequests) user.sentRequests = [];
    });
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Inscription
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    if(data.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
        id: '_' + Math.random().toString(36).substr(2, 9),
        username,
        passwordHash,
        totalPoints: 100,
        friends: [],
        friendRequests: [],
        sentRequests: [],
        cosmetics: [],
        challengesCompleted: 0,
        cheated: false
    };
    
    data.users.push(newUser);
    saveData();
    
    res.json({ message: 'Inscription réussie' });
});

// Connexion
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = data.users.find(u => u.username === username);
    if(!user) {
        return res.status(400).json({ error: 'Utilisateur introuvable' });
    }
    
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if(!validPassword) {
        return res.status(400).json({ error: 'Mot de passe incorrect' });
    }
    
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '7d' });
    
    res.json({ token, username });
});

module.exports = { router, data, saveData };
