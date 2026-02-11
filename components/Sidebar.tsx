import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, UserRole } from './AuthContext';
import { pb } from '../lib/pocketbase';

const Sidebar: React.FC = () => {
  const { user, setRole, logout, updateStatus } = useAuth();
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [mySpaceCount, setMySpaceCount] = React.useState(0);

  React.useEffect(() => {
    const fetchCounts = async () => {
      if (!user) return;
      try {
        // Notifications (excluding My Space notifications)
        const notifRes = await pb.collection('agenda_cap53_notifications').getList(1, 1, {
          filter: `user = "${user.id}" && read = false && type != "event_invite" && type != "event_participation_request"${(user.role === 'ALMC' || user.role === 'ADMIN') ? ' && data.kind != "almc_item_request"' : ''}${(user.role === 'TRA' || user.role === 'ADMIN') ? ' && data.kind != "transport_request"' : ''}`
        });
        let total = notifRes.totalItems;

        // ALMC Requests
        if (user.role === 'ALMC' || user.role === 'ADMIN') {
          const reqRes = await pb.collection('agenda_cap53_almac_requests').getList(1, 1, {
            filter: 'status = "pending"'
          });
          total += reqRes.totalItems;
        }

        // TRA Requests
        if (user.role === 'TRA' || user.role === 'ADMIN') {
          const traRes = await pb.collection('agenda_cap53_eventos').getList(1, 1, {
            filter: 'transporte_suporte = true && transporte_status = "pending"'
          });
          total += traRes.totalItems;
        }

        setNotificationCount(total);

        // My Space Notifications (Invites and Participation Requests)
        const mySpaceRes = await pb.collection('agenda_cap53_notifications').getList(1, 1, {
          filter: `user = "${user.id}" && read = false && (type = "event_invite" || type = "event_participation_request")`
        });
        setMySpaceCount(mySpaceRes.totalItems);
      } catch (e) {
        console.error("Error fetching counts", e);
      }
    };

    fetchCounts();
    
    // Subscribe to updates
    let unsubscribeNotifs: (() => void) | undefined;
    let unsubscribeRequests: (() => void) | undefined;

    const setupSubscriptions = async () => {
        unsubscribeNotifs = await pb.collection('agenda_cap53_notifications').subscribe('*', () => fetchCounts());
        if (user?.role === 'ALMC' || user?.role === 'ADMIN') {
            unsubscribeRequests = await pb.collection('agenda_cap53_almac_requests').subscribe('*', () => fetchCounts());
        }
        if (user?.role === 'TRA' || user?.role === 'ADMIN') {
            // Subscribe to events with transport support
            await pb.collection('agenda_cap53_eventos').subscribe('*', (e) => {
                if (e.record.transporte_suporte === true) {
                    fetchCounts();
                }
            });
        }
    };

    setupSubscriptions();
    
    return () => {
        if (unsubscribeNotifs) unsubscribeNotifs();
        if (unsubscribeRequests) unsubscribeRequests();
    };
  }, [user]);

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
    <aside className="hidden w-64 flex-col border-r border-border-light bg-white lg:flex h-full">
      <div className="flex flex-col h-full justify-between p-4">
        <div className="flex flex-col gap-6">
          <div className="flex gap-3 px-2 py-2 items-center">
            <div className="bg-primary rounded-lg size-10 flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <span className="material-symbols-outlined text-2xl">event_note</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-text-main text-lg font-bold leading-normal">Agenda Cap5.3</h1>
              <p className="text-text-secondary text-xs font-normal">
                {user?.role === 'ADMIN' ? 'Espaço do Admin' : `Portal ${
                  user?.role === 'ALMC' ? 'Almoxarifado' :
                  user?.role === 'TRA' ? 'Transporte' :
                  user?.role === 'CE' ? 'Cerimonial' :
                  user?.role === 'DCA' ? 'Informática' :
                  user?.role || 'Usuário'
                }`}
              </p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            <NavLink to="/calendar" className={linkClass}>
              {({ isActive }) => (
                <>
                  <span className={iconClass(isActive)}>calendar_month</span>
                  <p className="text-sm font-bold">Calendário</p>
                </>
              )}
            </NavLink>

            {(user?.role === 'ADMIN' || user?.role === 'USER' || user?.role === 'CE' || !user?.role) && (
              <NavLink to="/create-event" className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>add_circle</span>
                    <p className="text-sm font-bold">Novo Evento</p>
                  </>
                )}
              </NavLink>
            )}

            <NavLink to="/chat" className={linkClass}>
              {({ isActive }) => (
                <>
                  <span className={iconClass(isActive)}>chat</span>
                  <p className="text-sm font-bold">Mensagens</p>
                </>
              )}
            </NavLink>

            <NavLink to="/requests" className={linkClass}>
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
              <NavLink to="/reports" className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>bar_chart</span>
                    <p className="text-sm font-bold">Relatórios</p>
                  </>
                )}
              </NavLink>
            )}

            {(user?.role === 'ADMIN' || user?.role === 'ALMC') && (
              <NavLink to="/almoxarifado" className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>inventory_2</span>
                    <p className="text-sm font-bold">Almoxarifado e Copa</p>
                  </>
                )}
              </NavLink>
            )}

            {(user?.role === 'ADMIN' || user?.role === 'DCA') && (
              <NavLink to="/informatica" className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>computer</span>
                    <p className="text-sm font-bold">Informática</p>
                  </>
                )}
              </NavLink>
            )}

            {(user?.role === 'ADMIN' || user?.role === 'TRA') && (
              <NavLink to="/transporte" className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>directions_car</span>
                    <p className="text-sm font-bold">Transporte</p>
                  </>
                )}
              </NavLink>
            )}

            {(user?.role === 'ADMIN' || user?.role === 'CE') && (
              <NavLink to="/locais" className={linkClass}>
                {({ isActive }) => (
                  <>
                    <span className={iconClass(isActive)}>location_on</span>
                    <p className="text-sm font-bold">Gestão de Locais e Eventos</p>
                  </>
                )}
              </NavLink>
            )}

            <NavLink to="/equipe" className={linkClass}>
              {({ isActive }) => (
                <>
                  <span className={iconClass(isActive)}>groups</span>
                  <p className="text-sm font-bold">Equipe</p>
                </>
              )}
            </NavLink>

            {(user?.role === 'ADMIN' || user?.role === 'USER' || user?.role === 'CE') && (
              <NavLink to="/meu-envolvimento" className={linkClass}>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <span className={iconClass(isActive)}>analytics</span>
                      {mySpaceCount > 0 && (
                        <span className="absolute -top-1 -right-1 size-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                          {mySpaceCount > 9 ? '9+' : mySpaceCount}
                        </span>
                      )}
                    </div>
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
                  style={{ backgroundImage: `url(${user?.avatar ? pb.files.getUrl(user, user.avatar) : 'https://picsum.photos/100/100'})` }}
                ></div>
                <div className={`absolute -bottom-0.5 -right-0.5 size-3.5 border-2 border-white rounded-full ${user?.status === 'Online' ? 'bg-green-500' :
                  user?.status === 'Ausente' ? 'bg-amber-500' :
                    user?.status === 'Ocupado' ? 'bg-red-500' : 'bg-primary/20'
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
                                s === 'Ocupado' ? 'bg-red-500' : 'bg-primary/20'
                              }`}></span>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col overflow-hidden">
                <p className="text-sm font-bold text-text-main truncate">{user?.name || 'Membro do Time'}</p>
                <p className="text-[10px] text-text-secondary truncate font-medium">
                    {user?.sector || (
                      user?.role === 'ADMIN' ? 'Administrador' :
                      user?.role === 'ALMC' ? 'Almoxarifado' :
                      user?.role === 'TRA' ? 'Transporte' :
                      user?.role === 'CE' ? 'Cerimonial' :
                      user?.role === 'DCA' ? 'Informática' :
                      user?.role || 'Colaborador'
                    )}
                </p>
                {user?.observations && (
                  <p className="text-[9px] text-text-secondary/70 mt-0.5 italic leading-tight truncate">
                    {user.observations}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={logout}
              className="text-xs text-text-secondary text-left hover:text-red-500 flex items-center gap-1 transition-colors pl-1"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sair
            </button>
          </div>

          {/* Role Switcher for Demo */}
          <div className="px-3 pb-2">
            <p className="text-[9px] font-bold text-text-secondary/50 uppercase mb-1.5 tracking-wider">Mudar Nível (Dev)</p>
            <div className="grid grid-cols-3 gap-1">
              {(['USER', 'ADMIN', 'ALMC', 'TRA', 'CE', 'DCA'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={async () => {
                    try {
                      await setRole(r);
                    } catch (err: any) {
                      console.error('Error changing role:', err);
                      alert(`Erro ao mudar nível: ${err.message || 'Erro desconhecido'}`);
                    }
                  }}
                  className={`text-[8px] py-1 rounded border transition-all ${user?.role === r ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white border-border-light text-text-secondary hover:bg-primary/[0.02]'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[9px] text-text-secondary/40 text-center px-2">
            Desenvolvido por Fabio Ferreira de Oliveira<br />DAPS/CAP5.3
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;