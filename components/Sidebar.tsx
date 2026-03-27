import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, UserRole } from './AuthContext';
import { pb, getAvatarUrl } from '../lib/pocketbase';
import { useNotifications } from '../hooks/useNotifications';

const Sidebar: React.FC = () => {
  const { user, setRole, logout, updateStatus, isSidebarOpen, setSidebarOpen } = useAuth();
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const { unreadCount: notificationCount } = useNotifications();
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Fetch and subscribe to unread messages count
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
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive
      ? 'bg-primary/10 text-primary'
      : 'hover:bg-primary/[0.02] text-text-secondary hover:text-primary'
    }`;

  const iconClass = (isActive: boolean) =>
    `material-symbols-outlined text-2xl ${isActive ? 'text-primary' : 'text-text-secondary group-hover:text-primary'
    }`;

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

      <aside className={`fixed inset-y-0 left-0 w-72 flex-col border-r border-border-light bg-white z-[999] transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex lg:w-64 h-full ${
        isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full justify-between p-4">
          <div className="flex flex-col gap-6">
            <div className="flex gap-3 px-2 py-2 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary rounded-lg size-10 flex items-center justify-center text-white shadow-lg shadow-primary/30">
                  <span className="material-symbols-outlined text-2xl">event_note</span>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-text-main text-lg font-bold leading-normal">Agenda Cap5.3</h1>
                  <p className="text-text-secondary text-[10px] font-bold uppercase tracking-wider">
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
              
              {/* Close Button Mobile */}
              <button 
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden size-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar pr-1">
              <NavLink to="/calendar" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>calendar_month</span>
                    <p className="text-sm font-bold">Calendário</p>
                  </>
                )}
              </NavLink>

              {!['DCA', 'ALMC', 'TRA'].includes(user?.role || '') && (
              <NavLink to="/create-event" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>add_circle</span>
                    <p className="text-sm font-bold">Novo Evento</p>
                  </>
                )}
              </NavLink>
              )}

              <NavLink to="/chat" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <span className={iconClass(isActive)}>chat</span>
                      {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 size-4 bg-primary border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white font-bold animate-in fade-in zoom-in duration-300">
                          {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold">Mensagens</p>
                  </>
                )}
              </NavLink>

              <NavLink to="/notifications" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <span className={iconClass(isActive)}>notifications</span>
                      {notificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 size-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                          {notificationCount > 9 ? '9+' : notificationCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold">Notificações</p>
                  </>
                )}
              </NavLink>

              {user?.role === 'ADMIN' && (
                <NavLink to="/reports" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>bar_chart</span>
                      <p className="text-sm font-bold">Relatórios</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'ALMC') && (
                <NavLink to="/almoxarifado" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>inventory_2</span>
                      <p className="text-sm font-bold">Almoxarifado e Copa</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'DCA') && (
                <NavLink to="/informatica" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>computer</span>
                      <p className="text-sm font-bold">Informática</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'TRA') && (
                <NavLink to="/transporte" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>directions_car</span>
                      <p className="text-sm font-bold">Transporte</p>
                    </>
                  )}
                </NavLink>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'CE') && (
                <NavLink to="/locais" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>location_on</span>
                      <p className="text-sm font-bold">Gestão de Locais</p>
                    </>
                  )}
                </NavLink>
              )}

              <NavLink to="/equipe" className={linkClass} onClick={() => setSidebarOpen(false)}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>groups</span>
                    <p className="text-sm font-bold">Equipe</p>
                  </>
                )}
              </NavLink>

              {(user?.role === 'ADMIN' || user?.role === 'USER' || user?.role === 'CE') && (
                <NavLink to="/meu-envolvimento" className={linkClass} onClick={() => setSidebarOpen(false)}>
                  {({ isActive }) => (
                    <>
                      <span className={iconClass(isActive)}>analytics</span>
                      <p className="text-sm font-bold">Meu Espaço</p>
                    </>
                  )}
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex flex-col gap-4 border-t border-border-light pt-4">
            <div className="flex flex-col gap-2 px-3">
              <div className="flex items-center gap-3">
                <div
                  className="relative cursor-pointer"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                >
                  <div
                    className="size-10 rounded-full bg-cover bg-center ring-2 ring-primary/5 hover:ring-primary/40 transition-all"
                    style={{ backgroundImage: `url(${getAvatarUrl(user)})` }}
                  ></div>
                  <div className={`absolute -bottom-0.5 -right-0.5 size-3.5 border-2 border-white rounded-full ${
                    user?.context_status?.includes('Foco') ? 'bg-purple-500' :
                    user?.context_status?.includes('Reunião') ? 'bg-red-500' :
                    user?.context_status?.includes('Almoço') ? 'bg-amber-500' :
                    user?.status === 'Online' ? 'bg-green-500' :
                    user?.status === 'Ausente' ? 'bg-amber-500' :
                    user?.status === 'Ocupado' ? 'bg-red-500' : 'bg-slate-300'
                  }`}></div>

                  {/* Status Selector Dropdown */}
                  {showStatusMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-[40]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStatusMenu(false);
                        }}
                      />
                      <div
                        className="absolute bottom-full left-0 mb-2 w-32 bg-white rounded-lg shadow-xl border border-border-light z-[50] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          {(['Online', 'Ausente', 'Ocupado', 'Offline'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await updateStatus(s);
                                } catch (err) {
                                  console.error('Error updating status:', err);
                                  alert('Erro ao atualizar status. Tente novamente.');
                                }
                                setShowStatusMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-[10px] font-bold text-left hover:bg-primary/[0.02] flex items-center gap-2 transition-colors uppercase"
                            >
                              <span className={`size-2 rounded-full ${s === 'Online' ? 'bg-green-500' :
                                s === 'Ausente' ? 'bg-amber-500' :
                                  s === 'Ocupado' ? 'bg-red-500' : 'bg-slate-300'
                                }`}></span>
                              {s}
                            </button>
                          ))}
                          <div className="h-px bg-slate-100 my-1"></div>
                          <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await updateStatus('Ocupado', '🧠 Foco');
                                } catch (err) { console.error(err); }
                                setShowStatusMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-[10px] font-bold text-left hover:bg-primary/[0.02] flex items-center gap-2 transition-colors uppercase"
                            >
                              <span className="size-2 rounded-full bg-purple-500"></span>
                              🧠 Foco
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await updateStatus('Ocupado', '📅 Em Reunião');
                                } catch (err) { console.error(err); }
                                setShowStatusMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-[10px] font-bold text-left hover:bg-primary/[0.02] flex items-center gap-2 transition-colors uppercase"
                            >
                              <span className="size-2 rounded-full bg-red-500"></span>
                              📅 Reunião
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await updateStatus('Ausente', '🍽️ Almoço');
                                } catch (err) { console.error(err); }
                                setShowStatusMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-[10px] font-bold text-left hover:bg-primary/[0.02] flex items-center gap-2 transition-colors uppercase"
                            >
                              <span className="size-2 rounded-full bg-amber-500"></span>
                              🍽️ Almoço
                            </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-main truncate">{user?.name || 'Membro do Time'}</p>
                  <p className="text-[10px] text-text-secondary truncate font-medium">
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
                  {user?.observations && (
                    <p className="text-[10px] text-text-secondary/70 mt-1 italic leading-tight line-clamp-2">
                        {user.observations}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="text-[10px] font-bold uppercase tracking-wider text-text-secondary text-left hover:text-red-500 flex items-center gap-2 transition-colors py-1"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Encerrar Sessão
              </button>
            </div>

            <p className="text-[8px] font-bold uppercase tracking-widest text-text-secondary/30 text-center px-2 leading-relaxed">
              Desenvolvido por Fabio Ferreira de Oliveira<br />DAPS/CAP5.3
            </p>
          </div>
        </div>
      </aside>
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200 border border-white/20">
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
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
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