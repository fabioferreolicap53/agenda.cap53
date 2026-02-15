import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { NotificationRecord } from '../lib/notifications';
import { debugLog } from '../src/lib/debug';
import { useNotificationActions } from './useNotificationActions';

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
          expand: 'event,related_request,related_request.item,related_request.created_by,event.user'
        }),
        (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') 
          ? pb.collection('agenda_cap53_almac_requests').getList(1, 50, { 
              filter: `status = "pending"${
                user.role === 'ALMC' ? ' && (item.category = "ALMOXARIFADO" || item.category = "COPA")' :
                user.role === 'DCA' ? ' && item.category = "INFORMATICA"' :
                ''
              }`,
              expand: 'event,item,created_by,event.user'
            })
          : Promise.resolve({ items: [], totalItems: 0 }),
        (user.role === 'TRA' || user.role === 'ADMIN')
          ? pb.collection('agenda_cap53_eventos').getList(1, 50, { filter: 'transporte_suporte = true && transporte_status = "pending"', expand: 'user' })
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
            destino: evt.transporte_destino,
            event_title: evt.title,
            horario_levar: evt.transporte_horario_levar,
            horario_buscar: evt.transporte_horario_buscar,
            qtd_pessoas: evt.transporte_qtd_pessoas
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

  // Use actions hook
  const {
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearHistory,
    handleDecision
  } = useNotificationActions(notifications, setNotifications, setUnreadCount, fetchNotifications);

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
