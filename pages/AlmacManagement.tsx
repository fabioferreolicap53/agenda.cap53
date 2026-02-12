
import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { Navigate } from 'react-router-dom';
import CustomSelect from '../components/CustomSelect';

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
    const [activeView, setActiveView] = useState<'inventory' | 'history'>('inventory');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                console.log('ITENS CARREGADOS:', res.map(i => ({ name: i.name, available: i.is_available })));
                setItems(res);
            } else {
                const res = await pb.collection('agenda_cap53_almac_requests').getFullList({
                    sort: '-created',
                    expand: 'item,event,created_by'
                });
                setHistory(res);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        let unsubscribe: (() => void) | undefined;
        // Subscribe to real-time updates for items
        const setupSubscription = async () => {
            try {
                unsubscribe = await pb.collection('agenda_cap53_itens_servico').subscribe('*', (e) => {
                    if (!isMounted) return;
                    console.log('REALTIME EVENT:', e.action, e.record.name, 'is_available:', e.record.is_available);
                    
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
                            // Comparação robusta convertendo para booleanos reais
                            const currentAvail = current.is_available === true || String(current.is_available) === 'true';
                            const recordAvail = e.record.is_available === true || String(e.record.is_available) === 'true';

                            const isDifferent = 
                                currentAvail !== recordAvail || 
                                current.name !== e.record.name ||
                                current.category !== e.record.category;
                            
                            if (!isDifferent) return prev;
                            
                            console.log('Aplicando atualização do servidor via Real-time (Almac)');
                            return prev.map(i => i.id === e.record.id ? e.record : i);
                        });
                    } else if (e.action === 'delete') {
                        setItems(prev => prev.filter(i => i.id !== e.record.id));
                    }
                });
            } catch (err) {
                console.error('Erro ao subscrever AlmacManagement:', err);
            }
        };

        setupSubscription();

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName) return;
        try {
            // Normalizar os dados antes de qualquer comparação ou salvamento
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

            console.log('DADOS SENDO ENVIADOS PARA POCKETBASE:', JSON.stringify(itemData, null, 2));

            if (editingId) {
                // Check for duplication excluding current item
                const existing = items.find(i => 
                    i.name.toUpperCase().trim() === normalizedName && 
                    i.category.toUpperCase() === normalizedCategory && 
                    i.id !== editingId
                );
                if (existing) {
                    alert('Já existe outro item com este nome nesta categoria.');
                    return;
                }

                console.log('Executando UPDATE no ID:', editingId);
                const updated = await pb.collection('agenda_cap53_itens_servico').update(editingId, itemData);
                console.log('RESPOSTA DO SERVIDOR (UPDATE):', JSON.stringify(updated, null, 2));
                
                if (updated.is_available !== !!newItemAvailable) {
                    console.error('ERRO: O servidor retornou um status de disponibilidade diferente do enviado!');
                    alert(`Atenção: O item foi salvo mas a disponibilidade não foi atualizada no servidor. (Enviado: ${newItemAvailable}, Recebido: ${updated.is_available})`);
                    
                    // Tentativa de correção imediata se houver mismatch
                    console.log('Tentando corrigir mismatch de disponibilidade...');
                    await pb.collection('agenda_cap53_itens_servico').update(editingId, { is_available: !!newItemAvailable });
                }

                alert('Item atualizado com sucesso!');
                setEditingId(null);
            } else {
                // Check for duplication before creating
                const existing = items.find(i => 
                    i.name.toUpperCase().trim() === normalizedName && 
                    i.category.toUpperCase() === normalizedCategory
                );
                if (existing) {
                    alert('Este item já existe nesta categoria.');
                    return;
                }

                console.log('Executando CREATE');
                const created = await pb.collection('agenda_cap53_itens_servico').create(itemData);
                console.log('RESPOSTA DO SERVIDOR (CREATE):', JSON.stringify(created, null, 2));
                
                if (created.is_available !== !!newItemAvailable) {
                    console.error('ERRO: O servidor retornou um status de disponibilidade diferente do enviado!');
                    alert(`Atenção: O item foi criado mas a disponibilidade não foi salva corretamente no servidor. (Enviado: ${newItemAvailable}, Recebido: ${created.is_available})`);
                    
                    // Tentativa de correção imediata se houver mismatch
                    console.log('Tentando corrigir mismatch de disponibilidade...');
                    await pb.collection('agenda_cap53_itens_servico').update(created.id, { is_available: !!newItemAvailable });
                }

                alert('Item adicionado com sucesso!');
            }
            
            // Limpar formulário e resetar estado
            setNewItemName('');
            setNewItemAvailable(true);
            setNewItemUnit('un');
            setNewItemStock(0);
            
            // Forçar atualização local
            fetchData();
        } catch (error: any) {
            console.error('Erro detalhado ao salvar item:', error);
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
        if (!currentItem) {
            console.error('Item não encontrado localmente:', itemId);
            return;
        }

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
            console.log(`Sucesso no servidor [${itemId}]: agora é ${result.is_available}`);
            
            // Garantir que o estado local está em sincronia com o servidor
            setItems(prev => prev.map(i => i.id === itemId ? result : i));
        } catch (error: any) {
            console.error('Erro ao atualizar disponibilidade no servidor:', error);
            // Reverter para o status anterior em caso de falha
            setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: previousStatus } : i));
            alert(`Erro ao atualizar disponibilidade: ${error.message || 'Erro de conexão com o servidor'}`);
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
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        try {
            await pb.collection('agenda_cap53_itens_servico').delete(id);
            // fetchData(); // Real-time subscription handles this
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
    if (!user || (user.role !== 'ALMC' && user.role !== 'ADMIN')) {
        return <Navigate to="/calendar" replace />;
    }

    return (
        <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full p-4 md:p-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Add Item Form */}
                    <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden sticky top-8">
                        <div className="p-8">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                                    <span className="material-symbols-outlined text-2xl">
                                        {editingId ? 'edit_note' : 'add_circle'}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                        {editingId ? 'Editar Item' : 'Novo Item'}
                                    </h2>
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Almoxarifado e Copa</p>
                                </div>
                            </div>
                            
                            <form onSubmit={handleAddItem} className="flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nome do Item</label>
                                    <input
                                        type="text"
                                        required
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        className="rounded-xl border border-slate-100 bg-slate-50/50 h-12 px-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900/20 outline-none transition-all text-sm font-medium"
                                        placeholder="Ex: Água Mineral 500ml"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                                        <CustomSelect
                                            value={newItemType}
                                            onChange={(val) => setNewItemType(val as any)}
                                            options={[
                                                { value: 'almoxarifado', label: 'Almoxarifado' },
                                                { value: 'copa', label: 'Copa' }
                                            ]}
                                            className="h-12 !rounded-xl !border-slate-100 !bg-slate-50/50"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Unidade</label>
                                        <input
                                            type="text"
                                            list="unit-options"
                                            value={newItemUnit}
                                            onChange={(e) => setNewItemUnit(e.target.value)}
                                            className="rounded-xl border border-slate-100 bg-slate-50/50 h-12 px-4 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900/20 outline-none transition-all text-sm font-medium"
                                            placeholder="un, cx, kg"
                                        />
                                        <datalist id="unit-options">
                                            <option value="un" />
                                            <option value="kg" />
                                            <option value="L" />
                                            <option value="cx" />
                                            <option value="pct" />
                                            <option value="m" />
                                            <option value="garrafa" />
                                            <option value="lata" />
                                            <option value="fardo" />
                                        </datalist>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="flex-1 h-12 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="flex-[2] h-12 rounded-xl font-bold text-xs uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
                                    >
                                        {editingId ? 'Salvar Alterações' : 'Cadastrar Item'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Inventory Table */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        {/* Search and Filters */}
                        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                            <div className="relative flex-1 w-full">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar por nome ou categoria..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl h-12 pl-12 pr-4 text-sm font-medium focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900/20 outline-none transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 bg-slate-50/50 px-4 py-2 rounded-2xl border border-slate-100">
                                <span className="material-symbols-outlined text-lg">inventory</span>
                                <span className="text-xs font-bold uppercase tracking-widest">{filteredItems.length} Itens</span>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
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
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEditItem(item)}
                                                                className="size-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all"
                                                                title="Editar item"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="size-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                                                title="Excluir item"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
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
            ) : (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                                    <span className="material-symbols-outlined text-2xl">history</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Solicitações</h2>
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">Almoxarifado e Copa</p>
                                </div>
                            </div>

                            <button
                                onClick={handleClearAllHistory}
                                disabled={history.length === 0 || loading}
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:hover:bg-transparent transition-all border border-rose-100/50"
                            >
                                <span className="material-symbols-outlined text-lg">delete_sweep</span>
                                Limpar Histórico
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Data/Hora</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Evento / Solicitante</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item / Qtd</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando histórico...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : history.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-32 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-16 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                                        <span className="material-symbols-outlined text-3xl text-slate-200">history_toggle_off</span>
                                                    </div>
                                                    <p className="text-slate-900 font-black text-sm">Sem histórico recente</p>
                                                    <p className="text-slate-400 font-medium text-xs max-w-xs mx-auto text-balance">As solicitações de almoxarifado e copa aparecerão aqui assim que forem processadas.</p>
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
                                                        <span className="text-slate-900 font-bold">{req.expand?.event?.title || 'Evento não encontrado'}</span>
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
                                                <td className="px-6 py-5 text-right">
                                                    <button
                                                        onClick={() => handleDeleteHistory(req.id)}
                                                        className="size-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 ml-auto"
                                                        title="Excluir do histórico"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
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

export default AlmacManagement;
