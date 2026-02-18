import { pb } from '../lib/pocketbase';
import { NotificationRecord, isNotificationDeletable } from '../lib/notifications';
import { useAuth } from '../components/AuthContext';

export const useNotificationActions = (
  notifications: NotificationRecord[],
  setNotifications: React.Dispatch<React.SetStateAction<NotificationRecord[]>>,
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>,
  refreshNotifications: () => Promise<void>
) => {
  const { user } = useAuth();

  const markAsRead = async (id: string) => {
    console.log('markAsRead called for id:', id);
    
    // 1. Optimistic Update (Immediate Feedback)
    setNotifications(prev => {
        const newNotifs = prev.map(n => n.id === id ? { ...n, read: true } : n);
        console.log('Optimistic update applied. Found notification?', prev.some(n => n.id === id));
        return newNotifs;
    });
    
    // Only decrease unread count if it was actually unread
    const notification = notifications.find(n => n.id === id);
    if (notification) {
        if (!notification.read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    } else {
        console.warn('Notification not found in current list during markAsRead:', id);
        // Force unread count update anyway just in case
        setUnreadCount(prev => Math.max(0, prev - 1));
    }

    // 2. Backend/Persistence Update
    if (id.startsWith('req_') || id.startsWith('tra_')) {
        console.log('Virtual notification, skipping backend update');
        // For virtual notifications, we could persist to localStorage if needed
        // For now, local state update is enough for the session
        return;
    }

    try {
      console.log('Sending update to PocketBase for:', id);
      await pb.collection('agenda_cap53_notifications').update(id, { read: true });
      console.log('PocketBase update success');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert on error (optional, but good practice)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: false } : n));
      if (notification && !notification.read) {
          setUnreadCount(prev => prev + 1);
      }
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
    console.log('Tentando excluir notificação:', id);
    const notification = notifications.find(n => n.id === id);
    
    if (notification) {
        const { canDelete, reason } = isNotificationDeletable(notification);
        if (!canDelete) {
            alert(reason || 'Não é possível excluir esta notificação.');
            return;
        }
    } else {
        console.warn('Notificação não encontrada na lista local:', id);
    }

    if (id.startsWith('req_') || id.startsWith('tra_')) {
        // Persist virtual notification deletion
        try {
            const ignored = JSON.parse(localStorage.getItem('ignored_notifications') || '[]');
            if (!ignored.includes(id)) {
                ignored.push(id);
                localStorage.setItem('ignored_notifications', JSON.stringify(ignored));
            }
            setNotifications(prev => prev.filter(n => n.id !== id));
            const wasUnread = notifications.find(n => n.id === id)?.read === false;
            if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error('Error saving ignored notifications:', e);
        }
        return;
    }

    try {
      await pb.collection('agenda_cap53_notifications').delete(id);
      console.log('Notificação excluída com sucesso:', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      const wasUnread = notifications.find(n => n.id === id)?.read === false;
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      // Se o erro for 404, significa que já foi deletada, então removemos da lista local
      if (error.status === 404) {
          setNotifications(prev => prev.filter(n => n.id !== id));
      } else {
          alert(`Erro ao excluir notificação: ${error.message || 'Erro desconhecido'}`);
      }
    }
  };

  const clearHistory = async () => {
    if (!user?.id) return;
    try {
      // Use the safe backend endpoint that respects future event rules
      const result = await pb.send('/api/notifications/clear_safe?read_only=true', { method: 'POST' });
      
      if (result.skipped > 0) {
        alert(`Histórico limpo parcialmente. ${result.skipped} notificações foram mantidas pois estão vinculadas a eventos futuros.`);
      } else {
        // Optional: show success toast/message
      }

      // Refresh local state
      await refreshNotifications();
    } catch (error) {
      console.error('Error clearing history:', error);
      alert('Erro ao limpar histórico.');
    }
  };

  const clearAllNotifications = async () => {
    try {
        const result = await pb.send('/api/notifications/clear_safe?all=true', { method: 'POST' });
        
        // Refresh to get back virtual notifications but clear real ones
        await refreshNotifications();
        
        if (result.skipped > 0) {
            alert(`Notificações limpas parcialmente. ${result.skipped} notificações foram mantidas pois estão vinculadas a eventos futuros.`);
        } else {
            alert('Todas as notificações foram removidas.');
        }
    } catch (error: any) {
        console.error('Error clearing all notifications:', error);
        alert('Erro ao limpar notificações: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleDecision = async (notification: NotificationRecord, action: 'accepted' | 'rejected' | 'approved', justification?: string) => {
    if (!user?.id) return;

    try {
      // 1. Event Invitation Logic
      if (notification.type === 'event_invite') {
        const rawEvent = notification.event;
        const eventId = typeof rawEvent === 'object' ? (rawEvent as any)?.id : rawEvent;

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
        const rawEvent = notification.event;
        const eventId = typeof rawEvent === 'object' ? (rawEvent as any)?.id : rawEvent;

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
        const rawRequest = notification.related_request;
        const requestId = typeof rawRequest === 'object' ? (rawRequest as any)?.id : rawRequest;
        
        console.log('[DEBUG] Processing ALMC Request Decision:', {
            notificationId: notification.id,
            action,
            requestId,
            rawRequestType: typeof rawRequest,
            rawRequestValue: rawRequest
        });

        if (requestId) {
          const status = action === 'approved' || action === 'accepted' ? 'approved' : 'rejected';
          
          try {
              const payload: any = { status: status };
              // Ensure justification is always sent, even if empty string, to clear previous values or set new ones
              payload.justification = justification || '';
              
              console.log('[DEBUG] Sending update to agenda_cap53_almac_requests:', {
                  id: requestId,
                  payload
              });

              // Perform the update
              const result = await pb.collection('agenda_cap53_almac_requests').update(requestId, payload, { requestKey: null });
              
              console.log('[DEBUG] Update successful:', result);

              // Notify Requester
               try {
                   const requesterId = (typeof rawRequest === 'object' ? (rawRequest as any)?.created_by : notification.expand?.related_request?.created_by) || 
                                     notification.data?.requester_id || 
                                     (notification.expand as any)?.created_by?.id;
                   
                   if (requesterId && requesterId !== user.id) {
                       const itemName = (typeof rawRequest === 'object' && (rawRequest as any).expand?.item?.name) || 
                                      notification.expand?.related_request?.expand?.item?.name || 
                                      (notification.expand as any)?.item?.name ||
                                      notification.data?.item_name || 'Item';
                       const eventTitle = (typeof rawRequest === 'object' && (rawRequest as any).expand?.event?.title) || 
                                        notification.expand?.related_request?.expand?.event?.title || 
                                        (notification.expand as any)?.event?.title ||
                                        notification.data?.event_title || 'Evento';

                       await pb.collection('agenda_cap53_notifications').create({
                          user: requesterId,
                          title: `Solicitação ${status === 'approved' ? 'Aprovada' : 'Recusada'}`,
                          message: `Sua solicitação de ${itemName} para o evento "${eventTitle}" foi ${status === 'approved' ? 'aprovada' : 'recusada'}.`,
                          type: status === 'approved' ? 'request_decision' : 'refusal',
                          event: notification.event,
                          related_request: requestId,
                          read: false,
                          data: { 
                              kind: 'almc_item_decision', 
                              action: status, 
                              justification: payload.justification 
                          }
                      });
                      console.log('[DEBUG] Notification sent to requester:', requesterId);
                  }
              } catch (notifyError) {
                  console.error('[DEBUG] Error notifying requester:', notifyError);
                  // Don't throw, as the update was successful
              }

          } catch (updateError: any) {
              console.error('[DEBUG] Error updating ALMC request:', updateError);
              console.error('[DEBUG] Error details:', updateError.data);
              throw updateError;
          }
        } else {
            console.error('[DEBUG] Request ID not found in notification:', notification);
            // If we can't find the request ID, we can't update it. 
            // Should we stop here? Yes, to avoid marking notification as resolved without resolving request.
            throw new Error('Request ID not found in notification');
        }
      }

      // 4. Transport Request Logic
      if (notification.type === 'transport_request') {
        const rawEvent = notification.event;
        const eventId = typeof rawEvent === 'object' ? (rawEvent as any)?.id : rawEvent;

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
        const rawEvent = notification.event;
        const eventId = typeof rawEvent === 'object' ? (rawEvent as any)?.id : rawEvent;

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

      // AFTER business logic success, update the notification status
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
