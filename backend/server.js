const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://pnxufaxdzwgynnmknewn.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_YD1vvDDQlqSxIPlqWx5UOQ_z-FYToRz';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super-secret-key-for-local-cloud';
const MAX_STORAGE_BYTES = 20 * 1024 * 1024 * 1024; // 20 GB

app.use(cors());
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// Servir archivos estáticos (imágenes/videos) y el logo
app.use('/uploads', express.static(UPLOADS_DIR));

// Helper: Obtener espacio usado
const getUsedSpace = async () => {
    const { data, error } = await supabase.from('files').select('size');
    if (error) return 0;
    return data.reduce((acc, file) => acc + (file.size || 0), 0);
};

// Middleware: Autenticación
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Token inválido' });
    }
};

// Configuración Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- RUTAS DE AUTENTICACIÓN ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('username', username).limit(1);
    const user = users?.[0];
    
    if (error || !user) return res.status(400).json({ error: 'Usuario no encontrado' });
    const validPass = bcrypt.compareSync(password, user.password);
    if (!validPass) return res.status(400).json({ error: 'Contraseña incorrecta' });
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    const { newPassword } = req.body;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);
    
    const { error } = await supabase.from('users').update({ password: hash }).eq('id', req.user.id);
    if (error) return res.status(500).json({ error: 'Error al cambiar contraseña' });
    res.json({ message: 'Contraseña actualizada' });
});

// --- RUTAS DE ALMACENAMIENTO ---
app.get('/api/storage', authMiddleware, async (req, res) => {
    try {
        const used = await getUsedSpace();
        res.json({
            used,
            total: MAX_STORAGE_BYTES,
            available: MAX_STORAGE_BYTES - used
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al calcular espacio' });
    }
});

// --- RUTAS DE CARPETAS ---
app.post('/api/folders', authMiddleware, async (req, res) => {
    const { name, parent_id } = req.body;
    const { data, error } = await supabase.from('folders').insert([{ name, parent_id: parent_id || null }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.get('/api/folders', authMiddleware, async (req, res) => {
    const { parent_id } = req.query;
    let query = supabase.from('folders').select('*');
    if (parent_id) query = query.eq('parent_id', parent_id);
    else query = query.is('parent_id', null);
    
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- RUTAS DE ARCHIVOS ---
app.post('/api/files/upload', authMiddleware, async (req, res, next) => {
    // Middleware previo para chequear cuota por cabecera
    const contentLength = parseInt(req.headers['content-length'] || 0);
    const used = await getUsedSpace();
    if (used + contentLength > MAX_STORAGE_BYTES) {
        return res.status(400).json({ error: 'Límite de 20GB excedido' });
    }
    next();
}, upload.single('file'), async (req, res) => {
    const file = req.file;
    const folder_id = req.body.folder_id || null;
    
    if (!file) return res.status(400).json({ error: 'No se subió archivo' });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    
    // Subir a Supabase
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('archivos')
        .upload(filename, file.buffer, {
            contentType: file.mimetype
        });
        
    if (uploadError) {
        return res.status(500).json({ error: 'Error subiendo a Supabase: ' + uploadError.message });
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
        .from('archivos')
        .getPublicUrl(filename);
    const publicUrl = publicUrlData.publicUrl;

    const { data, error: insertError } = await supabase.from('files').insert([{
        filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        filepath: publicUrl,
        folder_id: folder_id || null
    }]).select();

    if (insertError) {
        return res.status(500).json({ error: insertError.message });
    }
    const savedFile = data[0];
    res.json({
        id: savedFile.id,
        filename: savedFile.filename,
        originalname: savedFile.originalname,
        url: savedFile.filepath
    });
});

app.get('/api/files', authMiddleware, async (req, res) => {
    const { folder_id } = req.query;
    let query = supabase.from('files').select('*');
    if (folder_id) query = query.eq('folder_id', folder_id);
    else query = query.is('folder_id', null);
    
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/files/:id/download', async (req, res) => {
    const id = req.params.id;
    const { data: files, error } = await supabase.from('files').select('*').eq('id', id).limit(1);
    const file = files?.[0];
    
    if (error || !file) return res.status(404).json({ error: 'Archivo no encontrado' });
    
    if (file.filepath && file.filepath.startsWith('http')) {
        res.redirect(file.filepath + '?download=');
    } else {
        res.download(file.filepath, file.originalname);
    }
});

app.delete('/api/files/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    const { data: files, error } = await supabase.from('files').select('*').eq('id', id).limit(1);
    const file = files?.[0];
    
    if (error || !file) return res.status(404).json({ error: 'Archivo no encontrado' });
    
    // Borrar de Supabase
    await supabase.storage.from('archivos').remove([file.filename]);
    
    // Borrar local si existe
    if (file.filepath && !file.filepath.startsWith('http')) {
        fs.unlink(file.filepath, () => {});
    }
    
    const { error: deleteError } = await supabase.from('files').delete().eq('id', id);
    if (deleteError) return res.status(500).json({ error: deleteError.message });
    res.json({ message: 'Archivo borrado correctamente' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend corriendo en http://0.0.0.0:${PORT}`);
});
