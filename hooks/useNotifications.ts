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
      const result = await pb.collection('agenda_cap53_notifications').getList<NotificationRecord>(1, 50, {
        filter: `user = "${user.id}"`,
        sort: '-created',
        expand: 'event,related_request,related_request.item,related_request.created_by'
      });

      setNotifications(result.items);
      setUnreadCount(result.items.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();

    if (!user?.id) return;

    const subscribe = async () => {
      return await pb.collection('agenda_cap53_notifications').subscribe('*', (e) => {
        if (e.record.user === user.id) {
          fetchNotifications();
        }
      });
    };

    let unsubscribe: (() => void) | undefined;
    subscribe().then(unsub => unsubscribe = unsub);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, fetchNotifications]);

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
      
      await pb.collection('agenda_cap53_notifications').update(notification.id, updatePayload);

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
          await pb.collection('agenda_cap53_almac_requests').update(requestId, {
            status: action === 'approved' ? 'approved' : 'rejected'
          });
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
