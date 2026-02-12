import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { useAuth, SECTORS } from '../components/AuthContext';
import CustomSelect from '../components/CustomSelect';

const TeamManagement: React.FC = () => {
    const { user: currentUser, updateProfile } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBio, setEditingBio] = useState(false);
    const [editingSector, setEditingSector] = useState(false);
    const [editingDetails, setEditingDetails] = useState(false);

    const [tempBio, setTempBio] = useState('');
    const [tempSector, setTempSector] = useState('');
    const [tempName, setTempName] = useState('');
    const [tempEmail, setTempEmail] = useState('');
    const [tempPhone, setTempPhone] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>(['Todos']);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    const handleFieldFocus = (field: string) => setFocusedField(field);
    const handleFieldBlur = () => setFocusedField(null);

    const fetchUnreadCounts = async () => {
        if (!currentUser?.id) return;
        try {
            const unreadRecords = await pb.collection('agenda_cap53_mensagens').getFullList({
                filter: `receiver = "${currentUser?.id}" && read = false`
            });
            const counts: Record<string, number> = {};
            unreadRecords.forEach(msg => {
                counts[msg.sender] = (counts[msg.sender] || 0) + 1;
            });
            setUnreadCounts(counts);
        } catch (error) {
            console.error('Error fetching unread counts:', error);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchUnreadCounts();

        let unsubscribeUsers: (() => void) | undefined;
        let unsubscribeMessages: (() => void) | undefined;

        // Subscribe to real-time changes
        const setupSubscriptions = async () => {
            unsubscribeUsers = await pb.collection('agenda_cap53_usuarios').subscribe('*', (e) => {
                if (e.action === 'update' || e.action === 'create') {
                    setUsers(prev => {
                        const index = prev.findIndex(u => u.id === e.record.id);
                        if (index !== -1) {
                            const newUsers = [...prev];
                            newUsers[index] = e.record;
                            return newUsers;
                        }
                        return [e.record, ...prev];
                    });
                } else if (e.action === 'delete') {
                    setUsers(prev => prev.filter(u => u.id !== e.record.id));
                }
            });

            unsubscribeMessages = await pb.collection('agenda_cap53_mensagens').subscribe('*', (e) => {
                if (e.action === 'create' && e.record.receiver === currentUser?.id) {
                    fetchUnreadCounts();
                } else if (e.action === 'update' && (e.record.receiver === currentUser?.id || e.record.sender === currentUser?.id)) {
                    fetchUnreadCounts();
                }
            });
        };

        setupSubscriptions();

        return () => {
            if (unsubscribeUsers) unsubscribeUsers();
            if (unsubscribeMessages) unsubscribeMessages();
        };
    }, [currentUser?.id]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const records = await pb.collection('agenda_cap53_usuarios').getFullList({
                sort: '-created',
            });

            if (records.length === 0) {
                // Keep mocks as fallback for local dev if collection is empty
                setUsers([
                    {
                        id: 'mock_admin',
                        name: 'Jane Doe',
                        email: 'jane@example.com',
                        role: 'ADMIN',
                        avatar: 'https://picsum.photos/seed/jane/200',
                        status: 'Online',
                        phone: '(21) 98888-7777',
                        sector: 'Diretoria Executiva',
                        observations: 'Responsável pela coordenação geral de eventos.'
                    },
                    {
                        id: 'mock_joao',
                        name: 'João Silva',
                        email: 'joao@example.com',
                        role: 'ALMC',
                        avatar: 'https://picsum.photos/seed/joao/200',
                        status: 'Ausente',
                        phone: '(21) 97777-6666',
                        sector: 'Almoxarifado',
                        observations: 'Especialista em logística de suprimentos.'
                    },
                    {
                        id: 'mock_maria',
                        name: 'Maria Santos',
                        email: 'maria@example.com',
                        role: 'TRA',
                        avatar: 'https://picsum.photos/seed/maria/200',
                        status: 'Ocupado',
                        phone: '(21) 96666-5555',
                        sector: 'Transporte',
                        observations: 'Coordenação de frotas e motoristas.'
                    }
                ]);
            } else {
                setUsers(records);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            setTempBio(currentUser.observations || '');
            setTempSector(currentUser.sector || '');
            setTempName(currentUser.name || '');
            setTempEmail(currentUser.email || '');
            setTempPhone(currentUser.phone || '');
        }
    }, [currentUser]);

    const handleSaveAll = async () => {
        if (!currentUser) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            const data: any = {
                name: tempName,
                phone: tempPhone,
                observations: tempBio,
                sector: tempSector || currentUser.sector
            };

            await updateProfile(data);

            setSaveStatus('success');
            setTimeout(() => {
                setEditingBio(false);
                setEditingDetails(false);
                setEditingSector(false);
                setSaveStatus('idle');
            }, 1000);
            fetchUsers();
        } catch (error: any) {
            console.error('Error saving profile:', error);
            setSaveStatus('error');
            // Show more detail if available
            const msg = error.data?.message || error.message || 'Erro desconhecido';
            alert(`Erro ao salvar: ${msg}`);
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveBio = handleSaveAll;
    const handleSaveDetails = handleSaveAll;

    const handleSaveSector = async (newSector: string) => {
        if (!currentUser) return;
        setIsSaving(true);
        try {
            await updateProfile({ sector: newSector });
            setEditingSector(false);
            fetchUsers();
        } catch (error) {
            console.error('Error saving sector:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Online': return 'bg-green-500';
            case 'Ausente': return 'bg-amber-500';
            case 'Ocupado': return 'bg-red-500';
            default: return 'bg-primary/20';
        }
    };

    const getAvatarUrl = (user: any) => {
        if (user?.avatar) {
            return pb.files.getUrl(user, user.avatar);
        }
        return `https://picsum.photos/seed/${user?.email || user?.id}/200`;
    };

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    const handleCreateEventWithSelected = () => {
        if (selectedUsers.length === 0) return;
        const participantsParam = encodeURIComponent(JSON.stringify(selectedUsers));
        navigate(`/create-event?participants=${participantsParam}`);
    };

    return (
        <div className="flex flex-col gap-3 md:gap-4 max-w-[1500px] mx-auto w-full p-3 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-1">
                <div className="w-full md:w-72 md:ml-auto">
                    <CustomSelect
                        value={selectedSectors}
                        onChange={setSelectedSectors}
                        startIcon="filter_list"
                        className="h-11 md:h-12"
                        multiSelect={true}
                        options={[
                            { value: 'Todos', label: 'Todos os Setores' },
                            ...SECTORS.map(s => ({ value: s, label: s }))
                        ]}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {(() => {
                        // Reorder: Current User first, then the rest
                        const sortedUsers = [...users].sort((a, b) => {
                            if (a.id === currentUser?.id) return -1;
                            if (b.id === currentUser?.id) return 1;
                            return 0;
                        });

                        // Apply Sector Filter and Restricted Roles
                        const restrictedRoles = ['ALMC', 'TRA', 'DCA'];
                        const filteredUsers = sortedUsers.filter(u => {
                            // Don't filter out current user
                            if (u.id === currentUser?.id) return true;
                            
                            // Filter by role
                            if (u.role && restrictedRoles.includes(u.role)) return false;
                            
                            // Filter by sector if not 'Todos'
                            if (!selectedSectors.includes('Todos')) {
                                return selectedSectors.includes(u.sector);
                            }
                            
                            return true;
                        });

                        return filteredUsers.map((u, idx) => {
                            const isMe = u.id === currentUser?.id;
                            const userData = isMe ? { ...u, ...currentUser } : u;

                            return (
                                <div key={userData.id || idx} className={`bg-white rounded-3xl transition-all duration-300 group relative flex flex-col ${isMe && editingSector ? 'z-[100]' : 'overflow-hidden'} ${isMe
                                    ? 'ring-1 ring-primary/30 border-primary/10 shadow-xl shadow-primary/5 bg-gradient-to-b from-white to-primary/5'
                                    : 'border border-gray-100 hover:border-primary/20 hover:shadow-xl hover:shadow-gray-200/50'
                                    }`}>
                                    {/* Header / Avatar Area */}
                                    <div className="relative">
                                        <div className="h-20 md:h-24 relative overflow-hidden rounded-t-3xl">
                                            <div className={`absolute inset-0 opacity-10 ${isMe ? 'bg-primary' : 'bg-slate-500'}`}>
                                                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.05) 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>
                                            </div>
                                            
                                            {/* Status and Selection Toggle */}
                                            <div className="absolute top-2.5 right-2.5 md:top-3 md:right-3 z-10 flex items-center gap-2">
                                                {!isMe && (
                                                    <div className="flex items-center gap-2">
                                                        {unreadCounts[userData.id] > 0 && (
                                                            <button 
                                                                onClick={() => navigate(`/chat?userId=${userData.id}`)}
                                                                className="bg-red-500 text-white text-[9px] md:text-[10px] font-bold h-6 md:h-7 px-1.5 md:px-2 flex items-center justify-center rounded-lg border-2 border-white shadow-lg animate-pulse"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px] md:text-[14px] mr-1">chat</span>
                                                                {unreadCounts[userData.id]}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => toggleUserSelection(userData.id)}
                                                            className={`w-6 h-6 md:w-7 md:h-7 rounded-lg border-2 transition-all duration-300 flex items-center justify-center backdrop-blur-md ${
                                                                selectedUsers.includes(userData.id)
                                                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-110'
                                                                    : 'bg-white/40 border-white/20 text-white/60 hover:bg-white/60 hover:text-primary hover:border-white'
                                                            }`}
                                                        >
                                                            <span className="material-symbols-outlined text-[14px] md:text-[16px] font-bold">
                                                                {selectedUsers.includes(userData.id) ? 'check' : 'add'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                )}
                                                {isMe && (
                                                    <div className="bg-primary/90 backdrop-blur-md text-white text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg uppercase tracking-[0.15em] shadow-lg shadow-primary/20 border border-white/20">
                                                        Você
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="absolute -bottom-8 md:-bottom-10 left-4 md:left-6 z-20 transition-transform duration-500 group-hover:scale-105">
                                            <div className="relative flex flex-col items-center">
                                                <div
                                                    className="size-16 md:size-20 rounded-2xl bg-contain bg-center bg-no-repeat bg-slate-100 border-[4px] md:border-[5px] border-white shadow-xl shadow-black/5 ring-1 ring-black/5"
                                                    style={{ backgroundImage: `url(${getAvatarUrl(userData)})` }}
                                                ></div>
                                                <div className={`absolute -bottom-0.5 -right-0.5 size-4 md:size-5 border-[2px] md:border-[3px] border-white rounded-full ${getStatusColor(userData.status)} shadow-lg ring-1 ring-black/5 flex items-center justify-center`}>
                                                </div>
                                                
                                                {/* User Status Badge */}
                                                <div className="absolute top-0 -right-1 md:-right-2 transform translate-x-full mt-1">
                                                    <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-[0.1em] px-1.5 md:px-2 py-0.5 rounded-md border shadow-sm whitespace-nowrap ${
                                                        userData.status === 'Online' ? 'bg-green-50 text-green-600 border-green-100' :
                                                        userData.status === 'Ausente' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        userData.status === 'Ocupado' ? 'bg-red-50 text-red-600 border-red-100' :
                                                        'bg-slate-50 text-slate-400 border-slate-100'
                                                    }`}>
                                                        {userData.status || 'Offline'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-10 md:pt-12 p-4 md:p-6 flex flex-col gap-4 md:gap-5 flex-1">
                                        {/* Identity Section */}
                                        <div className="flex flex-col gap-1 md:gap-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                {isMe && editingDetails ? (
                                                    <div className="relative flex-1 group/input">
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            value={tempName}
                                                            onChange={(e) => setTempName(e.target.value)}
                                                            onFocus={() => handleFieldFocus('name')}
                                                            onBlur={handleFieldBlur}
                                                            className={`text-base md:text-lg font-black text-text-main border-b-2 outline-none bg-transparent w-full pb-1 transition-all ${focusedField === 'name' ? 'border-primary' : 'border-gray-100'}`}
                                                            placeholder="Seu Nome"
                                                        />
                                                        <div className={`absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ${focusedField === 'name' ? 'w-full' : 'w-0'}`}></div>
                                                    </div>
                                                ) : (
                                                    <h3 className="text-base md:text-lg font-black text-text-main group-hover:text-primary transition-colors truncate tracking-tight">
                                                        {userData.name || 'Sem Nome'}
                                                    </h3>
                                                )}
                                                {isMe && (
                                                    <button
                                                        onClick={() => {
                                                            if (editingDetails && !isSaving) handleSaveDetails();
                                                            else if (!editingDetails) setEditingDetails(true);
                                                        }}
                                                        disabled={isSaving && editingDetails}
                                                        className={`size-7 md:size-8 rounded-xl flex items-center justify-center transition-all ${
                                                            editingDetails 
                                                                ? 'bg-green-500 text-white shadow-lg shadow-green-200 hover:bg-green-600' 
                                                                : 'bg-primary/5 text-primary hover:bg-primary hover:text-white'
                                                        }`}
                                                        title={editingDetails ? "Salvar Alterações" : "Editar Perfil"}
                                                    >
                                                        <span className="material-symbols-outlined text-[16px] md:text-[18px]">
                                                            {isSaving && editingDetails ? 'sync' : (editingDetails ? 'done' : 'edit_square')}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                                                <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg bg-primary/5 border border-primary/10">
                                                    <span className="material-symbols-outlined text-[12px] md:text-[14px] text-primary">badge</span>
                                                    <span className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-wider">
                                                        {userData.role}
                                                    </span>
                                                </div>

                                                {isMe ? (
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setEditingSector(!editingSector)}
                                                            className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg border transition-all text-[9px] md:text-[10px] font-bold uppercase tracking-wide group/sectbtn ${
                                                                editingSector 
                                                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                                                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-primary/30 hover:text-primary'
                                                            }`}
                                                        >
                                                            <span className="material-symbols-outlined text-[12px] md:text-[14px]">work</span>
                                                            {userData.sector || 'Definir Setor'}
                                                            <span className={`material-symbols-outlined text-[12px] md:text-[14px] transition-transform duration-300 ${editingSector ? 'rotate-180' : ''}`}>expand_more</span>
                                                        </button>
                                                        
                                                        {editingSector && (
                                                            <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 py-2 overflow-y-auto max-h-72 animate-in slide-in-from-top-2 duration-200 custom-scrollbar">
                                                                <div className="px-4 py-2 border-b border-gray-50 mb-1 sticky top-0 bg-white z-10">
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selecionar Setor</span>
                                                                </div>
                                                                {SECTORS.map(s => (
                                                                    <button
                                                                        key={s}
                                                                        onClick={() => handleSaveSector(s)}
                                                                        className={`w-full px-4 py-2.5 text-[11px] text-left hover:bg-primary/5 transition-colors font-bold flex items-center justify-between group/opt ${userData.sector === s ? 'text-primary bg-primary/5' : 'text-slate-600'}`}
                                                                    >
                                                                        {s}
                                                                        {userData.sector === s && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg bg-slate-50 border border-slate-100">
                                                        <span className="material-symbols-outlined text-[12px] md:text-[14px] text-slate-400">work</span>
                                                        <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate max-w-[100px] md:max-w-[120px]">
                                                            {userData.sector || 'Não informado'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Contact Section */}
                                        <div className="flex flex-col gap-2 md:gap-3 pt-1 md:pt-2">
                                            <div className="flex items-center gap-3 md:gap-4 group/contact">
                                                <div className="size-8 md:size-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 transition-colors group-hover/contact:bg-primary/5 group-hover/contact:text-primary">
                                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">mail</span>
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">E-mail Corporativo</span>
                                                    <span className="text-[11px] md:text-xs font-bold text-slate-600 truncate">{userData.email}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 md:gap-4 group/contact">
                                                <div className="size-8 md:size-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 transition-colors group-hover/contact:bg-primary/5 group-hover/contact:text-primary">
                                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">call</span>
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Telefone / WhatsApp</span>
                                                    <div className="flex items-center justify-between gap-2">
                                                        {isMe && editingDetails ? (
                                                            <input
                                                                type="text"
                                                                value={tempPhone}
                                                                onChange={(e) => setTempPhone(e.target.value)}
                                                                onFocus={() => handleFieldFocus('phone')}
                                                                onBlur={handleFieldBlur}
                                                                className={`text-[11px] md:text-xs font-bold text-text-main border-b outline-none bg-transparent w-full py-0.5 transition-all ${focusedField === 'phone' ? 'border-primary' : 'border-gray-100'}`}
                                                            />
                                                        ) : (
                                                            <span className="text-[11px] md:text-xs font-bold text-slate-600">{userData.phone || 'Não informado'}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bio/Observations Section */}
                                        <div className="mt-1 md:mt-2 flex flex-col gap-2 md:gap-3 bg-slate-50/50 rounded-2xl p-3 md:p-4 border border-slate-100/50 group-hover:bg-white group-hover:border-primary/10 transition-all duration-500">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-1.5 md:gap-2">
                                                    <span className="material-symbols-outlined text-[14px] md:text-[16px] text-primary">info</span>
                                                    <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Informações Adicionais</span>
                                                </div>
                                                {isMe && (
                                                    <button
                                                        onClick={() => setEditingBio(!editingBio)}
                                                        className={`size-5 md:size-6 rounded-lg flex items-center justify-center transition-all ${
                                                            editingBio ? 'bg-red-50 text-red-500' : 'bg-primary/5 text-primary hover:bg-primary hover:text-white'
                                                        }`}
                                                    >
                                                        <span className="material-symbols-outlined text-[12px] md:text-[14px]">{editingBio ? 'close' : 'edit'}</span>
                                                    </button>
                                                )}
                                            </div>

                                            {isMe && editingBio ? (
                                                <div className="flex flex-col gap-2 md:gap-3 animate-in fade-in duration-300">
                                                    <textarea
                                                        autoFocus
                                                        value={tempBio}
                                                        onChange={(e) => setTempBio(e.target.value)}
                                                        onFocus={() => handleFieldFocus('bio')}
                                                        onBlur={handleFieldBlur}
                                                        className={`text-[10px] md:text-[11px] font-medium text-slate-600 leading-relaxed bg-white border rounded-xl p-2 md:p-3 outline-none min-h-[80px] md:min-h-[100px] transition-all resize-none ${focusedField === 'bio' ? 'border-primary ring-4 ring-primary/5' : 'border-gray-100'}`}
                                                        placeholder="Escreva um pouco sobre suas responsabilidades..."
                                                    />
                                                    <button
                                                        onClick={handleSaveBio}
                                                        disabled={isSaving}
                                                        className="w-full py-1.5 md:py-2 bg-primary text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isSaving ? (
                                                            <>
                                                                <span className="material-symbols-outlined text-[14px] md:text-[16px] animate-spin">sync</span>
                                                                Salvando...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="material-symbols-outlined text-[14px] md:text-[16px]">done_all</span>
                                                                Confirmar Alterações
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] md:text-[11px] font-medium text-slate-500 leading-relaxed italic line-clamp-3 md:line-clamp-4">
                                                    {userData.observations ? `"${userData.observations}"` : 'Nenhuma informação adicional fornecida pelo profissional.'}
                                                </p>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        {!isMe && (
                                            <div className="mt-auto pt-1 md:pt-2">
                                                <button 
                                                    onClick={() => navigate(`/chat?userId=${userData.id}`)}
                                                    className="w-full flex items-center justify-center gap-2 py-2 md:py-2.5 bg-primary/5 text-primary hover:bg-primary hover:text-white rounded-xl transition-all duration-300 group/btn"
                                                >
                                                    <span className="material-symbols-outlined text-[16px] md:text-[18px]">chat</span>
                                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider">Conversar</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Subtle Bottom Accent */}
                                    <div className={`h-1.5 w-full mt-auto transition-all duration-500 ${isMe ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/20'}`}></div>
                                </div>
                            );
                        });
                    })()}
                    {(() => {
                        // Show message if no users found in filtered list
                        const sortedUsers = [...users].sort((a, b) => {
                            if (a.id === currentUser?.id) return -1;
                            if (b.id === currentUser?.id) return 1;
                            return 0;
                        });
                        const filteredUsers = selectedSectors.includes('Todos')
                            ? sortedUsers
                            : sortedUsers.filter(u => selectedSectors.includes(u.sector) || (u.id === currentUser?.id && selectedSectors.includes(currentUser?.sector)));

                        return filteredUsers.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-text-secondary/40">
                                <span className="material-symbols-outlined text-6xl mb-2">person_off</span>
                                <p className="text-lg font-bold">Nenhum membro encontrado neste setor.</p>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Selection FAB */}
            {selectedUsers.length > 0 && (
                <div className="fixed bottom-6 right-4 md:bottom-8 md:right-8 z-[100] animate-in zoom-in slide-in-from-bottom-10 duration-500">
                    <button
                        onClick={handleCreateEventWithSelected}
                        className="group flex items-center gap-2.5 md:gap-3 bg-primary text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl shadow-primary/30 hover:bg-primary-hover hover:scale-105 active:scale-95 transition-all"
                    >
                        <div className="flex -space-x-1.5 md:-space-x-2">
                            {selectedUsers.slice(0, 3).map((id, i) => {
                                const user = users.find(u => u.id === id);
                                return (
                                    <div key={id} className="size-5 md:size-6 rounded-lg border-2 border-primary bg-white overflow-hidden shadow-lg">
                                        <img src={getAvatarUrl(user)} alt="" className="w-full h-full object-cover" />
                                    </div>
                                );
                            })}
                            {selectedUsers.length > 3 && (
                                <div className="size-5 md:size-6 rounded-lg border-2 border-primary bg-white flex items-center justify-center text-[8px] md:text-[10px] font-black text-primary">
                                    +{selectedUsers.length - 3}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest leading-none">Agendar com Equipe</span>
                            <span className="text-[9px] md:text-[11px] font-bold opacity-80">{selectedUsers.length} {selectedUsers.length === 1 ? 'membro' : 'membros'}</span>
                        </div>
                        <span className="material-symbols-outlined text-[18px] md:text-[24px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default TeamManagement;
