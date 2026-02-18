import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { pb } from '../lib/pocketbase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReRequestModal from '../components/ReRequestModal';
import RefusalModal from '../components/RefusalModal';

type FilterType = 'all' | 'unread' | 'actions';

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearHistory,
    clearAllNotifications,
    handleDecision,
    refresh
  } = useNotifications();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reRequestNotification, setReRequestNotification] = useState<any | null>(null);
  const [rejectingNotification, setRejectingNotification] = useState<any | null>(null);

  const getData = (n: any) => {
    let result = {};
    // Prioridade 1: Campo 'data' já parseado ou objeto
    if (n.data && Object.keys(n.data).length > 0) {
        result = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
    }
    // Prioridade 2: Campo 'meta' (JSON stringificado)
    else if (n.meta) {
        try {
            result = typeof n.meta === 'string' ? JSON.parse(n.meta) : n.meta;
        } catch (e) {
            console.error('Erro ao parsear meta:', e);
            result = {};
        }
    }
    
    // Proteção contra null/undefined após parse
    return result || {};
  };

  const getNotificationStatus = (n: any) => {
    const data = getData(n);
    const title = n.title?.toLowerCase() || '';
    const type = n.type;

    // Explicit Rejection
    if (
      type === 'refusal' || 
      data.action === 'rejected' || 
      n.invite_status === 'rejected' || 
      title.includes('recusada') || 
      title.includes('rejeitada') ||
      title.includes('recusado')
    ) {
      return 'rejected';
    }

    // Explicit Approval
    if (
      data.action === 'approved' || 
      data.action === 'accepted' || 
      data.action === 'confirmed' ||
      n.invite_status === 'accepted' || 
      n.invite_status === 'approved' ||
      n.invite_status === 'confirmed' ||
      title.includes('aprovada') || 
      title.includes('aprovado') ||
      title.includes('aceita') || 
      title.includes('aceito') ||
      title.includes('confirmada') ||
      title.includes('confirmado')
    ) {
      return 'approved';
    }

    return 'neutral';
  };

  const filteredNotifications = useMemo(() => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'actions':
        return notifications.filter(n => {
          const data = getData(n);
          return n.invite_status === 'pending' || 
          (n.type === 'refusal' && (data.kind === 'almc_item_decision' || data.kind === 'transport_decision')) ||
          (n.type === 'transport_decision' && (n.invite_status === 'rejected' || data.action === 'rejected'));
        });
      default:
        return notifications;
    }
  }, [notifications, filter]);

  const latestGroupedIds = useMemo(() => {
    const groups: Record<string, any[]> = {};

    notifications.forEach(n => {
        const data = getData(n);
        const title = n.title?.toLowerCase() || '';
        
        // 1. Refusals (User side)
        const isRefusal = (
            (n.type === 'refusal' && (data.kind === 'almc_item_decision' || data.kind === 'transport_decision')) ||
            (n.type === 'request_decision' && title.includes('rejeitada')) ||
            (n.type === 'transport_decision' && (title.includes('rejeitad') || title.includes('recusad')))
        );

        // 2. Requests (Sector side - ALMC/TRA/DCA)
        const isRequest = (
            n.type === 'almc_item_request' || 
            n.type === 'transport_request'
        );

        // 3. Approvals (User side) - Add to group so they become the latest
        const isApproval = (
             (data.action === 'approved' || data.action === 'accepted' || n.invite_status === 'accepted') &&
             (n.type === 'request_decision' || n.type === 'transport_decision' || title.includes('aprovada') || title.includes('aceita'))
        );

        if (isRefusal || isRequest || isApproval) {
            // Group by related request or event
            // Item requests use related_request, Transport requests use event
            const key = n.related_request || n.event;
            
            // Only group if we have a key
            if (key) {
                if (!groups[key]) groups[key] = [];
                groups[key].push(n);
            }
        }
    });

    const latestIds = new Set<string>();
    Object.values(groups).forEach(group => {
        // Sort descending by created date
        group.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        if (group.length > 0) {
            latestIds.add(group[0].id);
        }
    });

    return latestIds;
  }, [notifications]);

  const getStatusContainerStyles = (n: any) => {
    const status = getNotificationStatus(n);
    const data = getData(n);
    const title = n.title?.toLowerCase() || '';
    
    // Check if it's an old notification (part of a group but not the latest)
    const isRefusal = (
        (n.type === 'refusal' && (data.kind === 'almc_item_decision' || data.kind === 'transport_decision')) ||
        (n.type === 'request_decision' && title.includes('rejeitada')) ||
        (n.type === 'transport_decision' && (title.includes('rejeitad') || title.includes('recusad')))
    );
    
    const isRequest = (
        n.type === 'almc_item_request' || 
        n.type === 'transport_request'
    );

    const isApproval = (
         (data.action === 'approved' || data.action === 'accepted' || n.invite_status === 'accepted') &&
         (n.type === 'request_decision' || n.type === 'transport_decision' || title.includes('aprovada') || title.includes('aceita'))
    );

    const isOldNotification = (isRefusal || isRequest || isApproval) && !latestGroupedIds.has(n.id);

    // Old Notifications: Minimalist "Ghost" State
    if (isOldNotification) {
        return 'bg-slate-50/40 border border-slate-100 opacity-40 hover:opacity-100 hover:bg-white hover:shadow-sm transition-all duration-500 grayscale hover:grayscale-0';
    }
    
    // Base styles for modern cards
    const baseStyles = 'bg-white transition-all duration-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]';
    
    if (status === 'approved') {
        // Premium Success: Clean white with Emerald accent
        return `${baseStyles} border-y border-r border-slate-100 border-l-[3px] border-l-emerald-500`;
    } 
    
    if (status === 'rejected') {
        // Premium Error: Clean white with Rose accent
        return `${baseStyles} border-y border-r border-slate-100 border-l-[3px] border-l-rose-500`;
    }

    // Default/Neutral
    return `${baseStyles} border border-slate-100 hover:border-slate-300`;
  };

  const getIcon = (n: any) => {
    const status = getNotificationStatus(n);
    if (status === 'rejected') return 'cancel';
    
    switch (n.type) {
      case 'event_invite': return 'calendar_add_on';
      case 'event_participation_request': return 'person_add';
      case 'cancellation': return 'event_busy';
      case 'service_request': return 'settings_suggest';
      case 'almc_item_request': return 'inventory_2';
      case 'transport_request': return 'local_shipping';
      case 'request_decision': return 'fact_check';
      case 'transport_decision': return 'commute';
      case 'refusal': return 'cancel';
      case 'acknowledgment': return 'check_circle';
      case 'system': return 'info';
      default: return 'notifications';
    }
  };

  const getIconStyles = (n: any) => {
    const status = getNotificationStatus(n);
    if (status === 'rejected') return 'text-rose-600 bg-rose-50';

    switch (n.type) {
      case 'event_invite': return 'text-blue-600 bg-blue-50';
      case 'event_participation_request': return 'text-violet-600 bg-violet-50';
      case 'cancellation': return 'text-rose-600 bg-rose-50';
      case 'service_request': return 'text-amber-600 bg-amber-50';
      case 'almc_item_request': return 'text-indigo-600 bg-indigo-50';
      case 'transport_request': return 'text-cyan-600 bg-cyan-50';
      case 'request_decision': return 'text-teal-600 bg-teal-50';
      case 'transport_decision': return 'text-teal-600 bg-teal-50';
      case 'refusal': return 'text-rose-600 bg-rose-50';
      case 'acknowledgment': return 'text-emerald-600 bg-emerald-50';
      case 'system': return 'text-slate-600 bg-slate-100';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const onHandleAction = async (notification: any, action: 'accepted' | 'rejected' | 'approved') => {
    // If rejecting a request (item or transport), show modal
    if (action === 'rejected' && (notification.type === 'almc_item_request' || notification.type === 'transport_request')) {
        setRejectingNotification(notification);
        return;
    }

    setProcessingId(notification.id);
    try {
      await handleDecision(notification, action);
    } catch (error) {
      console.error('Error handling notification action:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const onConfirmRejection = async (justification: string) => {
    if (!rejectingNotification) return;

    setProcessingId(rejectingNotification.id);
    try {
        await handleDecision(rejectingNotification, 'rejected', justification);
        setRejectingNotification(null);
    } catch (error) {
        console.error('Error rejecting notification:', error);
        alert('Erro ao processar recusa. Tente novamente.');
    } finally {
        setProcessingId(null);
    }
  };

  const onClearHistory = async () => {
    if (confirm('Deseja limpar as notificações lidas?')) {
      await clearHistory();
    }
  };

  const onClearAll = async () => {
    if (confirm('ATENÇÃO: Isso apagará TODAS as notificações do sistema. Deseja continuar?')) {
      await clearAllNotifications();
    }
  };

  const handleViewEvent = (notification: any) => {
    if (!notification.event) return;
    const eventData = notification.expand?.event;
    const eventDate = eventData?.date_start ? new Date(eventData.date_start) : new Date();
    const dateStr = eventDate.toISOString().split('T')[0];
    navigate(`/calendar?date=${dateStr}&view=agenda&eventId=${notification.event}`);
  };

  const getNotificationMessage = (n: any) => {
    const data = getData(n);
    let msg = n.message || '';

    // Remove a quantidade da mensagem original para evitar duplicação com a tag
    msg = msg.replace(/\s*\(Qtd:\s*\d+\)/i, '');

    // 1. Tenta pegar do payload (novo padrão)
    if (data?.item_name) {
       const action = (data.action === 'approved' || data.status === 'approved') ? 'aprovada' : 'rejeitada';
       return `Sua solicitação de ${data.item_name} foi ${action}.`;
    }

    // 2. Tenta pegar do expand (fix retroativo)
    const itemName = n.expand?.related_request?.expand?.item?.name;
    
    if (itemName) {
        let action = 'processada';
        if (msg.toLowerCase().includes('rejeitada')) action = 'rejeitada';
        if (msg.toLowerCase().includes('aprovada') || msg.toLowerCase().includes('confirmada')) action = 'aprovada';
        
        return `Sua solicitação de ${itemName} foi ${action}.`;
    }

    // 3. Fallback: retorna mensagem original limpa
    return msg.split(' Motivo: ')[0];
  };

  const onFixNotifications = async () => {
    if (!confirm('Isso irá processar as notificações no seu navegador para corrigir os nomes. Pode levar alguns instantes. Continuar?')) return;
    
    // Mostra loading visualmente (opcional, ou usa o state global)
    // setLoading(true); // Se quiser bloquear a UI
    
    let count = 0;
    let errors = 0;

    try {
        // 1. Busca as últimas 200 notificações que podem precisar de correção
        const result = await pb.collection('agenda_cap53_notifications').getList(1, 200, {
            sort: '-created',
            filter: 'type = "request_decision" || type = "almc_item_request"',
            expand: 'related_request,related_request.item'
        });

        for (const n of result.items) {
             const data = getData(n);
             
             // Se já tem item_name, pula
             if (data.item_name) continue;

             // Tenta encontrar o nome do item via expand
             let itemName = n.expand?.related_request?.expand?.item?.name;
             let quantity = n.expand?.related_request?.quantity;

             // Se não achou no expand, tenta buscar a request individualmente (fallback)
             if (!itemName && n.related_request) {
                 try {
                     const req = await pb.collection('agenda_cap53_almac_requests').getOne(n.related_request, { expand: 'item' });
                     itemName = req.expand?.item?.name;
                     quantity = req.quantity;
                 } catch (e) {
                     console.log('Skipping ' + n.id + ' - request access failed');
                 }
             }

             if (itemName) {
                 // Atualiza o registro
                 const newData = { ...data, item_name: itemName, quantity: quantity !== undefined ? quantity : data.quantity };
                 
                 try {
                     await pb.collection('agenda_cap53_notifications').update(n.id, {
                         data: newData,
                         meta: JSON.stringify(newData) // mantém compatibilidade
                     });
                     count++;
                 } catch (e) {
                     console.error('Failed to update notification ' + n.id, e);
                     errors++;
                 }
             }
        }

        alert(`Concluído! ${count} notificações foram corrigidas e salvas permanentemente. ${errors > 0 ? `(${errors} falhas de permissão)` : ''}`);
        window.location.reload();

    } catch (e: any) {
        console.error(e);
        alert('Erro ao executar correção local: ' + (e.message || e));
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 px-4 md:px-0 font-sans">
      
      {/* Header Minimalista */}
      <div className="flex flex-col gap-6 mb-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Notificações</h1>
          
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
              title="Atualizar"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
            
            {user?.role === 'ADMIN' && (
              <button
                onClick={onClearAll}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                title="Zerar Tudo (Admin)"
              >
                <span className="material-symbols-outlined text-[20px]">delete_forever</span>
              </button>
            )}
            
            <button
                onClick={onFixNotifications}
                className="p-2 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-all"
                title="Reparar Nomes de Itens (Fix Retroativo)"
              >
                <span className="material-symbols-outlined text-[20px]">build</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-1">
          {/* Tabs Clean */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setFilter('all')}
              className={`pb-3 text-sm font-medium transition-all relative ${
                filter === 'all' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Todas
              {filter === 'all' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 rounded-full"></span>}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`pb-3 text-sm font-medium transition-all relative ${
                filter === 'unread' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Não lidas
              {filter === 'unread' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 rounded-full"></span>}
            </button>
            <button
              onClick={() => setFilter('actions')}
              className={`pb-3 text-sm font-medium transition-all relative ${
                filter === 'actions' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Pendentes
              {filter === 'actions' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 rounded-full"></span>}
            </button>
          </div>

          {/* Ações Secundárias */}
          <div className="flex items-center gap-3">
             <button
              onClick={markAllAsRead}
              className="text-xs font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">done_all</span>
              Marcar lidas
            </button>
            <div className="h-3 w-px bg-slate-200"></div>
            <button
              onClick={onClearHistory}
              className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Limpar histórico
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-slate-300 text-3xl">notifications_off</span>
            </div>
            <h3 className="text-slate-900 font-semibold mb-1">Tudo limpo</h3>
            <p className="text-slate-500 text-sm">Nenhuma notificação encontrada.</p>
          </div>
        ) : (
          filteredNotifications.map((notification, index) => {
             // Check indentation for subsequent identical requests
             let isIndented = false;
             let isGhost = false;

             if (index > 0) {
                 const prev = filteredNotifications[index - 1];
                 
                 // Same event/request and same type
                 if (notification.type === prev.type && 
                     (notification.event === prev.event || 
                      (notification.expand?.related_request?.id && notification.expand?.related_request?.id === prev.expand?.related_request?.id))) {
                     isIndented = true;
                     isGhost = true;
                 }
             }

             return (
            <div
              key={notification.id}
              className={`group relative flex gap-5 p-5 rounded-xl transition-all duration-200 ${getStatusContainerStyles(notification)} ${isIndented ? 'ml-8 border-l-4 border-l-slate-300' : ''} ${isGhost ? 'opacity-40 hover:opacity-100 hover:bg-white hover:shadow-sm transition-all duration-500 grayscale hover:grayscale-0' : ''}`}
            >
              {!notification.read && (
                <div className="absolute top-5 right-5 size-2 bg-blue-500 rounded-full ring-4 ring-blue-50/50"></div>
              )}

              <div className={`flex-shrink-0 size-12 rounded-2xl flex items-center justify-center mt-0.5 ${getIconStyles(notification)}`}>
                <span className="material-symbols-outlined text-[24px]">
                  {getIcon(notification)}
                </span>
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center justify-between gap-2 mb-1.5 pr-6">
                  <h4 className={`text-[15px] font-semibold tracking-tight ${notification.read ? 'text-slate-600' : 'text-slate-900'}`}>
                    {notification.title}
                  </h4>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap font-medium">
                    {formatDistanceToNow(new Date(notification.created), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                
                <p className={`text-[14px] leading-relaxed mb-4 ${notification.read ? 'text-slate-400' : 'text-slate-500'}`}>
                  {getNotificationMessage(notification)}
                </p>

                {/* Metadata Tags */}
                <div className="flex flex-wrap gap-2">
                  {getData(notification).quantity !== undefined && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-600 text-[11px] font-medium rounded-md">
                       Qtd: {getData(notification).quantity}
                    </span>
                  )}
                  {notification.type === 'transport_request' && getData(notification) && (
                     <>
                        {getData(notification).horario_levar && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-600 text-[11px] font-medium rounded-md">
                                Ida: {getData(notification).horario_levar}
                            </span>
                        )}
                     </>
                  )}
                </div>

                {/* Re-request Indicator (Sector View) */}
                {getData(notification).is_rerequest && (
                   <div className="mt-2 mb-2 px-3 py-2 bg-purple-50 text-purple-800 border border-purple-100 rounded-lg text-xs flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                      <span className="material-symbols-outlined text-[18px]">history</span>
                      <div className="flex flex-col">
                        <span className="font-bold">Re-solicitação</span>
                        <span>O usuário solicitou novamente após uma recusa anterior.</span>
                      </div>
                   </div>
                )}

                {/* Justification/Observation */}
                {getData(notification).justification && (
                   <div className={`mt-2 p-3 text-xs rounded-lg border flex items-start gap-2 ${
                       (notification.type === 'refusal' || 
                        (notification.title?.toLowerCase() || '').includes('recusad') || 
                        (notification.title?.toLowerCase() || '').includes('rejeitad') ||
                        getData(notification).action === 'rejected')
                       ? 'bg-red-50 text-red-900 border-red-100 ring-1 ring-red-200/50'
                       : 'bg-amber-50 text-amber-900 border-amber-100 ring-1 ring-amber-200/50'
                   }`}>
                      <span className="material-symbols-outlined text-[16px] mt-px">
                        {(notification.type === 'refusal' || 
                          (notification.title?.toLowerCase() || '').includes('recusad') || 
                          (notification.title?.toLowerCase() || '').includes('rejeitad') ||
                          getData(notification).action === 'rejected') ? 'report' : 'sticky_note_2'}
                      </span>
                      <span className="leading-relaxed">
                        <strong className="font-bold block mb-0.5 uppercase tracking-wide text-[10px] opacity-80">
                            {(notification.type === 'refusal' || 
                              (notification.title?.toLowerCase() || '').includes('recusad') || 
                              (notification.title?.toLowerCase() || '').includes('rejeitad') ||
                              getData(notification).action === 'rejected') ? 'Motivo da Recusa' : 'Observação'}
                        </strong>
                        {getData(notification).justification}
                      </span>
                   </div>
                )}

                {/* Actions Area */}
                <div className="mt-3 flex items-center gap-3">
                   {/* Link para Gestão de Transporte (apenas para solicitações de transporte) */}
                   {(notification.type === 'transport_request' || notification.type === 'transport_decision') && (
                      <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // Check role to determine navigation target
                            // TRA (Transport Sector) goes to management page
                            // Others (Creator/Admin/CE) go to event details modal in Calendar
                            const isTransportSector = user?.role === 'TRA';

                            if (isTransportSector) {
                                navigate(`/transporte?eventId=${notification.event}`);
                            } else {
                                const eventData = notification.expand?.event;
                                const eventDate = eventData?.date_start ? new Date(eventData.date_start) : new Date();
                                const dateStr = eventDate.toISOString().split('T')[0];
                                navigate(`/calendar?date=${dateStr}&view=agenda&eventId=${notification.event}&tab=transport`);
                            }
                        }}
                        className="px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-100 text-xs font-bold rounded-lg hover:bg-cyan-100 transition-all flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        Ver Solicitação
                      </button>
                   )}

                   {/* Decision Buttons */}
                   {notification.invite_status === 'pending' && 
                    // For sector requests, only show actions if it's the latest notification in the chain
                    !((notification.type === 'almc_item_request' || notification.type === 'transport_request') && !latestGroupedIds.has(notification.id)) && (
                    <div className="flex items-center gap-2">
                      <button
                        disabled={processingId === notification.id}
                        onClick={() => onHandleAction(notification, (notification.type === 'almc_item_request' || notification.type === 'transport_request') ? 'approved' : 'accepted')}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 shadow-sm"
                      >
                         {(notification.type === 'almc_item_request' || notification.type === 'transport_request') ? 'Aprovar' : 'Aceitar'}
                      </button>
                      <button
                        disabled={processingId === notification.id}
                        onClick={() => onHandleAction(notification, 'rejected')}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
                      >
                        Recusar
                      </button>
                    </div>
                  )}

                  {/* Re-request Button */}
                  {(
                    latestGroupedIds.has(notification.id) && (
                        (notification.type === 'refusal' && (getData(notification).kind === 'almc_item_decision' || getData(notification).kind === 'transport_decision')) ||
                        (notification.type === 'request_decision' && ((notification.title?.toLowerCase() || '').includes('rejeitada') || getData(notification).action === 'rejected')) ||
                        (notification.type === 'transport_decision' && ((notification.title?.toLowerCase() || '').includes('rejeitad') || (notification.title?.toLowerCase() || '').includes('recusad') || getData(notification).action === 'rejected'))
                    )
                  ) && (
                    // Check if the underlying request/event is still rejected before showing the button
                    (() => {
                        const relatedReq = notification.expand?.related_request;
                        const relatedEvent = notification.expand?.event || notification.expand?.related_event;

                        // 0. Quick check from notification data (Priority)
                        if (getData(notification).re_requested) {
                            const isCurrentlyPending = 
                                (relatedReq?.status === 'pending') || 
                                (relatedEvent?.transporte_status === 'pending');

                            if (isCurrentlyPending) {
                                return (
                                    <div className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-default animate-in fade-in" title="Esta solicitação já encontra-se em análise no setor responsável">
                                        <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                                        Re-solicitação em análise
                                    </div>
                                );
                            }
                            
                            // Se não está pendente, mostra apenas status histórico
                            return (
                                <div className="px-3 py-1.5 bg-slate-50 text-slate-400 border border-slate-100 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-default" title="Esta recusa já foi tratada com uma nova solicitação">
                                    <span className="material-symbols-outlined text-[16px]">history</span>
                                    Re-solicitado
                                </div>
                            );
                        }
                        
                        let isApproved = false;
                        let isPending = false;

                        // Item Request Logic
                        if (!isPending && (relatedReq || (notification.related_request && relatedEvent))) {
                             // 1. Try to get the MOST UP-TO-DATE status from the event's reverse requests list
                             // The direct expansion 'relatedReq' might be stale depending on fetch order
                             const reverseRequests = relatedEvent?.expand?.['agenda_cap53_almac_requests_via_event'] || [];
                             
                             // Try to match specific request ID first
                             const match = notification.related_request 
                                ? reverseRequests.find((r: any) => r.id === notification.related_request)
                                : null;

                             if (match) {
                                 if (match.status === 'approved') isApproved = true;
                                 if (match.status === 'pending') isPending = true;
                             } else if (relatedReq) {
                                 // Fallback to direct expansion
                                 if (relatedReq.status === 'approved') isApproved = true;
                                 if (relatedReq.status === 'pending') isPending = true;
                             }

                             // 2. Check for ANY pending request for the SAME item (to avoid duplicates)
                             if (!isApproved && !isPending) {
                                  // Determine Item ID
                                  let currentItemId = null;
                                  
                                  if (match) {
                                      currentItemId = typeof match.item === 'object' ? match.item.id : match.item;
                                  } else if (relatedReq) {
                                      currentItemId = typeof relatedReq.item === 'object' ? relatedReq.item.id : relatedReq.item;
                                  }

                                  if (currentItemId && Array.isArray(reverseRequests)) {
                                      const sameItemPending = reverseRequests.some((r: any) => {
                                          const rItemId = typeof r.item === 'object' ? r.item.id : r.item;
                                          const status = (r.status || '').toLowerCase();
                                          return rItemId === currentItemId && status === 'pending';
                                      });

                                      if (sameItemPending) {
                                          isPending = true;
                                      }
                                  }
                             }
                        } 
                        // Transport Request Logic
                        else if (relatedEvent) {
                             isApproved = relatedEvent.transporte_status === 'approved' || relatedEvent.transporte_status === 'confirmed';
                             isPending = relatedEvent.transporte_status === 'pending';
                        }
                        
                        if (isApproved) {
                             return null;
                        }

                        if (isPending) {
                             return (
                                <div className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-default" title="Esta solicitação já encontra-se em análise no setor responsável">
                                    <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                                    Já solicitado novamente. Aguardando resposta do setor responsável.
                                </div>
                             );
                        }

                        return (
                            <button
                              onClick={() => setReRequestNotification(notification)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[16px]">refresh</span>
                              Solicitar Novamente
                            </button>
                        );
                    })()
                  )}

                  {/* Status Badge */}
                   {notification.invite_status && notification.invite_status !== 'pending' && (
                      <span className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${
                        (notification.invite_status === 'accepted' || notification.invite_status === 'confirmed' || notification.invite_status === 'approved') 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-red-50 text-red-700 border-red-100'
                      }`}>
                         <span className="material-symbols-outlined text-[16px]">
                            {(notification.invite_status === 'accepted' || notification.invite_status === 'confirmed' || notification.invite_status === 'approved') ? 'check_circle' : 'cancel'}
                         </span>
                         {(notification.invite_status === 'accepted' || notification.invite_status === 'confirmed' || notification.invite_status === 'approved') 
                         ? (notification.invite_status === 'confirmed' ? 'Confirmado' : 'Aceito')
                         : 'Recusado'}
                      </span>
                   )}
                </div>

                {/* Hover Actions */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity relative z-20">
                  {!notification.read && (
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Clicou em Marcar como lida:', notification.id);
                        markAsRead(notification.id);
                      }} 
                      className="text-[10px] font-semibold text-primary hover:text-primary-dark cursor-pointer"
                    >
                      Marcar como lida
                    </button>
                  )}
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Botão Remover clicado para:', notification.id);
                      deleteNotification(notification.id);
                    }} 
                    className="text-[10px] font-semibold text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    Remover
                  </button>
                  {notification.event && (
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleViewEvent(notification);
                      }} 
                      className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Ver Evento
                    </button>
                  )}
                </div>

              </div>
            </div>
            );
          })
        )}
      </div>

      {reRequestNotification && (
        <ReRequestModal
          notification={reRequestNotification}
          type={
              (reRequestNotification.type === 'transport_decision' || 
              (getData(reRequestNotification).kind === 'transport_decision') ||
              (reRequestNotification.title && reRequestNotification.title.toLowerCase().includes('transporte')))
              ? 'transport' 
              : 'item'
          }
          onClose={() => setReRequestNotification(null)}
          onSuccess={() => {
            refresh();
            setReRequestNotification(null);
          }}
        />
      )}

      {rejectingNotification && (
        <RefusalModal 
            onClose={() => setRejectingNotification(null)}
            onConfirm={onConfirmRejection}
            loading={processingId === rejectingNotification.id}
        />
      )}
    </div>
  );
};

export default Notifications;
