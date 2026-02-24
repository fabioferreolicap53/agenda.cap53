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
    try {
      if (id.startsWith('req_')) {
        // Handle virtual notification marking as read
        const readVirtual = JSON.parse(localStorage.getItem('virtual_notifications_read') || '[]');
        if (!readVirtual.includes(id)) {
          readVirtual.push(id);
          localStorage.setItem('virtual_notifications_read', JSON.stringify(readVirtual));
        }
      } else {
        await pb.collection('agenda_cap53_notifications').update(id, { read: true });
      }
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update badge
      if (navigator.setAppBadge) {
        const count = notifications.filter(n => !n.read && n.id !== id).length;
        if (count > 0) navigator.setAppBadge(count);
        else navigator.clearAppBadge();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const unread = notifications.filter(n => !n.read);
      if (unread.length === 0) return;
      
      const realUnreadIds = unread.filter(n => !n.id.startsWith('req_')).map(n => n.id);
      const virtualUnreadIds = unread.filter(n => n.id.startsWith('req_')).map(n => n.id);

      // 1. Handle Real Notifications
      if (realUnreadIds.length > 0) {
        const batchSize = 20;
        for (let i = 0; i < realUnreadIds.length; i += batchSize) {
          const batch = realUnreadIds.slice(i, i + batchSize);
          await Promise.all(
            batch.map(id => pb.collection('agenda_cap53_notifications').update(id, { read: true }))
          );
        }
      }

      // 2. Handle Virtual Notifications
      if (virtualUnreadIds.length > 0) {
        const readVirtual = JSON.parse(localStorage.getItem('virtual_notifications_read') || '[]');
        const newReadVirtual = [...new Set([...readVirtual, ...virtualUnreadIds])];
        localStorage.setItem('virtual_notifications_read', JSON.stringify(newReadVirtual));
      }
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      if (navigator.clearAppBadge) navigator.clearAppBadge();
      
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    // Check if deletable
    const { canDelete, reason } = isNotificationDeletable(notification);
    
    if (!canDelete) {
      alert(reason || 'Esta notificação não pode ser excluída no momento.');
      return;
    }

    try {
      if (id.startsWith('req_')) {
        // Handle virtual notification deletion (ignoring)
        const ignored = JSON.parse(localStorage.getItem('ignored_notifications') || '[]');
        if (!ignored.includes(id)) {
          ignored.push(id);
          localStorage.setItem('ignored_notifications', JSON.stringify(ignored));
        }
      } else {
        await pb.collection('agenda_cap53_notifications').delete(id);
      }
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (!notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert('Erro ao excluir notificação.');
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    
    try {
      // Delete all notifications that are deletable (mostly read and history)
      const deletable = notifications.filter(n => isNotificationDeletable(n).canDelete);
      
      if (deletable.length === 0) {
        return;
      }

      const realIds = deletable.filter(n => !n.id.startsWith('req_')).map(n => n.id);
      const virtualIds = deletable.filter(n => n.id.startsWith('req_')).map(n => n.id);

      // 1. Handle Real
      if (realIds.length > 0) {
        const batchSize = 20;
        for (let i = 0; i < realIds.length; i += batchSize) {
          const batch = realIds.slice(i, i + batchSize);
          await Promise.all(
            batch.map(id => pb.collection('agenda_cap53_notifications').delete(id))
          );
        }
      }

      // 2. Handle Virtual
      if (virtualIds.length > 0) {
        const ignored = JSON.parse(localStorage.getItem('ignored_notifications') || '[]');
        const newIgnored = [...new Set([...ignored, ...virtualIds])];
        localStorage.setItem('ignored_notifications', JSON.stringify(newIgnored));
      }
      
      await refreshNotifications();
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    
    try {
      const deletable = notifications.filter(n => isNotificationDeletable(n).canDelete);
      if (deletable.length === 0) return;

      const realIds = deletable.filter(n => !n.id.startsWith('req_')).map(n => n.id);
      const virtualIds = deletable.filter(n => n.id.startsWith('req_')).map(n => n.id);
        
      // 1. Handle Real
      if (realIds.length > 0) {
        const batchSize = 20;
        for (let i = 0; i < realIds.length; i += batchSize) {
          const batch = realIds.slice(i, i + batchSize);
          await Promise.all(
            batch.map(id => pb.collection('agenda_cap53_notifications').delete(id))
          );
        }
      }

      // 2. Handle Virtual
      if (virtualIds.length > 0) {
        const ignored = JSON.parse(localStorage.getItem('ignored_notifications') || '[]');
        const newIgnored = [...new Set([...ignored, ...virtualIds])];
        localStorage.setItem('ignored_notifications', JSON.stringify(newIgnored));
      }
      
      await refreshNotifications();
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  };

  const handleDecision = async (notification: NotificationRecord, action: 'accepted' | 'rejected' | 'approved', justification?: string) => {
    // Basic validation
    if (!notification) {
        console.error('handleDecision: notification is null');
        return;
    }

    try {
      // 1. CASO: Decisão de Solicitação de Item (Almoxarifado/DCA)
      if (notification.type === 'almc_item_request') {
        const requestId = notification.related_request;
        if (!requestId) {
            console.error('handleDecision: requestId is missing for almc_item_request');
            throw new Error('ID da solicitação não encontrado.');
        }

        // Atualiza o status do request no banco
        await pb.collection('agenda_cap53_almac_requests').update(requestId, {
            status: action,
            justification: justification || '',
        });

        // Busca dados frescos do request para as notificações
        let req;
        try {
            req = await pb.collection('agenda_cap53_almac_requests').getOne(requestId, { 
                expand: 'created_by,item,event,event.user' 
            });
        } catch (e) {
            console.warn('Could not fetch expanded request data, using notification data instead');
        }

        const itemName = req?.expand?.item?.name || notification.expand?.related_request?.expand?.item?.name || 'item';
        const eventTitle = req?.expand?.event?.title || notification.expand?.event?.title || 'Evento';
        const message = `O pedido de "${itemName}" para o evento "${eventTitle}" foi ${action === 'approved' ? 'aprovado' : 'reprovado'}.${action === 'rejected' && justification ? ` Justificativa: ${justification}` : ''}`;
        const requesterId = req?.expand?.created_by?.id || req?.created_by || notification.expand?.related_request?.created_by;
        const eventCreatorId = req?.expand?.event?.user || req?.event_creator_id || notification.expand?.event?.user;

        // Notifica o solicitante (se não for o próprio usuário logado decidindo)
        if (requesterId && requesterId !== user?.id) {
            await pb.collection('agenda_cap53_notifications').create({
                user: requesterId,
                title: `Solicitação ${action === 'approved' ? 'Aprovada' : 'Reprovada'}`,
                message: message,
                type: action === 'rejected' ? 'refusal' : 'system',
                read: false,
                related_request: requestId,
                event: req?.event || notification.event,
                data: {
                    kind: 'almc_item_decision',
                    action: action,
                    rejected_by: action === 'rejected' ? user?.id : undefined,
                    rejected_by_name: action === 'rejected' ? user?.name : undefined,
                    approved_by: action === 'approved' ? user?.id : undefined,
                    approved_by_name: action === 'approved' ? user?.name : undefined,
                    justification: justification,
                    item_name: itemName,
                    event_title: eventTitle
                },
                acknowledged: false
            });
        }

        // Notifica o criador do evento (se for diferente do solicitante e do decider)
        if (eventCreatorId && eventCreatorId !== user?.id && eventCreatorId !== requesterId) {
            await pb.collection('agenda_cap53_notifications').create({
                user: eventCreatorId,
                title: `Ciência: Item ${action === 'approved' ? 'Aprovado' : 'Reprovada'}`,
                message: message,
                type: action === 'rejected' ? 'refusal' : 'system',
                read: false,
                related_request: requestId,
                event: req?.event || notification.event,
                data: {
                    kind: 'almc_item_decision',
                    action: action,
                    justification: justification,
                    item_name: itemName,
                    event_title: eventTitle
                },
                acknowledged: false
            });
        }

        // Notifica o próprio decider (Setor) para manter no histórico dele
        if (user?.id) {
            await pb.collection('agenda_cap53_notifications').create({
                user: user.id,
                title: `Solicitação ${action === 'approved' ? 'Aprovada' : 'Recusada'}`,
                message: `Você ${action === 'approved' ? 'aprovou' : 'recusou'} o pedido de "${itemName}" para o evento "${eventTitle}".${action === 'rejected' && justification ? ` Motivo: ${justification}` : ''}`,
                type: action === 'rejected' ? 'refusal' : 'system',
                read: true, // Já nasce lida para o decider
                related_request: requestId,
                event: req?.event || notification.event,
                data: {
                    kind: 'almc_item_decision',
                    action: action,
                    justification: justification,
                    is_decider_copy: true,
                    item_name: itemName,
                    event_title: eventTitle
                },
                acknowledged: true
            });
        }
      }
      // 2. CASO: Decisão de Transporte
      else if (notification.type === 'transport_request') {
        const rawEventId = notification.event;
        const eventId = typeof rawEventId === 'object' ? rawEventId.id : rawEventId;
        
        if (!eventId) {
            console.error('handleDecision: eventId is missing for transport_request');
            throw new Error('ID do evento não encontrado.');
        }

        // Atualiza o status do transporte no evento
        await pb.collection('agenda_cap53_eventos').update(eventId, {
            transporte_status: action === 'approved' ? 'confirmed' : 'rejected',
            transporte_justification: justification || '',
        });

        // Notifica os interessados
        const event = await pb.collection('agenda_cap53_eventos').getOne(eventId, { expand: 'user' });
        const eventCreatorId = event.expand?.user?.id || event.user;
        const eventTitle = event.title || 'Evento';
        const actionText = action === 'approved' ? 'confirmado' : 'recusado';
        const message = `O transporte para o evento "${eventTitle}" foi ${actionText}.${action === 'rejected' && justification ? ` Justificativa: ${justification}` : ''}`;

        // 1. Notifica o criador do evento (se não for o próprio decider)
        if (eventCreatorId && eventCreatorId !== user?.id) {
            await pb.collection('agenda_cap53_notifications').create({
                user: eventCreatorId,
                title: `Transporte ${action === 'approved' ? 'Confirmado' : 'Recusado'}`,
                message: message,
                type: action === 'rejected' ? 'refusal' : 'transport_decision',
                read: false,
                event: eventId,
                data: {
                    kind: 'transport_decision',
                    action: action === 'approved' ? 'confirmed' : 'rejected',
                    justification: justification,
                    event_title: eventTitle,
                    status: action === 'approved' ? 'confirmed' : 'rejected',
                    approved_by: action === 'approved' ? user?.id : undefined,
                    approved_by_name: action === 'approved' ? user?.name : undefined,
                    rejected_by: action === 'rejected' ? user?.id : undefined,
                    rejected_by_name: action === 'rejected' ? user?.name : undefined
                },
                acknowledged: false
            });
        }

        // 2. Cópia para o decider (para histórico) - APENAS se não for o criador do evento (evita duplicação)
        if (user?.id && user.id !== eventCreatorId) {
            await pb.collection('agenda_cap53_notifications').create({
                user: user.id,
                title: `Transporte ${action === 'approved' ? 'Confirmado' : 'Recusada'}`,
                message: `Você ${action === 'approved' ? 'confirmou' : 'recusou'} o transporte para o evento "${eventTitle}".${action === 'rejected' && justification ? ` Motivo: ${justification}` : ''}`,
                type: action === 'rejected' ? 'refusal' : 'transport_decision',
                read: true,
                event: eventId,
                data: {
                    kind: 'transport_decision',
                    action: action === 'approved' ? 'confirmed' : 'rejected',
                    justification: justification,
                    is_decider_copy: true,
                    event_title: eventTitle,
                    status: action === 'approved' ? 'confirmed' : 'rejected',
                    approved_by: action === 'approved' ? user?.id : undefined,
                    approved_by_name: action === 'approved' ? user?.name : undefined,
                    rejected_by: action === 'rejected' ? user?.id : undefined,
                    rejected_by_name: action === 'rejected' ? user?.name : undefined
                },
                acknowledged: true
            });
        }
      }
      // 3. CASO: Convite de Evento (Aceitar/Recusar)
      else if (notification.type === 'event_invite') {
        const eventId = notification.event;
        if (!eventId) {
            console.error('handleDecision: eventId is missing for event_invite');
            throw new Error('ID do evento não encontrado.');
        }

        // Atualiza status do participante
        const participants = await pb.collection('agenda_cap53_participantes').getFullList({
            filter: `event = "${eventId}" && user = "${user?.id}"`
        });

        if (participants.length > 0) {
            await pb.collection('agenda_cap53_participantes').update(participants[0].id, {
                status: action === 'accepted' ? 'accepted' : 'rejected'
            });
        } else if (action === 'accepted') {
            await pb.collection('agenda_cap53_participantes').create({
                event: eventId,
                user: user?.id,
                status: 'accepted',
                role: 'PARTICIPANTE'
            });
        }

        // Se recusou, cria notificação de recusa para o organizador
        if (action === 'rejected') {
            const event = await pb.collection('agenda_cap53_eventos').getOne(eventId, { expand: 'user' });
            const organizerId = event.expand?.user?.id || event.user;
            
            if (organizerId && organizerId !== user?.id) {
                await pb.collection('agenda_cap53_notifications').create({
                    user: organizerId,
                    title: 'Convite Recusado',
                    message: `${user?.name} recusou o convite para o evento "${event.title}".${justification ? ` Motivo: ${justification}` : ''}`,
                    type: 'refusal',
                    read: false,
                    event: eventId,
                    data: {
                        kind: 'event_invite_response',
                        action: 'rejected',
                        guest_id: user?.id,
                        guest_name: user?.name,
                        justification: justification,
                        event_title: event.title
                    },
                    acknowledged: false
                });
            }
        }
      }

      // Marca a notificação original como lida após a decisão
      await markAsRead(notification.id);
      
      // Refresh local
      await refreshNotifications();

    } catch (error) {
      console.error('Error in handleDecision:', error);
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
