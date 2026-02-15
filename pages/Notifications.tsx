import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { debugLog } from '../src/lib/debug';

type FilterType = 'all' | 'unread' | 'actions';

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, clearHistory, handleDecision, refresh } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredNotifications = useMemo(() => {
    debugLog('Notifications', 'Filtrando notificações', {
      total: notifications.length,
      filter: filter
    });
    
    switch (filter) {
      case 'unread':
        const unread = notifications.filter(n => !n.read);
        debugLog('Notifications', 'Filtro unread:', unread.length);
        return unread;
      case 'actions':
        const actions = notifications.filter(n => 
          (n.type === 'event_invite' || n.type === 'event_participation_request' || n.type === 'service_request' || n.type === 'almc_item_request' || n.type === 'transport_request') && 
          n.invite_status === 'pending'
        );
        debugLog('Notifications', 'Filtro actions:', actions.length);
        return actions;
      default:
        debugLog('Notifications', 'Filtro all:', notifications.length);
        return notifications;
    }
  }, [notifications, filter]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'event_invite': return 'calendar_add_on';
      case 'event_participation_request': return 'person_add';
      case 'cancellation': return 'event_busy';
      case 'service_request': return 'settings_suggest';
      case 'almc_item_request': return 'inventory_2';
      case 'transport_request': return 'local_shipping';
      case 'refusal': return 'block';
      case 'acknowledgment': return 'check_circle';
      case 'system': return 'info';
      default: return 'notifications';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'event_invite': return 'text-blue-500 bg-blue-50';
      case 'event_participation_request': return 'text-purple-500 bg-purple-50';
      case 'cancellation': return 'text-red-500 bg-red-50';
      case 'service_request': return 'text-amber-500 bg-amber-50';
      case 'almc_item_request': return 'text-indigo-500 bg-indigo-50';
      case 'refusal': return 'text-red-600 bg-red-50';
      case 'acknowledgment': return 'text-green-500 bg-green-50';
      case 'system': return 'text-slate-500 bg-slate-50';
      default: return 'text-primary bg-primary/5';
    }
  };

  const onHandleAction = async (notification: any, action: 'accepted' | 'rejected' | 'approved') => {
    setProcessingId(notification.id);
    try {
      await handleDecision(notification, action);
    } catch (error) {
      console.error('Error handling notification action:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const onClearHistory = async () => {
    if (confirm('Deseja limpar todo o histórico de notificações lidas?')) {
      await clearHistory();
    }
  };

  const handleViewEvent = (notification: any) => {
    if (!notification.event) return;
    
    // Tenta pegar a data do evento do expand (PocketBase)
    const eventData = notification.expand?.event;
    const eventDate = eventData?.date_start ? new Date(eventData.date_start) : new Date();
    const dateStr = eventDate.toISOString().split('T')[0];
    
    navigate(`/calendar?date=${dateStr}&view=agenda&openChat=${notification.event}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 animate-pulse max-w-4xl mx-auto">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl border border-slate-200"></div>
          ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-slate-50/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm self-start">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'unread' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Não lidas
          </button>
          <button
            onClick={() => setFilter('actions')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'actions' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Pendentes
          </button>
        </div>

        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              onClick={() => {
                const notifications = JSON.parse(localStorage.getItem('debug_notifications') || '[]');
                console.table(notifications);
                debugLog('Notifications', 'Debug ativado:', notifications);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
              title="Debug notificações"
            >
              <span className="material-symbols-outlined text-sm">bug_report</span>
            </button>
          )}
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-sm">done_all</span>
            Lidas
          </button>
          <button
            onClick={onClearHistory}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            Limpar Histórico
          </button>
          <button
            onClick={refresh}
            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
            title="Atualizar"
          >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Lista de Notificações */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="size-20 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-300 text-4xl">notifications_off</span>
            </div>
            <div>
              <h3 className="text-slate-900 font-bold">Nenhuma notificação</h3>
              <p className="text-slate-500 text-sm">Tudo limpo por aqui! Você não tem notificações {filter !== 'all' ? 'neste filtro' : ''}.</p>
              {import.meta.env.DEV && (
                <p className="text-slate-400 text-xs mt-2">
                  Debug: Total={notifications.length}, Filtrado={filteredNotifications.length}, Filtro={filter}
                </p>
              )}
            </div>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                notification.read 
                  ? 'bg-white/50 border-slate-100 opacity-80' 
                  : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-primary/20'
              }`}
            >
              {!notification.read && (
                <div className="absolute top-4 right-4 size-2 bg-primary rounded-full animate-pulse shadow-sm shadow-primary/40"></div>
              )}

              <div className={`flex-shrink-0 size-12 rounded-xl flex items-center justify-center ${getIconColor(notification.type)}`}>
                <span className="material-symbols-outlined text-[24px]">
                  {getIcon(notification.type)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className={`text-sm font-bold truncate ${notification.read ? 'text-slate-700' : 'text-slate-900'}`}>
                    {notification.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                    {formatDistanceToNow(new Date(notification.created), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                
                <p className={`text-sm leading-relaxed mb-3 ${notification.read ? 'text-slate-500' : 'text-slate-600'}`}>
                  {notification.message}
                </p>

                {/* Badge de Quantidade se disponível no data */}
                {(notification.data?.quantity !== undefined || (typeof notification.data === 'string' && JSON.parse(notification.data).quantity !== undefined)) && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md border border-indigo-100 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                      Quantidade: {
                        notification.data?.quantity !== undefined 
                          ? notification.data.quantity 
                          : JSON.parse(notification.data as unknown as string).quantity
                      }
                    </span>
                  </div>
                )}

                {/* Detalhes de Transporte se disponível no data */}
                {notification.type === 'transport_request' && notification.data && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {notification.data.origem && (
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-md border border-slate-100 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        De: {notification.data.origem}
                      </span>
                    )}
                    {notification.data.destino && (
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-md border border-slate-100 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">near_me</span>
                        Para: {notification.data.destino}
                      </span>
                    )}
                    {notification.data.horario_levar && (
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-md border border-slate-100 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        Ida: {notification.data.horario_levar}
                      </span>
                    )}
                    {notification.data.horario_buscar && (
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-md border border-slate-100 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">history</span>
                        Volta: {notification.data.horario_buscar}
                      </span>
                    )}
                  </div>
                )}

                {/* Ações Específicas */}
                {notification.invite_status === 'pending' && (
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      disabled={processingId === notification.id}
                      onClick={() => onHandleAction(notification, (notification.type === 'almc_item_request' || notification.type === 'transport_request') ? 'approved' : 'accepted')}
                      className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-primary/20"
                    >
                      {processingId === notification.id ? (
                        <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span className="material-symbols-outlined text-sm">check</span>
                      )}
                      {(notification.type === 'almc_item_request' || notification.type === 'transport_request') ? 'Aprovar' : 'Aceitar'}
                    </button>
                    <button
                      disabled={processingId === notification.id}
                      onClick={() => onHandleAction(notification, 'rejected')}
                      className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </div>
                )}

                {/* Status Badge para decisões já tomadas */}
                {notification.invite_status && notification.invite_status !== 'pending' && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold mt-4 ${
                    notification.invite_status === 'accepted' 
                      ? 'bg-green-50 text-green-600 border border-green-100' 
                      : 'bg-red-50 text-red-600 border border-red-100'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {notification.invite_status === 'accepted' ? 'verified' : 'block'}
                    </span>
                    {notification.invite_status === 'accepted' 
                      ? (notification.type === 'almc_item_request' || notification.type === 'transport_request' ? 'Aprovado' : 'Aceito')
                      : 'Recusado'
                    }
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Marcar como lida
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Excluir
                  </button>
                  {notification.event && (
                    <button
                      onClick={() => handleViewEvent(notification)}
                      className="text-[11px] font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      Ver Evento
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
