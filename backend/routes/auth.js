const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Validar contra las variables de entorno
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username });
    } else {
        res.status(401).json({ message: 'Credenciales inválidas' });
    }
});

// Middleware para verificar token en otras rutas
const verifyToken = (req, res, next) => {
    let token = req.headers['authorization'];
    if (token) {
        token = token.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(403).json({ message: 'Token no proveído' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'No autorizado' });
        req.user = decoded;
        next();
    });
};

module.exports = router;
module.exports.verifyToken = verifyToken;
