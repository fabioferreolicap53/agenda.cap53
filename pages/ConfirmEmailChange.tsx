import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';

const ConfirmEmailChange: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        const rawToken = token && token !== '*' ? token : searchParams.get('token');
        if (!rawToken || rawToken.length < 10) {
            setStatus('error');
            setMessage('Link de confirmação inválido ou ausente.');
        } else {
            setHasToken(true);
        }
    }, [token, searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password || password.length < 8) {
            setStatus('error');
            setMessage('A senha deve ter pelo menos 8 caracteres.');
            return;
        }

        setStatus('loading');
        setMessage('Confirmando alteração de e-mail...');

        try {
            let cleanToken = token && token !== '*' ? token : searchParams.get('token');

            if (!cleanToken || cleanToken.length < 30) {
                throw new Error('Token de confirmação inválido ou incompleto.');
            }

            await pb.collection('agenda_cap53_usuarios').confirmEmailChange(cleanToken, password);
            setStatus('success');
            setMessage('E-mail alterado com sucesso! Redirecionando para o login...');

            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (error: any) {
            console.error('Erro na confirmação de troca de e-mail:', error);
            setStatus('error');

            const errorMessage = error?.message || '';

            if (error.status === 400 || errorMessage.includes('failed to load')) {
                setMessage('Este link é inválido, expirou ou já foi utilizado. A senha pode estar incorreta.');
            } else if (errorMessage.includes('Something went wrong') || error.status === 500) {
                setMessage('Ocorreu um erro interno no servidor. Tente novamente mais tarde.');
            } else if (errorMessage.includes('Failed to fetch') || error.status === 0) {
                setMessage('Erro de conexão. Verifique sua internet.');
            } else {
                setMessage('Não foi possível confirmar a alteração de e-mail. Verifique sua senha.');
            }
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-white p-4">
            <div className="relative w-full max-w-[480px] flex flex-col items-center rounded-xl bg-white p-8 shadow-2xl border border-border-light z-10">
                <div className="flex items-center justify-center size-16 rounded-full bg-primary/10 mb-6">
                    <span className={`material-symbols-outlined text-[40px] ${status === 'error' ? 'text-red-500' : 'text-primary'}`}>
                        {status === 'loading' ? 'sync' : status === 'success' ? 'verified' : status === 'error' ? 'error' : 'mark_email_read'}
                    </span>
                </div>

                <h1 className="text-text-main text-2xl font-bold mb-4">
                    {status === 'success' ? 'E-mail Confirmado!' : 'Confirmar Novo E-mail'}
                </h1>

                {message && (
                    <p className={`text-sm mb-6 text-center ${status === 'error' ? 'text-red-600 font-medium' : 'text-text-secondary'}`}>
                        {message}
                    </p>
                )}

                {hasToken && status !== 'success' && status !== 'loading' && (
                    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
                        <p className="text-text-secondary text-xs text-center">
                            Informe sua senha atual para confirmar a alteração do e-mail.
                        </p>

                        <label className="flex flex-col w-full">
                            <p className="text-text-main text-sm font-medium pb-2 text-left">Senha Atual</p>
                            <div className="relative flex w-full flex-1 items-stretch rounded-lg">
                                <input
                                    className="w-full rounded-lg border border-gray-300 h-11 px-4 pr-12 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                                    placeholder="Digite sua senha"
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

                        <button
                            type="submit"
                            className="flex w-full items-center justify-center rounded-lg h-11 px-4 bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/20 transition-all text-sm uppercase mt-2"
                        >
                            Confirmar Alteração
                        </button>
                    </form>
                )}

                {status === 'loading' && (
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}

                {(status === 'error' || status === 'success') && (
                    <button
                        onClick={() => navigate('/login')}
                        className="mt-6 text-primary font-bold hover:underline text-sm"
                    >
                        Voltar para o Login
                    </button>
                )}
            </div>
        </div>
    );
};

export default ConfirmEmailChange;
