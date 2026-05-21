import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LogOut, Upload, FolderPlus, Cloud, Trash2, Download } from 'lucide-react';

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const Dashboard = ({ setAuth }) => {
    const [storage, setStorage] = useState({ used: 0, total: 20 * 1024 * 1024 * 1024, available: 0 });
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [uploading, setUploading] = useState(false);

    const token = localStorage.getItem('token');
    const api = axios.create({
        baseURL: 'https://servidor-2j2q.onrender.com/api',
        headers: { Authorization: `Bearer ${token}` }
    });

    const fetchData = async () => {
        try {
            const [storageRes, filesRes, foldersRes] = await Promise.all([
                api.get('/storage'),
                api.get(`/files${currentFolder ? `?folder_id=${currentFolder}` : ''}`),
                api.get(`/folders${currentFolder ? `?parent_id=${currentFolder}` : ''}`)
            ]);
            setStorage(storageRes.data);
            setFiles(filesRes.data);
            setFolders(foldersRes.data);
        } catch (err) {
            console.error("Error fetching data", err);
            if (err.response?.status === 401) handleLogout();
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentFolder]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setAuth(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        if (currentFolder) formData.append('folder_id', currentFolder);

        try {
            await api.post('/files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Error al subir archivo');
        } finally {
            setUploading(false);
        }
    };

    const createFolder = async () => {
        const name = prompt('Nombre de la carpeta:');
        if (!name) return;
        try {
            await api.post('/folders', { name, parent_id: currentFolder });
            fetchData();
        } catch (err) {
            alert('Error al crear carpeta');
        }
    };

    const deleteFile = async (id) => {
        if (!confirm('¿Borrar este archivo?')) return;
        try {
            await api.delete(`/files/${id}`);
            fetchData();
        } catch (err) {
            alert('Error al borrar archivo');
        }
    };

    const storagePercent = Math.min(100, (storage.used / storage.total) * 100);

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Navbar */}
            <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2 text-brand-500">
                    <Cloud className="w-8 h-8" />
                    <h1 className="text-xl font-bold text-white tracking-tight">Mi Nube</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-medium text-slate-300">
                            {formatBytes(storage.used)} de {formatBytes(storage.total)}
                        </span>
                        <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden mt-1">
                            <div 
                                className={`h-full rounded-full ${storagePercent > 90 ? 'bg-red-500' : 'bg-brand-500'}`} 
                                style={{ width: `${storagePercent}%` }}
                            />
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-full hover:bg-slate-700">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col">
                {/* Actions */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        {currentFolder && (
                            <button 
                                onClick={() => setCurrentFolder(null)} 
                                className="text-sm text-slate-400 hover:text-brand-400 font-medium"
                            >
                                &larr; Volver al inicio
                            </button>
                        )}
                        <h2 className="text-2xl font-bold text-white">
                            {currentFolder ? 'Carpeta' : 'Archivos'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={createFolder} className="btn-primary flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700 focus:ring-slate-700">
                            <FolderPlus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva Carpeta</span>
                        </button>
                        <label className="btn-primary flex items-center gap-2 cursor-pointer shadow-sm">
                            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">{uploading ? 'Subiendo...' : 'Subir'}</span>
                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                        </label>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {folders.map(folder => (
                        <div 
                            key={folder.id} 
                            onClick={() => setCurrentFolder(folder.id)}
                            className="bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700 cursor-pointer hover:border-brand-500 hover:shadow-md transition-all flex flex-col items-center justify-center aspect-square group"
                        >
                            <FolderPlus className="w-12 h-12 text-brand-400 group-hover:text-brand-300 mb-2 transition-colors" />
                            <span className="text-sm font-medium text-slate-300 truncate w-full text-center">{folder.name}</span>
                        </div>
                    ))}
                    
                    {files.map(file => {
                        const isImage = file.mimetype.startsWith('image/');
                        const isVideo = file.mimetype.startsWith('video/');
                        const fileUrl = file.filepath?.startsWith('http') ? file.filepath : `/uploads/${file.filename}`;
                        return (
                            <div key={file.id} className="relative group bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden aspect-square">
                                {isImage ? (
                                    <img src={fileUrl} alt={file.originalname} className="w-full h-full object-cover" />
                                ) : isVideo ? (
                                    <video src={fileUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-700">
                                        <span className="text-xs text-slate-400">Archivo</span>
                                    </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex flex-row items-end justify-between">
                                    <div className="text-white text-xs truncate drop-shadow-md flex-1 pr-2">
                                        {file.originalname}
                                    </div>
                                    <div className="flex gap-2">
                                        <a href={`https://servidor-2j2q.onrender.com/api/files/${file.id}/download`} download target="_blank" rel="noreferrer" className="p-1.5 bg-white/20 hover:bg-blue-500 rounded-full text-white backdrop-blur-sm transition-colors">
                                            <Download className="w-4 h-4" />
                                        </a>
                                        <button onClick={() => deleteFile(file.id)} className="p-1.5 bg-white/20 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {folders.length === 0 && files.length === 0 && (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500">
                            <Cloud className="w-16 h-16 mb-4 opacity-50" />
                            <p>No hay archivos aquí aún.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
