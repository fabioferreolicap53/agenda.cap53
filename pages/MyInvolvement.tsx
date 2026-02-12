import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import EventDetailsModal from '../components/EventDetailsModal';
import { 
    PieChart, Pie, Cell, 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, 
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { createPortal } from 'react-dom';

// --- i18n Support ---
const translations = {
    'pt-BR': {
        title: 'Meu Espaço',
        tabs: {
            created: 'Eventos que criei',
            invites: 'Convites e Solicitações',
            pending: 'Meus pedidos',
            history: 'Histórico completo',
            stats: 'Estatísticas'
        },
        actions: {
            edit: 'Editar',
            duplicate: 'Duplicar',
            close_reg: 'Encerrar inscrições',
            accept: 'Aceitar',
            refuse: 'Recusar',
            details: 'Ver detalhes',
            cancel: 'Cancelar pedido'
        },
        labels: {
            status: 'Status',
            date: 'Data',
            participants: 'Participantes',
            sender: 'Remetente',
            location: 'Local',
            days_ago: 'dias atrás',
            no_events: 'Nenhum evento encontrado',
            search: 'Buscar por nome do evento...',
            loading: 'Carregando...',
            filter_year: 'Filtrar por ano',
            filter_type: 'Filtrar por tipo',
            filter_status: 'Filtrar por status',
            confirmed: 'confirmados',
            requested_ago: 'Solicitado há',
            creator: 'Criador',
            participant: 'Participante',
            invite: 'Convite',
            from: 'De',
            page: 'Página',
            of: 'de',
            all_clear: 'Tudo limpo por aqui!',
            header_desc: 'Acompanhe seu desempenho e compromissos',
            events_created: 'Eventos Criados',
            events_participated: 'Eventos Participados',
            creator_badge: 'CRIADOR'
        },
        statuses: {
            active: 'Ativo',
            pending: 'Pendente',
            canceled: 'Cancelado',
            refused: 'Recusado',
            finished: 'Finalizado',
            rejected: 'Rejeitado',
            accepted: 'Aceito'
        },
        stats: {
            participation_dist: 'Distribuição de participações',
            monthly_evolution: 'Evolução mensal (12 meses)',
            top_engagement: 'Status das Solicitações e Convites',
            skills_radar: 'Tipos e Naturezas de Eventos',
            creator: 'Criador',
            organizer: 'Organizador',
            coorganizer: 'Coorganizador',
            participant: 'Participante',
            speaker: 'Palestrante',
            listener: 'Ouvinte'
        }
    },
    'en-US': {
        title: 'Involvement Data',
        tabs: {
            created: 'Events I created',
            invites: 'Invites received',
            pending: 'Pending requests',
            history: 'Full history',
            stats: 'Statistics'
        },
        actions: {
            edit: 'Edit',
            duplicate: 'Duplicate',
            close_reg: 'Close registrations',
            accept: 'Accept',
            refuse: 'Refuse',
            details: 'View details',
            cancel: 'Cancel request'
        },
        labels: {
            status: 'Status',
            date: 'Date',
            participants: 'Participants',
            sender: 'Sender',
            location: 'Location',
            days_ago: 'days ago',
            no_events: 'No events found',
            search: 'Search by event name...',
            loading: 'Loading...',
            filter_year: 'Filter by year',
            filter_type: 'Filter by type',
            filter_status: 'Filter by status',
            confirmed: 'confirmed',
            requested_ago: 'Requested',
            creator: 'Creator',
            organizer: 'Organizer',
            coorganizer: 'Co-organizer',
            participant: 'Participant',
            invite: 'Invite',
            from: 'From',
            page: 'Page',
            of: 'of',
            all_clear: 'All clear here!',
            header_desc: 'Track your performance and commitments'
        },
        statuses: {
            active: 'Active',
            pending: 'Pending',
            canceled: 'Canceled',
            refused: 'Refused',
            finished: 'Finished',
            rejected: 'Rejected',
            accepted: 'Accepted'
        },
        stats: {
            participation_dist: 'Participation distribution',
            monthly_evolution: 'Monthly evolution (12 months)',
            top_engagement: 'Request and Invitation Status',
            skills_radar: 'Event Types and Nature',
            creator: 'Creator',
            organizer: 'Organizer',
            coorganizer: 'Co-organizer',
            participant: 'Participant',
            speaker: 'Speaker',
            listener: 'Listener'
        }
    }
};

type Language = 'pt-BR' | 'en-US';

// --- Types ---
interface EventRecord {
    id: string;
    title: string;
    description: string;
    date_start: string;
    status: string;
    participants: string[];
    user: string;
    creator_role?: string;
    custom_location?: string;
    location?: string;
    expand?: any;
}

interface NotificationRecord {
    id: string;
    title: string;
    message: string;
    type: string;
    created: string;
    data?: any;
    expand?: any;
}

interface RequestRecord {
    id: string;
    event: string;
    user: string;
    status: string;
    created: string;
    role?: string;
    expand?: any;
}

const COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];

// --- Simple Cache Implementation ---
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const dataCache: Record<string, { data: any, timestamp: number }> = {};

const getCachedData = (key: string) => {
    const cached = dataCache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
};

const setCachedData = (key: string, data: any) => {
    dataCache[key] = { data, timestamp: Date.now() };
};

const MyInvolvement: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [lang] = useState<Language>('pt-BR'); // Default to PT-BR
    const t = (key: string) => {
        const keys = key.split('.');
        let val: any = translations[lang];
        for (const k of keys) {
            val = val ? val[k] : undefined;
        }
        return val || key;
    };

    const getStatusLabel = (status: string) => {
        return t(`statuses.${status.toLowerCase()}`) || status;
    };

    const getRoleLabel = (role?: string) => {
        if (!role) return t('stats.participant');
        
        const upperRole = role.toUpperCase();
        let roleKey = '';
        
        if (upperRole === 'CRIADOR') roleKey = 'creator';
        else if (upperRole === 'ORGANIZADOR') roleKey = 'organizer';
        else if (upperRole === 'COORGANIZADOR') roleKey = 'coorganizer';
        else if (upperRole === 'PARTICIPANTE') roleKey = 'participant';
        else if (upperRole === 'PALESTRANTE') roleKey = 'speaker';
        else if (upperRole === 'OUVINTE') roleKey = 'listener';
        else roleKey = role.toLowerCase().replace(' ', '');
        
        return t(`stats.${roleKey}`) || role;
    };

    const [activeTab, setActiveTab] = useState<'created' | 'invites' | 'pending' | 'history' | 'stats'>('created');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Data States
    const [createdEvents, setCreatedEvents] = useState<EventRecord[]>([]);
    const [invites, setInvites] = useState<NotificationRecord[]>([]);
    const [pendingRequests, setPendingRequests] = useState<RequestRecord[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [allParticipations, setAllParticipations] = useState<any[]>([]);
    const [allSolicitations, setAllSolicitations] = useState<any[]>([]);
    const [eventTypes, setEventTypes] = useState<any[]>([]);
    
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [requestRoles, setRequestRoles] = useState<Record<string, string>>({});
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [initialChatOpen, setInitialChatOpen] = useState(false);

    // Filters for history
    const [filterYear, setFilterYear] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Fetch unread count for My Space
    const fetchUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const res = await pb.collection('agenda_cap53_notifications').getList(1, 1, {
                filter: `user = "${user.id}" && read = false && (type = "event_invite" || type = "event_participation_request")`
            });
            setUnreadCount(res.totalItems);
        } catch (e) {
            console.error("Error fetching unread count", e);
        }
    }, [user]);

    useEffect(() => {
        fetchUnreadCount();

        // Subscribe to real-time updates for notifications
        const unsubscribe = pb.collection('agenda_cap53_notifications').subscribe('*', () => {
            fetchUnreadCount();
        });

        return () => {
            pb.collection('agenda_cap53_notifications').unsubscribe('*');
        };
    }, [fetchUnreadCount]);

    // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        
        const cacheKey = `${activeTab}-${page}-${debouncedSearch}-${filterYear}-${filterType}-${filterStatus}`;
        const cached = getCachedData(cacheKey);
        
        if (cached) {
            if (activeTab === 'created') setCreatedEvents(cached.items);
            else if (activeTab === 'invites') setInvites(cached.items);
            else if (activeTab === 'pending') setPendingRequests(cached.items);
            else if (activeTab === 'history') setHistory(cached.items);
            else if (activeTab === 'stats') {
                setAllParticipations(cached.allParticipations);
                setAllSolicitations(cached.allSolicitations);
                setCreatedEvents(cached.createdEvents);
            }
            setTotalPages(cached.totalPages);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const filter = debouncedSearch ? `title ~ "${debouncedSearch}"` : '';
            let res;

            if (activeTab === 'created') {
                res = await pb.collection('agenda_cap53_eventos').getList(page, 20, {
                    filter: `user = "${user.id}"${filter ? ` && ${filter}` : ''}`,
                    sort: '-created',
                    expand: 'location'
                });
                setCreatedEvents(res.items as any);
            } else if (activeTab === 'invites') {
                res = await pb.collection('agenda_cap53_notifications').getList(page, 20, {
                    filter: `user = "${user.id}" && (type = "event_invite" || type = "event_participation_request") && invite_status = "pending"${debouncedSearch ? ` && title ~ "${debouncedSearch}"` : ''}`,
                    sort: '-created',
                    expand: 'event,event.location,event.user'
                });
                setInvites(res.items as any);
                
                // Mark these notifications as read when viewed
                const unreadIds = res.items.filter(n => !n.read).map(n => n.id);
                if (unreadIds.length > 0) {
                    await Promise.all(unreadIds.map(id => 
                        pb.collection('agenda_cap53_notifications').update(id, { read: true })
                    ));
                    fetchUnreadCount(); // Update count after marking as read
                }
            } else if (activeTab === 'pending') {
                res = await pb.collection('agenda_cap53_solicitacoes_evento').getList(page, 20, {
                    filter: `user = "${user.id}" && status = "pending"${debouncedSearch ? ` && event.title ~ "${debouncedSearch}"` : ''}`,
                    sort: '-created',
                    expand: 'event,event.location,event.user'
                });
                setPendingRequests(res.items as any);
            } else if (activeTab === 'history') {
                let historyFilter = `(user = "${user.id}" || participants ~ "${user.id}")`;
                if (filterYear !== 'all') historyFilter += ` && date_start ~ "${filterYear}"`;
                if (filterStatus !== 'all') historyFilter += ` && status = "${filterStatus}"`;
                if (filterType !== 'all') historyFilter += ` && type = "${filterType}"`;
                if (debouncedSearch) historyFilter += ` && title ~ "${debouncedSearch}"`;
                
                res = await pb.collection('agenda_cap53_eventos').getList(page, 20, {
                    filter: historyFilter,
                    sort: '-date_start',
                    expand: 'location,user'
                });

                // Fetch user roles for these events
                if (res.items.length > 0) {
                    const eventIds = res.items.map(i => i.id);
                    const participations = await pb.collection('agenda_cap53_participantes').getFullList({
                        filter: `user = "${user.id}" && (${eventIds.map(id => `event = "${id}"`).join(' || ')})`
                    });
                    
                    const roleMap = new Map(participations.map(p => [p.event, p.role]));
                    res.items.forEach((item: any) => {
                    if (item.user !== user.id) {
                        item.userRole = roleMap.get(item.id);
                        item.type = 'participation';
                    } else {
                        item.type = 'created';
                    }
                });
                }

                setHistory(res.items);
            } else if (activeTab === 'stats') {
                // Fetch all data for stats
                const [participations, solicitations, created] = await Promise.all([
                    pb.collection('agenda_cap53_participantes').getFullList({
                        filter: `user = "${user.id}"`,
                        expand: 'event'
                    }),
                    pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
                        filter: `user = "${user.id}"`,
                        expand: 'event'
                    }),
                    pb.collection('agenda_cap53_eventos').getFullList({
                        filter: `user = "${user.id}"`
                    })
                ]);
                
                setAllParticipations(participations);
                setAllSolicitations(solicitations);
                setCreatedEvents(created as any);
                
                setCachedData(cacheKey, { 
                    allParticipations: participations, 
                    allSolicitations: solicitations, 
                    createdEvents: created,
                    totalPages: 1 
                });
                setLoading(false);
                return;
            }

            if (res) {
                setTotalPages(res.totalPages);
                setCachedData(cacheKey, { items: res.items, totalPages: res.totalPages });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [user, activeTab, page, debouncedSearch, filterYear, filterStatus, filterType, fetchUnreadCount]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch event types for filters
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const types = await pb.collection('agenda_cap53_tipos_evento').getFullList({
                    sort: 'name',
                    filter: 'active = true'
                });
                setEventTypes(types);
            } catch (err) {
                console.error('Error fetching event types:', err);
            }
        };
        fetchTypes();
    }, []);

    // Real-time subscriptions
    useEffect(() => {
        if (!user) return;

        const subscribe = async () => {
            // Subscribe to notifications (invites)
            pb.collection('agenda_cap53_notifications').subscribe('*', (e) => {
                if (e.record.user === user.id && (e.action === 'create' || e.action === 'update' || e.action === 'delete')) {
                    Object.keys(dataCache).forEach(key => delete dataCache[key]);
                    fetchData();
                }
            });

            // Subscribe to requests
            pb.collection('agenda_cap53_solicitacoes_evento').subscribe('*', (e) => {
                if (e.record.user === user.id && (e.action === 'create' || e.action === 'update' || e.action === 'delete')) {
                    Object.keys(dataCache).forEach(key => delete dataCache[key]);
                    fetchData();
                }
            });

            // Subscribe to events (where user is creator or participant)
            pb.collection('agenda_cap53_eventos').subscribe('*', (e) => {
                const isCreator = e.record.user === user.id;
                const isParticipant = (e.record.participants || []).includes(user.id);
                
                if (isCreator || isParticipant) {
                    Object.keys(dataCache).forEach(key => delete dataCache[key]);
                    fetchData();
                }
            });
        };

        subscribe();

        return () => {
            pb.collection('agenda_cap53_notifications').unsubscribe('*');
            pb.collection('agenda_cap53_solicitacoes_evento').unsubscribe('*');
            pb.collection('agenda_cap53_eventos').unsubscribe('*');
        };
    }, [user, fetchData]);

    // Actions
    const handleAcceptInvite = async (id: string) => {
        try {
            const notif = await pb.collection('agenda_cap53_notifications').getOne(id, {
                expand: 'event,event.user,related_request'
            });

            if (notif.type === 'event_participation_request') {
                const eventId = notif.expand?.event?.id || notif.event;
                const requesterId = notif.data?.requester_id || notif.expand?.related_request?.user;
                
                if (eventId && requesterId) {
                    const selectedRole = requestRoles[id] || 'PARTICIPANTE';

                    // 1. Update the request record if it exists
                    try {
                        const requests = await pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
                            filter: `event = "${eventId}" && user = "${requesterId}" && status = "pending"`
                        });
                        for (const req of requests) {
                            await pb.collection('agenda_cap53_solicitacoes_evento').update(req.id, {
                                status: 'approved',
                                role: selectedRole
                            });
                        }
                    } catch (e) { console.error('Error updating request:', e); }

                    // 2. Add to participants
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

                    // 3. Notify requester
                    const eventTitle = notif.expand?.event?.title || 'Evento';
                    await pb.collection('agenda_cap53_notifications').create({
                        user: requesterId,
                        title: 'Solicitação Aprovada',
                        message: `Sua solicitação para participar do evento "${eventTitle}" foi aprovada. Nível: ${selectedRole}.`,
                        type: 'system',
                        event: eventId,
                        read: false,
                        data: { kind: 'participation_request_response', action: 'accepted', role: selectedRole }
                    });
                }
                
                await pb.collection('agenda_cap53_notifications').update(id, {
                    invite_status: 'accepted',
                    read: true
                });
            } else {
                // Original event_invite logic
                await pb.collection('agenda_cap53_notifications').update(id, {
                    invite_status: 'accepted',
                    read: true
                });
                
                if (notif.event) {
                    // 1. Update event participants list
                    const event = await pb.collection('agenda_cap53_eventos').getOne(notif.event);
                    const participants = event.participants || [];
                    if (!participants.includes(user!.id)) {
                        await pb.collection('agenda_cap53_eventos').update(notif.event, {
                            participants: [...participants, user!.id]
                        });
                    }

                    // 2. Update participants collection status
                    try {
                        const participantRecord = await pb.collection('agenda_cap53_participantes').getFirstListItem(
                            `event = "${notif.event}" && user = "${user!.id}"`
                        );
                        if (participantRecord) {
                            await pb.collection('agenda_cap53_participantes').update(participantRecord.id, {
                                status: 'accepted'
                            });
                        }
                    } catch (e) {
                        await pb.collection('agenda_cap53_participantes').create({
                            event: notif.event,
                            user: user!.id,
                            status: 'accepted',
                            role: 'PARTICIPANTE'
                        });
                    }

                    // Notify creator
                    if (notif.expand?.event?.user) {
                        const participantName = user!.name || user!.email;
                        await pb.collection('agenda_cap53_notifications').create({
                            user: notif.expand.event.user,
                            title: 'Convite Aceito',
                            message: `${participantName} aceitou o convite para o evento "${notif.expand.event.title}".`,
                            type: 'system',
                            read: false,
                            event: notif.event,
                            data: { kind: 'event_invite_response', action: 'accepted', participant_id: user!.id }
                        });
                    }
                }
            }
            
            // Invalidate cache
            Object.keys(dataCache).forEach(key => delete dataCache[key]);
            fetchData();
        } catch (error) {
            console.error('Error accepting action:', error);
        }
    };

    const handleRefuseInvite = async (id: string) => {
        try {
            const notif = await pb.collection('agenda_cap53_notifications').getOne(id, {
                expand: 'event,event.user,related_request'
            });

            if (notif.type === 'event_participation_request') {
                const eventId = notif.expand?.event?.id || notif.event;
                const requesterId = notif.data?.requester_id || notif.expand?.related_request?.user;
                
                if (eventId && requesterId) {
                    // 1. Update the request record if it exists
                    try {
                        const requests = await pb.collection('agenda_cap53_solicitacoes_evento').getFullList({
                            filter: `event = "${eventId}" && user = "${requesterId}" && status = "pending"`
                        });
                        for (const req of requests) {
                            await pb.collection('agenda_cap53_solicitacoes_evento').update(req.id, {
                                status: 'rejected'
                            });
                        }
                    } catch (e) { console.error('Error updating request:', e); }

                    // 2. Notify requester
                    const eventTitle = notif.expand?.event?.title || 'Evento';
                    await pb.collection('agenda_cap53_notifications').create({
                        user: requesterId,
                        title: 'Solicitação Recusada',
                        message: `Sua solicitação para participar do evento "${eventTitle}" foi recusada.`,
                        type: 'refusal',
                        event: eventId,
                        read: false,
                        data: { kind: 'participation_request_response', action: 'rejected' }
                    });
                }

                await pb.collection('agenda_cap53_notifications').update(id, {
                    invite_status: 'rejected',
                    read: true
                });
            } else {
                // Original event_invite logic
                await pb.collection('agenda_cap53_notifications').update(id, {
                    invite_status: 'rejected',
                    read: true
                });

                if (notif.event) {
                    // 1. Remove from event participants list if present
                    const event = await pb.collection('agenda_cap53_eventos').getOne(notif.event);
                    const participants = event.participants || [];
                    if (participants.includes(user!.id)) {
                        await pb.collection('agenda_cap53_eventos').update(notif.event, {
                            participants: participants.filter(p => p !== user!.id)
                        });
                    }

                    // 2. Update or create participant record with rejected status
                    try {
                        const participantRecord = await pb.collection('agenda_cap53_participantes').getFirstListItem(
                            `event = "${notif.event}" && user = "${user!.id}"`
                        );
                        if (participantRecord) {
                            await pb.collection('agenda_cap53_participantes').update(participantRecord.id, {
                                status: 'rejected'
                            });
                        }
                    } catch (e) {
                        await pb.collection('agenda_cap53_participantes').create({
                            event: notif.event,
                            user: user!.id,
                            status: 'rejected',
                            role: 'PARTICIPANTE'
                        });
                    }

                    // Notify creator
                    if (notif.expand?.event?.user) {
                        const participantName = user!.name || user!.email;
                        await pb.collection('agenda_cap53_notifications').create({
                            user: notif.expand.event.user,
                            title: 'Convite Recusado',
                            message: `${participantName} recusou o convite para o evento "${notif.expand.event.title}".`,
                            type: 'refusal',
                            read: false,
                            event: notif.event,
                            data: { kind: 'event_invite_response', action: 'rejected', participant_id: user!.id }
                        });
                    }
                }
            }
            
            // Invalidate cache
            Object.keys(dataCache).forEach(key => delete dataCache[key]);
            fetchData();
        } catch (error) {
            console.error('Error refusing action:', error);
        }
    };

    const handleCancelRequest = async (id: string) => {
        try {
            await pb.collection('agenda_cap53_solicitacoes_evento').delete(id);
            // Invalidate cache
            Object.keys(dataCache).forEach(key => delete dataCache[key]);
            fetchData();
        } catch (error) {
            console.error('Error canceling request:', error);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este evento permanentemente?')) return;
        try {
            await pb.collection('agenda_cap53_eventos').delete(id);
            // Invalidate cache and refetch
            Object.keys(dataCache).forEach(key => delete dataCache[key]);
            fetchData();
        } catch (error) {
            console.error('Error deleting event:', error);
        }
    };

    const handleCancelEvent = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja cancelar este evento?')) return;
        try {
            await pb.collection('agenda_cap53_eventos').update(id, {
                status: 'canceled'
            });
            // Invalidate cache and refetch
            Object.keys(dataCache).forEach(key => delete dataCache[key]);
            fetchData();
        } catch (error) {
            console.error('Error canceling event:', error);
        }
    };

    // Stats Data (Derived from actual fetched data)
    const statsData = useMemo(() => {
        // 1. Pie Chart: Participation Distribution (Roles)
        // Combine created events and accepted participations/solicitations
        const rolesCount = {
            organizer: 0,
            coorganizer: 0,
            participant: 0,
            creator_participant: 0
        };

        // Use creator_role for created events
        createdEvents.forEach(evt => {
            // Para eventos criados, o usuário é sempre "Criador e Participante"
            rolesCount.creator_participant++;
        });

        allParticipations.forEach(p => {
            if (p.status === 'accepted') {
                const role = (p.role || 'PARTICIPANTE').toUpperCase();
                // Se o usuário já foi contado como criador deste evento, não contamos aqui
                const isCreator = createdEvents.some(evt => evt.id === p.event);
                if (isCreator) return;

                if (role === 'ORGANIZADOR') rolesCount.organizer++;
                else if (role === 'COORGANIZADOR') rolesCount.coorganizer++;
                else if (role === 'PARTICIPANTE') rolesCount.participant++;
                else if (role === 'CRIADOR') rolesCount.creator_participant++;
            }
        });

        // Summary metrics
        const summary = {
            totalCreated: createdEvents.length,
            totalParticipated: allParticipations.filter(p => p.status === 'accepted').length,
            engagementRate: 0
        };
        
        const totalPossible = summary.totalCreated + allParticipations.length;
        summary.engagementRate = totalPossible > 0 ? Math.round((summary.totalParticipated / totalPossible) * 100) : 0;

        // 2. Line Chart: Monthly Evolution (last 12 months)
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const monthlyData = monthNames.map(name => ({ name, events: 0 }));
        
        const currentYear = new Date().getFullYear();
        [...createdEvents, ...allParticipations.filter(p => p.status === 'accepted').map(p => p.expand?.event)].forEach(evt => {
            if (evt && evt.date_start) {
                const date = new Date(evt.date_start);
                if (date.getFullYear() === currentYear) {
                    monthlyData[date.getMonth()].events++;
                }
            }
        });

        // 3. Bar Chart: Status Overview (Pending vs Accepted vs Rejected)
        const statusData = [
            { name: t('statuses.accepted'), value: allParticipations.filter(p => p.status === 'accepted').length + allSolicitations.filter(s => s.status === 'approved').length },
            { name: t('statuses.pending'), value: allParticipations.filter(p => p.status === 'pending').length + allSolicitations.filter(s => s.status === 'pending').length },
            { name: t('statuses.rejected'), value: allParticipations.filter(p => p.status === 'rejected').length + allSolicitations.filter(s => s.status === 'rejected').length },
        ];

        // 4. Radar Chart: Event Types and Nature
        // We'll count types from events the user is involved in
        const typeCounts: Record<string, number> = {};
        [...createdEvents, ...allParticipations.filter(p => p.status === 'accepted').map(p => p.expand?.event)].forEach(evt => {
            if (evt && evt.type) {
                typeCounts[evt.type] = (typeCounts[evt.type] || 0) + 1;
            }
        });

        const radarData = Object.entries(typeCounts).map(([subject, count]) => ({
            subject,
            A: count,
            fullMark: Math.max(...Object.values(typeCounts), 5)
        })).slice(0, 6); // Limit to top 6 for better visualization

        if (radarData.length < 3) {
            // Add some default categories if data is sparse
            const defaults = ['Reunião', 'Workshop', 'Treinamento'];
            defaults.forEach(d => {
                if (!typeCounts[d]) radarData.push({ subject: d, A: 0, fullMark: 5 });
            });
        }

        return {
            summary,
            pie: [
                { name: 'Criador e Participante', value: rolesCount.creator_participant },
                { name: t('stats.organizer'), value: rolesCount.organizer },
                { name: t('stats.coorganizer'), value: rolesCount.coorganizer },
                { name: 'Participante', value: rolesCount.participant },
            ].filter(d => d.value > 0),
            line: monthlyData,
            bar: statusData,
            radar: radarData
        };
    }, [createdEvents, allParticipations, allSolicitations, lang]);

    const handleOpenEventDetails = (event: any, chat: boolean = false) => {
        setSelectedEvent(event);
        setInitialChatOpen(chat);
    };

    // Components
    const Skeleton = ({ type = 'card' }: { type?: 'card' | 'stats' }) => {
        if (type === 'stats') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-[350px] bg-slate-100 rounded-2xl border border-slate-200"></div>
                    ))}
                </div>
            );
        }
        return (
            <div className="animate-pulse flex flex-col gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-slate-100 rounded-2xl border border-slate-200 flex items-center p-6 gap-4">
                        <div className="size-12 bg-slate-200 rounded-full"></div>
                        <div className="flex-1 space-y-3">
                            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const EmptyState = ({ tab }: { tab: string }) => {
        const icons: Record<string, string> = {
            created: 'edit_calendar',
            invites: 'mail_outline',
            pending: 'hourglass_empty',
            history: 'history_toggle_off'
        };
        
        const messages: Record<string, string> = {
            created: 'Você ainda não criou nenhum evento.',
            invites: 'Você não tem convites pendentes.',
            pending: 'Você não possui solicitações de participação aguardando aprovação.',
            history: 'Nenhum registro encontrado no seu histórico.'
        };

        return (
            <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center animate-in fade-in zoom-in duration-500">
                <div className="size-16 md:size-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
                    <span className="material-symbols-outlined text-slate-300 text-3xl md:text-4xl">{icons[tab] || 'event_busy'}</span>
                </div>
                <h3 className="text-slate-800 font-bold text-base md:text-lg max-w-[280px] md:max-w-none mx-auto leading-relaxed">
                    {messages[tab] || t('labels.no_events')}
                </h3>
                <p className="text-slate-400 text-xs md:text-sm mt-2 font-medium tracking-wide uppercase">{t('labels.all_clear')}</p>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4 md:gap-6 max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 w-full overflow-x-auto custom-scrollbar-hide">
                {(['created', 'invites', 'pending', 'history', 'stats'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setPage(1); }}
                        className={`flex-1 min-w-[140px] md:min-w-0 px-4 md:px-5 py-2.5 rounded-xl text-[11px] md:text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 relative whitespace-nowrap ${
                            activeTab === tab 
                            ? 'bg-white text-primary shadow-md shadow-primary/5 ring-1 ring-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[18px] md:text-[20px]">
                            {tab === 'created' ? 'settings_suggest' : 
                             tab === 'invites' ? 'mail' : 
                             tab === 'pending' ? 'hourglass_top' : 
                             tab === 'history' ? 'history' : 'insights'}
                        </span>
                        {t(`tabs.${tab}`)}
                        {tab === 'invites' && unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 size-5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white font-bold animate-in zoom-in">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {loading ? (
                    <Skeleton type={activeTab === 'stats' ? 'stats' : 'card'} />
                ) : activeTab === 'stats' ? (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-slate-200">
                                <div className="flex items-center gap-3 opacity-60 mb-2">
                                    <span className="material-symbols-outlined text-sm">edit_calendar</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{t('labels.events_created')}</span>
                                </div>
                                <div className="text-3xl font-black">{statsData.summary.totalCreated}</div>
                                <div className="text-[10px] mt-2 opacity-50 font-bold uppercase">Eventos sob sua autoria</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-3 text-slate-400 mb-2">
                                    <span className="material-symbols-outlined text-sm">group</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{t('labels.events_participated')}</span>
                                </div>
                                <div className="text-3xl font-black text-slate-800">{statsData.summary.totalParticipated}</div>
                                <div className="text-[10px] mt-2 text-slate-400 font-bold uppercase">Presença confirmada</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-3 text-slate-400 mb-2">
                                    <span className="material-symbols-outlined text-sm">analytics</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Taxa de Engajamento</span>
                                </div>
                                <div className="text-3xl font-black text-slate-800">{statsData.summary.engagementRate}%</div>
                                <div className="text-[10px] mt-2 text-slate-400 font-bold uppercase">Participação em convites</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Pie Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider">{t('stats.participation_dist')}</h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={statsData.pie} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {statsData.pie.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Line Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider">{t('stats.monthly_evolution')}</h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={statsData.line}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                        <Line type="monotone" dataKey="events" stroke="#0f172a" strokeWidth={3} dot={{ r: 4, fill: '#0f172a' }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bar Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider">{t('stats.top_engagement')}</h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={statsData.bar} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} width={100} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#0f172a" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Radar Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider">{t('stats.skills_radar')}</h3>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={statsData.radar}>
                                        <PolarGrid stroke="#f1f5f9" />
                                        <PolarAngleAxis dataKey="subject" tick={{fontSize: 10, fill: '#64748b'}} />
                                        <PolarRadiusAxis angle={30} hide />
                                        <Radar name="User" dataKey="A" stroke="#0f172a" fill="#0f172a" fillOpacity={0.6} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        </div>

                        {/* Recent Activity Table */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Últimos Eventos Criados</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50">
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Evento</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Data</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Papel</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Pessoas</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {createdEvents.slice(0, 5).map(event => (
                                            <tr key={event.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{event.title}</div>
                                                    <div className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[140px]">
                                                        {event.expand?.location?.name || event.custom_location || t('labels.location_not_defined')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[10px] text-slate-600 font-medium whitespace-nowrap">
                                                    {new Date(event.date_start).toLocaleDateString(lang.startsWith('pt') ? 'pt-BR' : 'en-US')}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9px] font-black uppercase">
                                                        {getRoleLabel(event.creator_role)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                            {(event.participants || []).length}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                        event.status === 'active' ? 'text-emerald-500' : 'text-slate-400'
                                                    }`}>
                                                        {getStatusLabel(event.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button 
                                                            onClick={() => handleOpenEventDetails(event)}
                                                            className="size-8 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-sm active:scale-95"
                                                            title="Ver Detalhes"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                        </button>
                                                        {event.status !== 'canceled' && (
                                                            <button 
                                                                onClick={() => handleCancelEvent(event.id)}
                                                                className="size-8 flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-all border border-amber-100/50 active:scale-95"
                                                                title="Cancelar Evento"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">block</span>
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleDeleteEvent(event.id)}
                                                            className="size-8 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all border border-rose-100/50 active:scale-95"
                                                            title="Excluir Permanentemente"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {createdEvents.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                    Nenhum evento criado recentemente
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                        {/* Filters for History Tab */}
                        {activeTab === 'history' && (
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <select 
                                    value={filterYear}
                                    onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}
                                    className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                                >
                                    <option value="all">{t('labels.filter_year')}</option>
                                    {[2026, 2025, 2024, 2023].map(y => (
                                        <option key={y} value={y.toString()}>{y}</option>
                                    ))}
                                </select>

                                <select 
                                    value={filterType}
                                    onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                                    className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                                >
                                    <option value="all">{t('labels.filter_type')}</option>
                                    {eventTypes.map(type => (
                                        <option key={type.id} value={type.name}>{type.name}</option>
                                    ))}
                                </select>

                                <select 
                                    value={filterStatus}
                                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                                    className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                                >
                                    <option value="all">{t('labels.filter_status')}</option>
                                    <option value="active">{t('statuses.active')}</option>
                                    <option value="finished">{t('statuses.finished')}</option>
                                    <option value="canceled">{t('statuses.canceled')}</option>
                                </select>

                                {(filterYear !== 'all' || filterType !== 'all' || filterStatus !== 'all') && (
                                    <button 
                                        onClick={() => { setFilterYear('all'); setFilterType('all'); setFilterStatus('all'); setPage(1); }}
                                        className="h-9 px-3 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-all flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                                        Limpar
                                    </button>
                                )}
                            </div>
                        )}

                        {/* List Items based on Active Tab */}
                        {activeTab === 'created' && createdEvents.length > 0 ? createdEvents.map(event => (
                            <div key={event.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            event.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {getStatusLabel(event.status)}
                                        </span>
                                        <div className="flex items-center">
                                            <span className="px-2.5 py-0.5 rounded-l-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider border-r border-white/10">
                                                {t('labels.creator_badge')}
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-r-full bg-slate-100 text-slate-800 text-[10px] font-black uppercase tracking-wider">
                                                {getRoleLabel(event.creator_role)}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            {new Date(event.date_start).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-800 group-hover:text-primary transition-colors">{event.title}</h3>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                        {event.custom_location || event.expand?.location?.name || (event.location === 'external' ? 'LUGAR EXTERNO NÃO FIXO' : t('labels.location') + ' não definido')}
                                    </p>
                                    <div className="flex items-center gap-3 mt-3">
                                        <div className="flex -space-x-2">
                                            {(event.participants || []).slice(0, 3).map((p, i) => (
                                                <div key={i} className="size-7 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {p.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            {(event.participants || []).length > 3 && (
                                                <div className="size-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    +{(event.participants || []).length - 3}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-400">{(event.participants || []).length} {t('labels.confirmed')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button 
                                        onClick={() => handleOpenEventDetails(event)} 
                                        className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black hover:bg-slate-800 transition-all shadow-sm"
                                    >
                                        DETALHES
                                    </button>
                                    <button 
                                        onClick={() => navigate(`/create-event?eventId=${event.id}`)} 
                                        className="h-9 px-4 rounded-xl border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all"
                                    >
                                        {t('actions.edit').toUpperCase()}
                                    </button>
                                    {event.status !== 'canceled' && (
                                        <button 
                                            onClick={() => handleCancelEvent(event.id)} 
                                            className="h-9 px-4 rounded-xl border border-orange-100 text-[10px] font-black text-orange-600 hover:bg-orange-50 transition-all"
                                        >
                                            CANCELAR
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleDeleteEvent(event.id)} 
                                        className="h-9 px-4 rounded-xl border border-red-100 text-[10px] font-black text-red-600 hover:bg-red-50 transition-all"
                                    >
                                        EXCLUIR
                                    </button>
                                </div>
                            </div>
                        )) : activeTab === 'invites' && invites.length > 0 ? invites.map(notif => (
                            <div key={notif.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">{t('labels.invite')}</span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                            {getRoleLabel(notif.data?.role || 'PARTICIPANTE')}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">{t('labels.from')}: {notif.expand?.event?.expand?.user?.name || t('labels.creator')}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-800">{notif.expand?.event?.title || notif.title}</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {notif.expand?.event?.custom_location || notif.expand?.event?.expand?.location?.name || (notif.expand?.event?.location === 'external' ? 'LUGAR EXTERNO NÃO FIXO' : t('labels.location') + ' não definido')}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-2 italic">"{notif.message}"</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button 
                                        onClick={() => handleOpenEventDetails(notif.expand?.event)} 
                                        className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black hover:bg-slate-800 transition-all shadow-sm"
                                    >
                                        DETALHES
                                    </button>
                                    <button 
                                        onClick={() => handleRefuseInvite(notif.id)} 
                                        className="h-9 px-4 rounded-xl border border-red-100 text-[10px] font-black text-red-600 hover:bg-red-50 transition-all"
                                    >
                                        {t('actions.refuse').toUpperCase()}
                                    </button>
                                    <button 
                                        onClick={() => handleAcceptInvite(notif.id)} 
                                        className="h-9 px-4 rounded-xl bg-primary text-white text-[10px] font-black hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
                                    >
                                        {t('actions.accept').toUpperCase()}
                                    </button>
                                </div>
                            </div>
                        )) : activeTab === 'pending' && pendingRequests.length > 0 ? pendingRequests.map(req => (
                            <div key={req.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wider">{t('statuses.pending')}</span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                            {getRoleLabel(req.role || 'PARTICIPANTE')}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                                            {t('labels.requested_ago')} {Math.floor((new Date().getTime() - new Date(req.created).getTime()) / (1000 * 60 * 60 * 24))} {t('labels.days_ago')}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-800">{req.expand?.event?.title || 'Evento'}</h3>
                                    <p className="text-xs text-slate-500 mt-1">{t('labels.creator')}: {req.expand?.event?.expand?.user?.name || '---'}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button 
                                        onClick={() => handleOpenEventDetails(req.expand?.event)} 
                                        className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black hover:bg-slate-800 transition-all shadow-sm"
                                    >
                                        DETALHES
                                    </button>
                                    <button 
                                        onClick={() => handleCancelRequest(req.id)} 
                                        className="h-9 px-4 rounded-xl border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all"
                                    >
                                        {t('actions.cancel').toUpperCase()}
                                    </button>
                                </div>
                            </div>
                        )) : activeTab === 'history' && history.length > 0 ? history.map(item => (
                            <div key={item.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all duration-300 p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-80 hover:opacity-100">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="flex items-center">
                                            {item.type === 'created' && (
                                                <span className="px-2 py-0.5 rounded-l-md bg-slate-900 text-white text-[9px] font-black uppercase tracking-tighter border-r border-white/10">
                                                    {t('labels.creator_badge')}
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 ${item.type === 'created' ? 'rounded-r-md bg-slate-100 text-slate-800' : 'rounded-md bg-blue-50 text-blue-600'} text-[9px] font-black uppercase tracking-wider`}>
                                                {item.type === 'created' 
                                                    ? getRoleLabel(item.creator_role)
                                                    : getRoleLabel(item.userRole || 'PARTICIPANTE')}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400">{new Date(item.date_start).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-800">{item.title}</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {item.custom_location || item.expand?.location?.name || (item.location === 'external' ? 'LUGAR EXTERNO NÃO FIXO' : t('labels.location') + ' não definido')}
                                    </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <button 
                                        onClick={() => handleOpenEventDetails(item)} 
                                        className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black hover:bg-slate-800 transition-all shadow-sm"
                                    >
                                        DETALHES
                                    </button>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg ${
                                        item.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                    }`}>
                                        {getStatusLabel(item.status)}
                                    </span>
                                </div>
                            </div>
                        )) : null}

                        {/* Pagination */}
                        {totalPages > 1 && !loading && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button 
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="size-10 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50 transition-all"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <span className="text-xs font-bold text-slate-600">{t('labels.page')} {page} {t('labels.of')} {totalPages}</span>
                                <button 
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    className="size-10 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50 transition-all"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        )}

                        {/* Empty State */}
                        {((activeTab === 'created' && createdEvents.length === 0) ||
                          (activeTab === 'invites' && invites.length === 0) ||
                          (activeTab === 'pending' && pendingRequests.length === 0) ||
                          (activeTab === 'history' && history.length === 0)) && (
                            <EmptyState tab={activeTab} />
                        )}
                    </div>
                )}
            </div>

            {selectedEvent && (
                <EventDetailsModal
                    event={selectedEvent}
                    onClose={() => {
                        setSelectedEvent(null);
                        setInitialChatOpen(false);
                    }}
                    onCancel={handleCancelEvent}
                    onDelete={handleDeleteEvent}
                    user={user}
                    initialChatOpen={initialChatOpen}
                />
            )}
        </div>
    );
};

export default MyInvolvement;
