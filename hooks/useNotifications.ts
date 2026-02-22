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
          expand: 'event,related_event,related_request,related_request.item,related_request.created_by,related_request.event,event.user',
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
          : pb.collection('agenda_cap53_almac_requests').getList(1, 50, {
              filter: `created_by = "${user.id}" && status = "pending"`,
              expand: 'event,item,created_by,event.user',
              $autoCancel: false
            }).catch(err => {
              console.error('Error fetching user requests:', err);
              return { items: [], totalItems: 0 };
            }),
        // Fetch pending transport requests (events) for the user
        pb.collection('agenda_cap53_eventos').getList(1, 50, {
          filter: `user = "${user.id}" && transporte_status = "pending"`,
          expand: 'user',
          $autoCancel: false
        }).catch(err => {
          console.error('Error fetching transport requests:', err);
          return { items: [], totalItems: 0 };
        })
      ]);

      // Map pending requests for easy access
      const pendingRequestsMap = new Map((almcResult?.items || []).map(r => [r.id, r]));
      const pendingTransportMap = new Map((traResult?.items || []).map(e => [e.id, e]));
      const handledRequestIds = new Set<string>();

      // 0. Hydrate missing request data (specifically history) for non-pending requests
      // This fixes the issue where "Sector Rejection" notifications might have incomplete expanded data
      // or missing history, causing the history chain to disappear.
      const hydrationMap = new Map<string, any>();
      const requestsToHydrate: Record<string, Set<string>> = {};

      notifResult.items.forEach(n => {
        if (n.related_request && !pendingRequestsMap.has(n.related_request)) {
          // Check if history is missing in the expanded object
          const expandedReq = n.expand?.related_request;
          const history = expandedReq && (Array.isArray(expandedReq) ? expandedReq[0]?.history : expandedReq?.history);
          
          // Refined Hydration Logic:
          // If it's a decision/refusal/re-request, we EXPECT history to be present (length > 0).
          // If history is empty array or undefined, we must hydrate.
          const isDecisionOrRefusal = n.type === 'refusal' || 
                                      n.type === 'request_decision' || 
                                      n.type === 'transport_decision' ||
                                      (n.title && (n.title.toLowerCase().includes('recusad') || n.title.toLowerCase().includes('rejeitad') || n.title.toLowerCase().includes('reaberta')));

          const hasValidHistory = history && Array.isArray(history) && history.length > 0;
          
          if (!hasValidHistory && isDecisionOrRefusal) {
             // Determine collection from data
             let collection = '';
             if (n.data && typeof n.data === 'object') {
                 // data can be JSON object or string in some versions, but SDK usually returns object if JSON field
                 const dataObj = n.data as any;
                 collection = dataObj.collection || dataObj.collectionName;
             }
             
             // Fallback inference if collection not in data
             if (!collection) {
                 if (n.type === 'almc_item_request' || n.type === 'request_decision' || n.type === 'refusal') {
                      // Default to almac requests for these types
                      collection = 'agenda_cap53_almac_requests';
                 }
             }

             if (collection) {
                 if (!requestsToHydrate[collection]) requestsToHydrate[collection] = new Set();
                 requestsToHydrate[collection].add(n.related_request);
             }
          }
        }

        // Check for Transport History missing
        if (n.event && !pendingTransportMap.has(n.event)) {
             const expandedEvt = n.expand?.event;
             const transportHistory = expandedEvt && (Array.isArray(expandedEvt) ? expandedEvt[0]?.transport_history : expandedEvt?.transport_history);
             
             const isTransportDecision = n.type === 'transport_decision' || (n.title && /transporte/i.test(n.title));
             const hasValidTransportHistory = transportHistory && Array.isArray(transportHistory) && transportHistory.length > 0;

             if (!hasValidTransportHistory && isTransportDecision) {
                 if (!requestsToHydrate['agenda_cap53_eventos']) requestsToHydrate['agenda_cap53_eventos'] = new Set();
                 requestsToHydrate['agenda_cap53_eventos'].add(n.event);
             }
        }
      });

      // Execute hydration fetches
      await Promise.all(Object.entries(requestsToHydrate).map(async ([collection, ids]) => {
          if (ids.size === 0) return;
          try {
              const filter = Array.from(ids).map(id => `id="${id}"`).join('||');
              const res = await pb.collection(collection).getList(1, ids.size, {
                  filter: `(${filter})`,
                  expand: 'event,item,created_by,event.user',
                  $autoCancel: false
              });
              res.items.forEach(item => hydrationMap.set(item.id, item));
          } catch (e) {
              console.error(`Error hydrating requests from ${collection}:`, e);
          }
      }));

      // 1. Enrich existing notifications if they match a pending request
      // This ensures we show buttons even if the persisted notification is incomplete,
      // while preserving the 'read' status.
      const enrichedNotifications: any[] = [];
      const seenEnrichedRequests = new Set<string>(); // Use Set to track unique notification IDs

      notifResult.items.forEach(n => {
        // FILTER: Remove duplicate rejection notifications generated by server hook (Pattern: "Item: Rejeitada")
        // We prefer the "Solicitação Recusada" format.
        // if (n.title && /.+:\s*Rejeitada$/i.test(n.title)) {
        //   return;
        // }

        let finalNotif = n;
          
          if (n.related_request && pendingRequestsMap.has(n.related_request)) {
              const req = pendingRequestsMap.get(n.related_request)!;
              handledRequestIds.add(n.related_request);
              
              // Check if it's a refusal notification
              const isRefusal = n.type === 'refusal' || 
                              (n.title && (n.title.toLowerCase().includes('recusad') || n.title.toLowerCase().includes('rejeitad') || n.title.toLowerCase().includes('reaberta')));

              if (isRefusal) {
                  // If it's a refusal, we want to keep it as a refusal visually so we can show the "Your Response" block,
                  // but we MUST update the related_request data to access the new justification.
                  finalNotif = {
                      ...n,
                      expand: {
                          ...n.expand,
                          related_request: req,
                      }
                  };
              } else {
                  // For other notifications (like old pending ones), force the current pending state
                  // to ensure actionable buttons appear if applicable.
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
          }
          // Hydrate from explicitly fetched map if available (for rejected/approved requests with missing history)
          else if (n.related_request && hydrationMap.has(n.related_request)) {
               const req = hydrationMap.get(n.related_request);
               finalNotif = {
                   ...n,
                   expand: {
                       ...n.expand,
                       related_request: req
                   }
               };
          }
          // Also update related_request data for non-pending requests if available in expand
          // This is crucial for retrieving the justification from the request object
          else if (n.expand?.related_request) {
               // Ensure we are using the most up-to-date request object from the notification expand
               finalNotif = {
                   ...n,
                   expand: {
                       ...n.expand,
                       related_request: n.expand.related_request
                   }
               };
          }

          // ENRICHMENT FOR TRANSPORT REQUESTS
          // Checks if the event associated with this notification has a pending transport status
          // This allows us to show the user's re-request justification
          if (n.event && pendingTransportMap.has(n.event)) {
              const evt = pendingTransportMap.get(n.event)!;
              
              finalNotif = {
                  ...finalNotif,
                  expand: {
                      ...finalNotif.expand,
                      event: evt, // Inject updated event data (with pending status and justification)
                      related_event: evt // Ensure fallback compatibility
                  }
              };
          } else if (n.event && hydrationMap.has(n.event)) {
               const evt = hydrationMap.get(n.event);
               finalNotif = {
                   ...finalNotif,
                   expand: {
                       ...finalNotif.expand,
                       event: evt,
                       related_event: evt
                   }
               };
          }

          // Restore Full History Chain:
          // We allow all notifications to pass through to create a complete timeline of events.
          // (Request -> Rejection -> Re-request -> Approval)
          // The grouping logic in Notifications.tsx will handle the visual stacking.
          // We only prevent EXACT duplicate records (same ID).
          
          if (!seenEnrichedRequests.has(finalNotif.id)) {
              enrichedNotifications.push(finalNotif);
              seenEnrichedRequests.add(finalNotif.id);
          }
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
      let readVirtual: string[] = [];
      try {
          ignored = JSON.parse(localStorage.getItem('ignored_notifications') || '[]');
          readVirtual = JSON.parse(localStorage.getItem('virtual_notifications_read') || '[]');
      } catch (e) {
          console.error('Error reading local storage notifications:', e);
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
          read: readVirtual.includes(`req_${req.id}`),
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
      
      // Helper function to get data from notification (same logic as in Notifications.tsx)
      const getData = (n: any): any => {
          let result: any = {};
          if (n.data && Object.keys(n.data).length > 0) {
              result = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
          }
          else if (n.meta) {
              try {
                  result = typeof n.meta === 'string' ? JSON.parse(n.meta) : n.meta;
              } catch (e) {
                  result = {};
              }
          }
          return result || {};
      };

      // Group notifications logic (mirrors Notifications.tsx)
      const groups = new Map<string, NotificationRecord[]>();
      const singles: NotificationRecord[] = [];

      allNotifications.forEach(n => {
          let key = null;
          
          // 1. Group by related_request
          if (n.related_request) {
              key = n.related_request;
          } 
          // 2. Group Transport events
          else if ((n.type === 'transport_request' || n.type === 'transport_decision' || (n.type === 'history_log' && getData(n).icon === 'local_shipping')) && n.event) {
              key = `transport_${n.event}`;
          }
          
          if (key) {
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)?.push(n);
          } else {
              singles.push(n);
          }
      });

      let unreadTotal = 0;

      // Count unread from groups (only check the latest one)
      groups.forEach(items => {
          // Items are sorted by date desc because allNotifications is sorted
          const latest = items[0];
          if (latest && !latest.read) {
              unreadTotal++;
          }
      });

      // Count unread from singles
      singles.forEach(n => {
          if (!n.read) unreadTotal++;
      });

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
