import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pb } from '../lib/pocketbase';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setSidebarOpen } = useAuth();

  const getTitle = () => {
    const searchParams = new URLSearchParams(location.search);
    const isEditing = searchParams.get('edit') || searchParams.get('eventId');

    switch (location.pathname) {
      case '/calendar': return 'Calendário';
      case '/create-event': return isEditing ? 'Editar Evento' : 'Novo Evento';
      case '/reports': return 'Relatórios e Análises';
      case '/chat': return 'Comunicação';
      case '/notifications': return 'Central de Notificações';
      case '/requests': 
        return user?.role === 'ALMC' ? 'Notificações (ALMC)' : 'Notificações Recebidas';
      case '/transporte': return 'Suporte de Transporte';
      case '/informatica': return 'Suporte de Informática';
      case '/almoxarifado': return 'Gestão Almoxarifado & Copa';
      case '/locais': return 'Gestão de Locais e Eventos';
      case '/equipe': return 'Equipe';
      case '/meu-envolvimento': return 'Meu Espaço';
      default: return 'Agenda CAP 5.3';
    }
  };

  const getDescription = () => {
    if (location.pathname === '/create-event') {
      return 'Preencha os dados para criar ou editar um evento de compromisso profissional.';
    }
    if (location.pathname === '/notifications') {
      return 'Acompanhe seus convites, avisos e atualizações do sistema.';
    }
    if (location.pathname === '/requests' && user?.role === 'ALMC') {
      return 'Gerencie notificações e solicitações.';
    }
    if (location.pathname === '/chat') {
      return 'Comunicação interna e mensagens.';
    }
    if (location.pathname === '/transporte') {
      return 'Visualize e gerencie as solicitações de transporte para eventos.';
    }
    if (location.pathname === '/informatica') {
      return 'Gerencie a disponibilidade de recursos tecnológicos e apoio técnico.';
    }
    if (location.pathname === '/almoxarifado') {
      return 'Gerencie o catálogo de itens e estoque do almoxarifado e copa.';
    }
    if (location.pathname === '/locais') {
      return 'Adicione, altere ou exclua locais e determine o controle de conflito.';
    }
    if (location.pathname === '/equipe') {
      return 'Conheça os membros da nossa equipe e seus perfis profissionais.';
    }
    if (location.pathname === '/meu-envolvimento') {
      return 'Acompanhe seu desempenho, convites e estatísticas de participação.';
    }
    return 'Gerencie a disponibilidade da equipe e os próximos prazos.';
  };

  return (
    <header className="bg-white border-b border-border-light px-4 md:px-6 py-3 md:py-4 flex-shrink-0 sticky top-0 z-[100]">
      <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Hamburger Button Mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center size-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

          <button
            onClick={() => navigate(-1)}
            className="hidden md:flex items-center justify-center size-10 rounded-full bg-white border border-slate-200/60 text-slate-500 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 shadow-sm active:scale-90"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-[22px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
          </button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-text-main text-lg md:text-2xl font-black leading-tight tracking-tight">
                {getTitle()}
              </h2>
            </div>
            <p className="text-text-secondary text-xs md:text-sm font-normal hidden md:block mt-0.5">
              {getDescription()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center bg-white rounded-lg px-3 py-2 border border-border-light w-64 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
            <span className="material-symbols-outlined text-text-secondary text-[20px]">search</span>
            <input
              type="text"
              placeholder={location.pathname === '/meu-envolvimento' ? "Buscar evento..." : "Buscar..."}
              className="bg-transparent border-none outline-none text-sm ml-2 w-full text-text-main placeholder-gray-400 focus:ring-0"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;