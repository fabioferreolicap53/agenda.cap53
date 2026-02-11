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
            if (!token) {
                setStatus('error');
                setMessage('Token de verificação ausente.');
                return;
            }

            try {
                // Algoritmo Sênior de Extração de Token:
                // 1. Pega o token bruto da URL
                // 2. Remove aspas e espaços
                // 3. Lida com double-hashing ou encoding de caracteres (#/%23)
                let cleanToken = (token || '').trim().replace(/['"”]/g, '');
                
                // Se o token contém o padrão de rota (ex: #/verify-email/TOKEN), extrai apenas a última parte
                if (cleanToken.includes('/')) {
                    const parts = cleanToken.split('/');
                    cleanToken = parts[parts.length - 1];
                }
                
                // Validação mínima de formato JWT (três partes separadas por ponto)
                if (!cleanToken || cleanToken.split('.').length !== 3) {
                    throw new Error('Token de verificação inválido ou malformado.');
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
