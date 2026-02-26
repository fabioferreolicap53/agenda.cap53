import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { Navigate, useLocation, Link } from 'react-router-dom';

const InformaticsManagement: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    
    // Inventory State
    const [items, setItems] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'inventory' | 'history'>('inventory');
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setSearchTerm(params.get('search') || '');

        const view = params.get('view');
        if (view === 'history') {
            setActiveView('history');
        } else if (view === 'inventory') {
            setActiveView('inventory');
        }
    }, [location.search]);

    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const availableItemsCount = items.filter(i => i.is_available === true || String(i.is_available) === 'true').length;
    const unavailableItemsCount = items.length - availableItemsCount;

    useEffect(() => {
        if (user && (user.role === 'DCA' || user.role === 'ADMIN')) {
            fetchData();
        }
    }, [user, activeView]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeView === 'inventory') {
                const res = await pb.collection('agenda_cap53_itens_servico').getFullList({ 
                    sort: 'name',
                    filter: 'category = "INFORMATICA"'
                });
                setItems(res);
            } else {
                const res = await pb.collection('agenda_cap53_almac_requests').getFullList({
                    sort: '-created',
                    expand: 'item,event,created_by'
                });
                const informaticsHistory = res.filter(req => req.expand?.item?.category === 'INFORMATICA');
                setHistory(informaticsHistory);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        let unsubscribeItems: (() => void) | undefined;
        let unsubscribeRequests: (() => void) | undefined;
        
        const setupSubscriptions = async () => {
            try {
                unsubscribeItems = await pb.collection('agenda_cap53_itens_servico').subscribe('*', (e) => {
                    if (!isMounted) return;
                    if (e.record.category !== 'INFORMATICA') return;

                    if (e.action === 'create') {
                        setItems(prev => {
                            const exists = prev.find(i => i.id === e.record.id);
                            if (exists) return prev;
                            return [...prev, e.record].sort((a, b) => a.name.localeCompare(b.name));
                        });
                    } else if (e.action === 'update') {
                        setItems(prev => {
                            const itemIndex = prev.findIndex(i => i.id === e.record.id);
                            if (itemIndex === -1) return [...prev, e.record].sort((a, b) => a.name.localeCompare(b.name));
                            
                            const current = prev[itemIndex];
                            const currentAvail = current.is_available === true || String(current.is_available) === 'true';
                            const recordAvail = e.record.is_available === true || String(e.record.is_available) === 'true';

                            const isDifferent = currentAvail !== recordAvail || current.name !== e.record.name;
                            if (!isDifferent) return prev;
                            
                            return prev.map(i => i.id === e.record.id ? e.record : i);
                        });
                    } else if (e.action === 'delete') {
                        setItems(prev => prev.filter(i => i.id !== e.record.id));
                    }
                });

                // Subscribe to requests (history)
                unsubscribeRequests = await pb.collection('agenda_cap53_almac_requests').subscribe('*', (e) => {
                    if (!isMounted) return;
                    if (activeView === 'history') {
                        fetchData();
                    }
                });
            } catch (err) {
                console.error('Erro ao subscrever InformaticsManagement:', err);
            }
        };

        setupSubscriptions();

        return () => {
            isMounted = false;
            if (unsubscribeItems) unsubscribeItems();
            if (unsubscribeRequests) unsubscribeRequests();
        };
    }, [activeView]);

    if (authLoading) return null;
    if (!user || (user.role !== 'DCA' && user.role !== 'ADMIN')) {
        return <Navigate to="/calendar" replace />;
    }

    return (
        <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full p-4 md:p-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                        <span className="material-symbols-outlined text-2xl">devices</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Informática</h1>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Gestão de Recursos Tecnológicos</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit border border-slate-200/50">
                    <button
                        onClick={() => setActiveView('inventory')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
                            activeView === 'inventory' 
                            ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0,05)] border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">inventory_2</span>
                        Recursos
                    </button>
                    <button
                        onClick={() => setActiveView('history')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
                            activeView === 'history' 
                            ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0,05)] border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">history</span>
                        Histórico
                    </button>
                </div>
            </div>

            {activeView === 'inventory' ? (
                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-slate-200 transition-all">
                            <div className="size-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-3xl">devices</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Total de Recursos</p>
                                <h3 className="text-2xl font-black text-slate-900">{items.length}</h3>
                            </div>
                        </div>
                        
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-slate-200 transition-all">
                            <div className="size-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-3xl">check_circle</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Disponíveis</p>
                                <h3 className="text-2xl font-black text-green-600">{availableItemsCount}</h3>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-slate-200 transition-all">
                            <div className="size-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-3xl">error</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Indisponíveis</p>
                                <h3 className="text-2xl font-black text-rose-600">{unavailableItemsCount}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 items-start">
                        {/* Inventory Table */}
                        <div className="flex flex-col gap-6">
                            {/* Search and Filters */}
                            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                                <div className="relative flex-1 w-full">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome do recurso..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl h-12 pl-12 pr-4 text-sm font-medium focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900/20 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 bg-slate-50/50 px-4 py-2 rounded-2xl border border-slate-100">
                                    <span className="material-symbols-outlined text-lg">devices</span>
                                    <span className="text-xs font-bold uppercase tracking-widest">{filteredItems.length} Recursos</span>
                                </div>
                            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-[800px] md:min-w-full">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Recurso</th>
                                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibilidade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="size-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando recursos...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-32 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-3xl text-slate-200">devices</span>
                                                </div>
                                                <div>
                                                    <p className="text-slate-900 font-black text-sm">Nenhum recurso encontrado</p>
                                                    <p className="text-slate-400 font-medium text-xs mt-1">Tente ajustar sua busca.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900 font-bold text-sm">{item.name}</span>
                                                    <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">{item.unit || 'un'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                                                        (item.is_available === true || String(item.is_available) === 'true')
                                                        ? 'bg-green-50 text-green-600 border border-green-100/50'
                                                        : 'bg-rose-50 text-rose-600 border border-rose-100/50'
                                                    } border text-[10px] font-black uppercase tracking-widest w-fit`}
                                                >
                                                    <span className={`size-1.5 rounded-full ${(item.is_available === true || String(item.is_available) === 'true') ? 'bg-green-500' : 'bg-rose-500'} animate-pulse`}></span>
                                                    {(item.is_available === true || String(item.is_available) === 'true') ? 'Disponível' : 'Indisponível'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Search and Filters for History */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar no histórico (evento ou finalidade)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl h-12 pl-12 pr-4 text-sm font-medium focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900/20 outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 bg-slate-50/50 px-4 py-2 rounded-2xl border border-slate-100">
                            <span className="material-symbols-outlined text-lg">history</span>
                            <span className="text-xs font-bold uppercase tracking-widest">{history.length} Registros</span>
                        </div>
                    </div>

                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                                        <span className="material-symbols-outlined text-2xl">history</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Movimentação</h2>
                                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Informática</p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto -mx-4 md:mx-0">
                                <div className="min-w-[1000px] md:min-w-full">
                                    <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Data/Hora</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Evento / Solicitante</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Recurso</th>
                                        <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando histórico...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : history.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-32 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                                        <span className="material-symbols-outlined text-3xl text-slate-200">history_toggle_off</span>
                                                    </div>
                                                    <p className="text-slate-900 font-black text-sm">Sem histórico recente</p>
                                                    <p className="text-slate-400 font-medium text-xs max-w-xs mx-auto text-balance">As movimentações de informática aparecerão aqui assim que forem registradas.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((req) => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group text-sm">
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-900 font-bold">{new Date(req.created).toLocaleDateString('pt-BR')}</span>
                                                        <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">{new Date(req.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        {req.event ? (() => {
                                                            const eventDate = req.expand?.event?.date_start ? new Date(req.expand.event.date_start.replace(' ', 'T')) : new Date();
                                                            const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
                                                            return (
                                                                <Link 
                                                                    to={`/calendar?date=${dateStr}&view=day&eventId=${req.event}&tab=resources&from=${location.pathname}`}
                                                                    className="text-slate-900 font-bold hover:text-primary transition-colors flex items-center gap-1 group/link"
                                                                    title="Ver detalhes do evento na aba recursos"
                                                                >
                                                                    {req.expand?.event?.title || 'Uso Avulso / Não Vinculado'}
                                                                    <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/link:opacity-100 transition-opacity">open_in_new</span>
                                                                </Link>
                                                            );
                                                        })() : (
                                                            <span className="text-slate-900 font-bold">{req.expand?.event?.title || 'Uso Avulso / Não Vinculado'}</span>
                                                        )}
                                                        <span className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">{req.expand?.created_by?.name || req.expand?.created_by?.email || 'Solicitante desconhecido'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-900 font-black text-xs">
                                                            {req.quantity || 1}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-900 font-bold">{req.expand?.item?.name || 'Recurso Removido'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                                            req.status === 'approved' 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                            : req.status === 'rejected'
                                                            ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                            : 'bg-slate-50 text-slate-700 border-slate-100'
                                                        }`}>
                                                            <span className={`size-1.5 rounded-full ${
                                                                req.status === 'approved' ? 'bg-emerald-500' : req.status === 'rejected' ? 'bg-rose-500' : 'bg-slate-500'
                                                            }`}></span>
                                                            {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            )}

        </div>
    );
};

export default InformaticsManagement;
