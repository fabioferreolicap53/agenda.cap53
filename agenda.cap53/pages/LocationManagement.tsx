import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';

const LocationManagement: React.FC = () => {
    const { user } = useAuth();
    const [locations, setLocations] = useState<any[]>([]);
    const [eventTypes, setEventTypes] = useState<any[]>([]);
    const [newName, setNewName] = useState('');
    const [newConflictControl, setNewConflictControl] = useState(false);
    const [newIsAvailable, setNewIsAvailable] = useState(true);
    const [newEventTypeName, setNewEventTypeName] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [addingType, setAddingType] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editTypeName, setEditTypeName] = useState('');

    // Inscrever para atualizações em tempo real
    useEffect(() => {
        let isMounted = true;
        let unsubscribeFunc: (() => void) | null = null;
        let unsubscribeTypesFunc: (() => void) | null = null;
        
        fetchData();
        fetchEventTypes();

        const subscribe = async () => {
            // Pequeno delay para garantir que a autenticação esteja estável
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!isMounted) return;

            try {
                const unsub = await pb.collection('agenda_cap53_locais').subscribe('*', (e) => {
                    if (!isMounted) return;
                    
                    console.log('Real-time update in locations:', e.action, e.record);
                    if (e.action === 'create') {
                        setLocations(prev => {
                            const exists = prev.find(loc => loc.id === e.record.id);
                            if (exists) return prev;
                            return [...prev, e.record];
                        });
                    } else if (e.action === 'update') {
                        setLocations(prev => {
                            const locIndex = prev.findIndex(loc => loc.id === e.record.id);
                            if (locIndex === -1) return [...prev, e.record];
                            
                            const current = prev[locIndex];
                    
                    // Comparação robusta para evitar sobrescrever estado otimista
                     // Convertemos para booleanos reais para comparação segura
                     const currentAvail = !!current.is_available && String(current.is_available) !== 'false';
                     const recordAvail = !!e.record.is_available && String(e.record.is_available) !== 'false';
                     const currentConflict = !!current.conflict_control && String(current.conflict_control) !== 'false';
                     const recordConflict = !!e.record.conflict_control && String(e.record.conflict_control) !== 'false';
                     
                     const isDifferent = 
                         currentAvail !== recordAvail || 
                         currentConflict !== recordConflict ||
                         current.name !== e.record.name;
                            
                            if (!isDifferent) {
                                console.log('Update real-time ignorado (já sincronizado ou otimista)');
                                return prev;
                            }
                            
                            console.log(`Aplicando atualização do servidor via Real-time [${e.record.id}]:`, e.record);
                            return prev.map(loc => loc.id === e.record.id ? e.record : loc);
                        });
                    } else if (e.action === 'delete') {
                        setLocations(prev => prev.filter(loc => loc.id !== e.record.id));
                    }
                });
                unsubscribeFunc = unsub;

                const unsubTypes = await pb.collection('agenda_cap53_tipos_evento').subscribe('*', (e) => {
                    if (!isMounted) return;
                    console.log('Real-time update in event types:', e.action, e.record);
                    if (e.action === 'create') {
                        setEventTypes(prev => prev.find(t => t.id === e.record.id) ? prev : [...prev, e.record]);
                    } else if (e.action === 'update') {
                        setEventTypes(prev => prev.map(t => t.id === e.record.id ? e.record : t));
                    } else if (e.action === 'delete') {
                        setEventTypes(prev => prev.filter(t => t.id !== e.record.id));
                    }
                });
                unsubscribeTypesFunc = unsubTypes;
            } catch (err: any) {
                console.error('Erro ao subscrever em tempo real:', err);
            }
        };

        subscribe();

        return () => {
            isMounted = false;
            if (unsubscribeFunc) {
                try { unsubscribeFunc(); } catch (e) { console.warn('Erro ao cancelar subscrição:', e); }
            }
            if (unsubscribeTypesFunc) {
                try { unsubscribeTypesFunc(); } catch (e) { console.warn('Erro ao cancelar subscrição tipos:', e); }
            }
        };
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await pb.collection('agenda_cap53_locais').getFullList();
            setLocations(res);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEventTypes = async () => {
        try {
            const res = await pb.collection('agenda_cap53_tipos_evento').getFullList({
                sort: 'name'
            });
            setEventTypes(res);
        } catch (error) {
            console.error('Error fetching event types:', error);
        }
    };

    const handleFormKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' && 
                (target as HTMLInputElement).type !== 'submit' &&
                (target as HTMLInputElement).type !== 'checkbox' &&
                (target as HTMLInputElement).type !== 'radio'
            ) {
                e.preventDefault();
                const form = (target as HTMLInputElement).form;
                if (form) {
                    const elements = Array.from(form.elements).filter(el => {
                        const htmlEl = el as HTMLElement;
                        return !htmlEl.hasAttribute('disabled') && 
                               htmlEl.tagName !== 'FIELDSET' && 
                               (htmlEl as any).type !== 'hidden' &&
                               htmlEl.offsetParent !== null;
                    });
                    
                    const index = elements.indexOf(target as any);
                    if (index > -1 && elements[index + 1]) {
                        (elements[index + 1] as HTMLElement).focus();
                    }
                }
            }
        }
    };

    const handleAddLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('handleAddLocation called with state:', newName);
        
        // Capturar o valor diretamente do formulário como backup do estado
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const nameFromForm = formData.get('newLocationName') as string;
        const nameToUse = (newName || nameFromForm || '').trim();
        
        console.log('Name from state:', newName);
        console.log('Name from form backup:', nameFromForm);
        console.log('Final name to use:', nameToUse);

        if (!nameToUse) {
            console.log('Name is empty, returning');
            alert('Por favor, insira o nome do local.');
            return;
        }
        setAdding(true);
        try {
            console.log('Attempting to create location...');
            const result = await pb.collection('agenda_cap53_locais').create({
                name: nameToUse,
                conflict_control: newConflictControl,
                is_available: newIsAvailable
            });
            console.log('Location created successfully:', result);
            setNewName('');
            setNewConflictControl(false);
            setNewIsAvailable(true);
            // Forçar atualização da lista se o real-time falhar
            fetchData();
        } catch (error: any) {
            console.error('Error adding location:', error);
            if (error.status === 404) {
                alert(`Erro 404: A coleção 'agenda_cap53_locais' não foi encontrada. Verifique o setup.`);
            } else if (error.status === 403) {
                alert('Erro 403: Você não tem permissão para adicionar locais (ADMIN/CE).');
            } else {
                alert(`Erro ao adicionar local: ${error.data?.message || error.message}`);
            }
        } finally {
            setAdding(false);
        }
    };

    const handleAddEventType = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('handleAddEventType called with state:', newEventTypeName);
        
        // Capturar o valor diretamente do formulário como backup do estado
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const nameFromForm = formData.get('newEventTypeName') as string;
        const nameToUse = (newEventTypeName || nameFromForm || '').trim();
        
        console.log('Event Type from state:', newEventTypeName);
        console.log('Event Type from form backup:', nameFromForm);
        console.log('Final event type name to use:', nameToUse);

        if (!nameToUse) {
            console.log('Event type name is empty, returning');
            alert('Por favor, insira o nome do tipo de evento.');
            return;
        }
        setAddingType(true);
        try {
            console.log('Attempting to create event type...');
            const result = await pb.collection('agenda_cap53_tipos_evento').create({
                name: nameToUse,
                active: true
            });
            console.log('Event type created successfully:', result);
            setNewEventTypeName('');
            // Forçar atualização da lista se o real-time falhar
            fetchEventTypes();
        } catch (error: any) {
            console.error('Error adding event type:', error);
            // Se o erro for 404, pode ser o nome da coleção errado
            if (error.status === 404) {
                alert(`Erro 404: A coleção 'agenda_cap53_tipos_evento' não foi encontrada no PocketBase. Verifique se o setup foi executado.`);
            } else if (error.status === 403) {
                alert('Erro 403: Você não tem permissão para adicionar tipos de evento (ADMIN/CE).');
            } else {
                alert(`Erro ao adicionar tipo de evento: ${error.data?.message || error.message}`);
            }
        } finally {
            setAddingType(false);
        }
    };

    const toggleEventTypeActive = async (id: string, currentActive: boolean) => {
        try {
            await pb.collection('agenda_cap53_tipos_evento').update(id, {
                active: !currentActive
            });
        } catch (error) {
            console.error('Error toggling event type status:', error);
            alert('Erro ao atualizar status do tipo de evento.');
        }
    };

    const startEditingType = (type: any) => {
        setEditingTypeId(type.id);
        setEditTypeName(type.name);
    };

    const cancelEditingType = () => {
        setEditingTypeId(null);
        setEditTypeName('');
    };

    const handleSaveEditType = async (id: string) => {
        if (!editTypeName.trim()) return;
        try {
            await pb.collection('agenda_cap53_tipos_evento').update(id, {
                name: editTypeName.trim()
            });
            setEditingTypeId(null);
            setEditTypeName('');
        } catch (error) {
            console.error('Error updating event type name:', error);
        }
    };

    const handleDeleteType = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este tipo de evento?')) return;
        try {
            await pb.collection('agenda_cap53_tipos_evento').delete(id);
        } catch (error) {
            console.error('Error deleting event type:', error);
        }
    };

    const toggleConflictControl = async (id: string) => {
        const loc = locations.find(l => l.id === id);
        if (!loc) return;

        const previousStatus = !!loc.conflict_control && String(loc.conflict_control) !== 'false';
        const nextStatus = !previousStatus;

        console.log(`Toggle Conflito [${id}]: ${previousStatus} -> ${nextStatus}`);

        // Atualização otimista
        setLocations(prev => prev.map(l => l.id === id ? { ...l, conflict_control: nextStatus } : l));

        try {
            const result = await pb.collection('agenda_cap53_locais').update(id, {
                conflict_control: nextStatus
            });
            console.log(`Sucesso no servidor (conflito) [${id}]: agora é ${result.conflict_control}`);
            
            // Garantir que o estado local use o valor exato do servidor
            setLocations(prev => prev.map(l => l.id === id ? result : l));
        } catch (error: any) {
            console.error('Error updating conflict control:', error);
            // Reverter em caso de erro
            setLocations(prev => prev.map(l => 
                l.id === id ? { ...l, conflict_control: previousStatus } : l
            ));
            
            let errorMsg = 'Erro ao atualizar controle de conflito.';
            if (error.status === 403) {
                errorMsg = 'Você não tem permissão para alterar o controle de conflito (ADMIN/CE).';
            } else {
                errorMsg = `Erro: ${error.data?.message || error.message}`;
            }
            alert(errorMsg);
        }
    };

    const toggleAvailability = async (id: string) => {
        const loc = locations.find(l => l.id === id);
        if (!loc) return;

        const previousStatus = loc.is_available;
        // Lógica robusta: se não for explicitamente falso (boolean ou string), o próximo é false
        const currentlyAvailable = !!previousStatus && String(previousStatus) !== 'false';
        const nextStatus = !currentlyAvailable;

        console.log(`Toggle Disponibilidade [${id}]: ${currentlyAvailable} -> ${nextStatus}`);

        // Atualização otimista
        setLocations(prev => prev.map(l => l.id === id ? { ...l, is_available: nextStatus } : l));

        try {
            console.log(`Enviando update para o servidor: { is_available: ${nextStatus} }`);
            const result = await pb.collection('agenda_cap53_locais').update(id, { 
                is_available: nextStatus
            });
            console.log(`Sucesso no servidor (disponibilidade) [${id}]: agora é ${result.is_available}`);
            
            // Garantir que o estado local use o valor exato do servidor
            setLocations(prev => prev.map(l => l.id === id ? result : l));
        } catch (error: any) {
            console.error('Error updating availability:', error);
            console.error('Error details:', error.data);
            
            // Reverter em caso de falha
            setLocations(prev => prev.map(l => 
                l.id === id ? { ...l, is_available: previousStatus } : l
            ));
            
            let errorMsg = 'Erro ao atualizar disponibilidade.';
            if (error.status === 403) {
                errorMsg = 'Você não tem permissão para alterar a disponibilidade (Erro 403).';
            } else if (error.status === 0) {
                errorMsg = 'Erro de conexão com o servidor. Verifique sua internet ou se o PocketBase caiu.';
            } else {
                errorMsg = `Erro: ${error.data?.message || error.message}`;
            }
            alert(errorMsg);
        }
    };

    const startEditing = (loc: any) => {
        setEditingId(loc.id);
        setEditName(loc.name);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) return;
        try {
            await pb.collection('agenda_cap53_locais').update(id, {
                name: editName.trim()
            });
            setEditingId(null);
            setEditName('');
            fetchData();
        } catch (error) {
            console.error('Error updating location name:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este local?')) return;
        try {
            await pb.collection('agenda_cap53_locais').delete(id);
            fetchData();
        } catch (error) {
            console.error('Error deleting location:', error);
        }
    };

    if (!user || (user.role !== 'ADMIN' && user.role !== 'CE')) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-border-light shadow-sm max-w-[1100px] mx-auto w-full">
                <span className="material-symbols-outlined text-red-500 text-6xl mb-4">gpp_maybe</span>
                <h1 className="text-2xl font-bold text-text-main mb-2">Acesso Restrito</h1>
                <p className="text-text-secondary text-center max-w-md">
                    Você não tem permissão para acessar esta página. Apenas usuários do Centro de Estudos (CE) ou Administradores (ADMIN) podem gerenciar locais e tipos de evento.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-[1100px] mx-auto w-full p-4 md:p-0">
            {/* Adicionar Novo Local */}
            <div className="bg-white rounded-3xl shadow-sm border border-border-light overflow-hidden transition-all hover:shadow-md">
                <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-xl font-bold">add_location_alt</span>
                    </div>
                    <h2 className="text-base font-bold tracking-tight text-primary uppercase tracking-widest">NOVO LOCAL</h2>
                </div>
                
                <div className="p-6">
                    <form onSubmit={handleAddLocation} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-5">
                            <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-2 ml-1">Nome do Local</label>
                            <input
                                type="text"
                                required
                                id="newLocationName"
                                name="newLocationName"
                                value={newName}
                                onChange={(e) => {
                                    console.log('newName onChange:', e.target.value);
                                    setNewName(e.target.value);
                                }}
                                className="w-full rounded-2xl border border-border-light h-12 px-5 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none bg-gray-50/50 transition-all font-medium text-sm"
                                placeholder="ex: Sala de Reuniões 01"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-2 ml-1">Configurações</label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 h-12 px-4 border border-border-light rounded-2xl bg-gray-50/50 cursor-pointer hover:bg-white transition-all group">
                                    <input
                                        type="checkbox"
                                        checked={newConflictControl}
                                        onChange={(e) => setNewConflictControl(e.target.checked)}
                                        className="w-5 h-5 accent-primary cursor-pointer rounded-lg"
                                    />
                                    <span className="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">Controle de Conflito</span>
                                </label>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-primary uppercase tracking-widest mb-2 ml-1">Status Inicial</label>
                            <label className="flex items-center gap-3 h-12 px-4 border border-border-light rounded-2xl bg-gray-50/50 cursor-pointer hover:bg-white transition-all group">
                                <input
                                    type="checkbox"
                                    checked={newIsAvailable}
                                    onChange={(e) => setNewIsAvailable(e.target.checked)}
                                    className="w-5 h-5 accent-primary cursor-pointer rounded-lg"
                                />
                                <span className="text-xs font-bold text-text-secondary group-hover:text-primary transition-colors">Disponível</span>
                            </label>
                        </div>
                        <div className="md:col-span-2">
                            <button
                                type="submit"
                                disabled={adding}
                                className={`w-full h-12 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 ${adding ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {adding ? (
                                    <span className="animate-spin material-symbols-outlined">progress_activity</span>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-xl">add</span>
                                        <span className="text-xs uppercase tracking-widest">Salvar</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Lista de Locais */}
            <div className="bg-white rounded-3xl shadow-sm border border-border-light overflow-hidden transition-all hover:shadow-md">
                <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-xl font-bold">list</span>
                        </div>
                        <h2 className="text-base font-bold tracking-tight text-primary uppercase tracking-widest">Locais e Tipos de Evento Cadastrados</h2>
                    </div>
                    <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                        {locations.length} {locations.length === 1 ? 'Item' : 'Itens'}
                    </span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest border-b border-border-light">Local / Tipo de Evento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest border-b border-border-light">Status de Uso</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest border-b border-border-light">Gestão de Conflito</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest border-b border-border-light text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light">
                            {locations.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <span className="material-symbols-outlined text-5xl">location_off</span>
                                            <p className="text-sm font-bold italic">Nenhum local cadastrado até o momento.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {locations.map(loc => {
                                // Lógica robusta: is_available é true se não for explicitamente falso (booleano ou string 'false')
                                const isAvailable = !!loc.is_available && String(loc.is_available) !== 'false';
                                const isConflictActive = !!loc.conflict_control && String(loc.conflict_control) !== 'false';
                                return (
                                    <tr key={loc.id} className="group hover:bg-primary/[0.01] transition-colors">
                                        <td className="px-6 py-5">
                                            {editingId === loc.id ? (
                                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="w-full max-w-[250px] rounded-xl border-2 border-primary/30 px-4 py-2 text-sm focus:border-primary outline-none font-bold"
                                                        autoFocus
                                                    />
                                                    <button 
                                                        onClick={() => handleSaveEdit(loc.id)} 
                                                        className="size-9 rounded-xl bg-green-500 text-white flex items-center justify-center hover:bg-green-600 shadow-sm transition-all active:scale-90"
                                                        title="Confirmar"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">check</span>
                                                    </button>
                                                    <button 
                                                        onClick={cancelEditing} 
                                                        className="size-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90"
                                                        title="Cancelar"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">close</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                        <span className="material-symbols-outlined text-xl">home_pin</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-text-main leading-tight">{loc.name}</span>
                                                        <button 
                                                            onClick={() => startEditing(loc)} 
                                                            className="flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-all hover:underline mt-0.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">edit</span>
                                                            EDITAR NOME
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleAvailability(loc.id);
                                                }}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                                                    isAvailable 
                                                    ? 'bg-green-50 border-green-100 text-green-700 hover:bg-green-100' 
                                                    : 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100'
                                                }`}
                                            >
                                                <div className={`size-2 rounded-full animate-pulse ${isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                <span className="text-[10px] font-black uppercase tracking-wider">
                                                    {isAvailable ? 'Disponível' : 'Indisponível'}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleConflictControl(loc.id);
                                                }}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                                                    isConflictActive 
                                                    ? 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100' 
                                                    : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-sm">{isConflictActive ? 'security' : 'security_update_warning'}</span>
                                                <span className="text-[10px] font-black uppercase tracking-wider">{isConflictActive ? 'Ativado' : 'Desativado'}</span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button 
                                                onClick={() => handleDelete(loc.id)} 
                                                className="size-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                title="Excluir Local"
                                            >
                                                <span className="material-symbols-outlined text-xl">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Gerenciamento de Tipos de Evento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Adicionar Novo Tipo */}
                <div className="bg-white rounded-3xl shadow-sm border border-border-light overflow-hidden flex flex-col">
                    <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-xl font-bold">category</span>
                        </div>
                        <h2 className="text-base font-bold tracking-tight text-primary uppercase tracking-widest">Novo Tipo de Evento</h2>
                    </div>
                    <div className="p-6">
                        <form onSubmit={handleAddEventType} onKeyDown={handleFormKeyDown} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 ml-1">Nome do Tipo</label>
                                <input
                                    type="text"
                                    required
                                    id="newEventTypeName"
                                    name="newEventTypeName"
                                    value={newEventTypeName}
                                    onChange={(e) => {
                                        console.log('newEventTypeName onChange:', e.target.value);
                                        setNewEventTypeName(e.target.value);
                                    }}
                                    className="w-full rounded-2xl border border-border-light h-12 px-5 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none bg-gray-50/50 transition-all font-medium text-sm"
                                    placeholder="Ex: Workshop, Treinamento..."
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={addingType}
                                className={`w-full h-12 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 ${addingType ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {addingType ? (
                                    <span className="animate-spin material-symbols-outlined">progress_activity</span>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-xl">add</span>
                                        <span className="text-xs uppercase tracking-widest">Adicionar Tipo</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Lista de Tipos */}
                <div className="bg-white rounded-3xl shadow-sm border border-border-light overflow-hidden flex flex-col">
                    <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-xl font-bold">list_alt</span>
                            </div>
                            <h2 className="text-base font-bold tracking-tight text-primary uppercase tracking-widest">Tipos de Evento</h2>
                        </div>
                        <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                            {eventTypes.length} {eventTypes.length === 1 ? 'Tipo' : 'Tipos'}
                        </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-border-light">
                                {eventTypes.length === 0 && (
                                    <tr>
                                        <td className="px-6 py-10 text-center text-gray-400 italic text-sm">Nenhum tipo cadastrado.</td>
                                    </tr>
                                )}
                                {eventTypes.map(type => (
                                    <tr key={type.id} className="group hover:bg-primary/[0.01] transition-colors">
                                        <td className="px-6 py-4">
                                            {editingTypeId === type.id ? (
                                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                                    <input
                                                        type="text"
                                                        value={editTypeName}
                                                        onChange={(e) => setEditTypeName(e.target.value)}
                                                        className="w-full rounded-xl border-2 border-primary/30 px-3 py-1.5 text-sm focus:border-primary outline-none font-bold"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveEditType(type.id)} className="size-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 shadow-sm transition-all active:scale-90" title="Confirmar"><span className="material-symbols-outlined text-lg">check</span></button>
                                                    <button onClick={cancelEditingType} className="size-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90" title="Cancelar"><span className="material-symbols-outlined text-lg">close</span></button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                            <span className="material-symbols-outlined text-xl">label</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-black ${type.active ? 'text-text-main' : 'text-gray-400 line-through'} leading-tight`}>{type.name}</span>
                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                <button 
                                                                    onClick={() => startEditingType(type)} 
                                                                    className="flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-all hover:underline"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">edit</span>
                                                                    EDITAR
                                                                </button>
                                                                <button 
                                                                    onClick={() => toggleEventTypeActive(type.id, type.active)} 
                                                                    className="text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-all hover:underline"
                                                                >
                                                                    {type.active ? 'DESATIVAR' : 'ATIVAR'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteType(type.id)} 
                                                        className="size-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm active:scale-90"
                                                        title="Excluir Tipo"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocationManagement;
