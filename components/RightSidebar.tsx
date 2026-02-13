import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';
import { useAuth } from './AuthContext';

interface RightSidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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

        // Subscribe to user changes
        let unsubscribeUsers: (() => void) | undefined;
        const setupUserSubscription = async () => {
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
        };

        // Subscribe to message changes for unread counts
        let unsubscribeMessages: (() => void) | undefined;
        const setupMessageSubscription = async () => {
            unsubscribeMessages = await pb.collection('agenda_cap53_mensagens').subscribe('*', (e) => {
                if (e.action === 'create' && e.record.receiver === currentUser?.id) {
                    fetchUnreadCounts();
                } else if (e.action === 'update' && (e.record.receiver === currentUser?.id || e.record.sender === currentUser?.id)) {
                    fetchUnreadCounts();
                }
            });
        };

        setupUserSubscription();
        setupMessageSubscription();

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Online': return 'bg-green-500';
            case 'Ausente': return 'bg-amber-500';
            case 'Ocupado': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    const getAvatarUrl = (user: any) => {
        if (user?.avatar) {
            return pb.files.getUrl(user, user.avatar);
        }
        return `https://picsum.photos/seed/${user?.email || user?.id}/100`;
    };

    // Show all users (exclude current user)
    const allUsers = users.filter(u => u.id !== currentUser?.id);

    return (
        <>
            {/* Toggle Button - Minimalista e Profissional */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed right-4 bottom-4 z-[100] size-12 rounded-2xl bg-white shadow-2xl border border-slate-100 hidden lg:flex items-center justify-center text-slate-600 transition-all duration-300 hover:scale-110 active:scale-95 group ${isOpen ? 'rotate-180 text-primary' : ''}`}
                title={isOpen ? 'Ocultar Equipe' : 'Mostrar Equipe'}
            >
                <span className="material-symbols-outlined text-[24px]">
                    {isOpen ? 'chevron_right' : 'groups'}
                </span>
                {!isOpen && Object.values(unreadCounts).some(c => c > 0) && (
                    <span className="absolute -top-1 -right-1 size-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
            </button>

            <aside 
                className={`fixed right-0 top-0 h-full w-72 flex-col border-l border-border-light bg-white z-[90] transition-all duration-500 ease-in-out shadow-2xl hidden lg:flex ${
                    isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                }`}
            >
                <div className="p-5 border-b border-border-light flex items-center justify-between bg-white sticky top-0 z-10">
                    <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">groups</span>
                        Equipe Cap5.3
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {allUsers.length}
                        </span>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="material-symbols-outlined text-slate-300 hover:text-slate-600 transition-colors text-xl"
                        >
                            close
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="animate-pulse flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-primary/5"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 w-24 bg-primary/5 rounded"></div>
                                        <div className="h-2 w-16 bg-primary/[0.02] rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {allUsers.map((u) => (
                                <div key={u.id} className="group cursor-pointer">
                                    <div className="flex items-start gap-3">
                                        <div className="relative flex-shrink-0">
                                            <div
                                                className="size-10 rounded-xl bg-cover bg-center ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all cursor-pointer"
                                                style={{ backgroundImage: `url(${getAvatarUrl(u)})` }}
                                                onDoubleClick={() => {
                                                    navigate(`/chat?userId=${u.id}`);
                                                    if (window.innerWidth < 1024) setIsOpen(false);
                                                }}
                                            ></div>
                                            <div className={`absolute -bottom-1 -right-1 size-3.5 border-2 border-white rounded-full ${getStatusColor(u.status)} shadow-sm`}></div>
                                            {unreadCounts[u.id] > 0 && (
                                                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold size-4 flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                                                    {unreadCounts[u.id]}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <p 
                                                    className="text-xs font-bold text-text-main truncate group-hover:text-primary transition-colors"
                                                    onDoubleClick={() => {
                                                        navigate(`/chat?userId=${u.id}`);
                                                        if (window.innerWidth < 1024) setIsOpen(false);
                                                    }}
                                                >
                                                    {u.name || 'Membro do Time'}
                                                </p>
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${u.status === 'Online' ? 'bg-green-100 text-green-700' :
                                                    u.status === 'Ausente' ? 'bg-amber-100 text-amber-700' :
                                                        u.status === 'Ocupado' ? 'bg-red-100 text-red-700' :
                                                            'bg-primary/5 text-text-secondary'
                                                    }`}>
                                                    {u.status || 'Offline'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-text-secondary truncate font-medium">
                                                {u.sector || 'Colaborador'}
                                            </p>

                                            {u.observations && (
                                                <p className="text-[9px] text-text-secondary/70 mt-1 italic leading-tight">
                                                    {u.observations}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {allUsers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                                    <span className="material-symbols-outlined text-4xl text-primary/10 mb-2">person_off</span>
                                    <p className="text-xs text-text-secondary">Nenhum outro membro encontrado.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>
            
            {/* Overlay para fechar ao clicar fora em telas menores - Desabilitado em mobile conforme solicitado */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[80] bg-slate-900/10 backdrop-blur-[2px] hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
};

export default RightSidebar;
