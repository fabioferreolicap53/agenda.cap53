import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';

const VerifyEmail: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verificando seu e-mail...');

    useEffect(() => {
        const verify = async () => {
            // Estratégia Multinível de Extração de Token
            let rawToken = token;
            
            // 1. Tenta pegar da URL se o React Router falhar ou o token vier com asterisco
            if (!rawToken || rawToken === '*' || rawToken === 'undefined') {
                const searchParams = new URLSearchParams(window.location.search);
                rawToken = searchParams.get('token'); // Tenta ?token=...
                
                if (!rawToken) {
                    // Tenta extrair da parte final do path (considerando hash routing)
                    const pathParts = window.location.hash.split('/');
                    rawToken = pathParts[pathParts.length - 1];
                }
            }

            if (!rawToken || rawToken.length < 10 || rawToken.includes('login')) {
                // Se ainda não temos um token válido, aguardamos ou mostramos erro
                console.warn('Token ainda não detectado ou inválido:', rawToken);
                return;
            }

            try {
                // Limpeza profunda do token
                let cleanToken = rawToken.trim()
                    .replace(/['"”]/g, '')     // Remove aspas
                    .split('?')[0]             // Remove query params
                    .split('&')[0];            // Remove outros params
                
                // Se o token vier com prefixos de rota devido a encoding de email
                if (cleanToken.includes('/')) {
                    cleanToken = cleanToken.split('/').pop() || '';
                }

                console.log('Iniciando verificação para o token:', cleanToken.substring(0, 10) + '...');
                
                // Removemos a validação estrita de 3 partes para evitar falsos negativos se o formato mudar
                if (cleanToken.length < 30) {
                     throw new Error('Token de verificação parece inválido ou incompleto.');
                }
                
                await pb.collection('agenda_cap53_usuarios').confirmVerification(cleanToken);
                setStatus('success');
                setMessage('E-mail verificado com sucesso! Redirecionando para o login...');
                
                setTimeout(() => {
                    // Forçamos o redirecionamento para o domínio correto do frontend
                    window.location.href = 'https://agenda-cap53.pages.dev/#/login';
                }, 3000);
            } catch (error: any) {
                console.error('Erro na verificação:', error);
                setStatus('error');
                
                // Tradução de erros comuns do PocketBase
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
    }, [token, navigate]);

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
                        onClick={() => window.location.href = 'https://agenda-cap53.pages.dev/#/login'}
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
