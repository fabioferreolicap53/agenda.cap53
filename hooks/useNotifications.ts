import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { NotificationRecord } from '../lib/notifications';
import { useNotificationActions } from './useNotificationActions';

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Execute requests independently to prevent one failure from breaking all
      const [notifResult, almcResult, traResult] = await Promise.all([
        pb.collection('agenda_cap53_notifications').getList<NotificationRecord>(1, 50, {
          filter: `user = "${user.id}"`,
          sort: '-created',
          expand: 'event,related_request,related_request.item,related_request.created_by,event.user'
        }).catch(err => {
          console.error('Error fetching notifications list:', err);
          return { items: [], totalItems: 0 };
        }),
        (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') 
          ? pb.collection('agenda_cap53_almac_requests').getList(1, 50, { 
              filter: `status = "pending"${
                user.role === 'ALMC' ? ' && (item.category = "ALMOXARIFADO" || item.category = "COPA")' :
                user.role === 'DCA' ? ' && item.category = "INFORMATICA"' :
                ''
              }`,
              expand: 'event,item,created_by,event.user',
              $autoCancel: false // Disable auto-cancel to prevent abort errors during rapid updates
            }).catch(err => {
              console.error('Error fetching almac requests:', err);
              return { items: [], totalItems: 0 };
            })
          : Promise.resolve({ items: [], totalItems: 0 }),
        (user.role === 'TRA' || user.role === 'ADMIN')
          ? pb.collection('agenda_cap53_eventos').getList(1, 50, { 
              filter: 'transporte_suporte = true && transporte_status = "pending"', 
              expand: 'user',
              $autoCancel: false
            }).catch(err => {
              console.error('Error fetching transport requests:', err);
              return { items: [], totalItems: 0 };
            })
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
            event_title: req.expand?.event?.title,
            justification: req.justification
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
            destino: evt.transporte_destino,
            event_title: evt.title,
            horario_levar: evt.transporte_horario_levar,
            horario_buscar: evt.transporte_horario_buscar,
            qtd_pessoas: evt.transporte_qtd_pessoas,
            justification: evt.transporte_justification
          },
          acknowledged: false,
          expand: { event: evt }
        }));

      const allNotifications = [
        ...notifResult.items,
        ...almcNotifications,
        ...traNotifications
      ].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      setNotifications(allNotifications);
      
      // The badge count is the sum of unread system notifications + pending administrative requests
      const systemUnread = notifResult.items.filter(n => !n.read).length;
      const almcCount = almcResult?.items?.length || 0;
      const traCount = traResult?.items?.length || 0;
      setUnreadCount(systemUnread + almcCount + traCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  // Use actions hook
  const {
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearHistory,
    clearAllNotifications,
    handleDecision
  } = useNotificationActions(notifications, setNotifications, setUnreadCount, fetchNotifications);

  useEffect(() => {
    fetchNotifications();

    if (!user?.id) return;

    const subscribe = async () => {
      const unsubs: (() => void)[] = [];
      
      const u1 = await pb.collection('agenda_cap53_notifications').subscribe<NotificationRecord>('*', (e) => {
         // Verifica se a notificação é para o usuário atual
         if (e.record.user === user.id) {
           // Sempre recarrega a lista completa para garantir que temos os dados expandidos (relacionamentos)
           // O evento realtime 'create'/'update' não traz os campos expandidos, o que causava notificações "vazias" ou erros
           fetchNotifications();
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

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearHistory,
    clearAllNotifications,
    handleDecision,
    refresh: fetchNotifications
  };
};
