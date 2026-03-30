import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { pb, getAvatarUrl } from '../lib/pocketbase';
import { UsersResponse } from '../lib/pocketbase-types';
import { useAuth } from '../components/AuthContext';
import AvatarUploadModal from '../components/AvatarUploadModal';
import { UserCard } from '../components/Team/UserCard';
import { TeamFilterBar } from '../components/Team/TeamFilterBar';
import { useDebounce } from '../hooks/useDebounce';

const TeamManagement: React.FC = () => {
    const { user: currentUser, updateProfile, toggleFavorite } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Pagination state
    const [users, setUsers] = useState<UsersResponse[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, online: 0 });
    const ITEMS_PER_PAGE = 20;

    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [selectedSectors, setSelectedSectors] = useState<string[]>(['Todos']);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [showFilters, setShowFilters] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // Intersection Observer for infinite scroll
    const observer = useRef<IntersectionObserver | null>(null);
    const lastUserElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setSearchTerm(params.get('search') || '');
    }, [location.search]);

    // Reset pagination when filters change
    useEffect(() => {
        setUsers([]);
        setPage(1);
        setHasMore(true);
        setInitialLoading(true);
        // We trigger the fetch in the next effect that depends on page
    }, [debouncedSearch, selectedSectors, showFavoritesOnly]);

    // Fetch users when page or filters change
    useEffect(() => {
        fetchUsers();
    }, [page, debouncedSearch, selectedSectors, showFavoritesOnly]);

    const fetchUnreadCounts = async () => {
        if (!currentUser?.id) return;
        try {
            const unreadRecords = await pb.collection('agenda_cap53_mensagens').getFullList({
                filter: `receiver = "${currentUser?.id}" && read = false`,
                fields: 'sender,id'
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

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const filterParts: string[] = [];

            // 1. Exclude restricted roles and hidden users
            const restrictedRoles = ['ALMC', 'TRA', 'DCA'];
            restrictedRoles.forEach(role => {
                filterParts.push(`role != "${role}"`);
            });
            filterParts.push('hidden != true');

            // 2. Search
            if (debouncedSearch) {
                filterParts.push(`(name ~ "${debouncedSearch}" || email ~ "${debouncedSearch}" || sector ~ "${debouncedSearch}" || role ~ "${debouncedSearch}")`);
            }

            // 3. Sector
            if (selectedSectors.length > 0 && !selectedSectors.includes('Todos')) {
                const sectorFilters = selectedSectors.map(s => `sector = "${s}"`);
                filterParts.push(`(${sectorFilters.join(' || ')})`);
            }

            // 4. Favorites
            if (showFavoritesOnly) {
                if (currentUser?.favorites && currentUser.favorites.length > 0) {
                    const favFilters = currentUser.favorites.map(id => `id = "${id}"`);
                    filterParts.push(`(${favFilters.join(' || ')})`);
                } else {
                    // No favorites, show nothing
                    filterParts.push(`id = "NO_MATCH"`);
                }
            }

            // 5. Exclude current user (we render them separately at the top)
            if (currentUser?.id) {
                filterParts.push(`id != "${currentUser.id}"`);
            }

            const filter = filterParts.join(' && ');

            const result = await pb.collection('agenda_cap53_usuarios').getList<UsersResponse>(page, ITEMS_PER_PAGE, {
                sort: '-created',
                filter: filter,
                fields: 'id,collectionId,collectionName,name,email,avatar,role,sector,observations,whatsapp,birthDate,admissionDate,active,lastActive,created,status,context_status',
                requestKey: 'team_fetch' 
            });

            if (page === 1) {
                // Fetch stats for the header
                const allUsers = await pb.collection('agenda_cap53_usuarios').getFullList<UsersResponse>({
                    filter: 'hidden != true && role != "ALMC" && role != "TRA" && role != "DCA"',
                    fields: 'id,status'
                });
                setStats({
                    total: allUsers.length,
                    online: allUsers.filter(u => u.status === 'Online').length
                });
            }

            setUsers(prev => {
                if (page === 1) return result.items;
                // Filter out duplicates just in case
                const newItems = result.items.filter(item => !prev.some(p => p.id === item.id));
                return [...prev, ...newItems];
            });
            
            setHasMore(result.page < result.totalPages);
            setLoading(false);
            setInitialLoading(false);

        } catch (error: any) {
            if (!error.isAbort) {
                console.error('Error fetching users:', error);
                setLoading(false);
                setInitialLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchUnreadCounts();

        let unsubscribeUsers: (() => void) | undefined;
        let unsubscribeMessages: (() => void) | undefined;
        let isMounted = true;

        // Subscribe to real-time changes
        const setupSubscriptions = async () => {
            try {
                // Only update existing users in the list to avoid messing up pagination
                const unsubUsersFunc = await pb.collection('agenda_cap53_usuarios').subscribe<UsersResponse>('*', (e) => {
                    if (!isMounted) return;
                    
                    if (e.action === 'update') {
                        setUsers(prev => prev.map(u => u.id === e.record.id ? e.record : u));
                    } else if (e.action === 'delete') {
                        setUsers(prev => prev.filter(u => u.id !== e.record.id));
                    }
                    // For 'create', we don't append automatically to avoid UI jumps
                });
                
                if (isMounted) {
                    unsubscribeUsers = unsubUsersFunc;
                } else {
                    unsubUsersFunc();
                }

                const unsubMsgFunc = await pb.collection('agenda_cap53_mensagens').subscribe('*', (e) => {
                    if (!isMounted) return;
                    
                    if (e.action === 'create' && e.record.receiver === currentUser?.id) {
                        fetchUnreadCounts();
                    } else if (e.action === 'update' && (e.record.receiver === currentUser?.id || e.record.sender === currentUser?.id)) {
                        fetchUnreadCounts();
                    }
                });

                if (isMounted) {
                    unsubscribeMessages = unsubMsgFunc;
                } else {
                    unsubMsgFunc();
                }
            } catch (err) {
                console.error('Failed to subscribe:', err);
            }
        };

        setupSubscriptions();

        return () => {
            isMounted = false;
            if (unsubscribeUsers) unsubscribeUsers();
            if (unsubscribeMessages) unsubscribeMessages();
        };
    }, [currentUser?.id]);

    const handleUpdateProfile = async (data: any) => {
        await updateProfile(data);
        // Refresh first page logic if needed, or just update local state via auth context
        // Ideally we should re-fetch if the current user profile changes affect the list (e.g. role change)
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
        <div className="flex flex-col gap-4 md:gap-8 max-w-[1600px] mx-auto w-full p-4 md:p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-3xl">groups</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                            Equipe <span className="text-primary">Cap5.3</span>
                        </h1>
                    </div>
                    <p className="text-slate-500 text-sm md:text-base max-w-2xl font-medium">
                        Gerencie os membros da equipe, visualize status em tempo real e coordene atividades de forma integrada.
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 min-w-[140px]">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-500">person</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
                            <p className="text-xl font-black text-slate-900">{stats.total}</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 min-w-[140px]">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-green-500">sensors</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online</p>
                            <p className="text-xl font-black text-slate-900">{stats.online}</p>
                        </div>
                    </div>
                </div>
            </div>

            <TeamFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(!showFilters)}
                selectedSectors={selectedSectors}
                onSectorChange={setSelectedSectors}
                showFavoritesOnly={showFavoritesOnly}
                onToggleFavoritesOnly={() => setShowFavoritesOnly(!showFavoritesOnly)}
            />

            {initialLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
                    {/* Always show current user first if they match the filters */}
                    {currentUser && (
                        // Check if current user matches filters (simple client-side check for the pinned card)
                        (!debouncedSearch || 
                            currentUser.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                            currentUser.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                            currentUser.sector?.toLowerCase().includes(debouncedSearch.toLowerCase())
                        ) &&
                        (selectedSectors.includes('Todos') || (currentUser.sector && selectedSectors.includes(currentUser.sector))) &&
                        (!showFavoritesOnly) // Usually we don't "favorite" ourselves, so hide if showing favorites only? Or show? Let's hide if logic demands.
                         ? (
                            <div className="h-full">
                                <UserCard
                                    key={currentUser.id}
                                    user={currentUser as unknown as UsersResponse}
                                    currentUser={currentUser}
                                    isMe={true}
                                    unreadCount={unreadCounts[currentUser.id] || 0}
                                    isSelected={false}
                                    onToggleSelection={() => {}}
                                    onUpdateProfile={handleUpdateProfile}
                                    isFavorite={false} // Cannot favorite self
                                    onToggleFavorite={() => {}}
                                    onChatClick={(userId) => navigate(`/chat?userId=${userId}`)}
                                    onAvatarClick={() => setShowAvatarModal(true)}
                                />
                            </div>
                        ) : null
                    )}

                    {users.map((user, index) => {
                        // Determine if this is the last element
                        const isLastElement = users.length === index + 1;
                        
                        return (
                            <div key={user.id} ref={isLastElement ? lastUserElementRef : null} className="h-full">
                                <UserCard
                                    user={user}
                                    currentUser={currentUser}
                                    isMe={false}
                                    unreadCount={unreadCounts[user.id] || 0}
                                    isSelected={selectedUsers.includes(user.id)}
                                    onToggleSelection={() => toggleUserSelection(user.id)}
                                    onUpdateProfile={async () => {}} // Only current user updates profile
                                    isFavorite={currentUser?.favorites?.includes(user.id) || false}
                                    onToggleFavorite={() => toggleFavorite(user.id)}
                                    onChatClick={(userId) => navigate(`/chat?userId=${userId}`)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
            
            {loading && !initialLoading && (
                 <div className="flex justify-center items-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            )}
            
            {!loading && !hasMore && users.length > 0 && (
                <div className="text-center py-4 text-gray-400 text-sm">
                    Todos os usuários carregados.
                </div>
            )}

            {!loading && users.length === 0 && !currentUser && (
                <div className="text-center py-12 text-gray-500">
                    Nenhum usuário encontrado com os filtros selecionados.
                </div>
            )}

            {/* Floating Create Event Button (only visible when users selected) */}
            {selectedUsers.length > 0 && (
                <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-[100] animate-in slide-in-from-bottom-4 duration-300">
                    <button
                        onClick={handleCreateEventWithSelected}
                        className="bg-primary text-white pl-3 pr-5 py-3 md:pl-4 md:pr-6 md:py-4 rounded-2xl md:rounded-3xl shadow-2xl shadow-primary/30 hover:bg-primary-hover hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 md:gap-4 group border border-white/10 backdrop-blur-md"
                    >
                        <div className="flex -space-x-2 md:-space-x-3 overflow-hidden">
                            {selectedUsers.slice(0, 3).map((id) => {
                                const user = users.find(u => u.id === id);
                                return (
                                    <div key={id} className="size-4.5 md:size-6 rounded-lg border-2 border-primary bg-white overflow-hidden shadow-lg">
                                        {getAvatarUrl(user) ? (
                                            <img src={getAvatarUrl(user)!} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[6px] text-slate-400">
                                                {user?.name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {selectedUsers.length > 3 && (
                                <div className="size-4.5 md:size-6 rounded-lg border-2 border-primary bg-white flex items-center justify-center text-[7px] md:text-[10px] font-black text-primary">
                                    +{selectedUsers.length - 3}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-[7.5px] md:text-[10px] font-black uppercase tracking-widest leading-none">Agendar</span>
                            <span className="text-[9px] md:text-[11px] font-bold opacity-80">{selectedUsers.length} {selectedUsers.length === 1 ? 'membro' : 'membros'}</span>
                        </div>
                        <span className="material-symbols-outlined text-[16px] md:text-[24px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                </div>
            )}

            <AvatarUploadModal isOpen={showAvatarModal} onClose={() => setShowAvatarModal(false)} />
        </div>
    );
};

export default TeamManagement;