import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

const ResetPassword: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { confirmPasswordReset } = useAuth();
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!token || token === '*') {
            // Tenta extrair da URL se o roteador falhar (comum em HashRouter)
            const parts = window.location.hash.split('/');
            const extractedToken = parts[parts.length - 1];
            if (!extractedToken || extractedToken.split('.').length !== 3) {
                setStatus('error');
                setMessage('Token de recuperação inválido ou ausente.');
            }
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.length < 8) {
            setStatus('error');
            setMessage('A senha deve ter pelo menos 8 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setStatus('error');
            setMessage('As senhas não coincidem.');
            return;
        }

        setStatus('loading');
        setMessage('Redefinindo sua senha...');

        try {
            let cleanToken = token;
            if (!cleanToken || cleanToken === '*') {
                const parts = window.location.hash.split('/');
                cleanToken = parts[parts.length - 1];
            }

            await confirmPasswordReset(cleanToken!, password);
            setStatus('success');
            setMessage('Senha redefinida com sucesso! Redirecionando para o login...');
            
            setTimeout(() => {
                window.location.href = 'https://agenda-cap53.pages.dev/#/login';
            }, 3000);
        } catch (error: any) {
            console.error('Reset password error:', error);
            setStatus('error');
            setMessage(error.message || 'Falha ao redefinir senha. O link pode ter expirado.');
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-white p-4">
            <div className="relative w-full max-w-[480px] flex flex-col items-center rounded-xl bg-white p-8 shadow-2xl border border-border-light z-10">
                <div className="flex items-center justify-center size-16 rounded-full bg-primary/10 mb-6">
                    <span className={`material-symbols-outlined text-[40px] ${status === 'error' ? 'text-red-500' : 'text-primary'}`}>
                        {status === 'loading' ? 'sync' : status === 'success' ? 'verified' : status === 'error' ? 'error' : 'lock_reset'}
                    </span>
                </div>

                <h1 className="text-text-main text-2xl font-bold mb-4">
                    {status === 'success' ? 'Senha Alterada!' : 'Nova Senha'}
                </h1>

                {message && (
                    <p className={`text-sm mb-6 text-center ${status === 'error' ? 'text-red-600 font-medium' : 'text-text-secondary'}`}>
                        {message}
                    </p>
                )}

                {status !== 'success' && status !== 'loading' && (
                    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
                        <label className="flex flex-col w-full">
                            <p className="text-text-main text-sm font-medium pb-2 text-left">Nova Senha</p>
                            <div className="relative flex w-full flex-1 items-stretch rounded-lg">
                                <input
                                    className="w-full rounded-lg border border-gray-300 h-11 px-4 pr-12 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                                    placeholder="Mínimo 8 caracteres"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-0 top-0 bottom-0 px-4 text-gray-400 hover:text-primary"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </label>

                        <label className="flex flex-col w-full">
                            <p className="text-text-main text-sm font-medium pb-2 text-left">Confirmar Nova Senha</p>
                            <input
                                className="w-full rounded-lg border border-gray-300 h-11 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                                placeholder="Repita a nova senha"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </label>

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="flex w-full items-center justify-center rounded-lg h-11 px-4 bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/20 transition-all text-sm uppercase mt-2"
                        >
                            Alterar Senha
                        </button>
                    </form>
                )}
                
                {status === 'loading' && (
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}

                {(status === 'error' || status === 'success') && (
                    <button
                        onClick={() => window.location.href = 'https://agenda-cap53.pages.dev/#/login'}
                        className="mt-6 text-primary font-bold hover:underline text-sm"
                    >
                        Voltar para o Login
                    </button>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;