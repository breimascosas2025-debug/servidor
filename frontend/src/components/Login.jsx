import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Lock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import './Login.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            if (isSignUp) {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (signUpError) throw signUpError;
                // Si Supabase requiere confirmación de email
                if (data.user && !data.session) {
                    setMessage('✅ Cuenta creada. Revisa tu correo para confirmar, o intenta iniciar sesión.');
                } else {
                    navigate('/explorer');
                }
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
                navigate('/explorer');
            }
        } catch (err) {
            if (err.message === 'Invalid login credentials') {
                setError('Correo o contraseña incorrectos');
            } else if (err.message === 'User already registered') {
                setError('Este correo ya está registrado. Inicia sesión.');
            } else {
                setError(err.message || 'Error de autenticación');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <motion.div 
                className="glass-panel login-box"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20
                }}
            >
                <div className="login-header">
                    <img src="/logo.png" alt="Almacén Digital" className="login-logo" />
                    <h2>Almacén Digital</h2>
                    <p>Tu nube personal privada</p>
                </div>
                
                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="error-msg">{error}</div>}
                    {message && <div className="success-msg">{message}</div>}
                    
                    <div className="input-group">
                        <Mail className="input-icon" size={20} />
                        <input 
                            type="email" 
                            className="input-field" 
                            placeholder="Correo electrónico" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <Lock className="input-icon" size={20} />
                        <input 
                            type="password" 
                            className="input-field" 
                            placeholder="Contraseña (mín. 6 caracteres)" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <motion.button 
                        type="submit" 
                        className="btn login-btn"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        disabled={loading}
                    >
                        {loading ? 'Cargando...' : (isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión')}
                    </motion.button>
                </form>

                <div className="auth-toggle">
                    <p>
                        {isSignUp ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
                        <button 
                            type="button"
                            className="toggle-btn" 
                            onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }}
                        >
                            {isSignUp ? 'Inicia Sesión' : 'Regístrate'}
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default Login;
