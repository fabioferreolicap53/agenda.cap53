import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { pb } from '../lib/pocketbase';

const VerifyEmail: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verificando seu e-mail...');

    useEffect(() => {
        const verify = async () => {
            // Extrair token: params da URL > query string ?verify=
            let rawToken = token && token !== '*' ? token : (searchParams.get('verify') || searchParams.get('token'));

            if (!rawToken || rawToken.length < 10) {
                console.warn('Token não detectado ou inválido:', rawToken);
                setStatus('error');
                setMessage('Link de verificação inválido ou ausente.');
                return;
            }

            try {
                // Limpeza do token
                let cleanToken = rawToken.trim()
                    .replace(/['""]/g, '')
                    .split('?')[0]
                    .split('&')[0];

                if (cleanToken.includes('/')) {
                    cleanToken = cleanToken.split('/').pop() || '';
                }

                console.log('Iniciando verificação para token:', cleanToken.substring(0, 10) + '...');

                if (cleanToken.length < 30) {
                    throw new Error('Token de verificação parece inválido ou incompleto.');
                }

                await pb.collection('agenda_cap53_usuarios').confirmVerification(cleanToken);
                setStatus('success');
                setMessage('E-mail verificado com sucesso! Redirecionando para o login...');

                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (error: any) {
                console.error('Erro na verificação:', error);
                setStatus('error');

                const errorMessage = error?.message || '';

                if (error.status === 400 || errorMessage.includes('failed to load')) {
                    setMessage('Este link de verificação é inválido, expirou ou já foi utilizado.');
                } else if (errorMessage.includes('Something went wrong') || error.status === 500) {
                    setMessage('Ocorreu um erro interno no servidor. Tente novamente mais tarde.');
                } else if (errorMessage.includes('Failed to fetch') || error.status === 0) {
                    setMessage('Erro de conexão. Verifique sua internet.');
                } else {
                    setMessage('Não foi possível verificar seu e-mail. Tente solicitar um novo link de verificação.');
                }
            }
        };

        verify();
    }, [token, searchParams, navigate]);

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-white p-4">
            <div className="relative w-full max-w-[480px] flex flex-col items-center rounded-xl bg-white p-8 shadow-2xl border border-border-light z-10 text-center">
                <div className="flex items-center justify-center size-16 rounded-full bg-primary/10 mb-6">
                    <span className={`material-symbols-outlined text-[40px] ${status === 'error' ? 'text-red-500' : 'text-primary'}`}>
                        {status === 'loading' ? 'sync' : status === 'success' ? 'verified' : 'error'}
                    </span>
                </div>

                <h1 className="text-text-main text-2xl font-bold mb-4">
                    {status === 'loading' ? 'Processando...' : status === 'success' ? 'E-mail Verificado!' : 'Ops! Algo deu errado'}
                </h1>

                <p className={`text-sm mb-8 ${status === 'error' ? 'text-red-600' : 'text-text-secondary'}`}>
                    {message}
                </p>

                {status !== 'loading' && (
                    <button
                        onClick={() => navigate('/login')}
                        className="flex w-full items-center justify-center rounded-lg h-11 px-4 bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/20 transition-all text-sm uppercase"
                    >
                        Ir para o Login
                    </button>
                )}
                
                {status === 'loading' && (
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
