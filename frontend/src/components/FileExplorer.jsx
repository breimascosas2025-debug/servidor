import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Folder, File, Upload, FolderPlus, Trash2, Download, LogOut, ChevronRight, Home, HardDrive, Image as ImageIcon, Video, FileText, X, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './FileExplorer.css';

const BUCKET = 'files';
const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1 GB (límite del plan free de Supabase)

function FileExplorer() {
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [quota, setQuota] = useState({ currentSize: 0, limit: STORAGE_LIMIT });
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Novedades
    const [activeTab, setActiveTab] = useState('Archivos');
    const [selectedItems, setSelectedItems] = useState([]);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewContent, setPreviewContent] = useState('');
    const [userId, setUserId] = useState(null);
    const [userEmail, setUserEmail] = useState('');

    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    // Verificar autenticación
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }
            setUserId(session.user.id);
            setUserEmail(session.user.email || '');
        };
        checkAuth();

        // Escuchar cambios de sesión
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                navigate('/login');
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    // Cargar archivos cuando cambia la ruta o el usuario
    useEffect(() => {
        if (userId) {
            fetchFiles();
        }
    }, [currentPath, userId]);

    // Fetch de contenido de texto para preview
    useEffect(() => {
        if (previewFile?.type === 'text') {
            const fetchText = async () => {
                try {
                    const res = await fetch(previewFile.url);
                    const text = await res.text();
                    setPreviewContent(text);
                } catch (e) {
                    console.error('Error fetching text preview', e);
                    setPreviewContent('Error al cargar la vista previa');
                }
            };
            fetchText();
        } else {
            setPreviewContent('');
        }
    }, [previewFile]);

    // Limpiar selección al cambiar tab/ruta
    useEffect(() => {
        setSelectedItems([]);
    }, [activeTab, currentPath]);

    // --- Helpers de ruta ---
    const getStoragePath = (subPath = '') => {
        const base = userId;
        if (subPath) return `${base}/${subPath}`;
        return base;
    };

    // --- Fetch archivos ---
    const fetchFiles = async () => {
        try {
            const storagePath = getStoragePath(currentPath);
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .list(storagePath, {
                    limit: 200,
                    sortBy: { column: 'name', order: 'asc' }
                });

            if (error) throw error;

            // Filtrar archivos .keep (placeholders de carpeta) y mapear al formato de la UI
            const mapped = (data || [])
                .filter(item => item.name !== '.keep' && item.name !== '.emptyFolderPlaceholder')
                .map(item => ({
                    name: item.name,
                    isDirectory: item.id === null || item.metadata === null,
                    size: item.metadata?.size || 0,
                    updatedAt: item.updated_at
                }));

            setFiles(mapped);

            // Calcular uso de almacenamiento
            const totalSize = mapped.reduce((acc, f) => acc + (f.size || 0), 0);
            setQuota(prev => ({ ...prev, currentSize: totalSize }));
        } catch (err) {
            console.error('Error listando archivos:', err);
        }
    };

    // --- Auth ---
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // --- Navegación ---
    const navigateTo = (folderName) => {
        setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName);
        setActiveTab('Archivos');
    };

    const navigateUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const navigateHome = () => {
        setCurrentPath('');
    };

    // --- Crear carpeta ---
    const createFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            const folderPath = currentPath
                ? `${getStoragePath(currentPath)}/${newFolderName.trim()}/.keep`
                : `${getStoragePath()}/${newFolderName.trim()}/.keep`;

            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(folderPath, new Blob([''], { type: 'text/plain' }));

            if (error) throw error;
            setNewFolderName('');
            setShowNewFolder(false);
            fetchFiles();
        } catch (err) {
            alert('Error al crear carpeta: ' + err.message);
        }
    };

    // --- Eliminar (recursivo para carpetas) ---
    const deleteFolderRecursive = async (folderPath) => {
        const { data: items } = await supabase.storage
            .from(BUCKET)
            .list(folderPath, { limit: 1000 });

        if (!items || items.length === 0) return;

        // Archivos en este nivel
        const filePaths = items
            .filter(item => item.metadata !== null && item.id !== null)
            .map(item => `${folderPath}/${item.name}`);

        if (filePaths.length > 0) {
            await supabase.storage.from(BUCKET).remove(filePaths);
        }

        // Subcarpetas (recursivo)
        const folders = items.filter(item => item.metadata === null || item.id === null);
        for (const folder of folders) {
            await deleteFolderRecursive(`${folderPath}/${folder.name}`);
        }
    };

    const deleteItem = async (itemName) => {
        if (!window.confirm(`¿Seguro que deseas eliminar "${itemName}"?`)) return;
        try {
            const itemPath = currentPath
                ? `${getStoragePath(currentPath)}/${itemName}`
                : `${getStoragePath()}/${itemName}`;

            const file = files.find(f => f.name === itemName);
            if (file?.isDirectory) {
                await deleteFolderRecursive(itemPath);
            } else {
                const { error } = await supabase.storage
                    .from(BUCKET)
                    .remove([itemPath]);
                if (error) throw error;
            }
            fetchFiles();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    const deleteSelectedItems = async () => {
        if (selectedItems.length === 0) return;
        if (!window.confirm(`¿Seguro que deseas eliminar ${selectedItems.length} elemento(s)?`)) return;

        try {
            for (const name of selectedItems) {
                const itemPath = currentPath
                    ? `${getStoragePath(currentPath)}/${name}`
                    : `${getStoragePath()}/${name}`;

                const file = files.find(f => f.name === name);
                if (file?.isDirectory) {
                    await deleteFolderRecursive(itemPath);
                } else {
                    await supabase.storage.from(BUCKET).remove([itemPath]);
                }
            }
            setSelectedItems([]);
            fetchFiles();
        } catch (err) {
            alert('Error al eliminar elementos: ' + err.message);
        }
    };

    // --- Selección ---
    const toggleSelection = (itemName) => {
        setSelectedItems(prev =>
            prev.includes(itemName) ? prev.filter(i => i !== itemName) : [...prev, itemName]
        );
    };

    const selectAll = () => {
        const itemsToSelect = getDisplayedFiles();
        if (selectedItems.length === itemsToSelect.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(itemsToSelect.map(f => f.name));
        }
    };

    // --- Descargar ---
    const downloadItem = async (itemName, isDirectory) => {
        if (isDirectory) return;
        try {
            const itemPath = currentPath
                ? `${getStoragePath(currentPath)}/${itemName}`
                : `${getStoragePath()}/${itemName}`;

            const { data, error } = await supabase.storage
                .from(BUCKET)
                .download(itemPath);

            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', itemName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Error al descargar: ' + err.message);
        }
    };

    // --- Subir archivos ---
    const handleFileUpload = async (e, isFolder = false) => {
        const uploadFiles = e.target.files;
        if (!uploadFiles || uploadFiles.length === 0) return;

        setUploading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            for (let i = 0; i < uploadFiles.length; i++) {
                const file = uploadFiles[i];
                let filePath;

                if (isFolder && file.webkitRelativePath) {
                    filePath = currentPath
                        ? `${getStoragePath(currentPath)}/${file.webkitRelativePath}`
                        : `${getStoragePath()}/${file.webkitRelativePath}`;
                } else {
                    filePath = currentPath
                        ? `${getStoragePath(currentPath)}/${file.name}`
                        : `${getStoragePath()}/${file.name}`;
                }

                const { error } = await supabase.storage
                    .from(BUCKET)
                    .upload(filePath, file, { upsert: true });

                if (error) {
                    console.error(`Error subiendo ${file.name}:`, error);
                    errorCount++;
                } else {
                    successCount++;
                }
            }

            if (errorCount > 0) {
                alert(`Se subieron ${successCount} archivo(s). ${errorCount} fallaron.`);
            }
            fetchFiles();
        } catch (err) {
            alert('Error al subir archivos: ' + err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (folderInputRef.current) folderInputRef.current.value = '';
        }
    };

    // --- Vista previa ---
    const openPreview = async (file) => {
        if (file.isDirectory) return;
        const ext = file.name.split('.').pop().toLowerCase();
        let type = 'unknown';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) type = 'image';
        else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) type = 'video';
        else if (ext === 'pdf') type = 'pdf';
        else if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) type = 'audio';
        else if (['txt', 'md', 'json', 'csv', 'log', 'xml', 'html', 'js', 'css', 'py', 'java', 'c', 'cpp', 'ts', 'tsx', 'jsx', 'sh', 'bat', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'env', 'sql'].includes(ext)) type = 'text';

        const itemPath = currentPath
            ? `${getStoragePath(currentPath)}/${file.name}`
            : `${getStoragePath()}/${file.name}`;

        try {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(itemPath, 3600); // URL válida por 1 hora

            if (error) throw error;

            setPreviewFile({ name: file.name, url: data.signedUrl, type });
        } catch (err) {
            alert('Error al generar vista previa: ' + err.message);
        }
    };

    // --- Utilidades ---
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const quotaPercentage = (quota.currentSize / quota.limit) * 100;

    const getDisplayedFiles = () => {
        if (activeTab === 'Carpetas') return files.filter(f => f.isDirectory);
        if (activeTab === 'Inicio') return [];
        return files;
    };

    const displayedFiles = getDisplayedFiles();

    return (
        <div className="explorer-container">
            {/* Modal de Vista Previa */}
            <AnimatePresence>
                {previewFile && (
                    <motion.div
                        className="preview-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setPreviewFile(null)}
                    >
                        <motion.div
                            className="preview-modal glass-panel"
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button className="close-preview-btn" onClick={() => setPreviewFile(null)}>
                                <X size={24} />
                            </button>
                            <div className="preview-content">
                                {previewFile.type === 'image' && <img src={previewFile.url} alt={previewFile.name} />}
                                {previewFile.type === 'video' && <video controls src={previewFile.url} />}
                                {previewFile.type === 'audio' && (
                                    <div className="preview-audio">
                                        <FileText size={80} opacity={0.5} />
                                        <p>{previewFile.name}</p>
                                        <audio controls src={previewFile.url} style={{ width: '100%', marginTop: '20px' }} />
                                    </div>
                                )}
                                {previewFile.type === 'pdf' && <embed src={previewFile.url} type="application/pdf" width="100%" height="600px" />}
                                {previewFile.type === 'text' && <pre className="preview-text">{previewContent || 'Cargando...'}</pre>}
                                {previewFile.type === 'unknown' && (
                                    <div className="preview-unknown">
                                        <File size={80} opacity={0.5} />
                                        <p>No se puede previsualizar este archivo.</p>
                                        <button className="btn" onClick={() => downloadItem(previewFile.name, false)}>
                                            <Download size={18} /> Descargar
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="preview-footer">
                                <h3>{previewFile.name}</h3>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* BARRA LATERAL */}
            <aside className="sidebar glass-panel">
                <div className="sidebar-header">
                    <img src="/logo.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8 }} />
                    <h2>Almacén</h2>
                </div>

                <nav className="sidebar-nav">
                    <button className={`nav-btn ${activeTab === 'Inicio' ? 'active' : ''}`} onClick={() => { setActiveTab('Inicio'); setCurrentPath(''); }}>
                        <Home size={18} /> Inicio
                    </button>
                    <button className={`nav-btn ${activeTab === 'Archivos' ? 'active' : ''}`} onClick={() => setActiveTab('Archivos')}>
                        <File size={18} /> Archivos
                    </button>
                    <button className={`nav-btn ${activeTab === 'Carpetas' ? 'active' : ''}`} onClick={() => setActiveTab('Carpetas')}>
                        <Folder size={18} /> Carpetas
                    </button>
                </nav>

                <div className="quota-section">
                    <div className="quota-header">
                        <HardDrive size={18} />
                        <span>Almacenamiento</span>
                    </div>
                    <div className="progress-bar-bg">
                        <motion.div
                            className="progress-bar-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(quotaPercentage, 100)}%` }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                            style={{ backgroundColor: quotaPercentage > 90 ? 'var(--danger)' : 'var(--primary-color)' }}
                        />
                    </div>
                    <div className="quota-text">
                        {formatBytes(quota.currentSize)} de {formatBytes(quota.limit)}
                    </div>
                </div>

                <div className="sidebar-actions">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn sidebar-btn" onClick={() => fileInputRef.current.click()}>
                        <Upload size={18} /> Subir Archivos
                    </motion.button>
                    <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, false)} />

                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn sidebar-btn" onClick={() => folderInputRef.current.click()}>
                        <FolderPlus size={18} /> Subir Carpeta
                    </motion.button>
                    <input type="file" webkitdirectory="" ref={folderInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, true)} />

                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn sidebar-btn" onClick={() => setShowNewFolder(!showNewFolder)}>
                        <FolderPlus size={18} /> Nueva Carpeta
                    </motion.button>
                </div>

                <div className="sidebar-user" style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
                    {userEmail}
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn btn-danger logout-btn" onClick={handleLogout}>
                    <LogOut size={18} /> Cerrar Sesión
                </motion.button>
            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <main className="main-content">
                <header className="topbar glass-panel">
                    <div className="breadcrumb">
                        <button className="breadcrumb-btn" onClick={navigateHome}>
                            <Home size={18} />
                        </button>
                        {currentPath && (
                            <>
                                <ChevronRight size={18} className="breadcrumb-separator" />
                                <span className="breadcrumb-path">{currentPath.split('/').join(' / ')}</span>
                            </>
                        )}
                    </div>
                    {currentPath && (
                        <button className="btn btn-small" onClick={navigateUp}>Volver</button>
                    )}
                </header>

                {/* Barra de Selección Masiva */}
                <AnimatePresence>
                    {selectedItems.length > 0 && (
                        <motion.div
                            className="selection-bar glass-panel"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="selection-info">
                                <span className="selection-count">{selectedItems.length} seleccionado(s)</span>
                                <button className="btn btn-small" onClick={selectAll}>
                                    {selectedItems.length === displayedFiles.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                                </button>
                            </div>
                            <button className="btn btn-danger btn-small" onClick={deleteSelectedItems}>
                                <Trash2 size={16} /> Eliminar
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Dialog Nueva Carpeta */}
                <AnimatePresence>
                    {showNewFolder && (
                        <motion.div
                            className="new-folder-dialog glass-panel"
                            initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        >
                            <form onSubmit={createFolder}>
                                <input
                                    type="text" className="input-field" placeholder="Nombre de la carpeta"
                                    value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus
                                />
                                <div className="dialog-actions">
                                    <button type="button" className="btn btn-danger" onClick={() => setShowNewFolder(false)}>Cancelar</button>
                                    <button type="submit" className="btn">Crear</button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Vistas basadas en Tab */}
                {activeTab === 'Inicio' && !currentPath ? (
                    <motion.div
                        className="home-view"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    >
                        <div className="welcome-banner glass-panel">
                            <img src="/logo.png" alt="Logo" style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 16 }} />
                            <h1>Bienvenido a tu nube personal</h1>
                            <p>Tienes {formatBytes(quota.limit - quota.currentSize)} libres de {formatBytes(quota.limit)}</p>
                            <div className="home-actions mt-4">
                                <button className="btn" onClick={() => setActiveTab('Archivos')}>Navegar Archivos</button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <div className="file-grid">
                        {displayedFiles.length > 0 && selectedItems.length === 0 && (
                            <div className="select-all-wrapper">
                                <button className="btn btn-small btn-secondary" onClick={selectAll}>
                                    <CheckSquare size={16} /> Seleccionar Todos
                                </button>
                            </div>
                        )}

                        {uploading && (
                            <div className="file-item glass-panel uploading-state">
                                <div className="spinner"></div>
                                <span>Subiendo...</span>
                            </div>
                        )}
                        <AnimatePresence>
                            {displayedFiles.map((file) => {
                                const isSelected = selectedItems.includes(file.name);
                                return (
                                    <motion.div
                                        key={file.name}
                                        className={`file-item glass-panel ${isSelected ? 'selected' : ''}`}
                                        layout
                                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ type: "spring", stiffness: 250, damping: 20 }}
                                        whileHover={{ y: -4, scale: 1.02 }}
                                        onClick={() => file.isDirectory ? navigateTo(file.name) : openPreview(file)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="checkbox-container" onClick={(e) => { e.stopPropagation(); toggleSelection(file.name); }}>
                                            {isSelected ? <CheckSquare className="checkbox checked" /> : <Square className="checkbox" />}
                                        </div>

                                        <div className="file-icon" onClick={() => file.isDirectory ? navigateTo(file.name) : openPreview(file)}>
                                            {file.isDirectory ? <Folder size={48} className="folder-icon" /> : <File size={48} className="file-icon-color" />}
                                        </div>
                                        <div className="file-details">
                                            <span className="file-name" title={file.name}>{file.name}</span>
                                            {!file.isDirectory && <span className="file-size">{formatBytes(file.size)}</span>}
                                        </div>
                                        <div className="file-actions">
                                            {!file.isDirectory && (
                                                <button className="action-btn" onClick={(e) => { e.stopPropagation(); downloadItem(file.name, false); }}>
                                                    <Download size={16} />
                                                </button>
                                            )}
                                            <button className="action-btn danger-text" onClick={(e) => { e.stopPropagation(); deleteItem(file.name); }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                        {!uploading && displayedFiles.length === 0 && (
                            <div className="empty-state">
                                <Folder size={64} opacity={0.5} />
                                <p>Esta sección está vacía</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default FileExplorer;
