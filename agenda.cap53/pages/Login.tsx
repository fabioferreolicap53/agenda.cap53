import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, SECTORS } from '../components/AuthContext';
import CustomSelect from '../components/CustomSelect';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sector, setSector] = useState('DAPS');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        await register({ name, email, password, sector });
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
    <div className="relative flex h-screen w-full flex-col items-center justify-center bg-white p-4 overflow-hidden">
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
            {isRegistering ? 'Criar minha conta' : 'Bem-vindo de volta'}
          </h1>
          <p className="text-text-secondary text-sm text-center">
            {isRegistering
              ? 'Preencha os dados abaixo para se cadastrar.'
              : 'Acesse sua conta para gerenciar seus eventos.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg text-center">
            {error}
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {isRegistering && (
            <label className="flex flex-col w-full">
              <p className="text-text-main text-sm font-medium pb-2">Nome Usuário</p>
              <input
                className="w-full rounded-lg border border-gray-300 h-11 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

          {isRegistering && (
            <label className="flex flex-col w-full">
              <p className="text-text-main text-sm font-medium pb-2">Setor</p>
              <CustomSelect
                value={sector}
                onChange={setSector}
                required
                className="h-11"
                options={SECTORS.map(s => ({ value: s, label: s }))}
              />
            </label>
          )}

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

          {!isRegistering && (
            <div className="flex justify-end mt-[-8px]">
              <a href="#" className="text-[13px] font-medium text-primary hover:underline">Esqueci minha senha</a>
            </div>
          )}

          <button
            disabled={loading}
            className={`flex w-full items-center justify-center rounded-lg h-11 px-4 bg-primary hover:bg-primary-hover text-white font-bold mt-2 shadow-lg shadow-primary/20 transition-all text-sm uppercase ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Processando...' : (isRegistering ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-light"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-text-secondary/40 uppercase tracking-widest text-[10px]">ou</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-sm font-medium">
          <span className="text-gray-500">
            {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
          </span>
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-primary font-bold hover:underline"
          >
            {isRegistering ? 'Fazer login' : 'Criar uma conta'}
          </button>
        </div>
      </div>

      <footer className="absolute bottom-6 w-full flex flex-col gap-1 items-center justify-center text-center">
        <p className="text-gray-400 text-[10px]">© 2026 Agenda Cap5.3. Todos os direitos reservados.</p>
        <p className="text-gray-400/60 text-[9px]">Desenvolvido por Fabio Ferreira de Oliveira - DAPS/CAP5.3</p>
      </footer>
    </div>
  );
};

export default Login;