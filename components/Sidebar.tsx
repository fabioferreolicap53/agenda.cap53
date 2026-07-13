import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, UserRole } from './AuthContext';
import { pb, getAvatarUrl } from '../lib/pocketbase';
import { useNotifications } from '../hooks/useNotifications';
import { useViewMode } from './ViewModeContext';

const Sidebar: React.FC = () => {
  const { user, setRole, logout, updateStatus, isSidebarOpen, setSidebarOpen } = useAuth();
  const { viewMode } = useViewMode();
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const { unreadCount: notificationCount } = useNotifications();
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  // Evita flash de transição no primeiro render (sidebar inicia oculto em mobile/tablet)
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (isSidebarOpen) setHasOpened(true);
  }, [isSidebarOpen]);

  // Garante sidebar fechado ao montar em mobile/tablet
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadMessages = async () => {
      try {
        const records = await pb.collection('agenda_cap53_mensagens').getList(1, 1, {
          filter: `receiver = "${user.id}" && read = false`,
          $autoCancel: false,
        });
        setUnreadMessagesCount(records.totalItems);
      } catch (error) {
        console.error('Error fetching unread messages count:', error);
      }
    };

    fetchUnreadMessages();

    let unsubscribe: (() => void) | undefined;
    const setupSubscription = async () => {
      unsubscribe = await pb.collection('agenda_cap53_mensagens').subscribe('*', (e) => {
        if (e.record.receiver === user.id) {
          fetchUnreadMessages();
        }
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 group relative ${
      isActive
        ? 'bg-slate-800 text-white shadow-md shadow-slate-900/15 border border-slate-700/50'
        : 'hover:bg-slate-50/80 text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-100'
    }`;

  const iconClass = (isActive: boolean) =>
    `material-symbols-outlined text-[20px] transition-all duration-200 ${
      isActive
        ? 'text-white'
        : 'text-slate-400 group-hover:text-slate-600'
    }`;

  const badgeCount = (count: number, color: string) => (
    <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 ${color} border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-black animate-in fade-in zoom-in duration-200`}>
      {count > 9 ? '9+' : count}
    </span>
  );

  const canSee = (role: UserRole | 'ALL') => {
    if (!user) return false;
    if (role === 'ALL') return true;
    if (user.role === 'ADMIN') return true;
    return user.role === role;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[998] lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 w-[245px] flex-col z-[999] transform ${hasOpened ? 'transition-all duration-300' : 'transition-none'} ease-in-out lg:relative lg:translate-x-0 lg:flex lg:w-[211px] h-full border-r ${
        viewMode === 'personal'
          ? 'bg-gradient-to-b from-white to-[#e9edf2] border-[rgba(28,46,74,0.15)]'
          : 'bg-gradient-to-b from-white to-[#fafbfc] border-slate-200/60'
      } ${isSidebarOpen ? 'translate-x-0 shadow-2xl shadow-slate-900/10 lg:opacity-100 lg:pointer-events-auto' : '-translate-x-full opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto'}`}>
        <div className="flex flex-col h-full justify-between p-3.5">
          <div className="flex flex-col gap-4">
            {/* Logo */}
            <div className="flex items-center justify-between px-2.5 py-2">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="bg-gradient-to-br from-primary to-[#1a2a5e] rounded-xl size-9 flex items-center justify-center shadow-[0_2px_10px_rgba(28,46,74,0.3)]">
                    <span className="material-symbols-outlined text-[18px] text-white">event_note</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-[13px] font-black text-slate-800 leading-none tracking-tight">Agenda Cap5.3</h1>
                  <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-0.5">
                    {user?.role === 'ADMIN' ? 'Espaço do Admin' : `Portal ${
                      user?.role === 'ALMC' ? 'Almoxarifado' :
                      user?.role === 'TRA' ? 'Transporte' :
                      user?.role === 'CE' ? 'Cerimonial' :
                      user?.role === 'DCA' ? 'Informática' :
                      user?.role === 'USER' ? 'Usuário' :
                      user?.role || 'Usuário'
                    }`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden size-7 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mx-3" />

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5 overflow-y-auto max-h-[calc(100vh-260px)] custom-scrollbar px-0.5">
              <NavLink to="/calendar" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>calendar_month</span>
                    <p className="text-[12px] font-bold truncate">Calendário</p>
                  </>
                )}
              </NavLink>

              {!['DCA', 'ALMC', 'TRA'].includes(user?.role || '') && (
                <NavLink to="/create-event" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>add_circle</span>
                      <p className="text-[12px] font-bold truncate">Novo Evento</p>
                    </>
                  )}
                </NavLink>
              )}

              <NavLink to="/chat" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <span className={iconClass(isActive)}>chat</span>
                      {unreadMessagesCount > 0 && badgeCount(unreadMessagesCount, 'bg-primary')}
                    </div>
                    <p className="text-[12px] font-bold truncate">Mensagens</p>
                  </>
                )}
              </NavLink>

              <NavLink to="/notifications" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <span className={iconClass(isActive)}>notifications</span>
                      {notificationCount > 0 && badgeCount(notificationCount, 'bg-red-500')}
                    </div>
                    <p className="text-[12px] font-bold truncate">Notificações</p>
                  </>
                )}
              </NavLink>

              {user?.role === 'ADMIN' && (
                <NavLink to="/reports" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>bar_chart</span>
                      <p className="text-[12px] font-bold truncate">Relatórios</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'ALMC') && (
                <NavLink to="/almoxarifado" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>inventory_2</span>
                      <p className="text-[12px] font-bold truncate">Almoxarifado e Copa</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'DCA') && (
                <NavLink to="/informatica" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>computer</span>
                      <p className="text-[12px] font-bold truncate">Informática</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'TRA') && (
                <NavLink to="/transporte" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>directions_car</span>
                      <p className="text-[12px] font-bold truncate">Transporte</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'CE') && (
                <NavLink to="/locais" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>location_on</span>
                      <p className="text-[12px] font-bold truncate">Gestão de Locais</p>
                    </>
                  )}
                </NavLink>
              )}

              <NavLink to="/equipe" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>groups</span>
                    <p className="text-[12px] font-bold truncate">Equipe</p>
                  </>
                )}
              </NavLink>

              {(user?.role === 'ADMIN' || user?.role === 'USER' || user?.role === 'CE') && (
                <NavLink to="/meu-envolvimento" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>analytics</span>
                      <p className="text-[12px] font-bold truncate">Meu Espaço</p>
                    </>
                  )}
                </NavLink>
              )}
            </nav>
          </div>

          {/* Bottom section */}
          <div className="flex flex-col gap-3 mt-3">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mx-3" />

            <div className="flex flex-col gap-2 px-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="relative cursor-pointer group/avatar"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                >
                  <div className="size-9 rounded-full bg-cover bg-center ring-[2.5px] ring-white shadow-md group-hover/avatar:ring-primary/30 transition-all duration-200"
                    style={{ backgroundImage: `url(${getAvatarUrl(user)})` }}
                  />
                  <div className={`absolute -bottom-0.5 -right-0.5 size-3 border-2 border-white rounded-full shadow-sm ${
                    user?.context_status?.includes('Foco') ? 'bg-purple-500' :
                    user?.context_status?.includes('Reunião') ? 'bg-red-500' :
                    user?.context_status?.includes('Almoço') ? 'bg-amber-500' :
                    user?.status === 'Online' ? 'bg-green-500' :
                    user?.status === 'Ausente' ? 'bg-amber-500' :
                    user?.status === 'Ocupado' ? 'bg-red-500' : 'bg-slate-300'
                  }`} />

                  {showStatusMenu && (
                    <>
                      <div className="fixed inset-0 z-[40]" onClick={(e) => { e.stopPropagation(); setShowStatusMenu(false); }} />
                      <div className="absolute bottom-full left-0 mb-2 w-36 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 z-[50] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="p-1">
                          {(['Online', 'Ausente', 'Ocupado', 'Offline'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try { await updateStatus(s); } catch (err) { console.error(err); }
                                setShowStatusMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-[9px] font-bold text-left hover:bg-slate-50 flex items-center gap-2 transition-colors rounded-lg uppercase tracking-wider text-slate-500"
                            >
                              <span className={`size-2 rounded-full shadow-sm ${s === 'Online' ? 'bg-green-500 shadow-green-500/30' :
                                s === 'Ausente' ? 'bg-amber-500 shadow-amber-500/30' :
                                  s === 'Ocupado' ? 'bg-red-500 shadow-red-500/30' : 'bg-slate-300'}`} />
                              {s}
                            </button>
                          ))}
                          <div className="h-px bg-slate-100 my-1 mx-2" />
                          <button onClick={async (e) => { e.stopPropagation(); try { await updateStatus('Ocupado', '🧠 Foco'); } catch (err) { console.error(err); } setShowStatusMenu(false); }}
                            className="w-full px-3 py-1.5 text-[9px] font-bold text-left hover:bg-slate-50 flex items-center gap-2 transition-colors rounded-lg uppercase tracking-wider text-slate-500">
                            <span className="size-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/30" />
                            🧠 Foco
                          </button>
                          <button onClick={async (e) => { e.stopPropagation(); try { await updateStatus('Ocupado', '📅 Em Reunião'); } catch (err) { console.error(err); } setShowStatusMenu(false); }}
                            className="w-full px-3 py-1.5 text-[9px] font-bold text-left hover:bg-slate-50 flex items-center gap-2 transition-colors rounded-lg uppercase tracking-wider text-slate-500">
                            <span className="size-2 rounded-full bg-red-500 shadow-sm shadow-red-500/30" />
                            📅 Reunião
                          </button>
                          <button onClick={async (e) => { e.stopPropagation(); try { await updateStatus('Ausente', '🍽️ Almoço'); } catch (err) { console.error(err); } setShowStatusMenu(false); }}
                            className="w-full px-3 py-1.5 text-[9px] font-bold text-left hover:bg-slate-50 flex items-center gap-2 transition-colors rounded-lg uppercase tracking-wider text-slate-500">
                            <span className="size-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30" />
                            🍽️ Almoço
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-slate-700 truncate leading-tight">{user?.name || 'Membro do Time'}</p>
                  <p className="text-[9px] text-slate-400 truncate font-semibold tracking-wide">
                    {user?.sector || (
                      user?.role === 'ADMIN' ? 'Administrador' :
                      user?.role === 'ALMC' ? 'Almoxarifado' :
                      user?.role === 'TRA' ? 'Transporte' :
                      user?.role === 'CE' ? 'Cerimonial' :
                      user?.role === 'DCA' ? 'Informática' :
                      user?.role === 'USER' ? 'Usuário' :
                      user?.role || 'Colaborador'
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 hover:bg-red-50/50 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Encerrar Sessão
              </button>
            </div>

            <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-slate-300 text-center px-2 leading-relaxed">
              Desenvolvido por Fabio Ferreira de Oliveira<br />DAPS/CAP5.3
            </p>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="size-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">logout</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800">Encerrar Sessão?</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
                Você precisará fazer login novamente para acessar o sistema.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full mt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); logout(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
