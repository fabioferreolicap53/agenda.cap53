import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
        setMessage('Token de verificação não encontrado.');
        return;
      }

      try {
        await pb.collection('agenda_cap53_usuarios').confirmVerification(token);
        setStatus('success');
        setMessage('E-mail verificado com sucesso!');
        
        // Auto redirect after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 5000);
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Erro ao verificar e-mail. O link pode ter expirado ou já ter sido utilizado.');
      }
    };

    verify();
  }, [token, navigate]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-white p-4 overflow-y-auto">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]"></div>

      <div className="relative w-full max-w-[480px] flex flex-col items-center rounded-xl bg-white p-8 shadow-2xl border border-border-light z-10 text-center">
        <div className="flex items-center gap-3 text-primary mb-6">
          <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10">
            <span className="material-symbols-outlined text-[32px]">
              {status === 'loading' ? 'sync' : status === 'success' ? 'verified' : 'error'}
            </span>
          </div>
        </div>

        <h1 className="text-text-main text-2xl font-bold mb-4">
          {status === 'loading' ? 'Aguarde um momento' : 
           status === 'success' ? 'E-mail Verificado!' : 'Ops! Algo deu errado'}
        </h1>

        <p className={`text-sm mb-8 ${status === 'error' ? 'text-red-600' : 'text-text-secondary'}`}>
          {message}
        </p>

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-gray-400 animate-pulse">
              Você será redirecionado para o login em instantes...
            </p>
            <Link 
              to="/login"
              className="flex items-center justify-center rounded-lg h-11 px-8 bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/20 transition-all text-sm uppercase"
            >
              Ir para Login
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-3 w-full">
            <Link 
              to="/login"
              className="flex items-center justify-center rounded-lg h-11 px-4 bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/20 transition-all text-sm uppercase"
            >
              Voltar para o Início
            </Link>
            <p className="text-xs text-gray-500">
              Se o problema persistir, solicite um novo link de verificação tentando fazer login.
            </p>
          </div>
        )}

        {status === 'loading' && (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        )}
      </div>

      <footer className="absolute bottom-6 w-full flex flex-col gap-1 items-center justify-center text-center">
        <p className="text-gray-400 text-[10px]">© 2026 Agenda Cap5.3. Todos os direitos reservados.</p>
        <p className="text-gray-400/60 text-[9px]">DAPS/CAP5.3</p>
      </footer>
    </div>
  );
};

export default VerifyEmail;
