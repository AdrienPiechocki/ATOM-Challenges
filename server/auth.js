const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');

const SECRET_KEY = "ATOM_SECRET_KEY";
const DATA_PATH = path.join(__dirname, 'data.json');

// Charger les données
let data = fs.readJsonSync(DATA_PATH);

// Enregistrer les données
function saveData() {
    fs.writeJsonSync(DATA_PATH, data, { spaces: 2 });
}

// Enregistrement
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if(data.users.find(u => u.username === username)) return res.status(400).json({ error: "Utilisateur déjà existant" });

    const hash = await bcrypt.hash(password, 10);
    const newUser = { 
        id: "_" + Math.random().toString(36).substr(2, 9), 
        username, 
        passwordHash: hash, 
        totalPoints: 100, 
        friends: [], 
        cosmetics: [], 
        cheated: false 
    };
    data.users.push(newUser);
    saveData();
    res.json({ success: true });
});

// Connexion
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = data.users.find(u => u.username === username);
    if(!user) return res.status(400).json({ error: "Utilisateur inconnu" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if(!match) return res.status(400).json({ error: "Mot de passe incorrect" });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '2h' });
    res.json({ token, username: user.username });
});

// Middleware JWT
function authenticateToken(req, res, next){
    const token = req.headers['authorization'];
    if(!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if(err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

module.exports = { router, authenticateToken, data, saveData };
