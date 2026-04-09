import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { Navigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';
import { printEventDoc } from '../lib/printUtils';

const InformaticsManagement: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Inventory State
    const [items, setItems] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'inventory' | 'history' | 'events'>(
        (searchParams.get('view') as any) || 'inventory'
    );
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState('');
    const scrollPositions = useRef<Record<string, number>>({});
    const pendingRestoreScroll = useRef<number | null>(null);
    const pendingAnchorId = useRef<string | null>(null);
    const [restoreVersion, setRestoreVersion] = useState(0);

    const getScrollStorageKey = (view: string) => `scroll:${location.pathname}:${view}`;
    const getScrollContainer = () => document.getElementById('main-scroll-container');
    const getCurrentScroll = () => getScrollContainer()?.scrollTop || 0;
    const persistScroll = (view: string, value: number) => {
        scrollPositions.current[view] = value;
        sessionStorage.setItem(getScrollStorageKey(view), String(value));
    };

    // Form State
    const [newItemName, setNewItemName] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('un');
    const [newItemAvailable, setNewItemAvailable] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);

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

    useEffect(() => {
        const container = getScrollContainer();
        if (!container) return;
        const handleScroll = () => {
            if (!loading) {
                persistScroll(activeView, container.scrollTop);
            }
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [activeView, loading, location.pathname]);

    useEffect(() => {
        if (loading) return;
        const stored = sessionStorage.getItem(getScrollStorageKey(activeView));
        const fallback = stored ? parseInt(stored, 10) : 0;
        const target = pendingRestoreScroll.current ?? scrollPositions.current[activeView] ?? fallback;
        pendingRestoreScroll.current = null;
        if (!target) return;
        const apply = (attempt = 0) => {
            const container = getScrollContainer();
            if (!container) return;
            if (pendingAnchorId.current) {
                const anchorEl = document.querySelector<HTMLElement>(`[data-anchor=\"event-${pendingAnchorId.current}\"]`);
                if (anchorEl) {
                    const containerRect = container.getBoundingClientRect();
                    const elRect = anchorEl.getBoundingClientRect();
                    const offset = elRect.top - containerRect.top + container.scrollTop - 16;
                    container.scrollTo({ top: offset, behavior: 'instant' });
                } else {
                    container.scrollTo({ top: target, behavior: 'instant' });
                }
            } else {
                container.scrollTo({ top: target, behavior: 'instant' });
            }
            if (attempt < 12 && Math.abs(container.scrollTop - target) > 2) {
                requestAnimationFrame(() => apply(attempt + 1));
            }
        };
        requestAnimationFrame(() => apply());
    }, [activeView, loading, history.length, restoreVersion]);

    useEffect(() => {
        setSearchTerm(searchParams.get('search') || '');

        const view = searchParams.get('view');
        if (view === 'history') {
            setActiveView('history');
        } else if (view === 'events') {
            setActiveView('events');
        } else if (view === 'inventory') {
            setActiveView('inventory');
        }

        const targetView = view || 'inventory';
        const scrollParam = searchParams.get('scroll');
        const stored = sessionStorage.getItem(getScrollStorageKey(targetView));
        const anchor = searchParams.get('anchor');
        if (anchor) {
            pendingAnchorId.current = anchor;
        }
        if (scrollParam) {
            const parsed = parseInt(scrollParam, 10);
            pendingRestoreScroll.current = parsed;
            persistScroll(targetView, parsed);
            setRestoreVersion(v => v + 1);
        } else if (stored) {
            const parsed = parseInt(stored, 10);
            pendingRestoreScroll.current = parsed;
            scrollPositions.current[targetView] = parsed;
            setRestoreVersion(v => v + 1);
        }
    }, [searchParams]);

    const handleViewChange = (view: 'inventory' | 'history' | 'events') => {
        setSearchParams({ view });
        setActiveView(view);
    };

    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });

    const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
    const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
    const [filterRequesters, setFilterRequesters] = useState<string[]>([]);
    const [filterStatuses, setFilterStatuses] = useState<string[]>(['Planejado', 'Em andamento', 'Concluído', 'Cancelado']);

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const years = React.useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
    }, []);

    const uniqueRequesters = React.useMemo(() => {
        const requesters = new Set<string>();
        history.forEach(req => {
            const name = req.expand?.created_by?.name || req.expand?.created_by?.email;
            if (name) requesters.add(name);
        });
        return Array.from(requesters).sort();
    }, [history]);

    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const availableItemsCount = items.filter(i => i.is_available === true || String(i.is_available) === 'true').length;
    const unavailableItemsCount = items.length - availableItemsCount;

    const groupedEvents = React.useMemo(() => {
        if (activeView !== 'events') return [];
        
        const eventsMap = new Map<string, any>();
        
        history.forEach(req => {
            if (!req.event || req.status === 'rejected') return; // hide rejected or orphaned requests
            
            const eventId = req.event;
            if (!eventsMap.has(eventId)) {
                eventsMap.set(eventId, {
                    event: req.expand?.event,
                    requests: []
                });
            }
            eventsMap.get(eventId).requests.push(req);
        });
        
        const eventsList = Array.from(eventsMap.values()).filter(e => {
            if (!e.event) return false;
            if (e.event.status === 'canceled' || e.event.status === 'rejected') return false;
            
            // Filtra para exibir apenas eventos de hoje em diante
            if (e.event.date_start) {
                const eventDate = new Date(e.event.date_start.replace(' ', 'T'));
                eventDate.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas as datas
                
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Zera as horas de hoje
                
                if (eventDate < today) return false;
            }
            return true;
        });
        
        return eventsList.sort((a, b) => {
            const dateA = new Date(a.event.date_start.replace(' ', 'T')).getTime();
            const dateB = new Date(b.event.date_start.replace(' ', 'T')).getTime();
            return dateA - dateB;
        });
    }, [history, activeView]);

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
                    expand: 'item,event,event.location,event.user,created_by'
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

                // Subscribe to requests (history & events)
                unsubscribeRequests = await pb.collection('agenda_cap53_almac_requests').subscribe('*', (e) => {
                    if (!isMounted) return;
                    if (activeView === 'history' || activeView === 'events') {
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

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName) return;
        try {
            const normalizedName = newItemName.toUpperCase().trim();
            const normalizedUnit = newItemUnit.trim();
            
            const itemData = {
                name: normalizedName,
                category: 'INFORMATICA',
                unit: normalizedUnit,
                is_available: !!newItemAvailable
            };

            if (editingId) {
                const existing = items.find(i => 
                    i.name.toUpperCase().trim() === normalizedName && 
                    i.id !== editingId
                );
                if (existing) {
                    alert('Já existe outro recurso com este nome.');
                    return;
                }

                await pb.collection('agenda_cap53_itens_servico').update(editingId, itemData);
                alert('Recurso atualizado com sucesso!');
                setEditingId(null);
            } else {
                const existing = items.find(i => 
                    i.name.toUpperCase().trim() === normalizedName
                );
                if (existing) {
                    alert('Este recurso já existe.');
                    return;
                }

                await pb.collection('agenda_cap53_itens_servico').create(itemData);
                alert('Recurso adicionado com sucesso!');
            }
            
            setNewItemName('');
            setNewItemAvailable(true);
            setNewItemUnit('un');
            fetchData();
        } catch (error: any) {
            console.error('Erro ao salvar recurso:', error);
            alert(`Erro ao salvar recurso: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleEditItem = (item: any) => {
        setNewItemName(item.name);
        setNewItemUnit(item.unit || 'un');
        setNewItemAvailable(item.is_available ?? true);
        setEditingId(item.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleToggleAvailability = async (itemId: string) => {
        const currentItem = items.find(i => i.id === itemId);
        if (!currentItem) return;

        const previousStatus = currentItem.is_available;
        const currentlyAvailable = previousStatus === true || String(previousStatus) === 'true';
        const nextStatus = !currentlyAvailable;

        setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: nextStatus } : i));

        try {
            const result = await pb.collection('agenda_cap53_itens_servico').update(itemId, { 
                is_available: nextStatus
            });
            setItems(prev => prev.map(i => i.id === itemId ? result : i));
        } catch (error: any) {
            console.error('Erro ao atualizar disponibilidade:', error);
            setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: previousStatus } : i));
            alert(`Erro ao atualizar disponibilidade: ${error.message || 'Erro de conexão'}`);
        }
    };

    const handleCancelEdit = () => {
        setNewItemName('');
        setNewItemUnit('un');
        setNewItemAvailable(true);
        setEditingId(null);
    };

    const handleDeleteItem = async (id: string) => {
        setConfirmationModalConfig({
            title: 'Excluir Recurso',
            description: 'Tem certeza que deseja excluir este recurso? Esta ação não pode ser desfeita.',
            confirmText: 'Excluir',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await pb.collection('agenda_cap53_itens_servico').delete(id);
                    setConfirmationModalOpen(false);
                } catch (error) {
                    console.error('Error deleting item:', error);
                }
            }
        });
        setConfirmationModalOpen(true);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getEventStatusBadge = (event: any) => {
        if (!event) return { label: 'Excluído', icon: 'delete', classes: 'bg-slate-500 text-white shadow-sm' };
        
        if (event.status === 'canceled') return { label: 'Cancelado', icon: 'cancel', classes: 'bg-rose-500 text-white shadow-sm' };
        
        if (event.date_end) {
            const endDate = new Date(event.date_end.replace(' ', 'T'));
            const startDate = event.date_start ? new Date(event.date_start.replace(' ', 'T')) : null;
            const now = new Date();
            
            if (endDate < now) return { label: 'Concluído', icon: 'check_circle', classes: 'bg-slate-500 text-white shadow-sm' };
            if (startDate && startDate <= now && endDate >= now) return { label: 'Em andamento', icon: 'play_circle', classes: 'bg-emerald-500 text-white shadow-sm' };
        }
        return { label: 'Planejado', icon: 'schedule', classes: 'bg-amber-500 text-white shadow-sm' };
    };

    const filteredHistoryGroups = React.useMemo(() => {
        let filtered = history.filter(req => {
            const lowerSearch = searchTerm.toLowerCase();
            const eventTitle = (req.expand?.event?.title || '').toLowerCase();
            const requesterName = (req.expand?.created_by?.name || '').toLowerCase();
            const itemName = (req.expand?.item?.name || '').toLowerCase();
            
            const matchesSearch = eventTitle.includes(lowerSearch) || 
                   requesterName.includes(lowerSearch) ||
                   itemName.includes(lowerSearch);

            if (!matchesSearch) return false;

            const eventDate = req.expand?.event?.date_start ? new Date(req.expand.event.date_start.replace(' ', 'T')) : new Date(req.created);
            
            if (eventDate.getMonth() !== filterMonth || eventDate.getFullYear() !== filterYear) return false;

            const reqName = req.expand?.created_by?.name || req.expand?.created_by?.email;
            if (filterRequesters.length > 0 && !filterRequesters.includes(reqName)) return false;

            const statusLabel = getEventStatusBadge(req.expand?.event).label;
            if (!filterStatuses.includes(statusLabel)) return false;

            return true;
        });

        const groups = new Map();
        filtered.forEach(req => {
            const key = req.event || `no-event-${req.id}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    eventId: key,
                    event: req.expand?.event,
                    created_by: req.expand?.created_by,
                    created: req.created,
                    updated: req.updated,
                    requests: []
                });
            }
            groups.get(key).requests.push(req);
        });

        let result = Array.from(groups.values());

        if (sortConfig !== null) {
            result.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                switch (sortConfig.key) {
                    case 'date':
                        aValue = new Date(a.event?.date_start || a.created).getTime();
                        bValue = new Date(b.event?.date_start || b.created).getTime();
                        break;
                    case 'title':
                        aValue = (a.event?.title || '').toLowerCase();
                        bValue = (b.event?.title || '').toLowerCase();
                        break;
                    case 'event_status':
                        aValue = (a.event?.status || '').toLowerCase();
                        bValue = (b.event?.status || '').toLowerCase();
                        break;
                    default:
                        return 0;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return result;
    }, [history, searchTerm, sortConfig, filterMonth, filterYear, filterRequesters, filterStatuses]);

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

                <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit border border-slate-200/50 overflow-x-auto max-w-full">
                    <button
                        onClick={() => handleViewChange('events')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                            activeView === 'events' 
                            ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0,05)] border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">calendar_month</span>
                        Agenda
                    </button>
                    <button
                        onClick={() => handleViewChange('inventory')}
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
                        onClick={() => handleViewChange('history')}
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
                <>
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

                        <div className="flex flex-col xl:flex-row gap-8 items-start">
                            {/* Novo Recurso Form */}
                            <div className="w-full xl:w-[400px] shrink-0 sticky top-8">
                                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
                                            <span className="material-symbols-outlined text-2xl">add_circle</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Novo Recurso</h2>
                                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Cadastro de Recurso</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleAddItem} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Recurso</label>
                                            <input
                                                type="text"
                                                value={newItemName}
                                                onChange={(e) => setNewItemName(e.target.value)}
                                                placeholder="Ex: Notebook Dell, Projetor..."
                                                className="w-full h-14 px-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidade</label>
                                            <input
                                                type="text"
                                                value={newItemUnit}
                                                onChange={(e) => setNewItemUnit(e.target.value)}
                                                placeholder="un"
                                                className="w-full h-14 px-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Disponibilidade Imediata</label>
                                            <button
                                                type="button"
                                                onClick={() => setNewItemAvailable(!newItemAvailable)}
                                                className={`w-full h-14 px-4 rounded-2xl flex items-center justify-between transition-all border ${
                                                    newItemAvailable 
                                                    ? 'bg-emerald-50 border-emerald-100/50' 
                                                    : 'bg-slate-50 border-slate-100'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-2 rounded-full ${newItemAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                    <span className={`text-xs font-black uppercase tracking-wider ${newItemAvailable ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {newItemAvailable ? 'Disponível' : 'Indisponível'}
                                                    </span>
                                                </div>
                                                
                                                <div className={`w-11 h-6 rounded-full p-1 transition-colors relative ${newItemAvailable ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                                    <div className={`size-4 rounded-full bg-white shadow-sm transition-transform duration-300 absolute top-1 ${newItemAvailable ? 'left-[22px]' : 'left-1'}`} />
                                                </div>
                                            </button>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full h-14 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-hover active:scale-[0.98] transition-all shadow-xl shadow-primary/20 hover:shadow-primary/30 mt-2"
                                        >
                                            {editingId ? 'Atualizar Recurso' : 'Cadastrar Recurso'}
                                        </button>

                                        {editingId && (
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-colors py-2"
                                            >
                                                Cancelar Edição
                                            </button>
                                        )}
                                    </form>
                                </div>
                            </div>

                            {/* Recursos Table Container */}
                            <div className="flex-1 w-full min-w-0 flex flex-col gap-6">
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
                                                        <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {loading ? (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-20 text-center">
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <div className="size-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando recursos...</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : filteredItems.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-32 text-center">
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
                                                                    <button 
                                                                        onClick={() => handleToggleAvailability(item.id)}
                                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                                                        (item.is_available === true || String(item.is_available) === 'true')
                                                                        ? 'bg-green-50 text-green-600 border border-green-100/50 hover:bg-green-100 hover:border-green-200'
                                                                        : 'bg-rose-50 text-rose-600 border border-rose-100/50 hover:bg-rose-100 hover:border-rose-200'
                                                                    } border text-[10px] font-black uppercase tracking-widest`}>
                                                                        <span className={`size-1.5 rounded-full ${(item.is_available === true || String(item.is_available) === 'true') ? 'bg-green-500' : 'bg-rose-500'} animate-pulse`}></span>
                                                                        {(item.is_available === true || String(item.is_available) === 'true') ? 'Disponível' : 'Indisponível'}
                                                                    </button>
                                                                </td>
                                                                <td className="px-6 py-5 text-right">
                                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => handleEditItem(item)}
                                                                            className="size-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white flex items-center justify-center transition-all"
                                                                            title="Editar"
                                                                        >
                                                                            <span className="material-symbols-outlined text-base">edit</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteItem(item.id)}
                                                                            className="size-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
                                                                            title="Excluir"
                                                                        >
                                                                            <span className="material-symbols-outlined text-base">delete</span>
                                                                        </button>
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
                </>
            ) : activeView === 'history' ? (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Search and Filters for History */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row gap-6 items-stretch">
                            {/* Busca Rápida */}
                            <div className="flex-1 flex flex-col gap-2.5">
                                <div className="flex items-center justify-center gap-2 px-1 shrink-0 h-4">
                                    <span className="material-symbols-outlined text-slate-400 text-[16px]">search</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Busca Rápida</span>
                                </div>
                                <div className="relative h-14 bg-slate-50/50 border border-slate-100 rounded-2xl transition-all hover:bg-white hover:shadow-sm focus-within:bg-white focus-within:shadow-sm focus-within:border-slate-200">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input
                                        type="text"
                                        placeholder="Filtrar por evento, solicitante ou recurso..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full h-full bg-transparent border-none pl-12 pr-4 text-xs font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:ring-0 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Resumo Analítico */}
                            <div className="md:w-[480px] flex flex-col gap-2.5">
                                <div className="flex items-center justify-center gap-2 px-1 shrink-0 h-4">
                                    <span className="material-symbols-outlined text-slate-400 text-[16px]">analytics</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo Analítico</span>
                                </div>
                                <div className="h-14 flex items-center justify-between px-6 bg-slate-50/50 border border-slate-100 rounded-2xl transition-all hover:bg-white hover:shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined text-lg">description</span>
                                        </div>
                                        <div className="flex flex-col -space-y-0.5">
                                            <span className="text-[11px] font-black text-slate-900">{filteredHistoryGroups.reduce((acc, g) => acc + g.requests.length, 0)}</span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Registros</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200" />
                                    <div className="flex items-center gap-3">
                                        {[
                                            { label: 'Planejado', color: 'bg-amber-500' },
                                            { label: 'Em andamento', color: 'bg-emerald-500' },
                                            { label: 'Concluído', color: 'bg-slate-500' },
                                            { label: 'Cancelado', color: 'bg-rose-500' }
                                        ].map(status => {
                                            const count = filteredHistoryGroups.reduce((acc, g) => {
                                                const eventStatus = getEventStatusBadge(g.event).label;
                                                return eventStatus === status.label ? acc + g.requests.length : acc;
                                            }, 0);
                                            return (
                                                <div key={status.label} className="flex flex-col items-center -space-y-1" title={status.label}>
                                                    <span className="text-[11px] font-black text-slate-900">{count}</span>
                                                    <div className={`w-3 h-1 rounded-full ${status.color}`} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="w-px h-6 bg-slate-200" />
                                    <div className="flex items-center gap-4">
                                        <div className="size-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-lg">event</span>
                                        </div>
                                        <div className="flex flex-col -space-y-0.5">
                                            <span className="text-[11px] font-black text-slate-900">{filteredHistoryGroups.length}</span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Eventos</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-stretch justify-between gap-6 border-t border-slate-50 pt-6">
                            {/* Período */}
                            <div className="flex-1 min-w-[240px] flex flex-col gap-2.5">
                                <div className="flex items-center justify-center gap-2 px-1 shrink-0 h-4">
                                    <span className="material-symbols-outlined text-slate-400 text-[16px]">calendar_month</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</span>
                                </div>
                                <div className="h-14 flex items-center bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-center flex-1 min-w-0 h-full">
                                        {/* Dropdown Mês */}
                                        <div className="relative group/month flex-1 h-full">
                                            <div className="flex items-center justify-center gap-1.5 cursor-pointer w-full h-full hover:bg-slate-50 transition-colors px-2">
                                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest truncate">{months[filterMonth]}</span>
                                                <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">expand_more</span>
                                            </div>
                                            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-2 hidden group-hover/month:block animate-in fade-in zoom-in-95 duration-200">
                                                <div className="px-4 py-2 border-b border-slate-50">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionar Mês</span>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                    {months.map((month, index) => (
                                                        <div 
                                                            key={month}
                                                            onClick={() => setFilterMonth(index)}
                                                            className={`px-4 py-2.5 hover:bg-primary/5 cursor-pointer transition-colors text-xs font-bold ${filterMonth === index ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                                                        >
                                                            {month}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-px h-6 bg-slate-200 shrink-0" />

                                        {/* Dropdown Ano */}
                                        <div className="relative group/year flex-1 h-full">
                                            <div className="flex items-center justify-center gap-1.5 cursor-pointer w-full h-full hover:bg-slate-50 transition-colors px-2">
                                                <span className="text-xs font-black text-slate-700 outline-none">{filterYear}</span>
                                                <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">expand_more</span>
                                            </div>
                                            <div className="absolute top-full right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-2 hidden group-hover/year:block animate-in fade-in zoom-in-95 duration-200">
                                                <div className="px-4 py-2 border-b border-slate-50">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionar Ano</span>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                    {years.map(year => (
                                                        <div 
                                                            key={year}
                                                            onClick={() => setFilterYear(year)}
                                                            className={`px-4 py-2.5 hover:bg-primary/5 cursor-pointer transition-colors text-xs font-bold ${filterYear === year ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                                                        >
                                                            {year}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Solicitante */}
                            <div className="flex-1 min-w-[240px] flex flex-col gap-2.5">
                                <div className="flex items-center justify-center gap-2 px-1 shrink-0 h-4">
                                    <span className="material-symbols-outlined text-slate-400 text-[16px]">person</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitante</span>
                                </div>
                                <div className="h-14 flex items-center bg-slate-50/50 px-4 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                                    <div className="relative group/multi flex-1 h-full flex items-center">
                                        <div className="flex items-center justify-between gap-2 cursor-pointer w-full px-1">
                                            <span className="text-xs font-bold text-slate-600 truncate text-center flex-1">
                                                {filterRequesters.length === 0 
                                                    ? 'Todos' 
                                                    : filterRequesters.length === 1 
                                                        ? filterRequesters[0] 
                                                        : `${filterRequesters.length} selecionados`}
                                            </span>
                                            <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">expand_more</span>
                                        </div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-2 hidden group-hover/multi:block animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-3 py-2 border-b border-slate-50 flex items-center justify-between">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionar</span>
                                                {filterRequesters.length > 0 && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFilterRequesters([]);
                                                        }}
                                                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600"
                                                    >
                                                        Limpar
                                                    </button>
                                                )}
                                            </div>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                {uniqueRequesters.map(req => (
                                                    <label key={req} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer transition-colors group/label">
                                                        <div className={`size-4 rounded border flex items-center justify-center transition-all ${
                                                            filterRequesters.includes(req) 
                                                                ? 'bg-primary border-primary text-white' 
                                                                : 'border-slate-200 group-hover/label:border-primary/50 bg-white'
                                                        }`}>
                                                            {filterRequesters.includes(req) && <span className="material-symbols-outlined text-[12px] font-black">check</span>}
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden"
                                                            checked={filterRequesters.includes(req)}
                                                            onChange={() => {
                                                                setFilterRequesters(prev => 
                                                                    prev.includes(req) 
                                                                        ? prev.filter(r => r !== req)
                                                                        : [...prev, req]
                                                                );
                                                            }}
                                                        />
                                                        <span className={`text-xs font-bold transition-colors ${filterRequesters.includes(req) ? 'text-slate-900' : 'text-slate-500'}`}>
                                                            {req}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex-[1.5] min-w-[320px] flex flex-col gap-2.5">
                                <div className="flex items-center justify-center gap-2 px-1 shrink-0 h-4">
                                    <span className="material-symbols-outlined text-slate-400 text-[16px]">done_all</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Ativos</span>
                                </div>
                                <div className="h-14 flex items-center bg-slate-50/50 px-2 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                                    <div className="flex items-center gap-1 flex-1 h-full py-2 overflow-x-auto lg:overflow-visible custom-scrollbar px-1">
                                        {[
                                            { label: 'Planejado', icon: 'schedule', color: 'amber' },
                                            { label: 'Em andamento', icon: 'play_circle', color: 'emerald' },
                                            { label: 'Concluído', icon: 'check_circle', color: 'slate' },
                                            { label: 'Cancelado', icon: 'cancel', color: 'rose' }
                                        ].map((status) => {
                                            const isActive = filterStatuses.includes(status.label);
                                            const colorClasses: Record<string, string> = {
                                                amber: isActive ? 'bg-amber-500 text-white shadow-amber-200' : 'text-amber-500 hover:bg-amber-50',
                                                emerald: isActive ? 'bg-emerald-500 text-white shadow-emerald-200' : 'text-emerald-400 hover:bg-emerald-50',
                                                slate: isActive ? 'bg-slate-500 text-white shadow-slate-200' : 'text-slate-400 hover:bg-slate-50',
                                                rose: isActive ? 'bg-rose-500 text-white shadow-rose-200' : 'text-rose-400 hover:bg-rose-50'
                                            };

                                            return (
                                                <button
                                                    key={status.label}
                                                    onClick={() => {
                                                        setFilterStatuses(prev => 
                                                            prev.includes(status.label) 
                                                                ? prev.filter(s => s !== status.label)
                                                                : [...prev, status.label]
                                                        );
                                                    }}
                                                    className={`flex items-center gap-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 shadow-sm border border-transparent h-full flex-1 min-w-fit justify-center text-center leading-none ${colorClasses[status.color]}`}
                                                    title={`Filtrar por ${status.label}`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px] shrink-0">{status.icon}</span>
                                                    <span className="whitespace-nowrap">{status.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            
                            {(filterMonth !== new Date().getMonth() || filterYear !== new Date().getFullYear() || filterRequesters.length > 0 || filterStatuses.length !== 4) && (
                                <div className="w-full flex justify-center mt-2">
                                    <button 
                                        onClick={() => {
                                            setFilterMonth(new Date().getMonth());
                                            setFilterYear(new Date().getFullYear());
                                            setFilterRequesters([]);
                                            setFilterStatuses(['Planejado', 'Em andamento', 'Concluído', 'Cancelado']);
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all border border-rose-100/50"
                                    >
                                        Limpar Filtros
                                    </button>
                                </div>
                            )}
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
                                        <th onClick={() => handleSort('date')} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors w-[20%]">
                                            <div className="flex items-center gap-1">Data/Hora Evento {sortConfig?.key === 'date' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                                        </th>
                                        <th onClick={() => handleSort('title')} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors w-[30%]">
                                            <div className="flex items-center gap-1">Evento / Solicitante {sortConfig?.key === 'title' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                                        </th>
                                        <th onClick={() => handleSort('event_status')} className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors w-[15%]">
                                            <div className="flex items-center gap-1">Status Evento {sortConfig?.key === 'event_status' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                                        </th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-[35%]">
                                            <div className="flex items-center justify-between">
                                                <span>Recursos Solicitados</span>
                                                <span>Status Liberação</span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando histórico...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredHistoryGroups.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-32 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                                        <span className="material-symbols-outlined text-3xl text-slate-200">history_toggle_off</span>
                                                    </div>
                                                    <p className="text-slate-900 font-black text-sm">Nenhum registro encontrado</p>
                                                    <p className="text-slate-400 font-medium text-xs max-w-xs mx-auto text-balance">Não encontramos solicitações com os termos pesquisados.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredHistoryGroups.map((group) => {
                                            const eventDate = group.event?.date_start ? new Date(group.event.date_start.replace(' ', 'T')) : null;
                                            const eventDateEnd = group.event?.date_end ? new Date(group.event.date_end.replace(' ', 'T')) : null;
                                            const eventStatusBadge = getEventStatusBadge(group.event);
                                            const isCanceledOrDeleted = !group.event || group.event.status === 'canceled';
                                            const cancelDate = isCanceledOrDeleted ? new Date(group.updated).toLocaleDateString('pt-BR') : null;
                                            const cancelTime = isCanceledOrDeleted ? new Date(group.updated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
                                            
                                            return (
                                            <tr key={group.eventId} data-anchor={`event-${group.eventId}`} className="hover:bg-slate-50/30 transition-colors group/row text-sm">
                                                <td className="px-6 py-6 align-top">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-slate-900 font-black text-[15px]">{eventDate ? eventDate.toLocaleDateString('pt-BR') : new Date(group.created).toLocaleDateString('pt-BR')}</span>
                                                        <span className="inline-flex items-center gap-1.5 text-slate-500 font-bold text-xs bg-slate-100/80 px-2.5 py-1 rounded-md w-fit">
                                                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                            {eventDate ? eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            {eventDateEnd ? ` - ${eventDateEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                        </span>
                                                        {isCanceledOrDeleted && (
                                                            <div className="mt-2 flex flex-col gap-0.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Data de {group.event ? 'Cancelamento' : 'Exclusão'}:</span>
                                                                <span className="text-xs font-bold text-rose-600">{cancelDate} às {cancelTime}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 align-top">
                                                    <div className="flex flex-col gap-2">
                                                        {group.event ? (() => {
                                                            const dateStr = eventDate ? `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}` : '';
                                                            return (
                                                                <Link 
                                                                    to={`/calendar?date=${dateStr}&view=day&eventId=${group.eventId}&tab=resources&from=${encodeURIComponent(`${location.pathname}?view=${activeView}&scroll=${scrollPositions.current[activeView] || getCurrentScroll()}&anchor=${group.eventId}`)}`}
                                                                    onClick={() => {
                                                                        persistScroll(activeView, getCurrentScroll());
                                                                    }}
                                                                    className="text-slate-900 font-bold hover:text-primary transition-colors flex items-start gap-1.5 group/link text-base"
                                                                    title="Ver detalhes do evento na aba recursos"
                                                                >
                                                                    <span className="leading-tight">{group.event.title || 'Evento não encontrado'}</span>
                                                                    <span className="material-symbols-outlined text-[16px] opacity-0 group-hover/link:opacity-100 transition-opacity mt-0.5 text-primary">open_in_new</span>
                                                                </Link>
                                                            );
                                                        })() : (
                                                            <span className="text-slate-900 font-bold text-base leading-tight line-through opacity-60" title="Evento Excluído">{group.requests[0]?.expand?.event?.title || 'Evento Excluído'}</span>
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                                {(group.created_by?.name || group.created_by?.email || '?')[0].toUpperCase()}
                                                            </div>
                                                            <span className="text-slate-500 text-xs font-medium">{group.created_by?.name || group.created_by?.email || 'Solicitante desconhecido'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 align-top">
                                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all duration-300 ${eventStatusBadge.classes}`}>
                                                        <span className="material-symbols-outlined text-[16px]">{eventStatusBadge.icon}</span>
                                                        {eventStatusBadge.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-6 align-top">
                                                    <div className="flex flex-col gap-3">
                                                        {group.requests.map((req: any) => (
                                                            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group/item">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-black text-sm shadow-sm shrink-0">
                                                                        {req.quantity || 1}
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-slate-900 font-bold">{req.expand?.item?.name || 'Item não encontrado'}</span>
                                                                        <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mt-0.5">Sol: {new Date(req.created).toLocaleDateString('pt-BR')} às {new Date(req.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                                                        req.status === 'approved' 
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                                        : req.status === 'rejected'
                                                                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                                                                        : 'bg-amber-50 text-amber-600 border-amber-100'
                                                                    }`}>
                                                                        <span className={`size-1.5 rounded-full ${
                                                                            req.status === 'approved' ? 'bg-emerald-500 animate-pulse' : req.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                                                                        }`}></span>
                                                                        {req.status === 'approved' ? 'Liberado' : req.status === 'rejected' ? 'Negado' : 'Pendente'}
                                                                    </span>
                                                                    {req.justification && (
                                                                        <p className="text-[10px] text-rose-500 italic font-medium max-w-[150px] truncate" title={req.justification}>
                                                                            "{req.justification}"
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )})
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                                    <span className="material-symbols-outlined text-2xl">event_upcoming</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Agenda de Eventos</h2>
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Eventos agendados por data</p>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center gap-3 py-20">
                                <div className="size-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando agenda...</p>
                            </div>
                        ) : groupedEvents.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-20">
                                <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                    <span className="material-symbols-outlined text-3xl text-slate-200">event_busy</span>
                                </div>
                                <p className="text-slate-900 font-black text-sm">Nenhum evento agendado</p>
                                <p className="text-slate-400 font-medium text-xs max-w-xs mx-auto text-balance text-center">Não há eventos futuros com solicitações para a Informática.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {groupedEvents.map((group) => {
                                    const eventDate = group.event.date_start ? new Date(group.event.date_start.replace(' ', 'T')) : new Date();
                                    const day = String(eventDate.getDate()).padStart(2, '0');
                                    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                    const month = monthNames[eventDate.getMonth()];
                                    const r = group.requests;
                                    const pendings = r.filter((x: any) => x.status === 'pending').length;
                                    
                                    return (
                                        <div key={group.event.id} className="group relative bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                                            {/* Date Badge */}
                                            <div className="absolute -top-3 -right-3 size-16 bg-primary text-white rounded-2xl flex flex-col items-center justify-center shadow-lg transform rotate-3 group-hover:rotate-0 transition-transform">
                                                <span className="text-xl font-black leading-none">{day}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mt-0.5">{month}</span>
                                            </div>

                                            <div className="mb-6 pr-12">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <h3 className="text-lg font-black text-slate-900 line-clamp-2 leading-tight">
                                                    <Link 
                                                        to={`/calendar?date=${eventDate.toISOString().split('T')[0]}&view=day&eventId=${group.event.id}&tab=resources&from=${encodeURIComponent(`${location.pathname}?view=${activeView}&scroll=${scrollPositions.current[activeView] || getCurrentScroll()}&anchor=${group.event.id}`)}`} 
                                                        className="hover:text-primary transition-colors"
                                                        onClick={() => {
                                                            persistScroll(activeView, getCurrentScroll());
                                                        }}
                                                    >
                                                        {group.event.title || 'Evento sem título'}
                                                    </Link>
                                                </h3>
                                                {group.event.expand?.location ? (
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{group.event.expand.location.name}</span>
                                                    </div>
                                                ) : group.event.custom_location ? (
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{group.event.custom_location}</span>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="space-y-3 mb-6">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Recursos Solicitados ({r.length})</h4>
                                                <ul className="space-y-2 max-h-[160px] overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
                                                    {r.map((req: any) => (
                                                        <li key={req.id} className="flex flex-col p-2.5 rounded-xl bg-slate-50/50 border border-slate-100/50">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="size-6 shrink-0 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-900 font-bold text-[10px] shadow-sm">
                                                                        {req.quantity || 1}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-700 truncate" title={req.expand?.item?.name || 'Recurso desconhecido'}>{req.expand?.item?.name || 'Recurso desconhecido'}</span>
                                                                </div>
                                                                <div className="shrink-0 ml-2">
                                                                    {req.status === 'approved' ? (
                                                                        <span className="material-symbols-outlined text-[16px] text-emerald-500" title="Aprovado">check_circle</span>
                                                                    ) : req.status === 'rejected' ? (
                                                                        <span className="material-symbols-outlined text-[16px] text-rose-500" title="Negado">cancel</span>
                                                                    ) : (
                                                                        <span className="material-symbols-outlined text-[16px] text-amber-500 animate-pulse" title="Pendente">pending</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100/50 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                                <div className="flex items-center gap-1" title="Data de Solicitação">
                                                                    <span className="material-symbols-outlined text-[11px]">add_circle</span>
                                                                    {req.created ? new Date(req.created.replace(' ', 'T') + (req.created.includes('Z') ? '' : 'Z')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '---'}
                                                                </div>
                                                                {req.updated && req.updated !== req.created && (
                                                                    <div className="flex items-center gap-1" title="Última Edição">
                                                                        <span className="material-symbols-outlined text-[11px]">edit</span>
                                                                        {new Date(req.updated.replace(' ', 'T') + (req.updated.includes('Z') ? '' : 'Z')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-6 rounded-full bg-slate-100 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[12px] text-slate-500">person</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[120px]" title={group.event.expand?.user?.name || 'Criador do Evento'}>
                                                        {group.event.expand?.user?.name || 'Criador do Evento'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            printEventDoc({
                                                                responsavel: group.event.expand?.user?.name || 'Não informado',
                                                                nomeEvento: group.event.title || 'Evento sem título',
                                                                localEvento: group.event.expand?.location?.name || group.event.custom_location || 'Não informado',
                                                                dataInicio: group.event.date_start ? new Date(group.event.date_start.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '---',
                                                                dataFim: group.event.date_end ? new Date(group.event.date_end.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '---',
                                                                observacoes: group.event.observacoes || group.event.description || '',
                                                                participantes: group.event.estimated_participants || 'Não informado',
                                                                insumos: r.map((req: any) => ({
                                                                    quantidade: req.quantity || 1,
                                                                    nome: req.expand?.item?.name || 'Recurso desconhecido',
                                                                    status: req.status === 'approved' ? 'Liberado' : req.status === 'rejected' ? 'Não Liberado' : 'Pendente'
                                                                })),
                                                                departamento: 'Informática'
                                                            });
                                                        }}
                                                        className="size-7 rounded-lg bg-slate-50 text-slate-500 hover:text-primary hover:bg-primary/10 border border-slate-100 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                                                        title="Imprimir Solicitação"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">print</span>
                                                    </button>
                                                    {pendings > 0 ? (
                                                        <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-100 flex items-center gap-1">
                                                            <div className="size-1 rounded-full bg-amber-500 animate-pulse" />
                                                            {pendings} Pendente{pendings > 1 ? 's' : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[10px]">check</span>
                                                            Aprovado
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
                </div>
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

export default InformaticsManagement;
