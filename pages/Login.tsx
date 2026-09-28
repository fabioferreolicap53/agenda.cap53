import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, SECTORS } from '../components/AuthContext';
import { pb } from '../lib/pocketbase';
import CustomSelect from '../components/CustomSelect';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, requestPasswordReset } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sector, setSector] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [needsVerificationView, setNeedsVerificationView] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const handleResendVerification = useCallback(async () => {
    if (resendCooldown > 0 || resendLoading || !email) return;
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await pb.collection('agenda_cap53_usuarios').requestVerification(email);
      setResendSuccess(true);
      setResendCooldown(60);
    } catch (err) {
      console.error('Failed to resend verification:', err);
    } finally {
      setResendLoading(false);
    }
  }, [email, resendCooldown, resendLoading]);

  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isResetting) {
        await requestPasswordReset(email);
        setSuccessMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
        setIsResetting(false);
        setLoading(false);
        return;
      }
      setNeedsVerificationView(false);
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('As senhas não coincidem.');
          setLoading(false);
          return;
        }
        const result = await register({ name, email, password, passwordConfirm: confirmPassword, sector });
        if (result.needsVerification) {
          setNeedsVerificationView(true);
          setIsRegistering(false);
          setLoading(false);
          return;
        }
      } else {
        await login(email, password);
      }
      navigate('/calendar');
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Ocorreu um erro na autenticação. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-white p-4 overflow-y-auto">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]"></div>

      <div className="relative w-full max-w-[480px] flex flex-col rounded-xl bg-white p-8 shadow-2xl border border-border-light z-10">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center gap-3 text-primary mb-2">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-[28px]">calendar_month</span>
            </div>
            <h2 className="text-text-main text-2xl font-bold">Agenda Cap5.3</h2>
          </div>
          <h1 className="text-text-main text-xl font-bold text-center">
            {isResetting ? 'Recuperar senha' : (isRegistering ? 'Criar minha conta' : 'Bem-vindo de volta')}
          </h1>
          <p className="text-text-secondary text-sm text-center">
            {isResetting 
              ? 'Informe seu e-mail para receber o link de recuperação.' 
              : (isRegistering
                ? 'Preencha os dados abaixo para se cadastrar.'
                : 'Acesse sua conta para gerenciar seus eventos.')}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg text-center">
            {error}
          </div>
        )}

        {successMessage && !needsVerificationView && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 text-xs rounded-lg text-center font-medium">
            {successMessage}
          </div>
        )}

        {needsVerificationView && (
          <div className="mb-6 p-5 bg-amber-50 border-2 border-amber-400 rounded-xl text-center">
            <div className="flex items-center justify-center size-14 rounded-full bg-amber-100 mx-auto mb-3">
              <span className="material-symbols-outlined text-[36px] text-amber-600">mark_email_unread</span>
            </div>
            <h3 className="text-amber-800 text-base font-bold mb-2">Verifique seu e-mail</h3>
            <p className="text-amber-700 text-sm mb-1">
              Enviamos um link de confirmação para
            </p>
            <p className="text-amber-900 text-sm font-bold mb-3 break-all">{email}</p>
            <p className="text-amber-600 text-xs mb-4">
              Clique no link no e-mail para ativar sua conta. Verifique também a pasta de spam.
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendCooldown > 0 || resendLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                resendCooldown > 0 || resendLoading
                  ? 'bg-amber-100 text-amber-400 cursor-not-allowed'
                  : 'bg-amber-600 text-white hover:bg-amber-700 shadow-md'
              }`}
            >
              {resendLoading
                ? 'Enviando...'
                : resendCooldown > 0
                  ? `Reenviar em ${resendCooldown}s`
                  : 'Reenviar e-mail de verificação'}
            </button>
            {resendSuccess && (
              <p className="mt-2 text-green-600 text-xs font-medium">E-mail reenviado com sucesso!</p>
            )}
            <button
              type="button"
              onClick={() => {
                setNeedsVerificationView(false);
                setResendSuccess(false);
                setIsRegistering(false);
                setSuccessMessage('');
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-amber-700 hover:text-amber-900 text-xs font-bold transition-all group"
            >
              <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
              Voltar para o login
            </button>
          </div>
        )}

        {!needsVerificationView && (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {!isResetting && isRegistering && (
            <label className="flex flex-col w-full">
              <p className="text-text-main text-sm font-medium pb-2">Nome Usuário</p>
              <input
                className="w-full rounded-lg border border-gray-300 h-11 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm uppercase"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                onBlur={(e) => setName(e.target.value.trim().toUpperCase())}
                required
              />
            </label>
          )}

          <label className="flex flex-col w-full">
            <p className="text-text-main text-sm font-medium pb-2">E-mail</p>
            <input
              className="w-full rounded-lg border border-gray-300 h-11 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
              placeholder="exemplo@empresa.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          {!isResetting && isRegistering && (
            <label className="flex flex-col w-full">
              <p className="text-text-main text-sm font-medium pb-2">Setor</p>
              <CustomSelect
                value={sector}
                onChange={setSector}
                required
                className="h-11"
                placeholder="Selecione o setor"
                options={SECTORS.map(s => ({ value: s, label: s }))}
              />
            </label>
          )}

          {!isResetting && (
            <label className="flex flex-col w-full">
              <div className="flex justify-between items-center pb-2">
                <p className="text-text-main text-sm font-medium">Senha</p>
              </div>
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
          )}

          {!isResetting && isRegistering && (
            <label className="flex flex-col w-full">
              <p className="text-text-main text-sm font-medium pb-2">Confirmar Senha</p>
              <div className="relative flex w-full flex-1 items-stretch rounded-lg">
                <input
                  className="w-full rounded-lg border border-gray-300 h-11 px-4 pr-12 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                  placeholder="Repita a senha"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-0 top-0 bottom-0 px-4 text-gray-400 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </label>
          )}

          {!isResetting && !isRegistering && (
            <div className="flex justify-end mt-[-8px]">
              <button 
                type="button"
                onClick={() => {
                  setIsResetting(true);
                  setError('');
                  setSuccessMessage('');
                }}
                className="text-[13px] font-medium text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <button
            disabled={loading}
            className={`flex w-full items-center justify-center rounded-lg h-11 px-4 bg-primary hover:bg-primary-hover text-white font-bold mt-2 shadow-lg shadow-primary/20 transition-all text-sm uppercase ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Processando...' : (isResetting ? 'Enviar Link' : (isRegistering ? 'Cadastrar' : 'Entrar'))}
          </button>
        </form>
        )}

        {!needsVerificationView && (
        <>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-light"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-text-secondary/40 uppercase tracking-widest text-[10px]">ou</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 text-sm font-medium">
          {!isResetting ? (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">
                {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
              </span>
              <button
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                  setSuccessMessage('');
                  setConfirmPassword('');
                  setNeedsVerificationView(false);
                  setResendSuccess(false);
                }}
                className="text-primary font-bold hover:underline"
              >
                {isRegistering ? 'Fazer login' : 'Criar uma conta'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsResetting(false);
                setError('');
                setSuccessMessage('');
              }}
              className="text-primary font-bold hover:underline"
            >
              Voltar para o login
            </button>
          )}
        </div>
        </>
        )}
      </div>

      <footer className="absolute bottom-6 w-full flex flex-col gap-1 items-center justify-center text-center">
        <p className="text-gray-400 text-[10px]">© 2026 Agenda Cap5.3. Todos os direitos reservados.</p>
        <p className="text-gray-400/60 text-[9px]">Desenvolvido por Fabio Ferreira de Oliveira - DAPS/CAP5.3</p>
      </footer>
    </div>
  );
};

export default Login;