
import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { Navigate } from 'react-router-dom';
import CustomSelect from '../components/CustomSelect';

const InformaticsManagement: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    
    // Inventory State
    const [items, setItems] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemType, setNewItemType] = useState<'informatica'>('informatica');
    const [newItemAvailable, setNewItemAvailable] = useState(true);
    const [newItemUnit, setNewItemUnit] = useState('un');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'inventory' | 'history'>('inventory');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (user && (user.role === 'DCA' || user.role === 'ADMIN')) {
            fetchData();
        }
    }, [user, activeView]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeView === 'inventory') {
                // Filter items by category 'INFORMATICA'
                const res = await pb.collection('agenda_cap53_itens_servico').getFullList({ 
                    sort: 'name',
                    filter: 'category = "INFORMATICA"'
                });
                setItems(res);
            } else {
                // Fetch all requests and filter manually if category expansion is not directly filterable
                // PocketBase doesn't support filtering on expanded fields directly in getFullList like 'item.category'
                // unless it's a specific setup. We'll fetch and filter or use a more clever filter if possible.
                const res = await pb.collection('agenda_cap53_almac_requests').getFullList({
                    sort: '-created',
                    expand: 'item,event,created_by'
                });
                
                // Filter by informatics items only
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
                // Subscribe to real-time updates for items
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
                            // Comparação robusta convertendo para booleanos reais
                            const currentAvail = current.is_available !== false && current.is_available !== 'false';
                            const recordAvail = e.record.is_available !== false && e.record.is_available !== 'false';

                            const isDifferent = 
                                currentAvail !== recordAvail || 
                                current.name !== e.record.name;
                            
                            if (!isDifferent) return prev;
                            
                            console.log('Aplicando atualização do servidor via Real-time (Informatics)');
                            return prev.map(i => i.id === e.record.id ? e.record : i);
                        });
                    } else if (e.action === 'delete') {
                        setItems(prev => prev.filter(i => i.id !== e.record.id));
                    }
                });

                // Subscribe to real-time updates for requests
                unsubscribeRequests = await pb.collection('agenda_cap53_almac_requests').subscribe('*', (e) => {
                    if (!isMounted) return;
                    // We need to check if the request belongs to an informatics item
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

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName) return;
        try {
            const normalizedName = newItemName.toUpperCase().trim();
            const normalizedCategory = 'INFORMATICA';
            const normalizedUnit = newItemUnit.trim();
            
            const itemData = {
                name: normalizedName,
                category: normalizedCategory,
                unit: normalizedUnit,
                is_available: !!newItemAvailable
            };

            console.log('DADOS SENDO ENVIADOS (INFORMATICA):', JSON.stringify(itemData, null, 2));

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
                const updated = await pb.collection('agenda_cap53_itens_servico').update(editingId, itemData);
                
                if (updated.is_available !== !!newItemAvailable) {
                    console.error('ERRO: O servidor retornou um status de disponibilidade diferente do enviado!');
                    alert(`Atenção: O item foi salvo mas a disponibilidade não foi atualizada no servidor. (Enviado: ${newItemAvailable}, Recebido: ${updated.is_available})`);
                    await pb.collection('agenda_cap53_itens_servico').update(editingId, { is_available: !!newItemAvailable });
                }

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
                const created = await pb.collection('agenda_cap53_itens_servico').create(itemData);
                
                if (created.is_available !== !!newItemAvailable) {
                    console.error('ERRO: O servidor retornou um status de disponibilidade diferente do enviado!');
                    alert(`Atenção: O item foi criado mas a disponibilidade não foi salva corretamente no servidor. (Enviado: ${newItemAvailable}, Recebido: ${created.is_available})`);
                    await pb.collection('agenda_cap53_itens_servico').update(created.id, { is_available: !!newItemAvailable });
                }

                alert('Item adicionado com sucesso!');
            }
            
            setNewItemName('');
            setNewItemAvailable(true);
            setNewItemUnit('un');
            fetchData();
        } catch (error: any) {
            console.error('Erro detalhado ao salvar item:', JSON.stringify(error, null, 2));
            console.error('Dados do erro:', error.data);
            alert(`Erro ao salvar item: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleEditItem = (item: any) => {
        setNewItemName(item.name);
        setNewItemType('informatica');
        setNewItemAvailable(item.is_available ?? true);
        setNewItemUnit(item.unit || 'un');
        setEditingId(item.id);
        
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleToggleAvailability = async (itemId: string) => {
        const currentItem = items.find(i => i.id === itemId);
        if (!currentItem) return;

        const previousStatus = currentItem.is_available;
        const currentlyAvailable = previousStatus === true || String(previousStatus) === 'true';
        const nextStatus = !currentlyAvailable;

        console.log(`Iniciando toggle para ${currentItem.name} (${itemId}): ${currentlyAvailable} -> ${nextStatus}`);

        // Atualização otimista
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: nextStatus } : i));

        try {
            const result = await pb.collection('agenda_cap53_itens_servico').update(itemId, { 
                is_available: nextStatus
            });
            console.log(`Sucesso no servidor (disponibilidade informatics) [${itemId}]: agora é ${result.is_available}`);
            
            setItems(prev => prev.map(i => i.id === itemId ? result : i));
        } catch (error: any) {
            console.error('Error updating availability:', error);
            setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: previousStatus } : i));
            alert(`Erro ao atualizar disponibilidade: ${error.message || 'Erro de conexão com o servidor'}`);
        }
    };

    const handleCancelEdit = () => {
        setNewItemName('');
        setNewItemType('informatica');
        setNewItemUnit('un');
        setNewItemAvailable(true);
        setEditingId(null);
    };

    const handleDeleteItem = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        try {
            await pb.collection('agenda_cap53_itens_servico').delete(id);
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este registro do histórico?')) return;
        try {
            await pb.collection('agenda_cap53_almac_requests').delete(id);
            setHistory(prev => prev.filter(req => req.id !== id));
        } catch (error) {
            console.error('Error deleting history record:', error);
            alert('Erro ao excluir registro do histórico.');
        }
    };

    const handleClearAllHistory = async () => {
        if (!history || history.length === 0) return;
        
        if (!confirm(`Deseja realmente limpar todo o histórico (${history.length} registros)? Esta ação não pode ser desfeita.`)) return;
        
        setLoading(true);
        try {
            // Excluir em lotes para evitar sobrecarga
            await Promise.all(history.map(req => pb.collection('agenda_cap53_almac_requests').delete(req.id)));
            setHistory([]);
            alert('Histórico limpo com sucesso.');
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('Erro ao limpar o histórico.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return null;
    if (!user || (user.role !== 'DCA' && user.role !== 'ADMIN')) {
        return <Navigate to="/calendar" replace />;
    }

    return (
        <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full p-4 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Informática</h1>
                <p className="text-slate-500 font-medium">Controle de inventário e solicitações de recursos tecnológicos.</p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveView('inventory')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${
                        activeView === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Estoque e Cadastro
                </button>
                <button
                    onClick={() => setActiveView('history')}
                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${
                        activeView === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Histórico de Solicitações
                </button>
            </div>

            {activeView === 'inventory' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 h-fit overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                                    <span className="material-symbols-outlined text-2xl">
                                        {editingId ? 'edit_note' : 'add_circle'}
                                    </span>
                                </div>
                                <h2 className="text-lg font-black tracking-tight text-slate-900">
                                    {editingId ? 'Editar Item' : 'Novo Recurso'}
                                </h2>
                            </div>
                        </div>
                        
                        <form onSubmit={handleAddItem} className="p-6 flex flex-col gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Nome do Item</label>
                                <input
                                    type="text"
                                    required
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    className="h-11 rounded-xl bg-slate-50 border-none px-4 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300 transition-all"
                                    placeholder="Ex: Notebook Dell, Projetor EPSON"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Categoria</label>
                                    <div className="h-11 rounded-xl bg-slate-100/50 flex items-center px-4 text-xs font-black text-slate-400 uppercase tracking-widest cursor-not-allowed">
                                        Informática
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Unidade</label>
                                    <input
                                        type="text"
                                        list="unit-options"
                                        value={newItemUnit}
                                        onChange={(e) => setNewItemUnit(e.target.value)}
                                        className="h-11 rounded-xl bg-slate-50 border-none px-4 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300 transition-all"
                                        placeholder="un"
                                    />
                                    <datalist id="unit-options">
                                        <option value="un" />
                                        <option value="kit" />
                                        <option value="conjunto" />
                                    </datalist>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Disponibilidade Imediata</label>
                                <div className="flex p-1 bg-slate-50 rounded-xl gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setNewItemAvailable(true)}
                                        className={`flex-1 h-9 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                                            newItemAvailable ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        Disponível
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewItemAvailable(false)}
                                        className={`flex-1 h-9 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                                            !newItemAvailable ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        Indisponível
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    className="flex-1 h-11 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {editingId ? 'save' : 'add_circle'}
                                    </span>
                                    {editingId ? 'Salvar Alterações' : 'Cadastrar Recurso'}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="px-4 h-11 bg-white text-slate-400 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-slate-100 text-slate-900 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">devices</span>
                                </div>
                                <h2 className="text-lg font-black tracking-tight text-slate-900">Inventário Ativo</h2>
                                <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {filteredItems.length} Itens
                                </span>
                            </div>
                            
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] transition-colors group-focus-within:text-slate-900">search</span>
                                <input 
                                    type="text"
                                    placeholder="Buscar recurso..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:w-64 h-10 pl-10 pr-4 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item / Recurso</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="material-symbols-outlined text-4xl text-slate-200">inventory_2</span>
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Nenhum item encontrado</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">ID: #{item.id.slice(-4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase">
                                                        {item.unit || 'un'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => handleToggleAvailability(item.id)}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                                                            (item.is_available === true || String(item.is_available) === 'true')
                                                                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                        }`}
                                                    >
                                                        <div className={`size-1.5 rounded-full ${
                                                            (item.is_available === true || String(item.is_available) === 'true') ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                                                        }`}></div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                            {(item.is_available === true || String(item.is_available) === 'true') ? 'Disponível' : 'Indisponível'}
                                                        </span>
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEditItem(item)}
                                                            className="size-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center"
                                                            title="Editar"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            className="size-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                                                            title="Excluir"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
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
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">history</span>
                                </div>
                                <h2 className="text-lg font-black tracking-tight text-slate-900">Registro de Pedidos</h2>
                            </div>
                            <button
                                onClick={handleClearAllHistory}
                                disabled={history.length === 0}
                                className="px-4 py-2 bg-white text-red-500 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                                Limpar Histórico
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Evento</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recurso Solicitado</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quantidade</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-32 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                                        <span className="material-symbols-outlined text-3xl text-slate-200">history_toggle_off</span>
                                                    </div>
                                                    <p className="text-slate-900 font-black text-sm">Sem histórico recente</p>
                                                    <p className="text-slate-400 font-medium text-xs max-w-xs mx-auto">Solicitações de informática aparecerão aqui assim que forem processadas.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((req) => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 uppercase truncate max-w-[200px]">
                                                            {req.expand?.event?.title || 'Sem título'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                            <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                            {new Date(req.created).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-700 uppercase">{req.expand?.item?.name || 'Item Excluído'}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Solicitante: {req.expand?.created_by?.name || 'Desconhecido'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black">
                                                        {req.quantity} {req.expand?.item?.unit || 'un'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                                        req.status === 'approved' ? 'bg-green-50 text-green-600' :
                                                        req.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                                        'bg-amber-50 text-amber-600'
                                                    }`}>
                                                        {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteHistory(req.id)}
                                                        className="size-8 rounded-lg bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center ml-auto"
                                                        title="Remover do histórico"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InformaticsManagement;
