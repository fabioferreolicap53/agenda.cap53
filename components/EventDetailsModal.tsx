import React from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { notificationService } from '../lib/notifications';
import EventChatModal from './EventChatModal';
import ReRequestModal from './ReRequestModal';
import CustomSelect from './CustomSelect';
import { INVOLVEMENT_LEVELS } from '../lib/constants';

interface EventDetailsModalProps {
  event: any;
  onClose: () => void;
  onCancel: (id: string, title: string, participants: string[]) => void;
  onDelete: (event: any) => void;
  user: any;
  initialChatOpen?: boolean;
  initialTab?: 'details' | 'dashboard' | 'transport' | 'resources' | 'professionals' | 'requests';
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({ event: initialEvent, onClose, onCancel, onDelete, user, initialChatOpen = false, initialTab = 'details' }) => {
  const navigate = useNavigate();
  const [event, setEvent] = React.useState(initialEvent);
  const [requests, setRequests] = React.useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = React.useState(false);
  const [eventParticipationRequests, setEventParticipationRequests] = React.useState<any[]>([]);
  const [hasRequestedParticipation, setHasRequestedParticipation] = React.useState(false);
  const [refusalAckByRequest, setRefusalAckByRequest] = React.useState<Record<string, boolean>>({});
  const [transportRefusalAck, setTransportRefusalAck] = React.useState<boolean | null>(null);
  const [participantStatus, setParticipantStatus] = React.useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = React.useState<'details' | 'dashboard' | 'transport' | 'resources' | 'professionals' | 'requests'>(initialTab);
  const [isChatOpen, setIsChatOpen] = React.useState(initialChatOpen);
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [requestMessage, setRequestMessage] = React.useState('');
  const [showRequestForm, setShowRequestForm] = React.useState(false);
  const [requestRoles, setRequestRoles] = React.useState<Record<string, string>>({});
  const [messageCount, setMessageCount] = React.useState(0);
  const [reRequestTarget, setReRequestTarget] = React.useState<{type: 'item' | 'transport', data: any} | null>(null);

  const getRoleLabel = (role: string) => {
    return INVOLVEMENT_LEVELS.find(l => l.value === (role || 'PARTICIPANTE').toUpperCase())?.label || 'PARTICIPANTE';
  };

  const renderParticipantRow = (p: any) => {
    const isCreator = event.user === p.id;
    const status = isCreator ? 'accepted' : (participantStatus[p.id] || 'pending');
    const role = isCreator ? (event.creator_role || (event.participants_roles && event.participants_roles[p.id])) : (event.participants_roles && event.participants_roles[p.id]);

    return (
      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-cover bg-center border border-gray-100" style={{ backgroundImage: `url(${p.avatar ? pb.files.getUrl(p, p.avatar) : `https://picsum.photos/seed/${p.email}/200`})` }} />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-text-main">{p.name || 'Convidado'}</span>
              {isCreator && (
                <span className="text-[8px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">CRIADOR</span>
              )}
            </div>
            <span className="text-[10px] text-text-secondary">{getRoleLabel(role)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
            status === 'accepted' ? 'bg-green-100 text-green-700' :
            status === 'rejected' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {status === 'accepted' ? 'Confirmado' : status === 'rejected' ? 'Recusado' : 'Pendente'}
          </span>
        </div>
      </div>
    );
  };
  
  const isCancelled = event.status === 'cancelled';

  // Fetch participation requests
  const fetchParticipationRequests = async () => {
      try {
          const res = await pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
              filter: `event = "${event.id}"`,
              expand: 'user',
              sort: '-created'
          });
          setEventParticipationRequests(res);
          
          // Check if current user already has a pending request
          const myRequest = res.find(r => r.user === user?.id && r.status === 'pending');
          setHasRequestedParticipation(!!myRequest);
      } catch (err) {
          console.error('Error fetching participation requests:', err);
      }
  };

  const fetchMessageCount = async () => {
    if (!event?.id) return;
    try {
        const room = await pb.collection('agenda_cap53_salas_batepapo').getFirstListItem(`event = "${event.id}"`);
        if (room) {
            const messages = await pb.collection('agenda_cap53_mensagens_salas').getList(1, 1, {
                filter: `room = "${room.id}"`,
                fields: 'id',
                requestKey: null
            });
            setMessageCount(messages.totalItems);
        } else {
            setMessageCount(0);
        }
    } catch (err) {
        setMessageCount(0);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
      try {
          const request = eventParticipationRequests.find(r => r.id === requestId);
          if (!request) return;

          const selectedRole = requestRoles[requestId] || 'PARTICIPANTE';

          // 1. Update request status
          await pb.collection('agenda_cap53_solicitacoes_evento').update(requestId, {
              status: action === 'approve' ? 'approved' : 'rejected'
          });

          // 2. If approved, add user to event participants
          if (action === 'approve') {
              const currentParticipants = event.participants || [];
              const currentStatus = event.participants_status || {};
              const currentRoles = event.participants_roles || {};
              
              if (!currentParticipants.includes(request.user)) {
                  const updatedParticipants = [...currentParticipants, request.user];
                  // Update local event status map (for immediate UI update if still relying on it partially)
                  const updatedStatus = { ...currentStatus, [request.user]: 'accepted' };
                  const updatedRoles = { ...currentRoles, [request.user]: selectedRole };
                  
                  // Update event record
                  await pb.collection('agenda_cap53_eventos').update(event.id, {
                      participants: updatedParticipants,
                      participants_status: updatedStatus,
                      participants_roles: updatedRoles
                  });

                  // Check if participant record exists before creating
                  const existingParticipant = await pb.collection('agenda_cap53_participantes').getList(1, 1, {
                      filter: `event = "${event.id}" && user = "${request.user}"`,
                      requestKey: null
                  });

                  if (existingParticipant.items.length > 0) {
                      await pb.collection('agenda_cap53_participantes').update(existingParticipant.items[0].id, {
                          status: 'accepted',
                          role: selectedRole
                      });
                  } else {
                      await pb.collection('agenda_cap53_participantes').create({
                          event: event.id,
                          user: request.user,
                          status: 'accepted', // Auto-accept since they requested it
                          role: selectedRole
                      });
                  }
                  
                  // Force update local state map
                  setParticipantStatus(prev => ({
                      ...prev,
                      [request.user]: 'accepted'
                  }));
              }
          }

          // 3. Notify user
          const originalMessage = request.message;
          await notificationService.createNotification({
              user: request.user,
              title: action === 'approve' ? 'Solicitação Aprovada' : 'Solicitação Recusada',
              message: action === 'approve' 
                  ? `Sua solicitação para participar do evento "${event.title}" foi aprovada!${originalMessage ? `\n\nSua mensagem: "${originalMessage}"` : ''}`
                  : `Sua solicitação para participar do evento "${event.title}" foi recusada pelo criador.${originalMessage ? `\n\nSua mensagem: "${originalMessage}"` : ''}`,
              type: action === 'approve' ? 'event_invite' : 'system',
              event: event.id,
              data: {
                  kind: 'participation_request_response',
                  action: action === 'approve' ? 'accepted' : 'rejected',
                  role: action === 'approve' ? selectedRole : undefined,
                  requester_message: originalMessage,
                  original_message: originalMessage
              }
          });

          // 4. Update the Creator's Notification
          try {
              // Find the notification that prompted this action
              // We look for notifications of type 'event_participation_request' for this event
              // where the requester matches the user we are approving/rejecting
              // The user.id here is the current user (the creator responding)
              const notifications = await pb.collection('agenda_cap53_notifications').getFullList({
                  filter: `event = "${event.id}" && type = "event_participation_request" && user = "${user.id}"`,
                  requestKey: null
              });

              // We need to check 'data' to find the matching requester_id
              const targetNotification = notifications.find(n => {
                  const data = n.data || {};
                  // The data field stores requester_id as string
                  return data.requester_id === request.user;
              });

              if (targetNotification) {
                   await pb.collection('agenda_cap53_notifications').update(targetNotification.id, {
                       invite_status: action === 'approve' ? 'accepted' : 'rejected',
                       read: true
                   });
              }
          } catch (notifErr) {
              console.warn('Error syncing creator notification:', notifErr);
          }

          // 5. Refresh data
          fetchParticipationRequests();
          // Refresh event to show new participant
          const freshEvent = await pb.collection('agenda_cap53_eventos').getOne(event.id, {
              expand: 'user,location,participants'
          });
          setEvent(freshEvent);

          alert(action === 'approve' ? 'Solicitação aprovada com sucesso!' : 'Solicitação recusada.');
      } catch (err) {
          console.error('Error handling request action:', err);
          alert('Erro ao processar ação.');
      }
  };

  const handleRequestParticipation = async () => {
    if (!user) return;
    
    // Verifica se o evento é restrito
    if (event.is_restricted) {
      alert('Este evento é restrito e não permite novas solicitações de participação.');
      return;
    }

    // Safety check for restricted roles
    if (['TRA', 'ALMC', 'DCA', 'CE'].includes(user.role)) {
      alert('Seu perfil não possui permissão para solicitar participação em eventos.');
      return;
    }

    setIsRequesting(true);
    try {
      await pb.collection('agenda_cap53_solicitacoes_evento').create({
        event: event.id,
        user: user.id,
        status: 'pending',
        message: requestMessage
      });

      // Notify creator
      if (event.user) {
        await notificationService.createNotification({
          user: event.user,
          title: 'Nova Solicitação de Participação',
          message: `${user.name} deseja participar do seu evento "${event.title}".${requestMessage ? `\n\nMensagem: "${requestMessage}"` : ''}`,
          type: 'event_participation_request',
          event: event.id,
          data: {
            kind: 'participation_request',
            requester_id: user.id,
            requester_name: user.name,
            requester_message: requestMessage
          }
        });
      }

      await fetchParticipationRequests();
      setShowRequestForm(false);
      setRequestMessage('');
      alert('Solicitação enviada com sucesso! Aguarde a aprovação do criador.');
    } catch (err) {
      console.error('Error requesting participation:', err);
      alert('Erro ao enviar solicitação.');
    } finally {
      setIsRequesting(false);
    }
  };

  // Cancellation restricted to the creator only
  const canCancel = !isCancelled && (event.user === user?.id);
  // Ensure ALMC cannot edit even if they created the event (though they shouldn't be able to create)
  // CE role also restricted to edit only their own events
  const canEdit = !isCancelled && user?.role !== 'ALMC' && (user?.role === 'ADMIN' || event.user === user?.id);
  const startDate = new Date(event.date_start || event.date);
  const endDate = new Date(event.date_end);

  const refreshEvent = async () => {
    if (!event?.id) return;
    try {
        // Fetch the freshest version of the event
        const freshEvent = await pb.collection('agenda_cap53_eventos').getOne(event.id, {
            expand: 'user,location,participants'
        });
        setEvent(freshEvent);
        
        // Refresh science statuses (refusals and acknowledgments)
        pb.collection('agenda_cap53_notifications').getFullList({
            filter: `event = "${event.id}" && (type = "refusal" || type = "acknowledgment" || type = "system")`,
            requestKey: null
        })
        .then((notifs: any[]) => {
            const map: Record<string, boolean> = {};
            let transportAck: boolean | null = null;
            
            notifs.forEach((n: any) => {
                const isAck = n.type === 'acknowledgment';
                const isRefusal = n.type === 'refusal';
                const isSystem = n.type === 'system';
                const title = (n.title || '').toLowerCase();
                const kind = (n.data?.kind || '').toLowerCase();
                const message = (n.message || '').toLowerCase();
                
                // For the creator viewing the event: 
                // They want to know if they have acknowledged the refusal.
                // For the sector user (TRA/ALMC/DCA) viewing the event:
                // They want to know if the creator has acknowledged their decision.
                
                // A notification indicates science was given if:
                // 1. It's a refusal and it's marked as acknowledged (creator saw it)
                // 2. It's an acknowledgment notification (exists because creator clicked "CIENTE")
                // 3. It's a system notification for confirmation (automatically acknowledged in many cases)
                const scienceGiven = !!n.acknowledged || isAck;

                const isTransportRelated = 
                    kind.includes('transport') || 
                    title.includes('transporte') || 
                    message.includes('transporte');

                if (n.related_request) {
                    if (scienceGiven) {
                        map[n.related_request] = true;
                    } else if (map[n.related_request] === undefined && isRefusal) {
                        map[n.related_request] = false;
                    }
                } else if (isTransportRelated) {
                    if (scienceGiven) {
                        transportAck = true;
                    } else if (transportAck === null && isRefusal) {
                        transportAck = false;
                    }
                }
            });
            setRefusalAckByRequest(map);
            setTransportRefusalAck(transportAck);
        })
        .catch(() => {});
        
        // NEW SYSTEM: Fetch statuses from the dedicated collection
        const participantsRes = await pb.collection('agenda_cap53_participantes').getFullList({
            filter: `event = "${event.id}"`,
            requestKey: null
        });
        
        // Merge logic: Start with legacy JSON map as base, then overwrite with relational data
        // Prioritize the participants collection data as it is the new source of truth
        const statusMap: Record<string, string> = { ...(freshEvent.participants_status || {}) };
        
        // Also make sure to check if current user is in participants list but has no record in participants collection
        // This handles migration or edge cases where they were added via legacy methods
        const participants = freshEvent.participants || [];
        participants.forEach((pId: string) => {
             if (!statusMap[pId]) statusMap[pId] = 'pending';
        });

        participantsRes.forEach(p => {
            statusMap[p.user] = p.status;
        });
        
        setParticipantStatus(statusMap);
        
        // Also refresh message count
        await fetchMessageCount();
    } catch (err: any) {
        if (err.status !== 404) {
          console.error('Error refreshing event details:', err);
        }
        setParticipantStatus(event.participants_status || {});
    }
  };

  const handleInvitationResponse = async (status: 'accepted' | 'rejected') => {
    if (!event?.id || !user?.id) return;

    try {
      // 1. Source of Truth: Update or Create Participant Record
      // This is the critical operation. If it fails, the whole process fails.
      const participantsRes = await pb.collection('agenda_cap53_participantes').getList(1, 1, {
        filter: `event = "${event.id}" && user = "${user.id}"`,
        requestKey: null
      });

      if (participantsRes.items.length > 0) {
        const participantRecord = participantsRes.items[0];
        await pb.collection('agenda_cap53_participantes').update(participantRecord.id, {
          status: status
        });
      } else {
        await pb.collection('agenda_cap53_participantes').create({
          event: event.id,
          user: user.id,
          status: status
        });
      }
      
      // 2. Update Notifications (Secondary Operation)
      // We attempt to update notifications, but if it fails (e.g. not found), we don't block the user.
      try {
        const notifications = await pb.collection('agenda_cap53_notifications').getFullList({
          filter: `event = "${event.id}" && user = "${user.id}" && type = "event_invite"`,
          requestKey: null
        });
        
        if (notifications.length > 0) {
          await Promise.all(notifications.map(n => 
            pb.collection('agenda_cap53_notifications').update(n.id, {
              invite_status: status,
              read: true
            }).catch(e => console.warn('Failed to update individual notification:', e))
          ));
        }
      } catch (notifErr) {
        console.warn('Error fetching/updating notifications:', notifErr);
      }

      // 3. Sync with event record's JSON status field (Optimization)
      // This might fail if the user is not the creator/admin due to API rules.
      // We catch and ignore the error to prevent blocking the user flow.
      try {
        const currentStatus = event.participants_status || {};
        const updatedStatus = { ...currentStatus, [user.id]: status };
        await pb.collection('agenda_cap53_eventos').update(event.id, {
          participants_status: updatedStatus
        });
      } catch (eventUpdateErr) {
        console.warn('Could not update event participants_status (likely permission issue, ignored):', eventUpdateErr);
      }
      
      // Refresh event data to update UI
      await refreshEvent();
      alert(status === 'accepted' ? 'Convite aceito!' : 'Convite recusado.');
    } catch (err: any) {
      console.error('Error responding to invitation:', err);
      const msg = err.data?.message || err.message || 'Erro desconhecido';
      alert(`Erro ao processar resposta: ${msg}`);
    }
  };

  React.useEffect(() => {
    refreshEvent();
    fetchParticipationRequests();
    fetchMessageCount();

    // Subscribe to messages for real-time count
    let unsubscribeMessages: (() => void) | undefined;
    let unsubscribeEvent: (() => void) | undefined;

    const setupSubscription = async () => {
        try {
            // Subscribe to event updates
            const unsubEvent = await pb.collection('agenda_cap53_eventos').subscribe(event.id, (data) => {
                if (data.action === 'update') {
                    refreshEvent();
                }
            });
            unsubscribeEvent = unsubEvent;

            // Subscribe to notifications for science status real-time updates
            const unsubNotifs = await pb.collection('agenda_cap53_notifications').subscribe('*', (data) => {
                if (data.record.event === event.id && (data.record.type === 'refusal' || data.record.type === 'acknowledgment' || data.record.type === 'system')) {
                    refreshEvent();
                }
            });

            // Subscribe to almac requests updates
            const unsubRequests = await pb.collection('agenda_cap53_almac_requests').subscribe('*', (data) => {
                if (data.record.event === event.id) {
                    pb.collection('agenda_cap53_almac_requests').getFullList({
                        filter: `event = "${event.id}"`,
                        expand: 'item'
                    })
                    .then(setRequests)
                    .catch(console.error);
                }
            });

            // We should ideally track this unsubscribe as well, but for simplicity we'll add it to the existing cleanup
            const originalCleanup = unsubscribeEvent;
            unsubscribeEvent = () => {
                if (originalCleanup) originalCleanup();
                unsubNotifs();
                unsubRequests();
            };

            // Subscribe to messages
            const room = await pb.collection('agenda_cap53_salas_batepapo').getFirstListItem(`event = "${event.id}"`);
            if (room) {
                const unsubMessages = await pb.collection('agenda_cap53_mensagens_salas').subscribe('*', (data) => {
                    if (data.action === 'create' && data.record.room === room.id) {
                        setMessageCount(prev => prev + 1);
                    } else if (data.action === 'delete' && data.record.room === room.id) {
                        setMessageCount(prev => Math.max(0, prev - 1));
                    }
                });
                unsubscribeMessages = unsubMessages;
            }
        } catch (e) {
            // Room might not exist yet
        }
    };
    setupSubscription();

    setLoadingRequests(true);
    pb.collection('agenda_cap53_almac_requests').getFullList({
        filter: `event = "${event.id}"`,
        expand: 'item'
    })
    .then(setRequests)
    .catch(console.error)
    .finally(() => setLoadingRequests(false));

    // Fallback/Enhancement: Fetch notifications (helps for the participant's own view)
    pb.collection('agenda_cap53_notifications').getFullList({
        filter: `event = "${event.id}" && type = "event_invite"`,
    })
    .then(notifs => {
        if (notifs.length > 0) {
            const notifMap: Record<string, string> = {};
            notifs.forEach(n => {
                notifMap[n.user] = n.invite_status;
            });
            setParticipantStatus(prev => ({ ...prev, ...notifMap }));
        }
    })
    .catch(console.error);

    return () => {
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeEvent) unsubscribeEvent();
    };
  }, [initialEvent.id]);

  const handleCancelClick = () => {
     if (confirm(`Deseja cancelar o evento "${event.title}"?`)) {
        onCancel(event.id, event.title, event.participants);
        onClose();
     }
  };

  const handleShare = () => {
    const locationName = event.expand?.location?.name || event.custom_location || 'Local não definido';
    const text = `📅 ${event.title}\n🕒 ${startDate.toLocaleDateString('pt-BR')} ${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n📍 ${locationName}\n\n${event.description || ''}`;
    navigator.clipboard.writeText(text);
    alert('Detalhes copiados para a área de transferência!');
  };

  const toggleItemAvailability = async (reqId: string, currentAvailability: boolean) => {
    try {
      const request = requests.find(r => r.id === reqId);
      if (!request || !request.expand?.item) return;

      const itemId = request.expand.item.id;
      
      await pb.collection('agenda_cap53_almac_items').update(itemId, {
        is_available: !currentAvailability
      });

      setRequests(prev => prev.map(r => {
        if (r.id === reqId) {
          return {
            ...r,
            expand: {
              ...r.expand,
              item: {
                ...r.expand.item,
                is_available: !currentAvailability
              }
            }
          };
        }
        return r;
      }));
    } catch (error) {
      console.error('Error toggling item availability:', error);
      alert('Erro ao atualizar disponibilidade do item.');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'PEND';
      case 'approved': return 'OK';
      case 'rejected': return 'REC';
      default: return '?';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] border border-slate-100">
            {/* Header - Refined Minimalist */}
            <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 flex flex-col gap-4 sm:gap-6">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {event.nature || event.type || 'Evento'}
                            </span>
                            {isCancelled && (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 border border-red-100 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-red-500">
                                    Cancelado
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 leading-tight tracking-tight truncate">{event.title}</h2>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {!isCancelled && (
                            event.user === user?.id || 
                            participantStatus[user?.id] === 'accepted' || 
                            ['ADMIN', 'ALMC', 'TRA', 'CE', 'DCA'].includes(user?.role)
                        ) && (
                            <button 
                                onClick={() => setIsChatOpen(true)}
                                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-200 border border-primary/10 group relative"
                                title="Discussões para Alinhamento"
                            >
                                <span className="material-symbols-outlined text-base sm:text-lg group-hover:scale-110 transition-transform">forum</span>
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden md:inline">Discussões</span>
                                {messageCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] sm:text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                                        {messageCount > 99 ? '99+' : messageCount}
                                    </span>
                                )}
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-slate-50 rounded-full transition-colors">
                            <span className="material-symbols-outlined text-slate-400 text-lg sm:text-xl">close</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-0.5 p-0.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100">
                    {[
                        { id: 'details', label: 'Detalhes', icon: 'info' },
                        { id: 'professionals', label: 'Participantes', icon: 'group' },
                        { id: 'resources', label: 'Recursos', icon: 'inventory_2' },
                        { id: 'transport', label: 'Transporte', icon: 'directions_car' },
                        { id: 'dashboard', label: 'Dashboard', icon: 'monitoring' },
                        ...(event.user === user?.id ? [{ id: 'requests', label: 'Solicitações', icon: 'person_add' }] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex flex-1 flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 px-0.5 sm:px-2 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] xs:text-[8px] sm:text-[10px] font-black uppercase tracking-tighter transition-all duration-300 min-w-0 ${
                                activeTab === tab.id 
                                ? 'bg-white text-primary shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm sm:text-lg shrink-0">{tab.icon}</span>
                            <span className="truncate w-full text-center">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                {activeTab === 'details' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início e Término</span>
                                <div className="flex items-center gap-2 text-slate-900 font-bold">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">event</span>
                                    {startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <div className="flex items-center gap-1">
                                        <span>{startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        {event.date_end && !isNaN(endDate.getTime()) && (
                                            <>
                                                <span className="text-slate-300 font-black text-[9px] uppercase tracking-widest mx-1">até</span>
                                                <span>{endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 rounded-[1.5rem] bg-slate-50/50 border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Localização</span>
                                <div className="flex items-center gap-2 text-slate-900 font-bold">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">location_on</span>
                                    <span className="truncate">{event.expand?.location?.name || event.custom_location || 'Local não definido'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sobre o Evento</h3>
                            <div className="p-6 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm leading-relaxed text-slate-600">
                                {event.description || 'Sem descrição adicional.'}
                            </div>
                        </div>

                        {/* Participation Management */}
                        {user && event.user !== user.id && !['TRA', 'ALMC', 'DCA', 'CE'].includes(user.role) && (
                            <div className="p-6 rounded-[2rem] bg-primary/[0.03] border border-primary/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                            <span className="material-symbols-outlined">person_add</span>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900">Participação no Evento</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">
                                                {participantStatus[user.id] === 'accepted' ? 'Você faz parte deste evento.' : 
                                                 participantStatus[user.id] === 'rejected' ? 'Seu convite foi recusado.' :
                                                 hasRequestedParticipation ? 'Solicitação enviada para o criador.' : 
                                                 'Deseja participar deste evento?'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons based on status */}
                                    {!participantStatus[user.id] && !hasRequestedParticipation && !showRequestForm && (
                                        <button 
                                            onClick={() => setShowRequestForm(true)}
                                            className="px-5 py-2.5 rounded-xl bg-primary text-white text-[11px] font-bold uppercase tracking-wider hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                                        >
                                            Solicitar Participação
                                        </button>
                                    )}

                                    {participantStatus[user.id] === 'pending' && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleInvitationResponse('rejected')}
                                                className="px-4 py-2 rounded-xl bg-white border border-red-100 text-red-600 text-[11px] font-bold uppercase tracking-wider hover:bg-red-50 transition-all"
                                            >
                                                Recusar
                                            </button>
                                            <button 
                                                onClick={() => handleInvitationResponse('accepted')}
                                                className="px-4 py-2 rounded-xl bg-primary text-white text-[11px] font-bold uppercase tracking-wider hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                                            >
                                                Aceitar Convite
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {showRequestForm && (
                                    <div className="pt-4 border-t border-primary/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <textarea
                                            placeholder="Escreva uma mensagem para o criador (opcional)..."
                                            value={requestMessage}
                                            onChange={(e) => setRequestMessage(e.target.value)}
                                            className="w-full p-4 rounded-xl border border-primary/20 bg-white text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none h-24"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => setShowRequestForm(false)}
                                                className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-100 rounded-xl transition-all"
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                onClick={handleRequestParticipation}
                                                disabled={isRequesting}
                                                className="px-5 py-2.5 rounded-xl bg-primary text-white text-[11px] font-bold uppercase tracking-wider hover:bg-primary-hover disabled:opacity-50 transition-all"
                                            >
                                                {isRequesting ? 'Enviando...' : 'Confirmar Envio'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'professionals' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        {/* Organizer Section */}
                        {event.expand?.user && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Nível de Envolvimento</h3>
                                {renderParticipantRow(event.expand.user)}
                            </div>
                        )}

                        {/* Participants Grouping */}
                        {(() => {
                            const participants = event.expand?.participants?.filter((p: any) => p.id !== event.user) || [];
                            
                            if (participants.length === 0 && !event.expand?.user) {
                                return (
                                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                        <span className="material-symbols-outlined text-4xl mb-2">group_off</span>
                                        <p className="text-xs font-bold uppercase tracking-widest">Sem participantes</p>
                                    </div>
                                );
                            }

                            const confirmed = participants.filter((p: any) => participantStatus[p.id] === 'accepted');
                            const pending = participants.filter((p: any) => !participantStatus[p.id] || participantStatus[p.id] === 'pending');
                            const rejected = participants.filter((p: any) => participantStatus[p.id] === 'rejected');

                            return (
                                <div className="space-y-6">
                                    {confirmed.length > 0 && (
                                        <div className="space-y-3">
                                             <div className="flex items-center gap-2 px-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirmados ({confirmed.length})</h3>
                                             </div>
                                             <div className="grid grid-cols-1 gap-3">
                                                {confirmed.map((p: any) => renderParticipantRow(p))}
                                             </div>
                                        </div>
                                    )}
                                    
                                    {pending.length > 0 && (
                                        <div className="space-y-3">
                                             <div className="flex items-center gap-2 px-2">
                                                <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-sm" />
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pendentes ({pending.length})</h3>
                                             </div>
                                             <div className="grid grid-cols-1 gap-3">
                                                {pending.map((p: any) => renderParticipantRow(p))}
                                             </div>
                                        </div>
                                    )}
                                    
                                    {rejected.length > 0 && (
                                        <div className="space-y-3">
                                             <div className="flex items-center gap-2 px-2">
                                                <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recusados ({rejected.length})</h3>
                                             </div>
                                             <div className="grid grid-cols-1 gap-3">
                                                {rejected.map((p: any) => renderParticipantRow(p))}
                                             </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'resources' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recursos Solicitados</h3>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 rounded-md bg-blue-50 text-[10px] font-black text-blue-500 uppercase">ALM</span>
                                <span className="px-2 py-1 rounded-md bg-orange-50 text-[10px] font-black text-orange-500 uppercase">COP</span>
                                <span className="px-2 py-1 rounded-md bg-indigo-50 text-[10px] font-black text-indigo-500 uppercase">INF</span>
                            </div>
                        </div>
                        
                        {loadingRequests ? (
                            <div className="py-12 flex justify-center"><div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" /></div>
                        ) : requests.length > 0 ? (
                            <div className="space-y-6">
                                {['ALMOXARIFADO', 'COPA', 'INFORMATICA'].map(category => {
                                    const categoryRequests = requests.filter(req => {
                                        const cat = req.expand?.item?.category || req.type;
                                        return cat === category || 
                                               (category === 'ALMOXARIFADO' && cat === 'ALMC') ||
                                               (category === 'INFORMATICA' && cat === 'INFO');
                                    });

                                    if (categoryRequests.length === 0) return null;

                                    const config = {
                                        ALMOXARIFADO: { label: 'Almoxarifado', icon: 'inventory_2', color: 'text-blue-500', bg: 'bg-blue-50' },
                                        COPA: { label: 'Copa', icon: 'local_cafe', color: 'text-orange-500', bg: 'bg-orange-50' },
                                        INFORMATICA: { label: 'Informática', icon: 'laptop_mac', color: 'text-indigo-500', bg: 'bg-indigo-50' }
                                    }[category] || { label: category, icon: 'category', color: 'text-slate-500', bg: 'bg-slate-50' };

                                    return (
                                        <div key={category} className="space-y-3">
                                            <div className="flex items-center gap-2 px-2">
                                                <span className={`material-symbols-outlined text-lg ${config.color}`}>{config.icon}</span>
                                                <h4 className={`text-xs font-black uppercase tracking-wider ${config.color}`}>{config.label}</h4>
                                                <div className="h-px flex-1 bg-slate-100 ml-2" />
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
                                                {categoryRequests.map(req => (
                                                    <div key={req.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-200">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`size-10 rounded-xl flex items-center justify-center text-xl ${config.bg} ${config.color}`}>
                                                                <span className="material-symbols-outlined text-lg">{config.icon}</span>
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-sm font-bold text-slate-900">{req.expand?.item?.name || 'Recurso'}</span>
                                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusStyle(req.status)}`}>
                                                                        {getStatusLabel(req.status)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/5 rounded-md">
                                                                        QTD: {req.quantity}
                                                                    </span>
                                                                    {req.justification && (
                                                                        <span className="text-[10px] text-slate-400 italic truncate max-w-[200px]" title={req.justification}>
                                                                            "{req.justification}"
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* Re-request Button */}
                                                            {req.status === 'rejected' && event.user === user?.id && (
                                                                <button
                                                                    onClick={() => setReRequestTarget({ type: 'item', data: req })}
                                                                    className="size-8 flex items-center justify-center text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors group/btn relative"
                                                                    title="Solicitar Novamente"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">restart_alt</span>
                                                                </button>
                                                            )}

                                                            {/* ALMC Availability Toggle */}
                                                            {user?.role === 'ALMC' && req.expand?.item && (
                                                                <button 
                                                                    onClick={() => toggleItemAvailability(req.id, req.expand.item.is_available)}
                                                                    className={`size-8 flex items-center justify-center rounded-lg transition-all ${
                                                                        req.expand.item.is_available 
                                                                        ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                                                                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                                    }`}
                                                                    title={req.expand.item.is_available ? 'Marcar como Indisponível' : 'Marcar como Disponível'}
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">
                                                                        {req.expand.item.is_available ? 'check_circle' : 'cancel'}
                                                                    </span>
                                                                </button>
                                                            )}
                                                            
                                                            {/* Refusal notification check */}
                                                            {req.status === 'rejected' && refusalAckByRequest[req.id] === false && (
                                                                <div className="size-8 flex items-center justify-center text-red-500 bg-red-50 rounded-lg border border-red-100 animate-pulse" title="Ciência Pendente">
                                                                    <span className="material-symbols-outlined text-lg">warning</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                                <p className="text-xs font-bold uppercase tracking-widest">Nenhum recurso solicitado</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'transport' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Suporte de Transporte</h3>
                            <div className="flex items-center gap-2">
                                {event.transporte_suporte && (
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase ${
                                        event.transporte_status === 'confirmed' ? 'bg-green-50 text-green-600 border-green-100' : 
                                        event.transporte_status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                                        'bg-yellow-50 text-yellow-600 border-yellow-100'
                                    }`}>
                                        {event.transporte_status === 'confirmed' ? 'Confirmado' : 
                                         event.transporte_status === 'rejected' ? 'Recusado' : 
                                         'Pendente'}
                                    </span>
                                )}
                                {event.transporte_suporte && event.transporte_status === 'rejected' && event.user === user?.id && (
                                    <button
                                        onClick={() => setReRequestTarget({ type: 'transport', data: event })}
                                        className="p-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors group/btn relative"
                                        title="Solicitar Novamente"
                                    >
                                        <span className="material-symbols-outlined text-lg">restart_alt</span>
                                        <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-[10px] text-white bg-slate-800 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                            Solicitar Novamente
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {event.transporte_suporte ? (
                            <div className="space-y-4">
                                <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm flex items-start gap-5">
                                    <div className="size-14 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-primary shadow-inner">
                                        <span className="material-symbols-outlined text-3xl">directions_car</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900 mb-0.5">Veículo Solicitado</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">O evento necessita de suporte para deslocamento.</p>
                                            </div>
                                            {event.transporte_status === 'rejected' && transportRefusalAck === false && (
                                                <div className="flex items-center gap-2 text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                                                    <span className="material-symbols-outlined text-lg animate-pulse">warning</span>
                                                    <span className="text-[10px] font-bold uppercase">Ciência Pendente</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Local de Origem</span>
                                                <span className="text-xs font-bold text-slate-700 truncate block">
                                                    {event.transporte_origem || 'Não definido'}
                                                </span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Local de Destino</span>
                                                <span className="text-xs font-bold text-slate-700 truncate block">
                                                    {event.transporte_destino || 'Não definido'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Horário de Ida</span>
                                                <span className="text-xs font-bold text-slate-700 truncate block">
                                                    {event.transporte_horario_levar || 'Não definido'}
                                                </span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Horário de Volta</span>
                                                <span className="text-xs font-bold text-slate-700 truncate block">
                                                    {event.transporte_horario_buscar || 'Não definido'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Detalhes do Transporte */}
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Observações Adicionais</span>
                                                <span className="text-xs font-bold text-slate-700 leading-relaxed">
                                                    {event.transporte_obs || 'Nenhuma observação informada.'}
                                                </span>
                                            </div>

                                            {event.transporte_status === 'rejected' && event.transporte_justification && (
                                                <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100">
                                                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1 block">Justificativa da Recusa</span>
                                                    <span className="text-xs font-bold text-red-700 leading-relaxed">
                                                        {event.transporte_justification}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative overflow-hidden group py-12 flex flex-col items-center justify-center bg-white/40 rounded-[2rem] border border-slate-100 transition-all duration-500 hover:bg-white/60">
                                {/* Decorative elements */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-30" />
                                
                                <div className="relative">
                                    <div className="absolute inset-0 bg-slate-100 rounded-full scale-150 blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
                                    <span className="material-symbols-outlined text-4xl mb-4 text-slate-300 relative z-10">no_transport</span>
                                </div>
                                
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10">Transporte não solicitado</p>
                                <div className="mt-2 w-8 h-0.5 bg-slate-200 rounded-full opacity-50 group-hover:w-12 transition-all duration-500" />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Visão Geral</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Status de Confirmação</span>
                                <div className="space-y-4">
                                    {[
                                        { label: 'Confirmados', color: 'bg-green-500', count: Object.values(participantStatus).filter(s => s === 'accepted').length + 1 },
                                        { label: 'Pendentes', color: 'bg-yellow-500', count: Object.values(participantStatus).filter(s => s === 'pending').length },
                                        { label: 'Recusados', color: 'bg-red-500', count: Object.values(participantStatus).filter(s => s === 'rejected').length }
                                    ].map(item => (
                                        <div key={item.label} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`size-2 rounded-full ${item.color}`} />
                                                <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                                            </div>
                                            <span className="text-[11px] font-black text-slate-900">{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Infraestrutura</span>
                                <div className="space-y-4">
                                    {/* ALMC Status */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg text-slate-400">inventory_2</span>
                                            <span className="text-[11px] font-bold text-slate-600">Almoxarifado</span>
                                        </div>
                                        {(() => {
                                            const almcReqs = requests.filter(r => r.expand?.item?.category === 'ALMOXARIFADO');
                                            if (almcReqs.length === 0) return <span className="text-[11px] font-black text-slate-300 uppercase">NÃO SOLIC.</span>;
                                            
                                            const status = almcReqs.some(r => r.status === 'rejected') ? 'rejected' : 
                                                          almcReqs.some(r => r.status === 'pending') ? 'pending' : 'approved';
                                            
                                            return (
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[11px] font-black uppercase ${
                                                        status === 'approved' ? 'text-green-600' : 
                                                        status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                                                    }`}>
                                                        {status === 'approved' ? 'ACEITO' : status === 'rejected' ? 'RECUSADO' : 'PENDENTE'}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* COPA Status */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg text-slate-400">local_cafe</span>
                                            <span className="text-[11px] font-bold text-slate-600">Copa</span>
                                        </div>
                                        {(() => {
                                            const copaReqs = requests.filter(r => r.expand?.item?.category === 'COPA');
                                            if (copaReqs.length === 0) return <span className="text-[11px] font-black text-slate-300 uppercase">NÃO SOLIC.</span>;
                                            
                                            const status = copaReqs.some(r => r.status === 'rejected') ? 'rejected' : 
                                                          copaReqs.some(r => r.status === 'pending') ? 'pending' : 'approved';
                                            
                                            return (
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[11px] font-black uppercase ${
                                                        status === 'approved' ? 'text-green-600' : 
                                                        status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                                                    }`}>
                                                        {status === 'approved' ? 'ACEITO' : status === 'rejected' ? 'RECUSADO' : 'PENDENTE'}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* DCA Status */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg text-slate-400">laptop_mac</span>
                                            <span className="text-[11px] font-bold text-slate-600">Informática</span>
                                        </div>
                                        {(() => {
                                            const dcaReqs = requests.filter(r => r.expand?.item?.category === 'INFORMATICA');
                                            if (dcaReqs.length === 0) return <span className="text-[11px] font-black text-slate-300 uppercase">NÃO SOLIC.</span>;
                                            
                                            const status = dcaReqs.some(r => r.status === 'rejected') ? 'rejected' : 
                                                          dcaReqs.some(r => r.status === 'pending') ? 'pending' : 'approved';
                                            
                                            return (
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-[11px] font-black uppercase ${
                                                        status === 'approved' ? 'text-green-600' : 
                                                        status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                                                    }`}>
                                                        {status === 'approved' ? 'ACEITO' : status === 'rejected' ? 'RECUSADO' : 'PENDENTE'}
                                                    </span>
                                                    {/* Status de ciência removido conforme solicitação */}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* TRA Status */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg text-slate-400">directions_car</span>
                                            <span className="text-[11px] font-bold text-slate-600">Transporte</span>
                                        </div>
                                        {event.transporte_suporte ? (
                                            <div className="flex flex-col items-end">
                                                <span className={`text-[11px] font-black uppercase ${
                                                    event.transporte_status === 'confirmed' ? 'text-green-600' : 
                                                    event.transporte_status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                                                }`}>
                                                    {event.transporte_status === 'confirmed' ? 'ACEITO' : 
                                                     event.transporte_status === 'rejected' ? 'RECUSADO' : 'PENDENTE'}
                                                </span>
                                                {/* Status de ciência removido conforme solicitação */}
                                            </div>
                                        ) : (
                                            <span className="text-[11px] font-black text-slate-300 uppercase">NÃO SOLIC.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && event.user === user?.id && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Solicitações de Participação</h3>
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase">
                                {eventParticipationRequests.filter(r => r.status === 'pending').length} PENDENTES
                            </span>
                        </div>

                        <div className="space-y-4">
                            {eventParticipationRequests.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {eventParticipationRequests.map((request) => (
                                        <div key={request.id} className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm flex flex-col gap-5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-12 rounded-2xl bg-cover bg-center border border-slate-100" 
                                                        style={{ backgroundImage: `url(${request.expand?.user?.avatar ? pb.files.getUrl(request.expand.user, request.expand.user.avatar) : `https://picsum.photos/seed/${request.expand?.user?.email}/200`})` }} 
                                                    />
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900">{request.expand?.user?.name || 'Usuário'}</h4>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{request.expand?.user?.email}</p>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] font-black uppercase px-3 py-1 rounded-full border border-slate-100 bg-slate-50 text-slate-500">
                                                    {new Date(request.created).toLocaleDateString('pt-BR')}
                                                </div>
                                            </div>

                                            {request.message && (
                                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 italic leading-relaxed">
                                                    "{request.message}"
                                                </div>
                                            )}

                                            {request.status === 'pending' && (
                                                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                                    <CustomSelect 
                                                        value={requestRoles[request.id] || 'PARTICIPANTE'}
                                                        onChange={(val) => setRequestRoles(prev => ({ ...prev, [request.id]: val }))}
                                                        options={INVOLVEMENT_LEVELS}
                                                        className="h-9 w-40"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => handleRequestAction(request.id, 'reject')}
                                                            className="size-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100"
                                                            title="Recusar"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">close</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRequestAction(request.id, 'approve')}
                                                            className="size-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all shadow-sm border border-green-100"
                                                            title="Aprovar"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">check</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                    <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                                        <span className="material-symbols-outlined text-2xl">person_search</span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">Nenhuma solicitação encontrada no momento.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {canEdit && (
                        <button 
                            onClick={() => {
                                onClose();
                                navigate(`/create-event?eventId=${event.id}`);
                            }}
                            className="flex-1 min-w-[90px] h-10 sm:h-11 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-base sm:text-lg">edit</span>
                            <span className="truncate">Editar</span>
                        </button>
                    )}
                    
                    {canCancel && (
                        <button 
                            onClick={handleCancelClick}
                            className="flex-1 min-w-[120px] h-10 sm:h-11 rounded-xl bg-white border border-red-100 text-red-500 text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-red-50 hover:border-red-200 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-base sm:text-lg">event_busy</span>
                            <span className="truncate">Cancelar</span>
                        </button>
                    )}

                    {event.user === user?.id && (
                        <button 
                            onClick={() => onDelete(event)}
                            className="flex-1 min-w-[90px] h-10 sm:h-11 rounded-xl bg-white border border-red-100 text-red-500 text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-red-50 hover:border-red-200 transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-base sm:text-lg">delete</span>
                            <span className="truncate">Excluir</span>
                        </button>
                    )}
                </div>

                <button 
                    onClick={onClose}
                    className="flex-1 sm:flex-none sm:min-w-[120px] h-10 sm:h-11 rounded-xl bg-slate-900 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-1.5"
                >
                    <span className="material-symbols-outlined text-base sm:text-lg">close</span>
                    <span>Fechar</span>
                </button>
            </div>
        </div>
            {isChatOpen && (
                <EventChatModal 
                    event={event} 
                    user={user} 
                    isAccepted={participantStatus[user?.id] === 'accepted'}
                    onClose={() => setIsChatOpen(false)} 
                />
            )}

            {reRequestTarget && (
                <ReRequestModal
                    type={reRequestTarget.type}
                    request={reRequestTarget.type === 'item' ? reRequestTarget.data : undefined}
                    event={reRequestTarget.type === 'transport' ? reRequestTarget.data : undefined}
                    onClose={() => setReRequestTarget(null)}
                    onSuccess={() => {
                        refreshEvent();
                        if (reRequestTarget.type === 'item') {
                            setLoadingRequests(true);
                            pb.collection('agenda_cap53_almac_requests').getFullList({
                                filter: `event = "${event.id}"`,
                                expand: 'item'
                            })
                            .then(setRequests)
                            .catch(console.error)
                            .finally(() => setLoadingRequests(false));
                        }
                    }}
                />
            )}
        </div>
    );
};

export default EventDetailsModal;
