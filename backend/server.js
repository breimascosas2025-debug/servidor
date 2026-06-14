const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const filesRoutes = require('./routes/files');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración principal de almacenamiento
const STORAGE_DIR = path.join(__dirname, 'storage');
fs.ensureDirSync(STORAGE_DIR); // Crea la carpeta si no existe

app.use(cors());
app.use(express.json());

// Middlewares para pasar el storage dir a las rutas
app.use((req, res, next) => {
    req.storageDir = STORAGE_DIR;
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);

app.listen(PORT, () => {
    console.log(`Servidor de Almacén Digital corriendo en el puerto ${PORT}`);
    console.log(`Carpeta de almacenamiento: ${STORAGE_DIR}`);
});
