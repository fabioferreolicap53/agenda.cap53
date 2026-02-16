import { pb } from '../lib/pocketbase';
import { NotificationRecord } from '../lib/notifications';
import { useAuth } from '../components/AuthContext';

export const useNotificationActions = (
  notifications: NotificationRecord[],
  setNotifications: React.Dispatch<React.SetStateAction<NotificationRecord[]>>,
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>,
  refreshNotifications: () => Promise<void>
) => {
  const { user } = useAuth();

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
      
      setNotifications(prev => prev.map(n => 
        (n.id.startsWith('req_') || n.id.startsWith('tra_')) ? n : { ...n, read: true }
      ));
      
      const virtualCount = notifications.filter(n => (n.id.startsWith('req_') || n.id.startsWith('tra_')) && !n.read).length;
      setUnreadCount(virtualCount);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
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

  const clearAllNotifications = async () => {
    try {
        await pb.send('/api/notifications/clear_all', { method: 'POST' });
        // Refresh to get back virtual notifications but clear real ones
        await refreshNotifications();
        alert('Todas as notificações foram removidas.');
    } catch (error: any) {
        console.error('Error clearing all notifications:', error);
        alert('Erro ao limpar notificações: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleDecision = async (notification: NotificationRecord, action: 'accepted' | 'rejected' | 'approved', justification?: string) => {
    if (!user?.id) return;

    try {
      const updatePayload: any = { 
        read: true,
        invite_status: action === 'approved' ? 'accepted' : action 
      };
      
      // Update local state first for responsiveness
      if (!notification.id.startsWith('req_') && !notification.id.startsWith('tra_')) {
        await pb.collection('agenda_cap53_notifications').update(notification.id, updatePayload);
      } else {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
      }

      // Sync with related notifications
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
        console.error('Error syncing related notifications:', err);
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
          
          try {
              const payload: any = { status: status };
              // Ensure justification is always sent, even if empty string, to clear previous values or set new ones
              payload.justification = justification || '';
              
              // Perform the update
              await pb.collection('agenda_cap53_almac_requests').update(requestId, payload, { requestKey: null });
              
          } catch (updateError) {
              console.error('Error updating ALMC request:', updateError);
              throw updateError;
          }
        }
      }

      // 4. Transport Request Logic
      if (notification.type === 'transport_request') {
        const eventId = notification.event;
        if (eventId) {
          // Transporte usa 'confirmed' ao invés de 'approved'
          const status = action === 'approved' || action === 'accepted' ? 'confirmed' : 'rejected';
          
          const payload: any = { transporte_status: status };
          // Ensure justification is always sent
          payload.transporte_justification = justification || '';

          await pb.collection('agenda_cap53_eventos').update(eventId, payload, { requestKey: null });
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

      // Add a small delay to allow backend hooks/endpoints to process before refreshing
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshNotifications();
    } catch (error) {
      console.error('Error handling decision:', error);
      throw error;
    }
  };

  return {
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearHistory,
    clearAllNotifications,
    handleDecision
  };
};
