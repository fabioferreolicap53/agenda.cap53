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
                return;
            }

            try {
                // Algoritmo Sênior de Extração de Token:
                // 1. Limpa aspas e espaços
                let cleanToken = rawToken.trim().replace(/['"”]/g, '');
                
                // 2. Se o token ainda contiver partes da URL (devido a redirecionamentos)
                if (cleanToken.includes('/')) {
                    cleanToken = cleanToken.split('/').pop() || '';
                }

                // 3. Remove possíveis sufixos de consulta (?...)
                cleanToken = cleanToken.split('?')[0];
                
                console.log('Processando verificação para o token:', cleanToken.substring(0, 10) + '...');
                
                // Validação mínima de formato JWT (três partes separadas por ponto)
                if (!cleanToken || cleanToken.split('.').length !== 3) {
                    throw new Error('O formato do token é inválido. Certifique-se de usar o link completo do e-mail.');
                }
                
                await pb.collection('agenda_cap53_usuarios').confirmVerification(cleanToken);
                setStatus('success');
                setMessage('E-mail verificado com sucesso! Você já pode fazer login.');
                
                // Auto redirect after 3 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 4000);
            } catch (error: any) {
                console.error('Verification error:', error);
                setStatus('error');
                setMessage(error.message || 'Falha ao verificar e-mail. O link pode ter expirado.');
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
