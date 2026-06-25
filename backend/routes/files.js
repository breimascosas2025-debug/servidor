// backend/routes/files.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('./auth');
const {
  uploadFile,
  getSignedUrl,
  listObjects,
  deleteObject,
  getBucketSize,
} = require('../utils/supabaseStorage');
const { checkQuota, QUOTA_LIMIT } = require('../utils/storage');
const fs = require('fs-extra');
const path = require('path');

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const relativePath = file.webkitRelativePath ? path.dirname(file.webkitRelativePath) : '';
        const targetPath = path.join(req.storageDir, req.query.path || '', relativePath);
        await fs.ensureDir(targetPath);
        cb(null, targetPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// Proteger todas las rutas de archivos
router.use(verifyToken);

// Obtener cuota actual
router.get('/quota', async (req, res) => {
    try {
        const currentSize = await getDirSize(req.storageDir);
        res.json({ currentSize, limit: QUOTA_LIMIT });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cuota' });
    }
});

// Listar archivos en un directorio
router.get('/list', async (req, res) => {
    try {
        const relPath = req.query.path || '';
        const fullPath = path.join(req.storageDir, relPath);
        
        // Evitar salir del storageDir
        if (!fullPath.startsWith(req.storageDir)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        if (!await fs.pathExists(fullPath)) {
            return res.status(404).json({ message: 'Directorio no encontrado' });
        }

        const items = await fs.readdir(fullPath);
        const statsPromises = items.map(async (item) => {
            const stat = await fs.stat(path.join(fullPath, item));
            return {
                name: item,
                isDirectory: stat.isDirectory(),
                size: stat.size,
                lastModified: stat.mtime
            };
        });

        const filesWithStats = await Promise.all(statsPromises);
        res.json(filesWithStats);
    } catch (error) {
        res.status(500).json({ message: 'Error al listar archivos', error: error.message });
    }
});

// Crear nueva carpeta
router.post('/folder', async (req, res) => {
    try {
        const relPath = req.body.path || '';
        const folderName = req.body.name;
        if (!folderName) return res.status(400).json({ message: 'Nombre de carpeta requerido' });

        const fullPath = path.join(req.storageDir, relPath, folderName);
        if (!fullPath.startsWith(req.storageDir)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        await fs.ensureDir(fullPath);
        res.json({ message: 'Carpeta creada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear carpeta' });
    }
});

// Borrar archivo(s) o carpeta(s)
router.delete('/delete', async (req, res) => {
    try {
        let items = req.body.paths;
        if (!items) {
            // Compatibilidad con la versión anterior
            if (req.body.path) items = [req.body.path];
            else return res.status(400).json({ message: 'Rutas requeridas' });
        }

        if (!Array.isArray(items)) items = [items];

        for (const itemPath of items) {
            const fullPath = path.join(req.storageDir, itemPath);
            if (!fullPath.startsWith(req.storageDir) || fullPath === req.storageDir) {
                continue; // Saltar rutas inválidas
            }
            await fs.remove(fullPath);
        }
        
        res.json({ message: 'Eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar' });
    }
});

// Descargar archivo
router.get('/download', async (req, res) => {
    try {
        const itemPath = req.query.path;
        if (!itemPath) return res.status(400).json({ message: 'Ruta requerida' });

        const fullPath = path.join(req.storageDir, itemPath);
        if (!fullPath.startsWith(req.storageDir)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ message: 'No se puede descargar un directorio directamente por ahora' });
        }

        res.download(fullPath);
    } catch (error) {
        res.status(500).json({ message: 'Error al descargar archivo' });
    }
});

// Ver archivo (inline en el navegador)
router.get('/view', async (req, res) => {
    try {
        const itemPath = req.query.path;
        if (!itemPath) return res.status(400).json({ message: 'Ruta requerida' });

        const fullPath = path.join(req.storageDir, itemPath);
        if (!fullPath.startsWith(req.storageDir)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ message: 'No se puede ver un directorio' });
        }

        res.sendFile(fullPath);
    } catch (error) {
        res.status(500).json({ message: 'Error al abrir archivo' });
    }
});

// Subir archivo(s)
router.post('/upload', async (req, res, next) => {
    const quotaCheck = await checkQuota(req.storageDir); // No sabemos el tamaño exacto antes, revisamos estado actual
    if (!quotaCheck.allowed) {
        return res.status(403).json({ message: 'Límite de cuota excedido (40 GB)' });
    }
    next();
}, upload.array('files'), (req, res) => {
    res.json({ message: 'Archivos subidos exitosamente', files: req.files.length });
});

module.exports = router;
