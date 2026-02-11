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
<<<<<<< HEAD
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
=======
            // Tenta pegar o token do useParams ou diretamente da URL se o roteador falhar
            let rawToken = token;
            if (!rawToken || rawToken === '*') {
                const parts = window.location.href.split('/');
                rawToken = parts[parts.length - 1];
                console.log('Token extraído via window.location:', rawToken);
            }

            if (!rawToken || rawToken.length < 10) {
                setStatus('error');
                setMessage('Token de verificação ausente ou inválido na URL.');
>>>>>>> 24ea5ab793136e9911250573c3a96e1d6722e0ea
                return;
            }

            try {
<<<<<<< HEAD
                // Limpeza profunda do token
                let cleanToken = rawToken.trim()
                    .replace(/['"”]/g, '')     // Remove aspas
                    .split('?')[0]             // Remove query params
                    .split('&')[0];            // Remove outros params
                
                // Se o token vier com prefixos de rota devido a encoding de email
=======
                // Algoritmo Sênior de Extração de Token:
                // 1. Limpa aspas e espaços
                let cleanToken = rawToken.trim().replace(/['"”]/g, '');
                
                // 2. Se o token ainda contiver partes da URL (devido a redirecionamentos)
>>>>>>> 24ea5ab793136e9911250573c3a96e1d6722e0ea
                if (cleanToken.includes('/')) {
                    cleanToken = cleanToken.split('/').pop() || '';
                }

<<<<<<< HEAD
                console.log('Iniciando verificação para o token:', cleanToken.substring(0, 10) + '...');
                
                if (cleanToken.split('.').length !== 3) {
                    throw new Error('Formato de token inválido. Use o link original do e-mail.');
=======
                // 3. Remove possíveis sufixos de consulta (?...)
                cleanToken = cleanToken.split('?')[0];
                
                console.log('Processando verificação para o token:', cleanToken.substring(0, 10) + '...');
                
                // Validação mínima de formato JWT (três partes separadas por ponto)
                if (!cleanToken || cleanToken.split('.').length !== 3) {
                    throw new Error('O formato do token é inválido. Certifique-se de usar o link completo do e-mail.');
>>>>>>> 24ea5ab793136e9911250573c3a96e1d6722e0ea
                }
                
                await pb.collection('agenda_cap53_usuarios').confirmVerification(cleanToken);
                setStatus('success');
<<<<<<< HEAD
                setMessage('E-mail verificado com sucesso! Redirecionando para o login...');
                
                setTimeout(() => navigate('/login'), 3000);
            } catch (error: any) {
                console.error('Erro na verificação:', error);
                setStatus('error');
                
                // Mensagens amigáveis para erros comuns
                if (error.status === 400) {
                    setMessage('Este link de verificação expirou ou já foi utilizado.');
                } else {
                    setMessage(error.message || 'Falha na verificação. Tente solicitar um novo link.');
                }
=======
                setMessage('E-mail verificado com sucesso! Você já pode fazer login.');
                
                // Auto redirect after 3 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 4000);
            } catch (error: any) {
                console.error('Verification error:', error);
                setStatus('error');
                setMessage(error.message || 'Falha ao verificar e-mail. O link pode ter expirado.');
>>>>>>> 24ea5ab793136e9911250573c3a96e1d6722e0ea
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
