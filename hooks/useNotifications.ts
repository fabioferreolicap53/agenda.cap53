import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { NotificationRecord } from '../lib/notifications';

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [notifResult, almcResult, traResult] = await Promise.all([
        pb.collection('agenda_cap53_notifications').getList<NotificationRecord>(1, 50, {
          filter: `user = "${user.id}"`,
          sort: '-created',
          expand: 'event,related_request,related_request.item,related_request.created_by'
        }),
        (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') 
          ? pb.collection('agenda_cap53_almac_requests').getList(1, 1, { 
              filter: `status = "pending"${
                user.role === 'ALMC' ? ' && (item.category = "ALMOXARIFADO" || item.category = "COPA")' :
                user.role === 'DCA' ? ' && item.category = "INFORMATICA"' :
                ''
              }` 
            })
          : Promise.resolve({ totalItems: 0 }),
        (user.role === 'TRA' || user.role === 'ADMIN')
          ? pb.collection('agenda_cap53_eventos').getList(1, 1, { filter: 'transporte_suporte = true && transporte_status = "pending"' })
          : Promise.resolve({ totalItems: 0 })
      ]);

      setNotifications(notifResult.items);
      
      // The badge count is the sum of unread system notifications + pending administrative requests
      const systemUnread = notifResult.items.filter(n => !n.read).length;
      setUnreadCount(systemUnread + almcResult.totalItems + traResult.totalItems);
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
      
      const u1 = await pb.collection('agenda_cap53_notifications').subscribe('*', (e) => {
        if (e.record.user === user.id) fetchNotifications();
      });
      unsubs.push(u1);

      if (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') {
        const u2 = await pb.collection('agenda_cap53_almac_requests').subscribe('*', () => fetchNotifications());
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
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => pb.collection('agenda_cap53_notifications').update(n.id, { read: true })));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
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
      const history = notifications.filter(n => n.read);
      await Promise.all(history.map(n => pb.collection('agenda_cap53_notifications').delete(n.id)));
      setNotifications(prev => prev.filter(n => !n.read));
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
      
      // Atualiza a notificação atual
      await pb.collection('agenda_cap53_notifications').update(notification.id, updatePayload);

      // Sincroniza o status com outras notificações idênticas para outros usuários do mesmo setor
      try {
        if (notification.related_request) {
          const others = await pb.collection('agenda_cap53_notifications').getFullList({
            filter: `related_request = "${notification.related_request}" && id != "${notification.id}" && invite_status = "pending"`
          });
          await Promise.all(others.map(n => 
            pb.collection('agenda_cap53_notifications').update(n.id, { invite_status: updatePayload.invite_status })
          ));
        } else if (notification.type === 'transport_request' && notification.event) {
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
