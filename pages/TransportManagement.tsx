import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TransportManagement: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const highlightEventId = searchParams.get('eventId');
    const scrollRef = useRef<Record<string, HTMLDivElement | null>>({});
    const [transportRequests, setTransportRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [transportSubTab, setTransportSubTab] = useState<'pending' | 'history'>('pending');
    const [transportSearch, setTransportSearch] = useState('');
    const [transportFilterStatus, setTransportFilterStatus] = useState<'all' | 'confirmed' | 'rejected'>('all');
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const handleTransportDecision = async (eventId: string, status: 'confirmed' | 'rejected') => {
        try {
            console.log('Sending transport decision directly to record update:', { eventId, status });
            
            // Bypass the custom API and try to update the record directly
            // Note: This requires the user to have update permissions on the agenda_cap53_eventos collection
            await pb.collection('agenda_cap53_eventos').update(eventId, {
                transporte_status: status,
                transporte_justification: ''
            });
            
            console.log('Record updated successfully');
            
            setActionMessage(status === 'confirmed' ? 'Confirmado' : 'Recusado');
            setTimeout(() => setActionMessage(null), 3000);
            fetchTransportRequests();
        } catch (err: any) {
            console.error(`Error processing transport ${status} via direct update:`, err);
            
            // If direct update fails, it might be due to API Rules. Fallback to custom API with more logging
                try {
                    console.log('Direct update failed, falling back to custom API /api/transport_decision...');
                    const response = await pb.send('/api/transport_decision', {
                        method: 'POST',
                        body: { 
                            event_id: eventId, 
                            status: status,
                            justification: 'Ação realizada pelo setor de transporte.'
                        }
                    });
                    console.log('Response from custom API:', response);
                
                setActionMessage(status === 'confirmed' ? 'Confirmado' : 'Recusado');
                setTimeout(() => setActionMessage(null), 3000);
                fetchTransportRequests();
            } catch (apiErr: any) {
                console.error('Custom API also failed:', apiErr);
                const errorMsg = apiErr.data?.message || apiErr.message || 'Erro desconhecido';
                alert(`Erro ao ${status === 'confirmed' ? 'confirmar' : 'recusar'}: ${errorMsg}\n\nVerifique se você tem permissão de edição para esta solicitação.`);
            }
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
        if (!loading && highlightEventId && scrollRef.current[highlightEventId]) {
            setTimeout(() => {
                scrollRef.current[highlightEventId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }
    }, [loading, highlightEventId]);

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

    return (
        <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full p-4 md:p-8">
            {actionMessage && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10">
                        <span className="material-symbols-outlined text-green-400">check_circle</span>
                        <span className="text-sm font-semibold">{actionMessage}</span>
                    </div>
                </div>
            )}
            
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                        <button
                            onClick={() => setTransportSubTab('pending')}
                            className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
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
                        {transportSubTab === 'history' && (
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
                            <button 
                                onClick={() => setTransportSearch('')}
                                className="mt-8 px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                            >
                                Limpar busca
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredTransportRequests.map((event) => (
                            <div 
                                key={event.id} 
                                ref={el => scrollRef.current[event.id] = el}
                                className={`group bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300 flex flex-col md:flex-row items-stretch ${
                                    transportSubTab === 'history' ? 'opacity-90' : ''
                                } ${highlightEventId === event.id ? 'ring-2 ring-primary ring-offset-2 border-primary shadow-xl shadow-primary/10' : 'border-slate-100'}`}
                            >
                                {/* Status Indicator (Vertical Bar) */}
                                <div className={`w-1.5 shrink-0 ${
                                    event.transporte_status === 'confirmed' ? 'bg-green-500' :
                                    event.transporte_status === 'rejected' ? 'bg-red-500' :
                                    'bg-amber-500'
                                }`}></div>

                                <div className="p-5 flex-1 flex flex-col gap-6">
                                    <div className="flex flex-col lg:flex-row items-start gap-6">
                                        {/* Info Column */}
                                        <div className="flex flex-col gap-2 min-w-[200px] w-full lg:w-auto">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full ${
                                                    event.transporte_status === 'confirmed' ? 'bg-green-50 text-green-600' :
                                                    event.transporte_status === 'rejected' ? 'bg-red-50 text-red-600' :
                                                    'bg-amber-50 text-amber-600'
                                                }`}>
                                                    {event.transporte_status === 'pending' ? 'Pendente' : event.transporte_status === 'confirmed' ? 'Confirmado' : 'Recusado'}
                                                </span>
                                                <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">Ref: #{event.id.slice(-4)}</span>
                                            </div>
                                            <h3 className="font-black text-slate-900 text-base leading-tight group-hover:text-primary transition-colors">{event.title}</h3>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <div className="size-6 rounded-full bg-slate-50 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[14px]">person</span>
                                                </div>
                                                <span className="text-[11px] font-bold">{event.expand?.user?.name || 'Sistema'}</span>
                                            </div>
                                        </div>

                                        {/* Event Details */}
                                        <div className="flex flex-wrap items-start gap-y-6 gap-x-8 flex-1 w-full lg:w-auto">
                                            {/* Date/Location/Passenger */}
                                            <div className="flex items-start gap-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_month</span>
                                                        </div>
                                                        <span className="text-[12px] font-black text-slate-700 whitespace-nowrap">
                                                            {new Date(event.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                {(event.expand?.location || event.custom_location) && (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Local</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-slate-400 text-[18px]">location_on</span>
                                                            </div>
                                                            <span className="text-[12px] font-black text-slate-700">{event.expand?.location?.name || event.custom_location}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {event.transporte_passageiro && (
                                                    <div className="flex flex-col gap-1 border-l border-slate-100 pl-6">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Passageiro</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-slate-400 text-[18px]">groups</span>
                                                            </div>
                                                            <span className="text-[12px] font-black text-slate-700">{event.transporte_passageiro}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Origin/Destination */}
                                            <div className="flex flex-col sm:flex-row items-stretch gap-4 flex-1 min-w-[350px] bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                                <div className="flex-1 flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="size-2 rounded-full bg-slate-300"></span>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Origem</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-[11px] font-bold text-slate-800 leading-relaxed pl-4">{event.transporte_origem || '---'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex sm:flex-col items-center justify-center gap-2 text-slate-200">
                                                    <div className="w-px h-full sm:w-full sm:h-px bg-slate-200 flex-1 hidden sm:block"></div>
                                                    <span className="material-symbols-outlined text-[20px] rotate-90 sm:rotate-0">arrow_forward</span>
                                                    <div className="w-px h-full sm:w-full sm:h-px bg-slate-200 flex-1 hidden sm:block"></div>
                                                </div>
                                                <div className="flex-1 flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="size-2 rounded-full bg-primary/40"></span>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Destino</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-[11px] font-bold text-slate-800 leading-relaxed pl-4">{event.transporte_destino || '---'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Times */}
                                            <div className="flex items-start gap-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Saída</span>
                                                    <div className="flex items-center gap-2 text-slate-900">
                                                        <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-slate-600 text-[18px]">departure_board</span>
                                                        </div>
                                                        <span className="text-[13px] font-black tracking-tight">{event.transporte_horario_levar || '--:--'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Retorno</span>
                                                    <div className="flex items-center gap-2 text-slate-900">
                                                        <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-slate-600 text-[18px]">update</span>
                                                        </div>
                                                        <span className="text-[13px] font-black tracking-tight">{event.transporte_horario_buscar || '--:--'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Column */}
                                        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-2 w-full lg:w-auto shrink-0 self-stretch justify-center border-l border-slate-50 pl-6">
                                            {transportSubTab === 'pending' ? (
                                                <>
                                                    <button 
                                                        onClick={() => handleTransportDecision(event.id, 'confirmed')}
                                                        className="h-11 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-200/50 active:scale-95"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                        Confirmar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleTransportDecision(event.id, 'rejected')}
                                                        className="h-11 px-6 bg-white text-slate-500 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all active:scale-95"
                                                    >
                                                        Recusar
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={async () => {
                                                        if (!confirm('Remover do histórico?')) return;
                                                        try {
                                                            await pb.collection('agenda_cap53_eventos').update(event.id, {
                                                                transporte_suporte: false
                                                            });
                                                            setActionMessage('Removido');
                                                            setTimeout(() => setActionMessage(null), 3000);
                                                            fetchTransportRequests();
                                                        } catch (err) {
                                                            alert('Erro ao remover');
                                                        }
                                                    }}
                                                    className="size-11 rounded-xl bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center active:scale-95"
                                                    title="Remover do histórico"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            )}
                                            
                                            {event.user && (
                                                <button
                                                    onClick={() => navigate(`/chat?userId=${event.user}`)}
                                                    className="size-11 rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center active:scale-95"
                                                    title="Conversar com solicitante"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">chat</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer Details (Observations/Justifications) */}
                                    <div className="flex flex-col gap-3 border-t border-slate-50 pt-6 mt-2">
                                        {event.transporte_obs && (
                                            <div className="flex flex-col gap-2 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <span className="material-symbols-outlined text-[16px]">info</span>
                                                    <span className="text-[9px] font-black uppercase tracking-[0.15em]">Observações do Solicitante</span>
                                                </div>
                                                <p className="text-[12px] text-slate-600 font-medium leading-relaxed italic pl-1 whitespace-pre-wrap">"{event.transporte_obs}"</p>
                                            </div>
                                        )}

                                        {transportSubTab === 'history' && event.transporte_justification && (
                                            <div className="flex flex-col gap-2 p-4 bg-red-50/30 rounded-2xl border border-red-100/30">
                                                <div className="flex items-center gap-2 text-red-400">
                                                    <span className="material-symbols-outlined text-[16px]">report</span>
                                                    <span className="text-[9px] font-black uppercase tracking-[0.15em]">Motivo da Recusa</span>
                                                </div>
                                                <p className="text-[12px] text-red-800/70 font-bold leading-relaxed italic pl-1 whitespace-pre-wrap">"{event.transporte_justification}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransportManagement;

