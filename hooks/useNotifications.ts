import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { NotificationRecord } from '../lib/notifications';
import { debugLog } from '../src/lib/debug';

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      debugLog('useNotifications', 'Iniciando fetch para user:', user.id);
      
      const [notifResult, almcResult, traResult] = await Promise.all([
        pb.collection('agenda_cap53_notifications').getList<NotificationRecord>(1, 50, {
          filter: `user = "${user.id}"`,
          sort: '-created',
          expand: 'event,related_request,related_request.item,related_request.created_by'
        }),
        (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') 
          ? pb.collection('agenda_cap53_almac_requests').getList(1, 50, { 
              filter: `status = "pending"${
                user.role === 'ALMC' ? ' && (item.category = "ALMOXARIFADO" || item.category = "COPA")' :
                user.role === 'DCA' ? ' && item.category = "INFORMATICA"' :
                ''
              }`,
              expand: 'event,item'
            })
          : Promise.resolve({ items: [], totalItems: 0 }),
        (user.role === 'TRA' || user.role === 'ADMIN')
          ? pb.collection('agenda_cap53_eventos').getList(1, 50, { filter: 'transporte_suporte = true && transporte_status = "pending"' })
          : Promise.resolve({ items: [], totalItems: 0 })
      ]);

      // Map pending requests to virtual notifications if they don't exist in notifications list
      const existingRequestIds = new Set(notifResult.items.map(n => n.related_request));
      
      const almcNotifications = (almcResult?.items || [])
        .filter(req => !existingRequestIds.has(req.id))
        .map(req => ({
          id: `req_${req.id}`,
          collectionId: 'virtual',
          collectionName: 'virtual',
          created: req.created,
          updated: req.updated,
          user: user.id,
          title: 'Solicitação Pendente',
          message: `Solicitação de ${req.expand?.item?.name || 'Item'} para o evento "${req.expand?.event?.title || 'Evento'}"`,
          type: 'almc_item_request' as const,
          read: false,
          event: req.event,
          related_request: req.id,
          invite_status: 'pending' as const,
          data: { 
            quantity: req.quantity, 
            item_name: req.expand?.item?.name,
            event_title: req.expand?.event?.title
          },
          acknowledged: false,
          expand: req.expand
        }));

      const traNotifications = (traResult?.items || [])
        .filter(evt => !existingRequestIds.has(evt.id)) // Assuming event ID is used as request ID for transport
        .map(evt => ({
          id: `tra_${evt.id}`,
          collectionId: 'virtual',
          collectionName: 'virtual',
          created: evt.created,
          updated: evt.updated,
          user: user.id,
          title: 'Transporte Pendente',
          message: `Solicitação de transporte para o evento "${evt.title}"`,
          type: 'transport_request' as const,
          read: false,
          event: evt.id,
          related_request: evt.id,
          invite_status: 'pending' as const,
          data: { 
            destination: evt.transporte_destino,
            event_title: evt.title
          },
          acknowledged: false,
          expand: { event: evt }
        }));

      const allNotifications = [
        ...notifResult.items,
        ...almcNotifications,
        ...traNotifications
      ].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      debugLog('useNotifications', 'Notificações encontradas:', allNotifications.length);
      
      // Salvar no localStorage para debug
      if (import.meta.env.DEV) {
        localStorage.setItem('debug_notifications', JSON.stringify(allNotifications));
      }
      
      setNotifications(allNotifications);
      
      // The badge count is the sum of unread system notifications + pending administrative requests
      const systemUnread = notifResult.items.filter(n => !n.read).length;
      const almcCount = almcResult?.items?.length || 0;
      const traCount = traResult?.items?.length || 0;
      setUnreadCount(systemUnread + almcCount + traCount);
      
      debugLog('useNotifications', 'Unread count calculado:', {
        system: systemUnread,
        almc: almcCount,
        tra: traCount,
        total: systemUnread + almcCount + traCount
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchNotifications();

    if (!user?.id) return;

    const subscribe = async () => {
      const unsubs: (() => void)[] = [];
      
      const u1 = await pb.collection('agenda_cap53_notifications').subscribe<NotificationRecord>('*', (e) => {
         if (e.record.user === user.id) {
           if (e.action === 'create') {
             // Quando uma nova notificação chega, adicionamos ao início
             setNotifications(prev => [e.record, ...prev]);
             if (!e.record.read) setUnreadCount(prev => prev + 1);
           } else if (e.action === 'update') {
             // Quando uma notificação é atualizada, mesclamos com a existente para preservar o 'expand'
             setNotifications(prev => prev.map(n => 
               n.id === e.record.id ? { ...n, ...e.record } : n
             ));
             
             // Recalcula o unreadCount de forma mais precisa
             fetchNotifications();
           } else if (e.action === 'delete') {
             setNotifications(prev => prev.filter(n => n.id !== e.record.id));
             fetchNotifications();
           }
         }
       });
      unsubs.push(u1);

      if (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') {
        const u2 = await pb.collection('agenda_cap53_almac_requests').subscribe('*', (e) => {
          // Quando um pedido de almoxarifado é alterado, recarregamos para atualizar contadores e dados expandidos
          fetchNotifications();
        });
        unsubs.push(u2);
      }

      if (user.role === 'TRA' || user.role === 'ADMIN') {
        const u3 = await pb.collection('agenda_cap53_eventos').subscribe('*', (e) => {
          if (e.record.transporte_suporte === true) fetchNotifications();
        });
        unsubs.push(u3);
      }

      return () => unsubs.forEach(unsub => unsub());
    };

    let unsubscribe: (() => void) | undefined;
    subscribe().then(unsub => unsubscribe = unsub);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, user?.role, fetchNotifications]);

  const markAsRead = async (id: string) => {
    // Skip virtual notifications
    if (id.startsWith('req_') || id.startsWith('tra_')) return;

    try {
      await pb.collection('agenda_cap53_notifications').update(id, { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read && !n.id.startsWith('req_') && !n.id.startsWith('tra_'));
      await Promise.all(unread.map(n => pb.collection('agenda_cap53_notifications').update(n.id, { read: true })));
      
      // Update local state - keeping virtual notifications as unread since they require action
      setNotifications(prev => prev.map(n => 
        (n.id.startsWith('req_') || n.id.startsWith('tra_')) ? n : { ...n, read: true }
      ));
      
      // Recalculate unread count
      const virtualCount = notifications.filter(n => (n.id.startsWith('req_') || n.id.startsWith('tra_')) && !n.read).length;
      setUnreadCount(virtualCount);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    // Skip virtual notifications
    if (id.startsWith('req_') || id.startsWith('tra_')) return;

    try {
      await pb.collection('agenda_cap53_notifications').delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      const wasUnread = notifications.find(n => n.id === id)?.read === false;
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearHistory = async () => {
    if (!user?.id) return;
    try {
      const history = notifications.filter(n => n.read && !n.id.startsWith('req_') && !n.id.startsWith('tra_'));
      await Promise.all(history.map(n => pb.collection('agenda_cap53_notifications').delete(n.id)));
      setNotifications(prev => prev.filter(n => !n.read || n.id.startsWith('req_') || n.id.startsWith('tra_')));
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const handleDecision = async (notification: NotificationRecord, action: 'accepted' | 'rejected' | 'approved') => {
    if (!user?.id) return;

    try {
      const updatePayload: any = { 
        read: true,
        invite_status: action === 'approved' ? 'accepted' : action 
      };
      
      // Atualiza a notificação atual (apenas se for real)
      if (!notification.id.startsWith('req_') && !notification.id.startsWith('tra_')) {
        await pb.collection('agenda_cap53_notifications').update(notification.id, updatePayload);
      } else {
        // Para notificações virtuais, apenas atualizamos o estado local para refletir que foi "lida/processada"
        // Na verdade, ela será removida no próximo fetch pois o status do request mudará
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
      }

      // Sincroniza o status com outras notificações idênticas para outros usuários do mesmo setor
      try {
        if (notification.related_request && !notification.id.startsWith('req_')) {
          const others = await pb.collection('agenda_cap53_notifications').getFullList({
            filter: `related_request = "${notification.related_request}" && id != "${notification.id}" && invite_status = "pending"`
          });
          await Promise.all(others.map(n => 
            pb.collection('agenda_cap53_notifications').update(n.id, { invite_status: updatePayload.invite_status })
          ));
        } else if (notification.type === 'transport_request' && notification.event && !notification.id.startsWith('tra_')) {
          const others = await pb.collection('agenda_cap53_notifications').getFullList({
            filter: `event = "${notification.event}" && type = "transport_request" && id != "${notification.id}" && invite_status = "pending"`
          });
          await Promise.all(others.map(n => 
            pb.collection('agenda_cap53_notifications').update(n.id, { invite_status: updatePayload.invite_status })
          ));
        }
      } catch (err) {
        console.error('Erro ao sincronizar notificações relacionadas:', err);
      }

      // 1. Event Invitation Logic
      if (notification.type === 'event_invite') {
        const eventId = notification.event;
        if (eventId) {
          const existing = await pb.collection('agenda_cap53_participantes').getFullList({
            filter: `event = "${eventId}" && user = "${user.id}"`
          });

          if (existing.length === 0) {
            if (action === 'accepted') {
              await pb.collection('agenda_cap53_participantes').create({
                event: eventId,
                user: user.id,
                status: 'accepted',
                role: 'PARTICIPANTE'
              });
            }
          } else {
            await Promise.all(existing.map((p: any) => (
              pb.collection('agenda_cap53_participantes').update(p.id, { 
                status: action === 'accepted' ? 'accepted' : 'rejected'
              })
            )));
          }

          // Notify Creator
          if (notification.expand?.event?.user) {
            await pb.collection('agenda_cap53_notifications').create({
              user: notification.expand.event.user,
              title: `Convite ${action === 'accepted' ? 'Aceito' : 'Recusado'}`,
              message: `${user.name || user.email} ${action === 'accepted' ? 'aceitou' : 'recusou'} o convite para "${notification.expand.event.title}".`,
              type: action === 'rejected' ? 'refusal' : 'system',
              event: eventId,
              read: false,
              data: { kind: 'event_invite_response', action }
            });
          }
        }
      }

      // 2. Participation Request Logic
      if (notification.type === 'event_participation_request') {
        const eventId = notification.event;
        const requesterId = notification.data?.requester_id || notification.expand?.related_request?.user;
        
        if (eventId && requesterId) {
          const requests = await pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
            filter: `event = "${eventId}" && user = "${requesterId}" && status = "pending"`
          });

          for (const req of requests) {
            await pb.collection('agenda_cap53_solicitacoes_evento').update(req.id, {
              status: action === 'accepted' ? 'approved' : 'rejected'
            });
          }

          if (action === 'accepted') {
            const event = await pb.collection('agenda_cap53_eventos').getOne(eventId);
            const participants = event.participants || [];
            if (!participants.includes(requesterId)) {
              await pb.collection('agenda_cap53_eventos').update(eventId, {
                participants: [...participants, requesterId]
              });
            }
          }
        }
      }

      // 3. ALMC/DCA Request Logic
      if (notification.type === 'almc_item_request') {
        const requestId = notification.related_request;
        if (requestId) {
          const status = action === 'approved' || action === 'accepted' ? 'approved' : 'rejected';
          await pb.collection('agenda_cap53_almac_requests').update(requestId, {
            status: status
          });

          // Notify Requester
          const request = await pb.collection('agenda_cap53_almac_requests').getOne(requestId, {
            expand: 'item,event'
          });
          
          if (request.created_by && request.created_by !== user.id) {
            await pb.collection('agenda_cap53_notifications').create({
              user: request.created_by,
              title: `Solicitação de Item ${status === 'approved' ? 'Aprovada' : 'Recusada'}`,
              message: `Sua solicitação para o item "${request.expand?.item?.name || 'Item'}" foi ${status === 'approved' ? 'aprovada' : 'recusada'}.`,
              type: status === 'approved' ? 'system' : 'refusal',
              event: request.event,
              read: false,
              data: { kind: 'almc_item_decision', action: status }
            });
          }
        }
      }

      // 4. Transport Request Logic
      if (notification.type === 'transport_request') {
        const eventId = notification.event;
        if (eventId) {
          const status = action === 'approved' || action === 'accepted' ? 'approved' : 'rejected';
          await pb.collection('agenda_cap53_eventos').update(eventId, {
            transporte_status: status
          });

          // Notify Creator
          const event = await pb.collection('agenda_cap53_eventos').getOne(eventId);
          if (event.user && event.user !== user.id) {
            await pb.collection('agenda_cap53_notifications').create({
              user: event.user,
              title: `Transporte ${status === 'approved' ? 'Aprovado' : 'Recusado'}`,
              message: `A solicitação de transporte para o evento "${event.title}" foi ${status === 'approved' ? 'aprovada' : 'recusada'}.`,
              type: status === 'approved' ? 'system' : 'refusal',
              event: eventId,
              read: false,
              data: { kind: 'transport_decision', action: status }
            });
          }
        }
      }

      // 5. Service Request Logic (Generic)
      if (notification.type === 'service_request') {
        const eventId = notification.event;
        const requesterId = notification.data?.requester_id || notification.expand?.event?.user;
        
        if (eventId && requesterId) {
          const status = action === 'accepted' ? 'approved' : 'rejected';
          
          // Notify Requester
          if (requesterId !== user.id) {
            await pb.collection('agenda_cap53_notifications').create({
              user: requesterId,
              title: `Serviço ${status === 'approved' ? 'Aceito' : 'Recusado'}`,
              message: `Sua solicitação de serviço para o evento "${notification.expand?.event?.title || 'Evento'}" foi ${status === 'approved' ? 'aceita' : 'recusada'}.`,
              type: status === 'rejected' ? 'refusal' : 'system',
              event: eventId,
              read: false,
              data: { kind: 'service_decision', action: status }
            });
          }
        }
      }

      await fetchNotifications();
    } catch (error) {
      console.error('Error handling decision:', error);
      throw error;
    }
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearHistory,
    handleDecision,
    refresh: fetchNotifications
  };
};
