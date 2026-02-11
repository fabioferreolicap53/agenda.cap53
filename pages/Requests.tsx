import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { pb } from '../lib/pocketbase';
import CustomSelect from '../components/CustomSelect';

const INVOLVEMENT_LEVELS = [
    { value: 'PARTICIPANTE', label: 'PARTICIPANTE' },
    { value: 'ORGANIZADOR', label: 'ORGANIZADOR' },
    { value: 'COORGANIZADOR', label: 'COORGANIZADOR' }
];

const Requests: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [actionMessage, setActionMessage] = React.useState<string | null>(null);
    const [notifications, setNotifications] = React.useState<any[]>([]);
    const [historyNotifications, setHistoryNotifications] = React.useState<any[]>([]);
    const [requestRoles, setRequestRoles] = React.useState<Record<string, string>>({});
    const [historyPage, setHistoryPage] = React.useState(1);
    const [historyHasMore, setHistoryHasMore] = React.useState(true);
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [almacRequests, setAlmacRequests] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState<'notifications' | 'almac'>('notifications');
    const [notificationsTab, setNotificationsTab] = React.useState<'pending' | 'history'>('pending');

    const fetchPendingNotifications = React.useCallback(async () => {
        if (!user) return;
        const res = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
            filter: `user = "${user.id}" && read = false && type != "event_invite" && type != "event_participation_request"`,
            expand: 'event,event.location,event.user,related_request,related_request.item,related_request.created_by,event.participants',
            sort: '-created'
        });
        setNotifications(res.items);
    }, [user]);

    const fetchHistoryNotifications = React.useCallback(async (page: number, append: boolean) => {
        if (!user) return;
        setHistoryLoading(true);
        try {
            const res = await pb.collection('agenda_cap53_notifications').getList(page, 20, {
                filter: `user = "${user.id}" && read = true && type != "event_invite" && type != "event_participation_request"`,
                expand: 'event,event.location,event.user,related_request,related_request.item,related_request.created_by,event.participants',
                sort: '-created'
            });
            setHistoryNotifications(prev => append ? [...prev, ...res.items] : res.items);
            setHistoryPage(page);
            setHistoryHasMore(page < res.totalPages);
        } finally {
            setHistoryLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        if (user) {
            if (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') {
                setActiveTab('almac');
            }
        }
    }, [user]);

    React.useEffect(() => {
        let unsubscribeAlmac: (() => void) | undefined;
        let unsubscribeEventos: (() => void) | undefined;
        let unsubscribeNotifications: (() => void) | undefined;
        let isMounted = true;

        const setupSubscriptions = async () => {
            if (!user || !isMounted) return;
            
            try {
                // Subscribe to almac requests if authorized
                if (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') {
                    unsubscribeAlmac = await pb.collection('agenda_cap53_almac_requests').subscribe('*', function(e) {
                        console.log('Almac Request Update:', e);
                        if (e.action === 'create' || e.action === 'update') {
                            const filterParts = ['status = "pending" || status = "approved" || status = "rejected"'];
                            
                            if (user.role === 'ALMC') {
                                filterParts.push('item.category = "ALMOXARIFADO" || item.category = "COPA"');
                            } else if (user.role === 'DCA') {
                                filterParts.push('item.category = "INFORMATICA"');
                            }

                            pb.collection('agenda_cap53_almac_requests').getFullList({
                                sort: '-created',
                                expand: 'event,item,created_by',
                                filter: filterParts.length > 1 ? `(${filterParts[0]}) && (${filterParts[1]})` : filterParts[0]
                            }).then(records => {
                                if (isMounted) setAlmacRequests(records);
                            });
                        }
                    });
                }

                // Subscribe to notifications for ALL users
                unsubscribeNotifications = await pb.collection('agenda_cap53_notifications').subscribe('*', function(e) {
                    console.log('Notification Update:', e);
                    if (e.record.user === user.id && isMounted) {
                        fetchPendingNotifications().catch(console.error);
                        fetchHistoryNotifications(1, false).catch(console.error);
                    }
                });

                // If component unmounted while we were setting up, clean up immediately
                if (!isMounted) {
                    if (unsubscribeAlmac) unsubscribeAlmac();
                    if (unsubscribeNotifications) unsubscribeNotifications();
                }
            } catch (error) {
                console.error('Error setting up subscriptions:', error);
            }
        };

        const loadData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // Fetch notifications for the user
                await fetchPendingNotifications();
                await fetchHistoryNotifications(1, false);

                // Fetch Almac requests if authorized
                if (user.role === 'ALMC' || user.role === 'DCA' || user.role === 'ADMIN') {
                    const filterParts = ['status = "pending" || status = "approved" || status = "rejected"'];
                    
                    if (user.role === 'ALMC') {
                        filterParts.push('item.category = "ALMOXARIFADO" || item.category = "COPA"');
                    } else if (user.role === 'DCA') {
                        filterParts.push('item.category = "INFORMATICA"');
                    }

                    const almacRecords = await pb.collection('agenda_cap53_almac_requests').getFullList({
                        sort: '-created',
                        expand: 'event,item,created_by',
                        filter: filterParts.length > 1 ? `(${filterParts[0]}) && (${filterParts[1]})` : filterParts[0]
                    });
                    if (isMounted) setAlmacRequests(almacRecords);
                }

                // Setup real-time subscriptions
                await setupSubscriptions();

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();

        return () => {
            isMounted = false;
            if (unsubscribeAlmac) unsubscribeAlmac();
            if (unsubscribeNotifications) unsubscribeNotifications();
        };
    }, [user, fetchPendingNotifications, fetchHistoryNotifications]);

    const handleNotificationAction = async (notification: any, action: 'accepted' | 'rejected') => {
        try {
            const updatePayload: any = { read: true };
            if (notification.type === 'event_invite') {
                updatePayload.invite_status = action;
            } else if (notification.type === 'event_participation_request') {
                updatePayload.invite_status = action === 'accepted' ? 'accepted' : 'rejected';
            }
            await pb.collection('agenda_cap53_notifications').update(notification.id, updatePayload);

            // Handle Participation Request
            if (notification.type === 'event_participation_request') {
                const eventId = notification.expand?.event?.id || notification.event;
                const requesterId = notification.data?.requester_id || notification.expand?.related_request?.user;
                
                if (eventId && requesterId) {
                    // 1. Update the request record if it exists
                    const requests = await pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
                        filter: `event = "${eventId}" && user = "${requesterId}" && status = "pending"`
                    });
                    
                    const selectedRole = requestRoles[notification.id] || 'PARTICIPANTE';

                    for (const req of requests) {
                        await pb.collection('agenda_cap53_solicitacoes_evento').update(req.id, {
                            status: action === 'accepted' ? 'approved' : 'rejected',
                            role: selectedRole
                        });
                    }

                    // 2. If accepted, add to participants
                    if (action === 'accepted') {
                        const event = await pb.collection('agenda_cap53_eventos').getOne(eventId);
                        const participants = event.participants || [];

                        if (!participants.includes(requesterId)) {
                            await pb.collection('agenda_cap53_eventos').update(eventId, {
                                participants: [...participants, requesterId],
                                participants_roles: { ...(event.participants_roles || {}), [requesterId]: selectedRole }
                            });

                            await pb.collection('agenda_cap53_participantes').create({
                                event: eventId,
                                user: requesterId,
                                status: 'accepted',
                                role: selectedRole
                            });
                        }
                    }

                    // 3. Notify the requester
                    const originalMessage = notification.data?.requester_message;
                    const eventTitle = notification.expand?.event?.title || 'Evento';
                    
                    await pb.collection('agenda_cap53_notifications').create({
                        user: requesterId,
                        title: `Solicitação ${action === 'accepted' ? 'Aprovada' : 'Recusada'}`,
                        message: `Sua solicitação para participar do evento "${eventTitle}" foi ${action === 'accepted' ? 'aprovada' : 'recusada'}.${action === 'accepted' ? ` Nível: ${selectedRole}.` : ''}`,
                        type: action === 'accepted' ? 'system' : 'refusal',
                        event: eventId,
                        read: false,
                        data: { 
                            kind: 'participation_request_response',
                            action: action,
                            role: action === 'accepted' ? selectedRole : undefined,
                            requester_message: originalMessage,
                            original_message: originalMessage
                        }
                    });
                }
                
                setActionMessage(`Solicitação ${action === 'accepted' ? 'aceita' : 'recusada'} com sucesso.`);
                setTimeout(() => setActionMessage(null), 5000);
            }

            if (notification.type === 'event_invite' && user) {
                const eventId = notification.expand?.event?.id || notification.event;

                if (eventId) {
                    const existing = await pb.collection('agenda_cap53_participantes').getFullList({
                        filter: `event = "${eventId}" && user = "${user.id}"`
                    });

                    if (existing.length === 0) {
                        if (action === 'accepted') {
                            await pb.collection('agenda_cap53_participantes').create({
                                event: eventId,
                                user: user.id,
                                status: action,
                                role: 'PARTICIPANTE' // Default for invites accepted by the user
                            });
                        }
                    } else {
                        await Promise.all(existing.map((p: any) => (
                            pb.collection('agenda_cap53_participantes').update(p.id, { 
                                status: action,
                                role: p.role || 'PARTICIPANTE'
                            })
                        )));
                    }

                    pb.collection('agenda_audit_logs').create({
                        user: user.id,
                        action: action === 'accepted' ? 'EVENT_INVITE_ACCEPTED' : 'EVENT_INVITE_REJECTED',
                        target_type: 'agenda_cap53_eventos',
                        target_id: eventId,
                        details: {
                            event_title: notification.expand?.event?.title || 'Evento',
                            action_timestamp: new Date().toISOString()
                        }
                    }).catch(() => {});

                    // Notify the event creator about the participant's decision
                    if (notification.expand?.event?.user) {
                        const creatorId = notification.expand.event.user;
                        const eventTitle = notification.expand.event.title || 'Evento';
                        const participantName = user.name || user.email;
                        
                        let message = `${participantName} ${action === 'accepted' ? 'aceitou' : 'recusou'} o convite para o evento "${eventTitle}".`;
                        
                        try {
                            await pb.collection('agenda_cap53_notifications').create({
                                user: creatorId,
                                title: `Convite ${action === 'accepted' ? 'Aceito' : 'Recusado'}`,
                                message: message,
                                type: action === 'rejected' ? 'refusal' : 'system',
                                read: false,
                                event: eventId,
                                data: { 
                                    kind: 'event_invite_response',
                                    participant_id: user.id,
                                    participant_name: participantName,
                                    action: action,
                                    role: action === 'accepted' ? (notification.expand?.event?.participants_roles?.[user.id] || 'PARTICIPANTE') : undefined,
                                    // Para permitir "dar ciência" na recusa e chat
                                    rejected_by: action === 'rejected' ? user.id : undefined,
                                    rejected_by_name: action === 'rejected' ? participantName : undefined,
                                    approved_by: action === 'accepted' ? user.id : undefined,
                                    approved_by_name: action === 'accepted' ? participantName : undefined
                                },
                                acknowledged: false
                            });
                        } catch (notifErr) {
                            console.error('Error notifying creator about invite response:', notifErr);
                        }
                    }
                }

                setActionMessage(`Você ${action === 'accepted' ? 'aceitou' : 'recusou'} o convite para "${notification.expand?.event?.title || notification.title}"`);
                setTimeout(() => setActionMessage(null), 5000);
            }
            await fetchPendingNotifications();
            await fetchHistoryNotifications(1, false);
        } catch (error) {
            console.error('Error handling action:', error);
            alert('Erro ao processar a ação. Tente novamente.');
        }
    };

    const handleAlmcItemNotificationDecision = async (notification: any, action: 'approved' | 'rejected') => {
        try {
            if (!user || (user.role !== 'ALMC' && user.role !== 'DCA' && user.role !== 'ADMIN')) {
                alert('Ação não permitida.');
                return;
            }

            const requestId = notification.related_request || notification.expand?.related_request?.id;
            if (!requestId) {
                alert('Solicitação vinculada não encontrada nesta notificação.');
                return;
            }

            const currentStatus = notification.expand?.related_request?.status;
            if (currentStatus && currentStatus !== 'pending' && user.role !== 'ADMIN') {
                await pb.collection('agenda_cap53_notifications').update(notification.id, { read: true });
                setActionMessage('Esta solicitação já foi decidida.');
                setTimeout(() => setActionMessage(null), 5000);
                await fetchPendingNotifications();
                await fetchHistoryNotifications(1, false);
                return;
            }

            let justification: string | undefined;
            if (action === 'rejected') {
                justification = prompt('Motivo da recusa:') || '';
                if (!justification) return;
            }

            await pb.collection('agenda_cap53_almac_requests').update(requestId, {
                status: action,
                justification: action === 'rejected' ? justification : '',
            });

            // Notify the requester and event creator about the decision
            const requesterId = notification.expand?.related_request?.created_by || notification.expand?.related_request?.expand?.created_by?.id;
            const eventCreatorId = notification.expand?.event?.user || notification.event?.user;
            
            if (requesterId || eventCreatorId) {
                const itemName = notification.expand?.related_request?.expand?.item?.name || 'Item';
                const eventTitle = notification.expand?.event?.title || 'Evento';
                const quantity = notification.expand?.related_request?.quantity || 1;
                const eventId = notification.event || notification.expand?.event?.id;
                
                const commonData = {
                    kind: 'almc_item_decision',
                    action: action,
                    quantity: quantity,
                    rejected_by: action === 'rejected' ? user.id : undefined,
                    rejected_by_name: action === 'rejected' ? user.name || user.email : undefined,
                    approved_by: action === 'approved' ? user.id : undefined,
                    approved_by_name: action === 'approved' ? user.name || user.email : undefined
                };

                // 1. Notify Requester
                if (requesterId && requesterId !== user.id) {
                    let message = `Sua solicitação do item "${itemName}" (Qtd: ${quantity}) para o evento "${eventTitle}" foi ${action === 'approved' ? 'aprovada' : 'reprovada'}.`;
                    if (action === 'rejected' && justification) {
                        message += ` Motivo: ${justification}`;
                    }

                    try {
                        await pb.collection('agenda_cap53_notifications').create({
                            user: requesterId,
                            title: `Item ${action === 'approved' ? 'Aprovado' : 'Reprovado'}`,
                            message: message,
                            type: action === 'rejected' ? 'refusal' : 'system',
                            read: false,
                            event: eventId,
                            related_request: requestId,
                            data: commonData,
                            acknowledged: false
                        });
                    } catch (notifErr) {
                        console.error('Error notifying requester about ALMC decision:', notifErr);
                    }
                }

                // 2. Notify Event Creator (if different from requester and user)
                if (eventCreatorId && eventCreatorId !== user.id && eventCreatorId !== requesterId) {
                    let message = `O pedido do item "${itemName}" (Qtd: ${quantity}) para o evento "${eventTitle}" foi ${action === 'approved' ? 'aprovado' : 'reprovada'}.`;
                    if (action === 'rejected' && justification) {
                        message += ` Motivo: ${justification}`;
                    }

                    try {
                        await pb.collection('agenda_cap53_notifications').create({
                            user: eventCreatorId,
                            title: `Ciência: Item ${action === 'approved' ? 'Aprovado' : 'Reprovado'}`,
                            message: message,
                            type: action === 'rejected' ? 'refusal' : 'system',
                            read: false,
                            event: eventId,
                            related_request: requestId,
                            data: commonData,
                            acknowledged: false
                        });
                    } catch (notifErr) {
                        console.error('Error notifying event creator about ALMC decision:', notifErr);
                    }
                }
            }

            await pb.collection('agenda_cap53_notifications').update(notification.id, { read: true });

            setActionMessage(`Solicitação ${action === 'approved' ? 'aprovada' : 'reprovada'} com sucesso.`);
            setTimeout(() => setActionMessage(null), 5000);
            await fetchPendingNotifications();
            await fetchHistoryNotifications(1, false);
        } catch (error) {
            console.error('Error handling ALMC item decision:', error);
            alert('Erro ao processar a solicitação.');
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        if (!confirm('Deseja excluir esta notificação do seu histórico?')) return;
        try {
            await pb.collection('agenda_cap53_notifications').delete(notificationId);
            setHistoryNotifications(prev => prev.filter(n => n.id !== notificationId));
            setActionMessage('Notificação excluída.');
            setTimeout(() => setActionMessage(null), 3000);
        } catch (error) {
            console.error('Error deleting notification:', error);
            alert('Erro ao excluir a notificação.');
        }
    };

    const handleClearAllHistory = async () => {
        if (!user) return;
        
        const count = filteredHistoryNotifications.length;
        if (count === 0) {
            setActionMessage('O histórico já está vazio.');
            setTimeout(() => setActionMessage(null), 3000);
            return;
        }

        if (!confirm(`Deseja realmente limpar todas as ${count} notificações do seu histórico? Esta ação não pode ser desfeita.`)) return;
        
        setHistoryLoading(true);
        try {
            // Buscamos todas as lidas para garantir que limpamos tudo do banco
            const allHistory = await pb.collection('agenda_cap53_notifications').getFullList({
                filter: `user = "${user.id}" && read = true`,
                fields: 'id'
            });

            if (allHistory.length === 0) {
                setActionMessage('O histórico já está vazio.');
                setTimeout(() => setActionMessage(null), 3000);
                return;
            }

            // Excluir em lotes para evitar sobrecarga
            await Promise.all(allHistory.map(n => pb.collection('agenda_cap53_notifications').delete(n.id)));

            setActionMessage('Todo o histórico foi limpo.');
            setTimeout(() => setActionMessage(null), 5000);
            setHistoryNotifications([]);
            setHistoryHasMore(false);
            setHistoryPage(1);
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('Erro ao limpar o histórico.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleAcknowledgement = async (notification: any) => {
        try {
            console.log('Processing acknowledgement for notification:', notification);

            const isInviteRefusal = notification.data?.kind === 'event_invite_response';
            const isTransportRefusal = notification.data?.kind === 'transport' || notification.data?.kind === 'transport_decision';
            const isAlmcRefusal = !isInviteRefusal && !isTransportRefusal && notification.type === 'refusal';
            
            let ackEndpoint = '/api/acknowledge_refusal';
            if (isInviteRefusal) {
                ackEndpoint = '/api/acknowledge_invite_refusal';
            } else if (isTransportRefusal) {
                ackEndpoint = '/api/acknowledge_transport_refusal';
            }

            // Try to use backend endpoint first (Requested architecture)
            try {
                await pb.send(ackEndpoint, {
                    method: 'POST',
                    body: { notification_id: notification.id }
                });
                setActionMessage('Ciência confirmada e notificação enviada (Via API).');
                setTimeout(() => setActionMessage(null), 5000);
                await fetchPendingNotifications();
                await fetchHistoryNotifications(1, false);
                return;
            } catch (apiError) {
                console.warn(`Backend endpoint ${ackEndpoint} failed or not found. Falling back to client-side logic.`, apiError);
            }

            // Fallback: Client-side logic if endpoint is missing
            // 1. Mark as acknowledged
            await pb.collection('agenda_cap53_notifications').update(notification.id, {
                acknowledged: true,
                read: true
            });

            // 2. Notify the decider user (ALMC/TRA/CE/ADMIN)
            let targetUserId = notification.data?.rejected_by || notification.data?.confirmed_by;
            
            // Fallback: Try to get from related request if data is missing
            if (!targetUserId && notification.related_request) {
                // ... logic to find target ...
            }

            // Fallback for missing target: Get ANY relevant sector user (better than failing)
            if (!targetUserId && (notification.type === 'refusal' || isTransportRefusal)) {
                console.warn('Target user (rejected_by) unknown. Falling back to any sector user to notify.');
                
                let roleToSearch = 'ALMC';
                if (isTransportRefusal) {
                    roleToSearch = 'TRA';
                } else {
                    // Check if it's a DCA (Informatics) refusal
                    const category = notification.expand?.related_request?.expand?.item?.category;
                    if (category === 'INFORMATICA') {
                        roleToSearch = 'DCA';
                    }
                }

                try {
                    const sectorUsers = await pb.collection('agenda_cap53_usuarios').getList(1, 1, {
                        filter: `role = "${roleToSearch}"`
                    });
                    if (sectorUsers.items.length > 0) {
                        targetUserId = sectorUsers.items[0].id;
                        console.log('Fallback: Selected sector user:', targetUserId);
                    }
                } catch (e) {
                    console.error('Failed to fetch fallback sector user:', e);
                }
            }

            if (notification.type === 'refusal' && targetUserId) {
                 let itemName = 'Item';
                 let eventId = notification.expand?.event?.id || notification.event;

                 if (isAlmcRefusal && notification.related_request) {
                     try {
                        if (notification.expand?.related_request?.expand?.item?.name) {
                             itemName = notification.expand.related_request.expand.item.name;
                             if (!eventId) eventId = notification.expand.related_request.event;
                        } else {
                            const relatedReq = await pb.collection('agenda_cap53_almac_requests').getOne(notification.related_request, {
                                expand: 'item'
                            });
                            itemName = relatedReq.expand?.item?.name || 'Item';
                            if (!eventId) eventId = relatedReq.event;
                        }
                     } catch (e) { console.log('Could not fetch related request details', e); }
                 }
                 
                 const timestamp = new Date().toLocaleString('pt-BR');
                 
                 let message = '';
                 if (isInviteRefusal) {
                     message = `O criador ${user?.name || user?.email} confirmou ciência da sua recusa ao convite em ${timestamp}.`;
                 } else if (isTransportRefusal) {
                     message = `O criador ${user?.name || user?.email} confirmou ciência da recusa do transporte em ${timestamp}.`;
                 } else {
                     message = `O criador ${user?.name || user?.email} confirmou ciência da recusa do item "${itemName}" em ${timestamp}.`;
                 }

                 const notifData = {
                     user: targetUserId,
                     title: 'Ciência de Recusa',
                     message: message,
                     type: 'acknowledgment',
                     read: false,
                     related_request: isAlmcRefusal ? notification.related_request : null,
                     event: eventId,
                     data: {
                         kind: isInviteRefusal ? 'invite_ack' : (isTransportRefusal ? 'transport_ack' : 'almc_ack'),
                         original_refusal_id: notification.id,
                         creator_name: user?.name || user?.email,
                         acknowledged_at: new Date().toISOString()
                     }
                 };

                 console.log('Creating acknowledgment notification (Client-side):', notifData);
                 await pb.collection('agenda_cap53_notifications').create(notifData);
                 
                 setActionMessage('Ciência confirmada e notificação enviada (Client-side).');
                 setTimeout(() => setActionMessage(null), 5000);
            } else {
                console.warn('Cannot send acknowledgment: Missing target user ID (rejected_by).', notification);
                setActionMessage('Ciência confirmada (Aviso: Não foi possível notificar o setor responsável).');
            }
            
            await fetchPendingNotifications();
            await fetchHistoryNotifications(1, false);
        } catch (error) { console.error('Error acknowledging:', error); }
    };

    const handleAlmacRequestAction = async (
        requestId: string,
        action: 'approved' | 'rejected',
        currentStatus?: 'pending' | 'approved' | 'rejected',
        currentJustification?: string
    ) => {
        if (currentStatus && currentStatus !== 'pending' && user?.role !== 'ADMIN') {
            alert('Esta solicitação já foi decidida e não pode ser alterada.');
            return;
        }

        let justification = currentJustification;
        if (action === 'rejected' && !justification) {
            justification = prompt('Motivo da reprovação:') || '';
            if (!justification) return; 
        }

        try {
            await pb.collection('agenda_cap53_almac_requests').update(requestId, {
                status: action,
                justification: justification
            });
            
            // Notify user
            // Habilitando criação de notificação no cliente para garantir que o criador receba o aviso de recusa
            // e possa dar ciência na aba de Notificações.
            
            const ENABLE_CLIENT_SIDE_NOTIF = true; 

            if (ENABLE_CLIENT_SIDE_NOTIF) {
                // Fetch fresh data to ensure we have created_by AND event creator
                let req = almacRequests.find(r => r.id === requestId);
                if (!req?.expand?.created_by || !req?.expand?.event?.user) {
                     try {
                        req = await pb.collection('agenda_cap53_almac_requests').getOne(requestId, { 
                            expand: 'created_by,item,event,event.user' 
                        });
                     } catch(e) { console.error("Error fetching fresh request:", e); }
                }

                if (req) {
                    const requesterId = req.expand?.created_by?.id || req.created_by;
                    const eventCreatorId = req.expand?.event?.user || req.event_creator_id; // event_creator_id as fallback if stored directly
                    
                    const itemName = req.expand?.item?.name || 'item';
                    const eventTitle = req.expand?.event?.title || 'Evento';
                    const message = `O pedido de "${itemName}" para o evento "${eventTitle}" foi ${action === 'approved' ? 'aprovado' : 'reprovado'}.${action === 'rejected' && justification ? ` Justificativa: ${justification}` : ''}`;

                    // 1. Notify the requester (if not the one acting)
                    if (requesterId && requesterId !== user?.id) {
                        try {
                            await pb.collection('agenda_cap53_notifications').create({
                                user: requesterId,
                                title: `Solicitação ${action === 'approved' ? 'Aprovada' : 'Reprovada'}`,
                                message: `Seu pedido de "${itemName}" para o evento "${eventTitle}" foi ${action === 'approved' ? 'aprovado' : 'reprovado'}.${action === 'rejected' && justification ? ` Justificativa: ${justification}` : ''}`,
                                type: action === 'rejected' ? 'refusal' : 'system',
                                read: false,
                                related_request: requestId,
                                event: req.event,
                                data: {
                                    kind: 'almc_item_decision',
                                    action: action,
                                    rejected_by: action === 'rejected' ? user?.id : undefined,
                                    rejected_by_name: action === 'rejected' ? user?.name || user?.email : undefined,
                                    approved_by: action === 'approved' ? user?.id : undefined,
                                    approved_by_name: action === 'approved' ? user?.name || user?.email : undefined
                                },
                                acknowledged: false
                            });
                        } catch (notifErr) {
                            console.error('Error notifying requester:', notifErr);
                        }
                    }

                    // 2. Notify the event creator (if not the one acting and not the requester)
                    // Note: In many cases the requester IS the creator, so we check for both.
                    const creatorToNotify = eventCreatorId || req.expand?.event?.user;
                    if (creatorToNotify && creatorToNotify !== user?.id && creatorToNotify !== requesterId) {
                        try {
                            await pb.collection('agenda_cap53_notifications').create({
                                user: creatorToNotify,
                                title: `Ciência: Item ${action === 'approved' ? 'Aprovado' : 'Reprovado'}`,
                                message: message,
                                type: action === 'rejected' ? 'refusal' : 'system',
                                read: false,
                                related_request: requestId,
                                event: req.event,
                                data: {
                                    kind: 'almc_item_decision',
                                    action: action,
                                    rejected_by: action === 'rejected' ? user?.id : undefined,
                                    rejected_by_name: action === 'rejected' ? user?.name || user?.email : undefined,
                                    approved_by: action === 'approved' ? user?.id : undefined,
                                    approved_by_name: action === 'approved' ? user?.name || user?.email : undefined
                                },
                                acknowledged: false
                            });
                        } catch (notifErr) {
                            console.error('Error notifying event creator:', notifErr);
                        }
                    }
                }
            }

            // Local update (optimistic or wait for subscription)
            // We rely on subscription for full refresh, but can update locally for speed
             setAlmacRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: action, justification } : r));

        } catch (error) {
            console.error('Error updating request:', error);
            alert('Erro ao atualizar solicitação.');
        }
    };

    // Group requests by Event
    const requestsByEvent = almacRequests.reduce((acc, req) => {
        const eventId = req.event;
        if (!acc[eventId]) {
            acc[eventId] = {
                event: req.expand?.event,
                requests: []
            };
        }
        acc[eventId].requests.push(req);
        return acc;
    }, {} as Record<string, any>);

    const canSeeAlmac = user?.role === 'ALMC' || user?.role === 'DCA' || user?.role === 'ADMIN';

    // Filtrar notificações para evitar duplicidade na aba "Notificações"
    // Se o usuário já vê as solicitações na aba "Recursos", não precisamos das notificações de sistema duplicadas
    const filteredNotifications = React.useMemo(() => {
        let list = notifications;
        if (canSeeAlmac) {
            list = list.filter(n => n.data?.kind !== 'almc_item_request');
        }
        return list;
    }, [notifications, canSeeAlmac]);

    const filteredHistoryNotifications = React.useMemo(() => {
        let list = historyNotifications;
        if (canSeeAlmac) {
            list = list.filter(n => n.data?.kind !== 'almc_item_request');
        }
        return list;
    }, [historyNotifications, canSeeAlmac]);

    return (
        <div className="flex flex-col gap-6 max-w-[1300px] mx-auto w-full">
            {actionMessage && (
                <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 animate-bounce flex items-center gap-3 border-2 border-green-400">
                    <span className="material-symbols-outlined">notifications_active</span>
                    <p className="font-bold">{actionMessage}</p>
                </div>
            )}
            
            {canSeeAlmac && (
                 <div className="flex gap-4 border-b border-slate-200">
                    {canSeeAlmac && (
                        <button
                            onClick={() => setActiveTab('almac')}
                            className={`pb-3 px-4 text-sm font-bold transition-all relative ${activeTab === 'almac' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {user?.role === 'DCA' ? 'Informática' : 'Almoxarifado & Copa'}
                            {activeTab === 'almac' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 rounded-t-full" />}
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`pb-3 px-4 text-sm font-bold transition-all relative ${activeTab === 'notifications' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Notificações
                        {filteredNotifications.length > 0 && (
                            <span className="ml-2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded-full">{filteredNotifications.length}</span>
                        )}
                        {activeTab === 'notifications' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 rounded-t-full" />}
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                </div>
            ) : (
                <>
                    {/* ALMAC REQUESTS TAB */}
                    {activeTab === 'almac' && canSeeAlmac && (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                            {Object.keys(requestsByEvent).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-100 border-dashed">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inbox</span>
                                    <p className="text-slate-400 font-medium">Nenhuma solicitação de almoxarifado encontrada.</p>
                                </div>
                            )}

                            {Object.entries(requestsByEvent).map(([eventId, group]: [string, any]) => (
                                <div key={eventId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-2xl font-bold">event</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <h3 className="font-bold text-slate-800 text-lg">{group.event?.title || 'Evento Desconhecido (ou Deletado)'}</h3>
                                                <span className="text-xs text-slate-400">
                                                    Solicitante: <span className="font-bold text-slate-600">{group.requests[0]?.expand?.created_by?.name || 'Sistema'}</span> • 
                                                    Data: {group.event?.date_start ? new Date(group.event.date_start).toLocaleDateString('pt-BR') : 'Data N/A'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                            {group.requests.length} Itens
                                        </span>
                                    </div>
                                    
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.requests.map((req: any) => (
                                            <div key={req.id} className={`group relative p-4 rounded-2xl border transition-all duration-300 ${
                                                req.status === 'pending' ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300' :
                                                req.status === 'approved' ? 'bg-slate-50/50 border-slate-200 opacity-90' :
                                                'bg-slate-50/30 border-slate-100 opacity-60'
                                            }`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="font-bold text-sm text-slate-800 tracking-tight">{req.expand?.item?.name || 'Item Desconhecido'}</span>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${
                                                        req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                        req.status === 'approved' ? 'bg-slate-800 text-white border-slate-800' :
                                                        'bg-white text-slate-400 border-slate-200'
                                                    }`}>
                                                        {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : 'Reprovado'}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                                                        <span className="material-symbols-outlined text-[14px] text-slate-500">inventory_2</span>
                                                        <span className="text-[11px] font-bold text-slate-700">{req.quantity || 1}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{req.expand?.item?.category || 'Geral'}</span>
                                                    
                                                    {/* Status na Solicitação */}
                                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md border ${
                                                        req.item_snapshot_available !== false 
                                                        ? 'bg-green-50 border-green-100 text-green-600' 
                                                        : 'bg-red-50 border-red-100 text-red-600'
                                                    }`}>
                                                        <span className="material-symbols-outlined text-[12px]">
                                                            {req.item_snapshot_available !== false ? 'check_circle' : 'cancel'}
                                                        </span>
                                                        <span className="text-[9px] font-black uppercase tracking-tight">
                                                            {req.item_snapshot_available !== false ? 'Disponível' : 'Indisponível'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {req.status === 'pending' && (
                                                    <div className="flex gap-2 mt-2">
                                                        {req.expand?.created_by?.id && req.expand?.created_by?.id !== user?.id && (
                                                            <button
                                                                onClick={() => navigate(`/chat?userId=${req.expand.created_by.id}`)}
                                                                className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center shadow-sm"
                                                                title={`Conversar com ${req.expand.created_by.name || 'Solicitante'}`}
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">chat</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleAlmacRequestAction(req.id, 'approved', req.status, req.justification)}
                                                            className="flex-1 h-9 rounded-xl bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-900 transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                                            Aprovar
                                                        </button>
                                                        <button
                                                            onClick={() => handleAlmacRequestAction(req.id, 'rejected', req.status, req.justification)}
                                                            className="flex-1 h-9 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                                            Reprovar
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                {req.status !== 'pending' && req.justification && (
                                                    <div className="relative mt-3 pt-3 border-t border-slate-100">
                                                        <span className="absolute -top-2 left-2 bg-slate-50 px-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Justificativa</span>
                                                        <p className="text-[11px] italic text-slate-500 leading-relaxed px-1">
                                                            "{req.justification}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* NOTIFICATIONS TAB */}
                    {activeTab === 'notifications' && (
                        <>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl w-fit border border-slate-200/50">
                                    <button
                                        onClick={() => setNotificationsTab('pending')}
                                        className={`h-8 px-5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 flex items-center gap-2 ${
                                            notificationsTab === 'pending'
                                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        Pendentes
                                        {filteredNotifications.length > 0 && (
                                            <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black ${
                                                notificationsTab === 'pending' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {filteredNotifications.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setNotificationsTab('history')}
                                        className={`h-8 px-5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${
                                            notificationsTab === 'history'
                                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        Histórico
                                    </button>
                                </div>
                                
                                {notificationsTab === 'history' && filteredHistoryNotifications.length > 0 && (
                                    <button
                                        onClick={handleClearAllHistory}
                                        className="h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-white border border-red-100 text-red-500 hover:bg-red-50 flex items-center gap-2 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                                        Limpar Histórico
                                    </button>
                                )}
                            </div>

                            {notificationsTab === 'pending' ? (
                                filteredNotifications.length > 0 ? (
                                    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {filteredNotifications.map((notification) => {
                                            const event = notification.expand?.event;
                                            const location = event?.expand?.location;
                                            const isInvite = notification.type === 'event_invite';
                                            const isAlmcItemRequest = notification.data?.kind === 'almc_item_request';
                                            const isApproved = notification.title.toLowerCase().includes('aprovada') || notification.title.toLowerCase().includes('aceito') || notification.title.toLowerCase().includes('confirmado');
                                            const isRejected = notification.title.toLowerCase().includes('reprovada') || notification.title.toLowerCase().includes('recusado');
                                            const isRefusal = notification.type === 'refusal';
                                            const isAcknowledgment = notification.type === 'acknowledgment';
                                            const isSystem = notification.type === 'system';
                                            const isEventDeleted = notification.type === 'event_deleted';
                                            const isChatRoomCreated = notification.type === 'chat_room_created';
                                            const isParticipationRequest = notification.type === 'event_participation_request';
                                            const isTransportRequest = notification.data?.kind === 'transport_request' || notification.data?.kind === 'transport' || notification.data?.kind === 'transport_decision';

                                            const isInviteRefusal = isRefusal && notification.data?.kind === 'event_invite_response';
                                            const isAlmcRefusal = isRefusal && !isInviteRefusal;

                                            const itemName = notification.expand?.related_request?.expand?.item?.name;
                                            const itemQty = notification.expand?.related_request?.quantity || notification.data?.quantity;

                                            // Determine who to talk to:
                                            const talkToId = (isRefusal || isApproved || isAcknowledgment || isEventDeleted) 
                                                ? (notification.data?.rejected_by || notification.data?.approved_by || notification.data?.deleted_by || event?.user || event?.expand?.user?.id)
                                                : (event?.user || event?.expand?.user?.id || notification.expand?.related_request?.created_by || notification.expand?.related_request?.expand?.created_by?.id);
                                            
                                            const talkToName = (isRefusal || isApproved || isAcknowledgment || isEventDeleted)
                                                ? (notification.data?.rejected_by_name || notification.data?.approved_by_name || notification.data?.deleted_by_name || event?.expand?.user?.name || 'Criador')
                                                : (event?.expand?.user?.name || notification.expand?.related_request?.expand?.created_by?.name || 'Criador');

                                            // Limpar mensagem para evitar duplicidade se houver requester_message no data
                                            const displayMessage = (notification.message || '')
                                                .split('\n\nMensagem:')[0]
                                                .split('\nMensagem:')[0]
                                                .split('\n\nSua mensagem:')[0]
                                                .split('\nSua mensagem:')[0];

                                            const roleDisplay = notification.data?.role || notification.expand?.event?.participants_roles?.[user?.id || ''];
                                            const statusDisplay = isRefusal 
                                                ? (notification.acknowledged ? 'accepted' : 'pending')
                                                : (notification.data?.action || notification.invite_status);

                                            return (
                                                <div key={notification.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 flex items-stretch min-h-[120px]">
                                                    {/* Status indicator bar */}
                                                    <div className={`w-1.5 shrink-0 rounded-l-2xl ${
                                                                isApproved || isAcknowledgment ? 'bg-slate-800' : 
                                                                    isRejected || isRefusal ? 'bg-red-500' : 
                                                                    isInvite ? 'bg-slate-700' : 
                                                                    isParticipationRequest ? 'bg-primary' :
                                                                    isAlmcItemRequest ? 'bg-slate-600' :
                                                                    'bg-slate-400'
                                                            }`}></div>

                                                    <div className="flex-1 p-5 flex flex-col md:flex-row md:items-center gap-6">
                                                        {/* Icon & Category */}
                                                        <div className="flex flex-col gap-1.5 min-w-[150px] shrink-0">
                                                            <div className="flex items-center gap-2.5 text-slate-500">
                                                                <div className={`size-8 rounded-xl flex items-center justify-center ${
                                                                    isInvite ? 'bg-slate-100 text-slate-700' :
                                                                    isParticipationRequest ? 'bg-primary/10 text-primary' :
                                                                    isAlmcItemRequest ? 'bg-slate-100 text-slate-600' :
                                                                    isTransportRequest ? 'bg-slate-100 text-slate-500' :
                                                                    isApproved || isAcknowledgment ? 'bg-slate-100 text-slate-800' :
                                                                    isRejected || isRefusal ? 'bg-red-50 text-red-600' :
                                                                    'bg-slate-50 text-slate-400'
                                                                }`}>
                                                                    <span className="material-symbols-outlined text-[18px] font-bold">
                                                                        {isInvite ? 'person_add' :
                                                                         isParticipationRequest ? 'group_add' :
                                                                         isAlmcItemRequest ? 'inventory_2' :
                                                                         isApproved || isAcknowledgment ? 'check_circle' :
                                                                         isRejected || isRefusal ? 'cancel' :
                                                                         isChatRoomCreated ? 'forum' :
                                                                         isEventDeleted ? 'delete_forever' :
                                                                         isTransportRequest ? 'local_shipping' :
                                                                         'pending_actions'}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                                    {isInvite ? 'Convite' :
                                                                     isParticipationRequest ? 'Participação' :
                                                                     isAlmcItemRequest ? 'Recursos' :
                                                                     isTransportRequest ? 'Transporte' :
                                                                     isApproved ? 'Aprovação' :
                                                                     isRejected ? 'Recusa' :
                                                                     isRefusal ? 'Recusa' :
                                                                     isAcknowledgment ? 'Ciência' :
                                                                     'Notificação'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col gap-1 ml-10">
                                                                <span className="text-[10px] text-slate-400 font-bold">
                                                                    {new Date(notification.created).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                </span>
                                                                {statusDisplay && (
                                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md w-fit ${
                                                                        statusDisplay === 'accepted' || statusDisplay === 'approved' || statusDisplay === 'confirmed' ? (isRefusal ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600') :
                                                                        statusDisplay === 'rejected' || statusDisplay === 'refused' || isRefusal ? 'bg-red-50 text-red-600' :
                                                                        'bg-amber-50 text-amber-600'
                                                                    }`}>
                                                                        {isRefusal ? (statusDisplay === 'accepted' ? 'CIENTE' : 'RECUSADO') :
                                                                         (statusDisplay === 'accepted' || statusDisplay === 'approved' || statusDisplay === 'confirmed' ? 'Confirmado' :
                                                                         statusDisplay === 'rejected' || statusDisplay === 'refused' ? 'Recusado' :
                                                                         'Pendente')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Main Content */}
                                                        <div className="flex-1 flex flex-col gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-primary transition-colors">
                                                                        {isAlmcItemRequest && itemName ? itemName : (event?.title || notification.title)}
                                                                    </h3>
                                                                    {roleDisplay && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider">
                                                                            {roleDisplay}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className={`text-xs text-slate-500 leading-relaxed ${isTransportRequest ? '' : 'line-clamp-2'}`}>
                                                                    {displayMessage}
                                                                </p>
                                                            </div>

                                                            {(notification.data?.requester_message || notification.data?.original_message) && (
                                                                <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 flex gap-2.5 items-start">
                                                                    <span className="material-symbols-outlined text-[16px] text-slate-300 mt-0.5">chat_bubble</span>
                                                                    <p className="text-[11px] text-slate-500 italic leading-relaxed">
                                                                        "{notification.data?.requester_message || notification.data?.original_message}"
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {event && (
                                                                <div className="flex items-center gap-4 mt-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="material-symbols-outlined text-[14px] text-slate-300">calendar_today</span>
                                                                        <span className="text-[10px] text-slate-400 font-bold">
                                                                            {new Date(event.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                    {(location || event.custom_location || event.location === 'external') && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="material-symbols-outlined text-[14px] text-slate-300">location_on</span>
                                                                            <span className={`text-[10px] text-slate-400 font-bold ${isTransportRequest ? '' : 'truncate max-w-[120px]'}`}>
                                                                                {event.custom_location || location?.name || (event.location === 'external' ? 'LUGAR EXTERNO NÃO FIXO' : 'Local não definido')}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {isTransportRequest && event && (
                                                                <button
                                                                    onClick={() => navigate(`/transporte?eventId=${event.id}`)}
                                                                    className="size-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center shadow-sm"
                                                                    title="Ver solicitação de transporte"
                                                                >
                                                                    <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                                                                </button>
                                                            )}
                                                            {talkToId && talkToId !== user?.id && !isEventDeleted && (
                                                                <button
                                                                    onClick={() => navigate(`/chat?userId=${talkToId}`)}
                                                                    className="size-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center shadow-sm"
                                                                    title={`Conversar com ${talkToName}`}
                                                                >
                                                                    <span className="material-symbols-outlined text-[20px]">chat</span>
                                                                </button>
                                                            )}

                                                            <div className="flex items-center gap-2">
                                                                {isParticipationRequest && (
                                                                    <div className="w-48">
                                                                        <CustomSelect
                                                                            value={requestRoles[notification.id] || 'PARTICIPANTE'}
                                                                            onChange={(val) => setRequestRoles(prev => ({ ...prev, [notification.id]: val }))}
                                                                            options={INVOLVEMENT_LEVELS}
                                                                            placeholder="Nível..."
                                                                            className="h-10 text-[10px]"
                                                                        />
                                                                    </div>
                                                                )}

                                                                {isAlmcItemRequest ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleAlmcItemNotificationDecision(notification, 'approved')}
                                                                            className="h-10 px-5 rounded-xl bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider hover:bg-slate-900 transition-all shadow-sm flex items-center gap-2"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                                            Confirmar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleAlmcItemNotificationDecision(notification, 'rejected')}
                                                                            className="h-10 px-5 rounded-xl bg-white border border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center gap-2"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                                                            Recusar
                                                                        </button>
                                                                    </>
                                                                ) : ( (isRefusal || isTransportRequest) && !notification.acknowledged ) ? (
                                                                    <button
                                                                        onClick={() => handleAcknowledgement(notification)}
                                                                        className="h-10 px-5 rounded-xl bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider hover:bg-slate-900 transition-all shadow-sm flex items-center gap-2"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                                        Ciente
                                                                    </button>
                                                                ) : (isSystem || isAcknowledgment || isChatRoomCreated || isEventDeleted) ? (
                                                                    <>
                                                                        {isChatRoomCreated && event && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const date = new Date(event.date_start);
                                                                                    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                                                    navigate(`/calendar?view=day&date=${dateStr}&openChat=${event.id}`);
                                                                                }}
                                                                                className="h-10 px-5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[18px]">forum</span>
                                                                                Chat
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleNotificationAction(notification, 'accepted')}
                                                                            className="h-10 px-5 rounded-xl bg-slate-800 text-white text-[11px] font-black uppercase tracking-wider hover:bg-slate-900 transition-all shadow-sm flex items-center gap-2"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                                            Ciente
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleNotificationAction(notification, 'accepted')}
                                                                            className="h-10 px-5 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-wider hover:bg-primary-dark transition-all shadow-sm flex items-center gap-2"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                                            Aceitar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleNotificationAction(notification, 'rejected')}
                                                                            className="h-10 px-5 rounded-xl bg-white border border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-wider hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all flex items-center gap-2"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                                                            Recusar
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed animate-in fade-in zoom-in duration-500">
                                        <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined text-3xl text-slate-300">notifications_off</span>
                                        </div>
                                        <p className="text-slate-500 font-bold text-sm tracking-tight">Nenhuma notificação pendente</p>
                                        <p className="text-slate-400 text-[11px] mt-1">Tudo limpo por aqui!</p>
                                    </div>
                                )
                            ) : (
                                filteredHistoryNotifications.length > 0 ? (
                                    <>
                                        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4">
                                            {filteredHistoryNotifications.map((notification) => {
                                                const event = notification.expand?.event;
                                                const location = event?.expand?.location;
                                                const isInvite = notification.type === 'event_invite';
                                                const isAlmcItemRequest = notification.data?.kind === 'almc_item_request';
                                                const isApproved = notification.title.toLowerCase().includes('aprovada') || notification.title.toLowerCase().includes('aceito');
                                                const isRejected = notification.title.toLowerCase().includes('reprovada') || notification.title.toLowerCase().includes('recusado');
                                                const isRefusal = notification.type === 'refusal';
                                                const isAcknowledgment = notification.type === 'acknowledgment';
                                                const isChatRoomCreated = notification.type === 'chat_room_created';
                                                const isEventDeleted = notification.type === 'event_deleted';
                                                const inviteStatus = notification.invite_status;
                                                const inviteLabel = inviteStatus === 'accepted' ? 'Aceito' : inviteStatus === 'rejected' ? 'Recusado' : 'Pendente';

                                                const isInviteRefusal = isRefusal && notification.data?.kind === 'event_invite_response';

                                                // Determine who to talk to:
                                                const talkToId = (isRefusal || isApproved || isAcknowledgment || isEventDeleted) 
                                                    ? (notification.data?.rejected_by || notification.data?.approved_by || notification.data?.deleted_by || event?.user || event?.expand?.user?.id)
                                                    : (event?.user || event?.expand?.user?.id || notification.expand?.related_request?.created_by || notification.expand?.related_request?.expand?.created_by?.id);
                                                
                                                const talkToName = (isRefusal || isApproved || isAcknowledgment || isEventDeleted)
                                                    ? (notification.data?.rejected_by_name || notification.data?.approved_by_name || notification.data?.deleted_by_name || event?.expand?.user?.name || 'Criador')
                                                    : (event?.expand?.user?.name || notification.expand?.related_request?.expand?.created_by?.name || 'Criador');

                                                // Limpar mensagem para evitar duplicidade se houver requester_message no data
                                                const displayMessage = (notification.message || '')
                                                    .split('\n\nMensagem:')[0]
                                                    .split('\nMensagem:')[0]
                                                    .split('\n\nSua mensagem:')[0]
                                                    .split('\nSua mensagem:')[0];

                                                const roleDisplay = notification.data?.role || notification.expand?.event?.participants_roles?.[user?.id || ''];

                                                return (
                                                    <div key={notification.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 flex items-stretch min-h-[100px]">
                                                        {/* Status indicator bar */}
                                                        <div className={`w-1.5 shrink-0 rounded-l-2xl ${
                                                            isApproved || isAcknowledgment ? 'bg-slate-800' : 
                                                            isRejected || isRefusal ? 'bg-slate-400' : 
                                                            isInvite ? 'bg-slate-700' : 
                                                            isAlmcItemRequest ? 'bg-slate-600' :
                                                            'bg-slate-400'
                                                        }`}></div>

                                                        <div className="flex-1 p-5 flex flex-col md:flex-row md:items-center gap-6">
                                                            {/* Icon & Category */}
                                                            <div className="flex flex-col gap-1.5 min-w-[150px] shrink-0">
                                                                <div className="flex items-center gap-2.5 text-slate-500">
                                                                    <div className={`size-8 rounded-xl flex items-center justify-center ${
                                                                        isInvite ? 'bg-slate-100 text-slate-700' :
                                                                        notification.type === 'event_participation_request' ? 'bg-primary/10 text-primary' :
                                                                        isAlmcItemRequest ? 'bg-slate-100 text-slate-600' :
                                                                        isApproved || isAcknowledgment ? 'bg-slate-100 text-slate-800' :
                                                                        'bg-slate-50 text-slate-400'
                                                                    }`}>
                                                                        <span className="material-symbols-outlined text-[18px] font-bold">
                                                                            {isInvite ? 'person_add' : 
                                                                             isAlmcItemRequest ? 'inventory_2' :
                                                                             notification.type === 'event_participation_request' ? 'groups' :
                                                                             isChatRoomCreated ? 'forum' :
                                                                             isEventDeleted ? 'delete_forever' :
                                                                             isApproved || isAcknowledgment ? 'check_circle' :
                                                                             isRejected || isRefusal ? 'cancel' :
                                                                             'pending_actions'}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                                        {isInvite ? 'Convite' : 
                                                                         isAlmcItemRequest ? 'Recursos' :
                                                                         notification.type === 'event_participation_request' ? 'Particip.' :
                                                                         isChatRoomCreated ? 'Sala' :
                                                                         isEventDeleted ? 'Exclusão' :
                                                                         isRefusal ? 'Recusa' :
                                                                         isAcknowledgment ? 'Ciência' :
                                                                         'Notificação'}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 font-bold ml-10">
                                                                    {new Date(notification.created).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Main Content */}
                                                            <div className="flex-1 flex flex-col gap-2">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-primary transition-colors">
                                                                        {event?.title || notification.title}
                                                                    </h3>
                                                                    {roleDisplay && (
                                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider">
                                                                            {roleDisplay}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                                                                    {displayMessage}
                                                                </p>

                                                                {(notification.data?.requester_message || notification.data?.original_message) && (
                                                                    <div className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 flex gap-2.5 items-start">
                                                                        <span className="material-symbols-outlined text-[16px] text-slate-300 mt-0.5">chat_bubble</span>
                                                                        <p className="text-[11px] text-slate-500 italic leading-relaxed">
                                                                            "{notification.data?.requester_message || notification.data?.original_message}"
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Event details if available */}
                                                                {event && (
                                                                    <div className="flex items-center gap-4 mt-1">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="material-symbols-outlined text-[14px] text-slate-300">calendar_today</span>
                                                                            <span className="text-[10px] text-slate-400 font-bold">{new Date(event.date_start).toLocaleDateString()}</span>
                                                                        </div>
                                                                        {(location || event.custom_location || event.location === 'external') && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="material-symbols-outlined text-[14px] text-slate-300">location_on</span>
                                                                                <span className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">
                                                                                    {event.custom_location || location?.name || (event.location === 'external' ? 'LUGAR EXTERNO NÃO FIXO' : 'Local não definido')}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Status Badges & Actions */}
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                {talkToId && talkToId !== user?.id && !isEventDeleted && (
                                                                    <button
                                                                        onClick={() => navigate(`/chat?userId=${talkToId}`)}
                                                                        className="size-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center shadow-sm"
                                                                        title={`Conversar com ${talkToName}`}
                                                                    >
                                                                        <span className="material-symbols-outlined text-[20px]">chat</span>
                                                                    </button>
                                                                )}
                                                                
                                                                <div className="flex items-center gap-2">
                                                                    {inviteStatus && (
                                                                        <div className={`h-8 px-4 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                                                                            inviteStatus === 'accepted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                                                                            inviteStatus === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' : 
                                                                            'bg-slate-50 text-slate-400 border border-slate-100'
                                                                        }`}>
                                                                            <span className="material-symbols-outlined text-[14px]">
                                                                                {inviteStatus === 'accepted' ? 'check_circle' : inviteStatus === 'rejected' ? 'cancel' : 'schedule'}
                                                                            </span>
                                                                            {inviteLabel}
                                                                        </div>
                                                                    )}
                                                                    
                                                                    <button
                                                                        onClick={() => handleDeleteNotification(notification.id)}
                                                                        className="size-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                                                                        title="Excluir notificação"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-center">
                                            {historyHasMore ? (
                                                <button
                                                    onClick={() => fetchHistoryNotifications(historyPage + 1, true)}
                                                    disabled={historyLoading}
                                                    className="h-10 px-6 rounded-xl bg-white border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-60"
                                                >
                                                    {historyLoading ? 'Carregando...' : 'Carregar mais'}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400">Fim do histórico.</span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed animate-in fade-in zoom-in duration-500">
                                        <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined text-3xl text-slate-300">history</span>
                                        </div>
                                        <p className="text-slate-500 font-bold text-sm tracking-tight">Histórico vazio</p>
                                        <p className="text-slate-400 text-[11px] mt-1">Suas notificações lidas aparecerão aqui</p>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default Requests;
