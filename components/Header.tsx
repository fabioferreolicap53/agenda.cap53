import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pb } from '../lib/pocketbase';
import { useNotifications } from '../hooks/useNotifications';
import { EventsResponse, UsersResponse } from '../lib/pocketbase-types';

type SearchResult = EventsResponse<{
  user: UsersResponse;
}>;

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setSidebarOpen } = useAuth();
  const { unreadCount } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = () => {
    if (searchRef.current) {
      const rect = searchRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 350)
      });
    }
  };

  useEffect(() => {
    if (showResults) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showResults]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('search') || '');
  }, [location.search]);

  // Global search logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        let filter = `(title ~ "${searchTerm}" || description ~ "${searchTerm}" || user.name ~ "${searchTerm}")`;
        
        // Check if it looks like a date (DD/MM/YYYY, DD/MM, or DD/)
        const dateMatch = searchTerm.match(/^(\d{1,2})\/(\d{1,2})?(\/(\d{2,4}))?$/);
        if (dateMatch) {
          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2] ? dateMatch[2].padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
          const year = dateMatch[4] ? (dateMatch[4].length === 2 ? `20${dateMatch[4]}` : dateMatch[4]) : new Date().getFullYear();
          const dateStr = `${year}-${month}-${day}`;
          // Prioritize searching in date_start as requested
          filter = `(date_start ~ "${dateStr}" || title ~ "${searchTerm}" || user.name ~ "${searchTerm}")`;
        }

        const records = await pb.collection('agenda_cap53_eventos').getList<SearchResult>(1, 5, {
          filter,
          expand: 'user',
          sort: '-date_start',
        });
        setSearchResults(records.items);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Click outside or ESC to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isInsideSearch = searchRef.current && searchRef.current.contains(event.target as Node);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
      
      if (!isInsideSearch && !isInsideDropdown) {
        setShowResults(false);
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  const handleClearSearch = () => {
    setSearchTerm('');
    setShowResults(false);
    setSearchResults([]);
    const params = new URLSearchParams(location.search);
    params.delete('search');
    navigate({
      pathname: location.pathname,
      search: params.toString()
    }, { replace: true });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowResults(true);

    const params = new URLSearchParams(location.search);
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }

    navigate({
      pathname: location.pathname,
      search: params.toString()
    }, { replace: true });
  };

  const handleResultClick = (eventId: string, date?: string) => {
    // 1. Limpar estados de busca IMEDIATAMENTE
    setShowResults(false);
    setSearchTerm('');
    setSearchResults([]);
    
    // 2. Formatar a data para a URL (YYYY-MM-DD) de forma segura (local date)
    let dateStr = '';
    if (date) {
      const eventDate = new Date(date.replace(' ', 'T')); // Garantir formato ISO para consistência
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }
    
    // 3. Navegar para o calendário com o eventId para abrir o modal. 
    // Usamos um novo objeto URLSearchParams para garantir que o 'search' foi removido.
    // Passamos a página atual no parâmetro 'from' para podermos retornar se necessário.
    const newParams = new URLSearchParams();
    newParams.set('view', 'day');
    newParams.set('date', dateStr);
    newParams.set('eventId', eventId);
    newParams.set('from', location.pathname);
    
    // Se estivermos em outra página que não o calendário, o Header será remontado ou atualizado.
    // Garantimos que o parâmetro de busca seja removido do histórico também.
    navigate({
      pathname: '/calendar',
      search: newParams.toString()
    }, { replace: true });
  };

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
            className="lg:hidden relative flex items-center justify-center size-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all z-[101]"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 size-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] text-white font-bold animate-in zoom-in duration-200">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {location.pathname !== '/calendar' && (
            <button
              onClick={() => navigate(-1)}
              className="hidden md:flex items-center justify-center size-10 rounded-full bg-white border border-slate-200/60 text-slate-500 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 shadow-sm active:scale-90 group"
            >
              <span className="material-symbols-outlined text-[22px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            </button>
          )}
          
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
          <div ref={searchRef} className="relative hidden lg:block">
            <div className="flex items-center bg-white rounded-lg px-3 py-2 border border-border-light w-64 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-sm">
              <span className="material-symbols-outlined text-text-secondary text-[20px]">
                {isSearching ? 'sync' : 'search'}
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearch}
                onFocus={() => setShowResults(true)}
                placeholder={location.pathname === '/meu-envolvimento' ? "Buscar evento..." : "Buscar por título, data ou criador..."}
                className={`bg-transparent border-none outline-none text-sm ml-2 w-full text-text-main placeholder-gray-400 focus:ring-0 ${isSearching ? 'animate-pulse' : ''}`}
              />
              {searchTerm && (
                <button
                  onClick={handleClearSearch}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600 ml-1"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Dropdown de Resultados via Portal */}
            {showResults && searchTerm.trim().length >= 2 && createPortal(
              <div 
                ref={dropdownRef}
                style={{ 
                  position: 'fixed', 
                  top: `${dropdownPos.top + 8}px`, 
                  left: `${dropdownPos.left + dropdownPos.width - 350}px`, 
                  width: '350px' 
                }}
                className="bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden z-[99999] animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="p-2 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resultados</span>
                  {isSearching && <div className="size-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>}
                </div>
                
                <div className="max-h-[400px] overflow-y-auto p-1">
                  {searchResults.length > 0 ? (
                    searchResults.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => handleResultClick(event.id, event.date_start || event.date)}
                        className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-all group border-b border-slate-50 last:border-none"
                      >
                        <div className="flex items-start gap-3">
                          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-sm">event</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate group-hover:text-primary transition-colors">
                              {event.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                {new Date(event.date_start || event.date).toLocaleDateString('pt-BR')}
                              </span>
                              <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1 truncate">
                                <span className="material-symbols-outlined text-[12px]">person</span>
                                {event.expand?.user?.name || 'Sistema'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : !isSearching ? (
                    <div className="p-8 text-center">
                      <span className="material-symbols-outlined text-slate-200 text-3xl">search_off</span>
                      <p className="text-xs text-slate-400 mt-2 font-medium">Nenhum evento encontrado</p>
                    </div>
                  ) : null}
                </div>

                {searchTerm.trim().length >= 2 && (
                  <div className="p-2 bg-slate-50 border-t border-slate-100">
                    <button 
                      onClick={() => setShowResults(false)}
                      className="w-full py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
                    >
                      Pressione Esc para fechar
                    </button>
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;