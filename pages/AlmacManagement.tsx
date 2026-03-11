import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { Navigate, useLocation, Link } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal';
import { printEventDoc } from '../lib/printUtils';

const AlmacManagement: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    
    // Inventory State
    const [items, setItems] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemType, setNewItemType] = useState<'almoxarifado' | 'copa'>('almoxarifado');
    const [newItemAvailable, setNewItemAvailable] = useState(true);
    const [newItemUnit, setNewItemUnit] = useState('un');
    const [newItemStock, setNewItemStock] = useState<number>(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'inventory' | 'history' | 'events'>('inventory');
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState('');

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
        const params = new URLSearchParams(location.search);
        setSearchTerm(params.get('search') || '');
        
        const view = params.get('view');
        if (view === 'history') {
            setActiveView('history');
        } else if (view === 'events') {
            setActiveView('events');
        } else if (view === 'inventory') {
            setActiveView('inventory');
        }
    }, [location.search]);

    const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'ALMOXARIFADO' | 'COPA'>('ALL');

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'ALL' || item.category.toUpperCase() === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const filteredHistory = history.filter(req => {
        const lowerSearch = searchTerm.toLowerCase();
        const eventTitle = (req.expand?.event?.title || '').toLowerCase();
        const requesterName = (req.expand?.created_by?.name || '').toLowerCase();
        const itemName = (req.expand?.item?.name || '').toLowerCase();
        
        return eventTitle.includes(lowerSearch) || 
               requesterName.includes(lowerSearch) ||
               itemName.includes(lowerSearch);
    });

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
        if (user && (user.role === 'ALMC' || user.role === 'ADMIN')) {
            fetchData();
        }
    }, [user, activeView]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeView === 'inventory') {
                const res = await pb.collection('agenda_cap53_itens_servico').getFullList({ 
                    sort: 'name',
                    filter: 'category != "INFORMATICA"'
                });
                setItems(res);
            } else {
                const res = await pb.collection('agenda_cap53_almac_requests').getFullList({
                    sort: '-created',
                    expand: 'item,event,event.location,event.user,created_by'
                });
                // Filtrar apenas itens que NÃO são informática
                const almacHistory = res.filter(req => req.expand?.item?.category !== 'INFORMATICA');
                setHistory(almacHistory);
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

        const setupSubscription = async () => {
            try {
                // Subscribe to items
                unsubscribeItems = await pb.collection('agenda_cap53_itens_servico').subscribe('*', (e) => {
                    if (!isMounted) return;
                    if (e.record.category === 'INFORMATICA') return;

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

                            const isDifferent = 
                                currentAvail !== recordAvail || 
                                current.name !== e.record.name ||
                                current.category !== e.record.category;
                            
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
                console.error('Erro ao subscrever AlmacManagement:', err);
            }
        };

        setupSubscription();

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
            const normalizedCategory = newItemType.toUpperCase();
            const normalizedUnit = newItemUnit.trim();
            
            const itemData = {
                name: normalizedName,
                category: normalizedCategory,
                unit: normalizedUnit,
                is_available: !!newItemAvailable,
                stock: Number(newItemStock)
            };

            if (editingId) {
                const existing = items.find(i => 
                    i.name.toUpperCase().trim() === normalizedName && 
                    i.category.toUpperCase() === normalizedCategory && 
                    i.id !== editingId
                );
                if (existing) {
                    alert('Já existe outro item com este nome nesta categoria.');
                    return;
                }

                await pb.collection('agenda_cap53_itens_servico').update(editingId, itemData);
                alert('Item atualizado com sucesso!');
                setEditingId(null);
            } else {
                const existing = items.find(i => 
                    i.name.toUpperCase().trim() === normalizedName && 
                    i.category.toUpperCase() === normalizedCategory
                );
                if (existing) {
                    alert('Este item já existe nesta categoria.');
                    return;
                }

                await pb.collection('agenda_cap53_itens_servico').create(itemData);
                alert('Item adicionado com sucesso!');
            }
            
            setNewItemName('');
            setNewItemAvailable(true);
            setNewItemUnit('un');
            setNewItemStock(0);
            fetchData();
        } catch (error: any) {
            console.error('Erro ao salvar item:', error);
            alert(`Erro ao salvar item: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleEditItem = (item: any) => {
        setNewItemName(item.name);
        setNewItemType(item.category.toLowerCase() as any);
        setNewItemUnit(item.unit || 'un');
        setNewItemStock(item.stock || 0);
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
        setNewItemType('almoxarifado');
        setNewItemUnit('un');
        setNewItemStock(0);
        setNewItemAvailable(true);
        setEditingId(null);
    };

    const handleDeleteItem = async (id: string) => {
        setConfirmationModalConfig({
            title: 'Excluir Item',
            description: 'Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.',
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

    const handleDeleteHistory = async (id: string) => {
        setConfirmationModalConfig({
            title: 'Excluir Histórico',
            description: 'Tem certeza que deseja excluir este registro do histórico?',
            confirmText: 'Excluir',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await pb.collection('agenda_cap53_almac_requests').delete(id);
                    setHistory(prev => prev.filter(req => req.id !== id));
                    setConfirmationModalOpen(false);
                } catch (error) {
                    console.error('Error deleting history record:', error);
                    alert('Erro ao excluir registro do histórico.');
                }
            }
        });
        setConfirmationModalOpen(true);
    };

    const handleClearAllHistory = async () => {
        if (!history || history.length === 0) return;
        
        setConfirmationModalConfig({
            title: 'Limpar Todo o Histórico',
            description: `Deseja realmente limpar todo o histórico (${history.length} registros)? Esta ação é irreversível.`,
            confirmText: 'Limpar Tudo',
            variant: 'danger',
            onConfirm: async () => {
                setLoading(true);
                try {
                    await Promise.all(history.map(req => pb.collection('agenda_cap53_almac_requests').delete(req.id)));
                    setHistory([]);
                    // alert('Histórico limpo com sucesso.'); // Removed alert for smoother UX
                    setConfirmationModalOpen(false);
                } catch (error) {
                    console.error('Error clearing history:', error);
                    alert('Erro ao limpar o histórico.');
                } finally {
                    setLoading(false);
                }
            }
        });
        setConfirmationModalOpen(true);
    };

    if (authLoading) return null;
    if (!user || (user.role !== 'ALMC' && user.role !== 'ADMIN')) {
        return <Navigate to="/calendar" replace />;
    }

    return (
        <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full p-4 md:p-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                        <span className="material-symbols-outlined text-2xl">inventory_2</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Almoxarifado & Copa</h1>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Gestão de Itens e Solicitações</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit border border-slate-200/50 overflow-x-auto max-w-full">
                    <button
                        onClick={() => setActiveView('events')}
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
                        onClick={() => setActiveView('inventory')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
                            activeView === 'inventory' 
                            ? 'bg-white text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0,05)] border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">inventory_2</span>
                        Estoque
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
                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-slate-200 transition-all">
                            <div className="size-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform">
                                <span className="material-symbols-outlined text-3xl">inventory_2</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Total em Estoque</p>
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
                        {/* Novo Item Form */}
                        <div className="w-full xl:w-[400px] shrink-0 sticky top-8">
                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
                                        <span className="material-symbols-outlined text-2xl">add_circle</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Novo Item</h2>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Cadastro de Item</p>
                                    </div>
                                </div>

                                <form onSubmit={handleAddItem} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Item</label>
                                        <input
                                            type="text"
                                            value={newItemName}
                                            onChange={(e) => setNewItemName(e.target.value)}
                                            placeholder="Ex: Água Mineral 500ml"
                                            className="w-full h-14 px-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                                        <div className="flex bg-slate-50 p-1.5 rounded-2xl">
                                            <button
                                                type="button"
                                                onClick={() => setNewItemType('almoxarifado')}
                                                className={`flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    newItemType === 'almoxarifado' 
                                                    ? 'bg-white text-slate-900 shadow-sm' 
                                                    : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                Almoxarifado
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewItemType('copa')}
                                                className={`flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    newItemType === 'copa' 
                                                    ? 'bg-white text-slate-900 shadow-sm' 
                                                    : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                Copa
                                            </button>
                                        </div>
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
                                        className="w-full h-14 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 mt-2"
                                    >
                                        {editingId ? 'Atualizar Item' : 'Cadastrar Item'}
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

                        {/* Inventory Table Container */}
                        <div className="flex-1 w-full min-w-0 flex flex-col gap-6">
                            {/* Search and Filters */}
                            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-3 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="relative flex-1 w-full">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input 
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Buscar por nome ou categoria..."
                                        className="w-full pl-12 pr-4 h-12 bg-slate-50/50 border-none rounded-2xl text-sm font-medium focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                                    />
                                </div>
                                
                                <div className="flex items-center gap-1 p-1 bg-slate-50/50 rounded-2xl border border-slate-100 w-full md:w-auto">
                                    {(['ALL', 'ALMOXARIFADO', 'COPA'] as const).map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategoryFilter(cat)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                categoryFilter === cat 
                                                ? 'bg-white text-slate-900 shadow-sm' 
                                                : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            {cat === 'ALL' ? 'Todos' : cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto -mx-4 md:mx-0">
                                    <div className="min-w-[800px] md:min-w-full">
                                        <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibilidade</th>
                                                <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="size-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando estoque...</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-32 text-center">
                                                        <div className="flex flex-col items-center gap-4">
                                                            <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-3xl text-slate-200">inventory_2</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-slate-900 font-black text-sm">Nenhum item encontrado</p>
                                                                <p className="text-slate-400 font-medium text-xs mt-1">Tente ajustar sua busca ou cadastrar um novo item.</p>
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
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                                item.category === 'COPA' 
                                                                ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                                                : 'bg-blue-50 text-blue-600 border border-blue-100'
                                                            }`}>
                                                                {item.category === 'COPA' ? 'Copa' : 'Almoxarifado'}
                                                            </span>
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
            ) : activeView === 'history' ? (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Search and Filters for History */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar no histórico (evento ou solicitante)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl h-12 pl-12 pr-4 text-sm font-medium focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900/20 outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 bg-slate-50/50 px-4 py-2 rounded-2xl border border-slate-100">
                            <span className="material-symbols-outlined text-lg">history</span>
                            <span className="text-xs font-bold uppercase tracking-widest">{filteredHistory.length} Registros</span>
                        </div>
                    </div>

                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                                        <span className="material-symbols-outlined text-2xl">history</span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Solicitações</h2>
                                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Almoxarifado e Copa</p>
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
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item / Qtd</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
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
                                    ) : filteredHistory.length === 0 ? (
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
                                        filteredHistory.map((req) => (
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
                                                                    to={`/calendar?date=${dateStr}&view=day&eventId=${req.event}&tab=resources&from=${encodeURIComponent(`${location.pathname}?view=${activeView}`)}`}
                                                                    className="text-slate-900 font-bold hover:text-primary transition-colors flex items-center gap-1 group/link"
                                                                    title="Ver detalhes do evento na aba recursos"
                                                                >
                                                                    {req.expand?.event?.title || 'Evento não encontrado'}
                                                                    <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/link:opacity-100 transition-opacity">open_in_new</span>
                                                                </Link>
                                                            );
                                                        })() : (
                                                            <span className="text-slate-900 font-bold">{req.expand?.event?.title || 'Evento não encontrado'}</span>
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
                                                            <span className="text-slate-900 font-bold">{req.expand?.item?.name || 'Item não encontrado'}</span>
                                                            <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">{req.expand?.item?.unit || 'un'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
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
                                                        {req.status === 'approved' ? 'Entregue' : req.status === 'rejected' ? 'Negado' : 'Pendente'}
                                                    </span>
                                                    {req.justification && (
                                                        <p className="text-[10px] text-rose-500 mt-1.5 italic font-medium max-w-[150px] leading-relaxed">
                                                            "{req.justification}"
                                                        </p>
                                                    )}
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
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                                    <span className="material-symbols-outlined text-2xl">event_upcoming</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Agenda de Solicitações</h2>
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
                                <p className="text-slate-400 font-medium text-xs max-w-xs mx-auto text-balance text-center">Não há eventos futuros solicitando materiais do Almoxarifado/Copa.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {groupedEvents.map((group) => {
                                    const eventDate = group.event.date_start ? new Date(group.event.date_start.replace(' ', 'T')) : new Date();
                                    const day = String(eventDate.getDate()).padStart(2, '0');
                                    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                    const month = monthNames[eventDate.getMonth()];
                                    const year = eventDate.getFullYear();
                                    const r = group.requests;
                                    const pendings = r.filter((x: any) => x.status === 'pending').length;
                                    
                                    return (
                                        <div key={group.event.id} className="group relative bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
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
                                                    <Link to={`/calendar?date=${eventDate.toISOString().split('T')[0]}&view=day&eventId=${group.event.id}&tab=resources&from=${encodeURIComponent(`${location.pathname}?view=${activeView}`)}`} className="hover:text-indigo-600 transition-colors">
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
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Itens Solicitados ({r.length})</h4>
                                                <ul className="space-y-2 max-h-[160px] overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
                                                    {r.map((req: any) => (
                                                        <li key={req.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 border border-slate-100/50">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className="size-6 shrink-0 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-900 font-bold text-[10px] shadow-sm">
                                                                    {req.quantity || 1}
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 truncate" title={req.expand?.item?.name || 'Item desconhecido'}>{req.expand?.item?.name || 'Item desconhecido'}</span>
                                                            </div>
                                                            <div className="shrink-0 ml-2">
                                                                {req.status === 'approved' ? (
                                                                    <span className="material-symbols-outlined text-[16px] text-emerald-500" title="Entregue">check_circle</span>
                                                                ) : req.status === 'rejected' ? (
                                                                    <span className="material-symbols-outlined text-[16px] text-rose-500" title="Negado">cancel</span>
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-[16px] text-amber-500 animate-pulse" title="Pendente">pending</span>
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
                                                                    nome: req.expand?.item?.name || 'Item desconhecido',
                                                                    status: req.status === 'approved' ? 'Liberado' : req.status === 'rejected' ? 'Não Liberado' : 'Pendente'
                                                                })),
                                                                departamento: 'Almoxarifado e Copa'
                                                            });
                                                        }}
                                                        className="size-7 rounded-lg bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 transition-all flex items-center justify-center cursor-pointer active:scale-95"
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
                                                            Concluído
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

export default AlmacManagement;
