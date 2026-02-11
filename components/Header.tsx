import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pb } from '../lib/pocketbase';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mySpaceCount, setMySpaceCount] = useState(0);

  useEffect(() => {
    if (!user || location.pathname !== '/meu-envolvimento') return;

    const fetchCount = async () => {
      try {
        const res = await pb.collection('agenda_cap53_notifications').getList(1, 1, {
          filter: `user = "${user.id}" && read = false && (type = "event_invite" || type = "event_participation_request")`
        });
        setMySpaceCount(res.totalItems);
      } catch (e) {
        console.error("Error fetching my space count in header", e);
      }
    };

    fetchCount();

    const unsubscribe = pb.collection('agenda_cap53_notifications').subscribe('*', () => {
      fetchCount();
    });

    return () => {
      pb.collection('agenda_cap53_notifications').unsubscribe('*');
    };
  }, [user, location.pathname]);

  const getTitle = () => {
    const searchParams = new URLSearchParams(location.search);
    const isEditing = searchParams.get('edit') || searchParams.get('eventId');

    switch (location.pathname) {
      case '/calendar': return 'Calendário';
      case '/create-event': return isEditing ? 'Editar Evento' : 'Novo Evento';
      case '/reports': return 'Relatórios e Análises';
      case '/chat': return 'Comunicação';
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
    <header className="bg-white border-b border-border-light px-6 py-4 flex-shrink-0 sticky top-0 z-20">
      <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center justify-center size-10 rounded-full bg-white border border-slate-200/60 text-slate-500 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 shadow-sm active:scale-90"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-[22px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
          </button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-text-main text-2xl font-black leading-tight tracking-tight">
                {getTitle()}
              </h2>
              {location.pathname === '/meu-envolvimento' && mySpaceCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] h-5 flex items-center justify-center animate-in zoom-in shadow-sm">
                  {mySpaceCount > 9 ? '9+' : mySpaceCount}
                </span>
              )}
            </div>
            <p className="text-text-secondary text-sm font-normal hidden md:block">
              {getDescription()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-white rounded-lg px-3 py-2 border border-border-light w-64 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <span className="material-symbols-outlined text-text-secondary text-[20px]">search</span>
            <input
              type="text"
              placeholder={location.pathname === '/meu-envolvimento' ? "Buscar por nome do evento..." : "Buscar..."}
              className="bg-transparent border-none outline-none text-sm ml-2 w-full text-text-main placeholder-gray-400 focus:ring-0"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;