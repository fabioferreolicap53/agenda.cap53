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
          expand: 'event,related_event,related_request,related_request.item,related_request.created_by,event.user',
          $autoCancel: false
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
          : Promise.resolve({ items: [], totalItems: 0 })
      ]);

      // Map pending requests for easy access
      const pendingRequestsMap = new Map((almcResult?.items || []).map(r => [r.id, r]));
      const handledRequestIds = new Set<string>();

      // 1. Enrich existing notifications if they match a pending request
      // This ensures we show buttons even if the persisted notification is incomplete,
      // while preserving the 'read' status.
      const enrichedNotifications: any[] = [];
      const seenEnrichedRequests = new Set<string>();

      notifResult.items.forEach(n => {
          let finalNotif = n;
          
          if (n.related_request && pendingRequestsMap.has(n.related_request)) {
              const req = pendingRequestsMap.get(n.related_request)!;
              handledRequestIds.add(n.related_request);
              
              // Force actionable state for pending requests
              finalNotif = {
                  ...n,
                  type: 'almc_item_request', // Ensure type matches for buttons logic
                  invite_status: 'pending',   // Ensure status matches for buttons logic
                  expand: {
                      ...n.expand,
                      related_request: req, // Ensure we have the latest request data
                  }
              };
          }

          // Deduplicate: If it's a request type, only keep the first occurrence (latest)
          if (finalNotif.related_request && (finalNotif.type === 'almc_item_request' || finalNotif.type === 'transport_request' || finalNotif.type === 'service_request')) {
              if (seenEnrichedRequests.has(finalNotif.related_request)) {
                  return; // Skip duplicate
              }
              seenEnrichedRequests.add(finalNotif.related_request);
          }

          enrichedNotifications.push(finalNotif);
      });
      
      // Geração de Histórico Sintético (Chain of Events)
      // Cria notificações de "Origem" (ex: "Solicitação Enviada") para itens que já têm decisão,
      // permitindo a visualização em cadeia.
      const historyNotifications: any[] = [];
      const processedHistory = new Set<string>();

      enrichedNotifications.forEach(n => {
          // 1. Histórico para Itens (Almoxarifado/DCA)
          // Só gera histórico se NÃO for uma solicitação pendente que já tem botões de ação
          // Se for uma notificação de "request" real (tipo almc_item_request), ela já é a própria solicitação
          if (n.related_request && n.expand?.related_request && !processedHistory.has(n.related_request)) {
              const req = n.expand.related_request;
              const isPending = req.status === 'pending';
              
              // Regra: Se a notificação atual (n) já é do tipo request, não cria histórico duplicado.
              if (n.type !== 'almc_item_request' && n.type !== 'transport_request') {
                   // Verifica se já existe uma notificação de "request" explícita na lista principal
                   const hasExplicitRequest = enrichedNotifications.some(other => 
                       (other.type === 'almc_item_request' || other.type === 'transport_request') && 
                       other.related_request === n.related_request
                   );

                   if (!hasExplicitRequest && !isPending) {
                      historyNotifications.push({
                          id: `hist_${req.id}`,
                          collectionId: 'virtual_history',
                          collectionName: 'virtual_history',
                          created: req.created,
                          updated: req.created,
                          user: user.id,
                          title: 'Solicitação Enviada',
                          message: `Solicitação de ${req.expand?.item?.name || 'Item'} enviada para análise.`,
                          type: 'history_log',
                          read: true, // Histórico nasce lido
                          related_request: req.id,
                          event: n.event,
                          expand: {
                            event: n.expand?.event,
                            related_request: req
                          },
                          data: {
                              icon: 'send',
                              is_history: true
                          }
                      });
                      processedHistory.add(n.related_request);
                   }
              }
          }

          // 2. Histórico para Transporte
          if ((n.type === 'transport_decision' || n.type === 'transport_request') && n.event && n.expand?.event && !processedHistory.has(`trans_${n.event}`)) {
               const evt = n.expand.event;
               // Evita duplicar se já estamos processando um transport_request real
               // Mas se for decision, queremos ver o "Solicitado" antes.
               // Se n.type for transport_request, ele JÁ É o solicitado.
               if (n.type === 'transport_decision') {
                   // Verifica se tem um request real na lista
                   const hasRealRequest = enrichedNotifications.some(other => other.type === 'transport_request' && other.event === n.event);
                   
                   if (!hasRealRequest) {
                       historyNotifications.push({
                          id: `hist_trans_${n.event}`,
                          collectionId: 'virtual_history',
                          collectionName: 'virtual_history',
                          created: evt.created, // Proxy: data do evento
                          updated: evt.created,
                          user: user.id,
                          title: 'Transporte Solicitado',
                          message: `Solicitação de transporte iniciada com o evento.`,
                          type: 'history_log',
                          read: true,
                          event: n.event,
                          expand: { event: evt },
                          data: { icon: 'local_shipping', is_history: true }
                       });
                       processedHistory.add(`trans_${n.event}`);
                   }
               }
          }
      });

      let ignored: string[] = [];
      try {
          ignored = JSON.parse(localStorage.getItem('ignored_notifications') || '[]');
      } catch (e) {
          console.error('Error reading ignored notifications:', e);
      }

      const almcNotifications = (almcResult?.items || [])
        .filter(req => !handledRequestIds.has(req.id) && !ignored.includes(`req_${req.id}`))
        .map(req => ({
          id: `req_${req.id}`,
          collectionId: 'virtual',
          collectionName: 'virtual',
          created: req.created,
          updated: req.updated,
          user: user.id,
          title: req.expand?.item?.name ? `Solicitação: ${req.expand.item.name}` : 'Solicitação em Análise',
          message: `Aguardando aprovação para o evento "${req.expand?.event?.title || 'Evento'}"`,
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

      const allNotifications = [
        ...enrichedNotifications,
        ...almcNotifications,
        ...historyNotifications
      ].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      setNotifications(allNotifications);
      
      // The badge count should reflect the actual unread items in the list
      const unreadTotal = allNotifications.filter(n => !n.read).length;
      setUnreadCount(unreadTotal);
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

    // Fallback: Polling a cada 10 segundos para garantir atualização mesmo se o Realtime (502) falhar
    const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') { // Só atualiza se a aba estiver visível para economizar recurso
            fetchNotifications();
        }
    }, 10000);

    if (!user?.id) {
        clearInterval(intervalId);
        return;
    }

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
      clearInterval(intervalId); // Limpa o polling
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
