import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import RefusalModal from '../components/RefusalModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { printEventDoc } from '../lib/printUtils';

const TransportManagement: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const highlightEventId = searchParams.get('eventId');
    const scrollRef = useRef<Record<string, HTMLDivElement | null>>({});
    const [transportRequests, setTransportRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [transportSubTab, setTransportSubTab] = useState<'pending' | 'history' | 'events'>('pending');
    const [transportSearch, setTransportSearch] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setTransportSearch(params.get('search') || '');
        
        const view = params.get('view');
        if (view === 'history') {
            setTransportSubTab('history');
        } else if (view === 'events') {
            setTransportSubTab('events');
        } else if (view === 'pending') {
            setTransportSubTab('pending');
        }
    }, [location.search]);
    const [transportFilterStatus, setTransportFilterStatus] = useState<'all' | 'confirmed' | 'rejected'>('all');
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [rerequestIds, setRerequestIds] = useState<Set<string>>(new Set());
    const [refusalModalOpen, setRefusalModalOpen] = useState(false);
    const [refusalModalProps, setRefusalModalProps] = useState<{title?: string, description?: string}>({});
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [processingDecision, setProcessingDecision] = useState(false);

    const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
    const [confirmationModalConfig, setConfirmationModalConfig] = useState<{
        title: string;
        description: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
        confirmText?: string;
    }>({
        title: '',
        description: '',
        onConfirm: () => {},
    });

    const fetchRerequestNotifications = useCallback(async () => {
        try {
            const res = await pb.collection('agenda_cap53_notifications').getList(1, 100, {
                filter: `read = false && data.is_rerequest = true`,
                fields: 'event,data'
            });
            
            const ids = new Set<string>();
            res.items.forEach(n => {
                if (n.event) ids.add(n.event);
            });
            setRerequestIds(ids);
        } catch (e) {
            console.error("Erro ao buscar re-solicitações:", e);
        }
    }, []);

    const handleTransportDecision = async (eventId: string, status: 'confirmed' | 'rejected') => {
        if (status === 'rejected') {
            setSelectedEventId(eventId);
            setRefusalModalProps({
                title: 'Recusar Solicitação de Transporte',
                description: 'Por favor, informe o motivo da recusa para o solicitante. Esta justificativa será enviada por e-mail.'
            });
            setRefusalModalOpen(true);
            return;
        }

        // Se for confirmação, prossegue diretamente
        await processDecision(eventId, 'confirmed', '');
    };

    const processDecision = async (eventId: string, status: 'confirmed' | 'rejected', justification: string) => {
        setProcessingDecision(true);
        
        // Capturar dados do evento antes de atualizar para garantir que temos o ID do usuário
        // Tenta pegar da lista local primeiro para evitar query extra
        const eventInList = transportRequests.find(e => e.id === eventId);
        let targetUserId = eventInList?.user;
        const eventTitle = eventInList?.title || 'Evento';

        // Garantir que targetUserId é uma string (ID), caso venha expandido como objeto
        if (typeof targetUserId === 'object' && targetUserId?.id) {
            targetUserId = targetUserId.id;
        }

        // Se não tiver na lista ou user vazio, busca no banco
        if (!targetUserId) {
            try {
                const evt = await pb.collection('agenda_cap53_eventos').getOne(eventId, { 
                    fields: 'user,title' 
                });
                targetUserId = evt.user;
                // Garantir extração correta se o retorno do banco vier expandido
                if (typeof targetUserId === 'object' && targetUserId?.id) {
                    targetUserId = targetUserId.id;
                }
            } catch (fetchErr) {
                console.error("Erro ao buscar dados do evento para notificação:", fetchErr);
            }
        }

        if (!targetUserId) {
            alert('ERRO CRÍTICO: Não foi possível identificar o usuário criador do evento para enviar a notificação. A operação será abortada.');
            setProcessingDecision(false);
            return;
        }

        try {
            console.log('Processing transport decision:', { eventId, status, targetUserId, justification });
            
            // Get current history first
            let currentHistory = [];
            try {
                const currentEvent = await pb.collection('agenda_cap53_eventos').getOne(eventId, { fields: 'transport_history' });
                currentHistory = currentEvent.transport_history || [];
            } catch (e) {
                console.warn('Could not fetch current history, starting fresh', e);
            }

            // Append new history entry
            const newHistoryEntry = {
                timestamp: new Date().toISOString(), // Usar timestamp para compatibilidade com HistoryChain
                action: status === 'confirmed' ? 'approved' : 'rejected',
                user: pb.authStore.model?.id,
                justification: status === 'rejected' ? justification : ''
            };

            const updatedHistory = [...currentHistory, newHistoryEntry];

            // Atualização do status do evento
            try {
                await pb.collection('agenda_cap53_eventos').update(eventId, {
                    transporte_status: status,
                    transporte_justification: status === 'rejected' ? justification : '',
                    transport_history: updatedHistory
                });
                console.log('Evento atualizado com sucesso.');
            } catch (updateErr: any) {
                console.error("Erro ao atualizar evento (possível erro de hook):", updateErr);
                // Mesmo que dê erro no update (ex: hook falhando), tentamos enviar a notificação se o status for 400/500
                // mas alertamos o usuário
                alert(`Aviso: O status do evento foi enviado, mas o servidor retornou um erro: ${updateErr.message}. Tentaremos enviar a notificação mesmo assim.`);
            }
            
            // Sync with Notifications: Find and update related transport_request notifications
            // This ensures that if we approve/reject here, the notification buttons in the other view are also updated/hidden
            try {
                const relatedNotifications = await pb.collection('agenda_cap53_notifications').getList(1, 50, {
                    filter: `event = "${eventId}" && type = "transport_request" && invite_status = "pending"`
                });
                
                const notifStatus = status === 'confirmed' ? 'accepted' : 'rejected';
                
                await Promise.all(relatedNotifications.items.map(n => 
                    pb.collection('agenda_cap53_notifications').update(n.id, {
                        invite_status: notifStatus,
                        read: true
                    })
                ));
            } catch (syncErr) {
                console.error("Error syncing with notifications:", syncErr);
                // Non-blocking error
            }

            // Feedback visual de sucesso (Notificação agora é gerada pelo Hook no servidor)
            const actionText = status === 'rejected' ? 'recusada' : 'confirmada';
            
            // Se foi recusa via modal, fecha o modal
            if (status === 'rejected') {
                setRefusalModalOpen(false);
                setSelectedEventId(null);
            }

            alert(`Decisão registrada com sucesso!\n\nA solicitação foi ${actionText}. O solicitante será notificado automaticamente pelo sistema.`);
            
            fetchTransportRequests();
        } catch (err: any) {
            console.error(`Error processing transport ${status}:`, err);
            const errorMsg = err.data?.message || err.message || 'Erro desconhecido';
            alert(`Erro ao atualizar evento: ${errorMsg}`);
        } finally {
            setProcessingDecision(false);
        }
    };

    const fetchTransportRequests = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const transportRecords = await pb.collection('agenda_cap53_eventos').getFullList({
                filter: 'transporte_suporte = true',
                sort: '-created',
                expand: 'location,user'
            });
            setTransportRequests(transportRecords);
        } catch (error) {
            console.error('Error loading transport data:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTransportRequests();
        fetchRerequestNotifications();

        let unsubscribe: (() => void) | undefined;

        // Subscribe to transport requests
        const setupSubscription = async (retries = 3) => {
            if (!pb.authStore.isValid) return;
            
            try {
                const unsub = await pb.collection('agenda_cap53_eventos').subscribe('*', function(e) {
                    if (e.action === 'create' || e.action === 'update') {
                        if (e.record.transporte_suporte === true) {
                            fetchTransportRequests();
                        }
                    } else if (e.action === 'delete') {
                        fetchTransportRequests();
                    }
                });
                unsubscribe = unsub;
            } catch (err: any) {
                if (err.status === 403 && retries > 0) {
                    setTimeout(() => setupSubscription(retries - 1), 300);
                    return;
                }
                console.error('Transport subscription error:', err);
            }
        };

        setupSubscription();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [fetchTransportRequests]);

    useEffect(() => {
        if (!loading && highlightEventId && transportRequests.length > 0) {
            const event = transportRequests.find(e => e.id === highlightEventId);
            if (event && event.transporte_status !== 'pending' && transportSubTab !== 'history') {
                setTransportSubTab('history');
            }
        }
    }, [loading, highlightEventId, transportRequests, transportSubTab]);

    useEffect(() => {
        if (!loading && highlightEventId && scrollRef.current[highlightEventId]) {
            setTimeout(() => {
                scrollRef.current[highlightEventId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }
    }, [loading, highlightEventId, transportSubTab]);

    const filteredTransportRequests = useMemo(() => {
        return transportRequests.filter(event => {
            const matchesTab = transportSubTab === 'pending' 
                ? event.transporte_status === 'pending'
                : event.transporte_status !== 'pending';
            
            const matchesSearch = !transportSearch || 
                event.title.toLowerCase().includes(transportSearch.toLowerCase()) ||
                (event.expand?.user?.name || '').toLowerCase().includes(transportSearch.toLowerCase()) ||
                (event.transporte_origem || '').toLowerCase().includes(transportSearch.toLowerCase()) ||
                (event.transporte_destino || '').toLowerCase().includes(transportSearch.toLowerCase());

            const matchesStatus = transportSubTab === 'pending' || transportFilterStatus === 'all' || event.transporte_status === transportFilterStatus;

            return matchesTab && matchesSearch && matchesStatus;
        });
    }, [transportRequests, transportSubTab, transportSearch, transportFilterStatus]);

    const agendaEvents = useMemo(() => {
        if (transportSubTab !== 'events') return [];
        return transportRequests
            .filter(e => {
                if (e.transporte_status === 'rejected') return false;
                
                // Filtra para exibir apenas eventos de hoje em diante
                if (e.date_start) {
                    const eventDate = new Date(e.date_start.replace(' ', 'T'));
                    eventDate.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas as datas
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Zera as horas de hoje
                    
                    if (eventDate < today) return false;
                }
                
                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date_start.replace(' ', 'T')).getTime();
                const dateB = new Date(b.date_start.replace(' ', 'T')).getTime();
                return dateA - dateB;
            });
    }, [transportRequests, transportSubTab]);

    return (
        <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full p-4 md:p-8">
            {/* Bloco de notificação removido conforme solicitação */}
            
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                        <button
                            onClick={() => setTransportSubTab('events')}
                            className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                                transportSubTab === 'events'
                                    ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0,05)]'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                            Agenda
                        </button>
                        <button
                            onClick={() => setTransportSubTab('pending')}
                            className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                transportSubTab === 'pending'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Solicitações Ativas
                        </button>
                        <button
                            onClick={() => setTransportSubTab('history')}
                            className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                transportSubTab === 'history'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Histórico
                        </button>
                    </div>

                    <div className="flex flex-1 w-full md:max-w-xl gap-3">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                            <input
                                placeholder="Buscar por evento, solicitante, origem ou destino..."
                                value={transportSearch}
                                onChange={(e) => setTransportSearch(e.target.value)}
                                className="w-full h-11 pl-11 pr-4 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-200 transition-all"
                                type="text"
                            />
                        </div>
                        {(transportSubTab === 'history' || transportSubTab === 'pending') && (
                            <select
                                value={transportFilterStatus}
                                onChange={(e) => setTransportFilterStatus(e.target.value as any)}
                                className="h-11 px-4 bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-slate-200 transition-all cursor-pointer"
                            >
                                <option value="all">Todos</option>
                                <option value="confirmed">Confirmados</option>
                                <option value="rejected">Recusados</option>
                            </select>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <div className="size-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mb-6"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando dados...</p>
                    </div>
                ) : transportSubTab === 'events' ? (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                                    <span className="material-symbols-outlined text-2xl">event_upcoming</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Agenda de Eventos - Transporte</h2>
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Eventos agendados por data</p>
                                </div>
                            </div>
                        </div>

                        {agendaEvents.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-20">
                                <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                    <span className="material-symbols-outlined text-3xl text-slate-200">event_busy</span>
                                </div>
                                <p className="text-slate-900 font-black text-sm">Nenhum evento agendado</p>
                                <p className="text-slate-400 font-medium text-xs max-w-xs mx-auto text-balance text-center">Não há eventos futuros com solicitações de transporte.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {agendaEvents.map((event) => {
                                    const eventDate = event.date_start ? new Date(event.date_start.replace(' ', 'T')) : new Date();
                                    const day = String(eventDate.getDate()).padStart(2, '0');
                                    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                    const month = monthNames[eventDate.getMonth()];
                                    
                                    return (
                                        <div key={event.id} className="group relative bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                                            {/* Date Badge */}
                                            <div className="absolute -top-3 -right-3 size-16 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center shadow-lg transform rotate-3 group-hover:rotate-0 transition-transform">
                                                <span className="text-xl font-black leading-none">{day}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mt-0.5">{month}</span>
                                            </div>

                                            <div className="mb-6 pr-12">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <h3 className="text-lg font-black text-slate-900 line-clamp-2 leading-tight">
                                                    <Link to={`/calendar?date=${eventDate.toISOString().split('T')[0]}&view=day&eventId=${event.id}&tab=transport&from=${encodeURIComponent(`${location.pathname}?view=${transportSubTab}`)}`} className="hover:text-indigo-600 transition-colors">
                                                        {event.title || 'Evento sem título'}
                                                    </Link>
                                                </h3>
                                            </div>

                                            <div className="space-y-4 mb-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">trip_origin</span> Origem</span>
                                                    <span className="text-sm font-bold text-slate-700">{event.transporte_origem || '---'}</span>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">location_on</span> Destino</span>
                                                    <span className="text-sm font-bold text-slate-700">{event.transporte_destino || '---'}</span>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span> Saída/Retorno</span>
                                                        <span className="text-xs font-bold text-slate-700">{event.transporte_horario_levar || '--:--'} às {event.transporte_horario_buscar || '--:--'}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">group</span> Passageiros</span>
                                                        <span className="text-xs font-bold text-slate-700">{event.transporte_passageiro || '-'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 pt-4 border-t border-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <div className="flex items-center gap-1" title="Data de Solicitação">
                                                        <span className="material-symbols-outlined text-[11px]">add_circle</span>
                                                        {new Date(event.created).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </div>
                                                    {event.updated && event.updated !== event.created && (
                                                        <div className="flex items-center gap-1" title="Última Edição">
                                                            <span className="material-symbols-outlined text-[11px]">edit</span>
                                                            {new Date(event.updated).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-6 rounded-full bg-slate-100 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[12px] text-slate-500">person</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[120px]" title={event.expand?.user?.name || 'Criador do Evento'}>
                                                        {event.expand?.user?.name || 'Criador do Evento'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            printEventDoc({
                                                                responsavel: event.expand?.user?.name || 'Não informado',
                                                                nomeEvento: event.title || 'Evento sem título',
                                                                localEvento: event.expand?.location?.name || event.custom_location || 'Utilizando transporte (vários)',
                                                                dataInicio: event.date_start ? new Date(event.date_start.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '---',
                                                                dataFim: event.date_end ? new Date(event.date_end.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '---',
                                                                observacoes: event.transporte_obs || event.observacoes || event.description || '',
                                                                participantes: event.transporte_passageiro || event.estimated_participants || 'Não informado',
                                                                insumos: [
                                                                    { quantidade: 1, nome: `Origem: ${event.transporte_origem || '---'}`, status: 'Transporte' },
                                                                    { quantidade: 1, nome: `Destino: ${event.transporte_destino || '---'}` },
                                                                    { quantidade: 1, nome: `Saída: ${event.transporte_horario_levar || '--:--'} | Retorno: ${event.transporte_horario_buscar || '--:--'}` }
                                                                ],
                                                                departamento: 'Transporte'
                                                            });
                                                        }}
                                                        className="size-7 rounded-lg bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                                                        title="Imprimir Solicitação de Transporte"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">print</span>
                                                    </button>
                                                    {event.transporte_status === 'pending' ? (
                                                        <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100 flex items-center gap-1">
                                                            <div className="size-1 rounded-full bg-amber-500 animate-pulse" />
                                                            Pendente
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[10px]">check</span>
                                                            Confirmado
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : filteredTransportRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-slate-200 border-dashed">
                        <div className="size-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-4xl text-slate-300">
                                {transportSearch ? 'search_off' : (transportSubTab === 'pending' ? 'local_shipping' : 'history')}
                            </span>
                        </div>
                        <h3 className="text-slate-900 font-black text-lg mb-2">
                            {transportSearch ? 'Nenhum resultado encontrado' : (transportSubTab === 'pending' ? 'Sem solicitações pendentes' : 'Histórico vazio')}
                        </h3>
                        <p className="text-slate-400 font-medium text-center max-w-xs px-4">
                            {transportSearch 
                                ? `Não encontramos nada para "${transportSearch}". Tente outros termos.`
                                : (transportSubTab === 'pending' 
                                    ? 'Todas as solicitações de transporte foram processadas.' 
                                    : 'Ainda não existem registros no histórico de transporte.')}
                        </p>
                        {transportSearch && (
                            <div className="mt-8 text-slate-400 font-medium text-xs">
                                Tente outros termos de busca.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredTransportRequests.map((event) => (
                            <div 
                                key={event.id} 
                                ref={el => { if (el) scrollRef.current[event.id] = el; }}
                                className={`group bg-white relative rounded-[24px] shadow-sm border overflow-hidden hover:shadow-xl hover:border-slate-200 transition-all duration-500 flex flex-col md:flex-row items-stretch ${
                                    transportSubTab === 'history' ? 'opacity-95' : ''
                                } ${highlightEventId === event.id ? 'ring-2 ring-slate-900 ring-offset-2 border-slate-900 shadow-2xl shadow-slate-900/10' : 'border-slate-100'}`}
                            >
                                {rerequestIds.has(event.id) && (
                                    <div className="absolute top-4 right-6 px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm z-20 animate-pulse">
                                        <span className="material-symbols-outlined text-[14px]">history</span>
                                        Re-solicitação
                                    </div>
                                )}
                                
                                {/* Status Indicator (Vertical Bar) - Thinner and more elegant */}
                                <div className={`w-1.5 shrink-0 ${
                                    event.transporte_status === 'confirmed' ? 'bg-emerald-500' :
                                    event.transporte_status === 'rejected' ? 'bg-rose-500' :
                                    'bg-amber-500'
                                }`}></div>

                                <div className="p-6 flex-1 flex flex-col gap-8">
                                    <div className="flex flex-col lg:flex-row items-start gap-8">
                                        {/* Info Column: Title and Requester */}
                                        <div className="flex flex-col gap-3 min-w-[240px] w-full lg:w-auto">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg border ${
                                                    event.transporte_status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    event.transporte_status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                    'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                    {event.transporte_status === 'pending' ? 'Pendente' : event.transporte_status === 'confirmed' ? 'Confirmado' : 'Recusado'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                    Ref: #{event.id.slice(-4)}
                                                </span>
                                            </div>
                                            <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-primary transition-colors">
                                                <Link 
                                                    to={`/calendar?date=${new Date(event.date_start).toISOString().split('T')[0]}&view=day&eventId=${event.id}&tab=transport&from=transporte`}
                                                    className="hover:text-primary transition-colors flex items-center gap-1.5 group/link"
                                                >
                                                    {event.title}
                                                    <span className="material-symbols-outlined text-[16px] opacity-0 group-hover/link:opacity-100 transition-opacity">open_in_new</span>
                                                </Link>
                                            </h3>
                                            <div className="flex items-center gap-2.5 text-slate-500">
                                                <div className="size-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200/50">
                                                    <span className="material-symbols-outlined text-[16px]">person</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Solicitante</span>
                                                    <span className="text-[12px] font-bold text-slate-700">{event.expand?.user?.name || 'Sistema'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Event Details Grid */}
                                        <div className="flex flex-wrap items-start gap-y-8 gap-x-10 flex-1 w-full lg:w-auto">
                                            {/* Date and Location */}
                                            <div className="flex items-start gap-8">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Data</span>
                                                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                        <div className="size-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-slate-600 text-[20px]">calendar_month</span>
                                                        </div>
                                                        <span className="text-[13px] font-black text-slate-800 whitespace-nowrap pr-2">
                                                            {new Date(event.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                {(event.expand?.location || event.custom_location) && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Local</span>
                                                        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                            <div className="size-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-slate-600 text-[20px]">location_on</span>
                                                            </div>
                                                            <span className="text-[13px] font-black text-slate-800 pr-2">{event.expand?.location?.name || event.custom_location}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Route Visualization (Origin -> Destination) */}
                                            <div className="flex flex-col sm:flex-row items-stretch gap-6 flex-1 min-w-[380px] bg-slate-50/50 p-5 rounded-[20px] border border-slate-200/40 relative">
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-2 rounded-full bg-slate-400"></div>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Origem</span>
                                                    </div>
                                                    <p className="text-[13px] font-bold text-slate-900 leading-tight pl-4">
                                                        {event.transporte_origem || '---'}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex sm:flex-col items-center justify-center gap-2 text-slate-300">
                                                    <div className="w-px h-full sm:w-full sm:h-px bg-slate-200 flex-1 hidden sm:block"></div>
                                                    <span className="material-symbols-outlined text-[22px] rotate-90 sm:rotate-0 font-bold">arrow_forward</span>
                                                    <div className="w-px h-full sm:w-full sm:h-px bg-slate-200 flex-1 hidden sm:block"></div>
                                                </div>

                                                <div className="flex-1 flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-2 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(var(--color-primary),0.4)]"></div>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Destino</span>
                                                    </div>
                                                    <p className="text-[13px] font-bold text-slate-900 leading-tight pl-4">
                                                        {event.transporte_destino || '---'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Metrics: Times and Passengers - Enhanced distribution and alignment */}
                                            <div className="flex items-start gap-8">
                                                <div className="flex flex-col gap-1.5 w-full">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Logística</span>
                                                    <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-100 shadow-sm min-w-[380px]">
                                                        <div className="flex-1 flex items-center justify-center gap-3 px-4 py-2 border-r border-slate-50">
                                                            <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                                                <span className="material-symbols-outlined text-slate-500 text-[18px]">departure_board</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Saída</span>
                                                                <span className="text-[13px] font-black text-slate-900 tabular-nums leading-none">{event.transporte_horario_levar || '--:--'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 flex items-center justify-center gap-3 px-4 py-2 border-r border-slate-50">
                                                            <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                                                <span className="material-symbols-outlined text-slate-500 text-[18px]">update</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Retorno</span>
                                                                <span className="text-[13px] font-black text-slate-900 tabular-nums leading-none">{event.transporte_horario_buscar || '--:--'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 flex items-center justify-center gap-3 px-4 py-2">
                                                            <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                                                <span className="material-symbols-outlined text-slate-500 text-[18px]">groups</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Passageiros</span>
                                                                <span className="text-[13px] font-black text-slate-900 leading-none">{event.transporte_passageiro || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Sidebar - Optimized for alignment and size */}
                                        <div className="flex flex-col items-center justify-center gap-3 w-full lg:w-[80px] shrink-0 self-stretch border-l border-slate-100/60 pl-4 ml-2">
                                            <div className="flex flex-col items-center justify-center gap-3 w-full">
                                                {(() => {
                                                    const eventDate = new Date(event.date_start.replace(' ', 'T'));
                                                    const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
                                                    return (
                                                        <Link
                                                            to={`/calendar?date=${dateStr}&view=day&eventId=${event.id}&tab=transport&from=${encodeURIComponent(`${location.pathname}?view=${transportSubTab}`)}`}
                                                            className="size-11 rounded-xl bg-slate-50 text-slate-500 hover:text-primary hover:bg-primary/5 border border-slate-100 hover:border-primary/20 transition-all flex items-center justify-center active:scale-[0.98]"
                                                            title="Ver detalhes do evento"
                                                        >
                                                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                        </Link>
                                                    );
                                                })()}

                                                {event.user && (
                                                    <button
                                                        onClick={() => navigate(`/chat?userId=${event.user}`)}
                                                        className="size-11 rounded-xl bg-slate-50 text-slate-500 hover:text-primary hover:bg-primary/5 border border-slate-100 hover:border-primary/20 transition-all flex items-center justify-center active:scale-[0.98]"
                                                        title="Conversar com solicitante"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">chat</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Observation/Footer Section */}
                                    {(event.transporte_obs || (transportSubTab === 'history' && event.transporte_justification)) && (
                                        <div className="flex flex-col gap-4 border-t border-slate-100/80 pt-6 mt-2">
                                            {event.transporte_obs && (
                                                <div className="flex flex-col gap-2.5 p-5 bg-slate-50/50 rounded-[20px] border border-slate-200/40 shadow-inner">
                                                    <div className="flex items-center gap-2 text-slate-400">
                                                        <span className="material-symbols-outlined text-[18px]">info</span>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Observações do Solicitante</span>
                                                    </div>
                                                    <p className="text-[13px] text-slate-600 font-medium leading-relaxed italic pl-1 whitespace-pre-wrap border-l-2 border-slate-200 ml-1.5 pl-4">
                                                        "{event.transporte_obs}"
                                                    </p>
                                                </div>
                                            )}

                                            {transportSubTab === 'history' && event.transporte_justification && (
                                                <div className="flex flex-col gap-2.5 p-5 bg-rose-50/40 rounded-[20px] border border-rose-100/50">
                                                    <div className="flex items-center gap-2 text-rose-500/80">
                                                        <span className="material-symbols-outlined text-[18px]">report</span>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Motivo da Recusa</span>
                                                    </div>
                                                    <p className="text-[13px] text-rose-800/80 font-bold leading-relaxed italic pl-1 whitespace-pre-wrap border-l-2 border-rose-200/60 ml-1.5 pl-4">
                                                        "{event.transporte_justification}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {refusalModalOpen && (
                <RefusalModal
                    onClose={() => {
                        setRefusalModalOpen(false);
                        setSelectedEventId(null);
                        setRefusalModalProps({});
                    }}
                    onConfirm={(justification) => {
                        if (selectedEventId) {
                            processDecision(selectedEventId, 'rejected', justification);
                        }
                    }}
                    loading={processingDecision}
                    title={refusalModalProps.title}
                    description={refusalModalProps.description}
                />
            )}
            <ConfirmationModal
                isOpen={confirmationModalOpen}
                onClose={() => setConfirmationModalOpen(false)}
                onConfirm={confirmationModalConfig.onConfirm}
                title={confirmationModalConfig.title}
                description={confirmationModalConfig.description}
                confirmText={confirmationModalConfig.confirmText}
                variant={confirmationModalConfig.variant}
            />
        </div>
    );
};

export default TransportManagement;

