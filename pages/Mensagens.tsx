import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { pb, getAvatarUrl } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';

const Chat: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = searchParams.get('userId');
  
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showChatMobile, setShowChatMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync with global search
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('search') || '');
  }, [location.search]);

  // Handle window resize for responsiveness
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set showChatMobile based on userId presence
  useEffect(() => {
    if (userId && isMobile) {
      setShowChatMobile(true);
    } else if (!userId) {
      setShowChatMobile(false);
    }
  }, [userId, isMobile]);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all users for the sidebar and their unread counts
  useEffect(() => {
    if (!currentUser?.id) return;

    const fetchUsersAndUnread = async () => {
      try {
        setLoadingUsers(true);
        const userRecords = await pb.collection('agenda_cap53_usuarios').getFullList({
          sort: 'name',
          filter: `id != "${currentUser.id}"`
        });
        setUsers(userRecords);

        // Fetch unread counts for each user
        const unreadRecords = await pb.collection('agenda_cap53_mensagens').getFullList({
          filter: `receiver = "${currentUser.id}" && read = false`
        });

        const counts: Record<string, number> = {};
        unreadRecords.forEach(msg => {
          counts[msg.sender] = (counts[msg.sender] || 0) + 1;
        });
        setUnreadCounts(counts);
      } catch (error) {
        console.error("Error fetching users/unread:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsersAndUnread();

    // Subscribe to user changes for status/name/avatar updates
    let unsubscribe: (() => void) | undefined;
    const setupSubscription = async () => {
      try {
        unsubscribe = await pb.collection('agenda_cap53_usuarios').subscribe('*', (e) => {
          if (e.action === 'update') {
            setUsers(prev => prev.map(u => u.id === e.record.id ? e.record : u));
          } else if (e.action === 'create') {
            if (e.record.id !== currentUser.id) {
              setUsers(prev => [e.record, ...prev].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            }
          } else if (e.action === 'delete') {
            setUsers(prev => prev.filter(u => u.id !== e.record.id));
          }
        });
      } catch (err) {
        console.error("Erro na subscrição de usuários:", err);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.id]);

  // Helper function to refresh unread counts
  const refreshUnread = async () => {
    if (!currentUser?.id) return;
    try {
      const unreadRecords = await pb.collection('agenda_cap53_mensagens').getFullList({
        filter: `receiver = "${currentUser.id}" && read = false`
      });

      const counts: Record<string, number> = {};
      unreadRecords.forEach(msg => {
        counts[msg.sender] = (counts[msg.sender] || 0) + 1;
      });
      setUnreadCounts(counts);
    } catch (error) {
      console.error("Error refreshing unread counts:", error);
    }
  };

  // Fetch selected user and their messages
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setSelectedUser(null);
        setMessages([]);
        return;
      }
      
      setLoading(true);
      try {
        // Fetch user details
        const userRecord = await pb.collection('agenda_cap53_usuarios').getOne(userId);
        setSelectedUser(userRecord);

        // Fetch messages between current user and selected user
        const filter = `((sender = "${currentUser?.id}" && receiver = "${userId}" && deleted_by_sender = false) || (sender = "${userId}" && receiver = "${currentUser?.id}" && deleted_by_receiver = false))`;
        
        const messageRecords = await pb.collection('agenda_cap53_mensagens').getFullList({
          filter: filter,
          sort: 'created',
        });
        setMessages(messageRecords);

        // Mark messages as read
          const unreadMessages = messageRecords.filter(m => m.receiver === currentUser?.id && !m.read);
          if (unreadMessages.length > 0) {
            for (const msg of unreadMessages) {
              await pb.collection('agenda_cap53_mensagens').update(msg.id, { read: true });
            }
            // Refresh sidebar unread counts
            refreshUnread();
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setLoading(false);
        }
      };
  
      fetchData();
  
      // Subscribe to real-time messages
      if (userId) {
        const setupMessageSubscription = async () => {
          try {
            await pb.collection('agenda_cap53_mensagens').subscribe('*', async (data) => {
              if (data.action === 'create') {
                const msg = data.record;
                // Check if message belongs to the current conversation
                if ((msg.sender === currentUser?.id && msg.receiver === userId) || 
                    (msg.sender === userId && msg.receiver === currentUser?.id)) {
                  setMessages(prev => [...prev, msg]);
                  
                  // Mark as read if received
                  if (msg.receiver === currentUser?.id) {
                    await pb.collection('agenda_cap53_mensagens').update(msg.id, { read: true });
                    // Refresh unread counts after marking as read
                    refreshUnread();
                  }
                } else if (msg.receiver === currentUser?.id) {
                  // New message for another conversation, refresh unread counts
                  refreshUnread();
                }
              } else if (data.action === 'update') {
                const msg = data.record;
                // Update message in the list if it belongs to current conversation AND is not hidden for current user
                const isRelevant = (msg.sender === currentUser?.id && msg.receiver === userId) || 
                                  (msg.sender === userId && msg.receiver === currentUser?.id);
                
                if (isRelevant) {
                  const isHiddenForMe = (msg.sender === currentUser?.id && msg.deleted_by_sender) || 
                                      (msg.receiver === currentUser?.id && msg.deleted_by_receiver);
                  
                  if (isHiddenForMe) {
                    setMessages(prev => prev.filter(m => m.id !== msg.id));
                  } else {
                    setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
                  }
                }
              } else if (data.action === 'delete') {
                setMessages(prev => prev.filter(m => m.id !== data.record.id));
              }
            });
          } catch (err) {
            console.error("Erro na subscrição de mensagens:", err);
          }
        };

        setupMessageSubscription();
      }

    return () => {
      pb.collection('agenda_cap53_mensagens').unsubscribe();
    };
  }, [userId, currentUser?.id]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !userId || !currentUser) return;

    setLoading(true);
    try {
      await pb.collection('agenda_cap53_mensagens').create({
        sender: currentUser.id,
        receiver: userId,
        content: newMessage.trim(),
        read: false
      });
      setNewMessage('');
    } catch (error: any) {
      console.error("Error sending message:", error);
      const errorMsg = error.response?.message || error.message || "Erro desconhecido";
      alert(`Erro ao enviar mensagem: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMessage = async (msgId: string) => {
    if (!editContent.trim()) return;
    try {
      await pb.collection('agenda_cap53_mensagens').update(msgId, {
        content: editContent.trim(),
        is_edited: true
      });
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleDeleteMessage = async (msg: any) => {
    if (!currentUser) return;
    const isMe = msg.sender === currentUser.id;

    if (isMe) {
      if (!confirm('Deseja excluir esta mensagem para todos?')) return;
      try {
        await pb.collection('agenda_cap53_mensagens').update(msg.id, {
          is_deleted: true,
          content: 'Esta mensagem foi excluída'
        });
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    } else {
      if (!confirm('Deseja excluir sua cópia desta mensagem?')) return;
      try {
        await pb.collection('agenda_cap53_mensagens').update(msg.id, {
          deleted_by_receiver: true
        });
        // Optimistic update
        setMessages(prev => prev.filter(m => m.id !== msg.id));
      } catch (error) {
        console.error("Error hiding received message:", error);
      }
    }
  };

  const handleDeleteConversation = async () => {
    if (!userId || !messages.length || !currentUser) return;
    if (!confirm('Deseja realmente excluir sua cópia desta conversa? O outro usuário ainda poderá ver as mensagens.')) return;

    setLoading(true);
    try {
      // Mark each message as deleted for the current user
      const updatePromises = messages.map(msg => {
        const isSender = msg.sender === currentUser.id;
        return pb.collection('agenda_cap53_mensagens').update(msg.id, {
          [isSender ? 'deleted_by_sender' : 'deleted_by_receiver']: true
        });
      });
      
      await Promise.all(updatePromises);
      setMessages([]);
    } catch (error) {
      console.error("Error hiding conversation:", error);
      alert("Erro ao excluir conversa. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Online': return 'bg-green-500';
      case 'Ausente': return 'bg-amber-500';
      case 'Ocupado': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };



  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] lg:h-[calc(100vh-160px)] border-none lg:border lg:border-border-light rounded-none lg:rounded-xl overflow-hidden bg-white shadow-none lg:shadow-sm">
      {/* Chat Sidebar */}
      <div className={`${isMobile && showChatMobile ? 'hidden' : 'flex'} w-full lg:w-80 border-r border-border-light flex-col bg-white`}>
        <div className="p-2 md:p-4 border-b border-border-light bg-white/50 backdrop-blur-sm sticky top-0 z-10">
             <div className="relative group">
                <span className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-primary material-symbols-outlined text-[18px] md:text-[20px] transition-colors">search</span>
                <input 
                    className="w-full h-9 md:h-11 pl-9 md:pl-10 pr-4 rounded-xl bg-slate-50 border-none text-xs md:text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all placeholder:text-gray-400" 
                    placeholder="Buscar conversa..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {loadingUsers ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary/30"></div>
                    <p className="text-xs text-slate-400 animate-pulse">Carregando contatos...</p>
                </div>
            ) : (
                <>
                    {filteredUsers.map((user) => (
                        <div 
                            key={user.id} 
                            onClick={() => {
                                navigate(`/chat?userId=${user.id}`);
                                if (isMobile) setShowChatMobile(true);
                            }}
                            className={`flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 group ${
                                user.id === userId 
                                ? 'bg-primary/5 border border-primary/10 shadow-sm' 
                                : 'hover:bg-slate-50 border border-transparent'
                            }`}
                        >
                            <div className="relative shrink-0">
                                <div 
                                    className="size-12 rounded-2xl bg-primary/10 bg-cover bg-center shadow-sm group-hover:scale-105 transition-transform" 
                                    style={{ backgroundImage: `url(${getAvatarUrl(user)})` }}
                                ></div>
                                <span className={`absolute -bottom-1 -right-1 size-4 border-2 border-white rounded-full shadow-sm ${getStatusColor(user.status)}`}></span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <p className={`text-[15px] font-bold truncate ${user.id === userId ? 'text-primary' : 'text-slate-800'}`}>
                                        {user.name || 'Membro do Time'}
                                    </p>
                                    {unreadCounts[user.id] > 0 && (
                                        <div className="bg-primary text-white text-[10px] font-black px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-lg shadow-primary/20 animate-in fade-in zoom-in duration-300">
                                            {unreadCounts[user.id]}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-slate-500 truncate font-medium flex-1">
                                        {user.sector || 'Sem setor'}
                                    </p>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${user.status === 'Online' ? 'text-green-500' : 'text-slate-300'}`}>
                                        {user.status || 'Offline'}
                                    </span>
                                </div>
                                {user.observations && (
                                    <p className="text-[10px] text-slate-400 mt-0.5 italic leading-tight line-clamp-1" title={user.observations}>
                                        {user.observations}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                    {!loadingUsers && filteredUsers.length === 0 && (
                        <div className="p-12 text-center flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined text-slate-200 text-5xl">person_search</span>
                            <p className="text-slate-400 text-sm font-medium">Nenhum usuário encontrado</p>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`${isMobile && !showChatMobile ? 'hidden' : 'flex'} flex-1 flex flex-col bg-white relative`}>
        <div className="h-16 lg:h-20 border-b border-border-light flex items-center justify-between px-4 lg:px-6 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
                 {isMobile && (
                     <button 
                        onClick={() => {
                            setShowChatMobile(false);
                            navigate('/chat');
                        }}
                        className="size-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 active:scale-90 transition-transform"
                     >
                         <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                     </button>
                 )}
                 <div className="relative shrink-0">
                    <div 
                        className="size-10 lg:size-11 rounded-xl lg:rounded-2xl bg-primary/10 bg-cover bg-center shadow-sm" 
                        style={{ backgroundImage: `url(${getAvatarUrl(selectedUser)})` }}
                    ></div>
                    {selectedUser && (
                        <span className={`absolute -bottom-1 -right-1 size-3.5 border-2 border-white rounded-full shadow-sm ${getStatusColor(selectedUser?.status)}`}></span>
                    )}
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm lg:text-base font-bold text-slate-800 truncate">{selectedUser?.name || 'Selecione um contato'}</h3>
                    <p className={`text-[11px] lg:text-xs font-bold uppercase tracking-widest ${selectedUser?.status === 'Online' ? 'text-green-500' : 'text-slate-400'}`}>
                        {selectedUser?.status || (selectedUser ? 'Offline' : 'Para começar')}
                    </p>
                </div>
            </div>
            <div className="flex gap-1 text-slate-400 items-center">
                 {userId && messages.length > 0 && (
                   <button 
                     onClick={handleDeleteConversation}
                     className="size-10 flex items-center justify-center hover:text-red-500 hover:bg-red-50 transition-all rounded-xl group"
                     title="Excluir conversa"
                   >
                     <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">delete_sweep</span>
                   </button>
                 )}
                 <button className="size-10 flex items-center justify-center hover:bg-slate-50 rounded-xl hover:text-primary transition-all">
                    <span className="material-symbols-outlined text-[22px]">more_vert</span>
                 </button>
            </div>
        </div>
  
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-[#f8fafc]/50 custom-scrollbar">
               {messages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50">
                    <span className="material-symbols-outlined text-6xl mb-2">forum</span>
                    <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
                    <p className="text-xs">Comece a conversa abaixo</p>
                 </div>
               ) : (
                 <>
                   {messages.map((msg, i) => {
                     const isMe = msg.sender === currentUser?.id;
                     const showDate = i === 0 || new Date(msg.created).toDateString() !== new Date(messages[i-1].created).toDateString();
                     
                     return (
                       <React.Fragment key={msg.id}>
                         {showDate && (
                           <div className="flex justify-center my-4">
                             <span className="text-xs font-bold text-gray-400 bg-white border border-border-light px-3 py-1 rounded-full">
                               {new Date(msg.created).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                             </span>
                           </div>
                         )}
                         <div className={`flex gap-3 lg:gap-4 max-w-[90%] lg:max-w-2xl group ${isMe ? 'flex-row-reverse ml-auto' : ''}`}>
                             <div 
                               className="size-7 lg:size-8 rounded-lg lg:rounded-xl bg-primary/10 bg-cover shrink-0 shadow-sm" 
                               style={{ backgroundImage: `url(${getAvatarUrl(isMe ? currentUser : selectedUser)})` }}
                             ></div>
                            <div className={`flex flex-col gap-1 relative ${isMe ? 'items-end' : ''}`}>
                                <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-[11px] lg:text-xs font-black text-slate-800">
                                      {isMe ? 'Você' : selectedUser?.name} 
                                    </span>
                                    <span className="text-[10px] lg:text-[11px] font-bold text-slate-400">
                                      {new Date(msg.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {msg.is_edited && !msg.is_deleted && (
                                      <span className="text-[10px] text-slate-400 font-medium italic">(editada)</span>
                                    )}
                                </div>

                                {editingMessageId === msg.id ? (
                                  <div className="flex flex-col gap-2 min-w-[200px] bg-white p-3 rounded-2xl shadow-xl border border-primary/20">
                                    <textarea
                                      className="p-3 rounded-xl text-sm border-none bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      rows={2}
                                      autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => setEditingMessageId(null)}
                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                      <button 
                                        onClick={() => handleEditMessage(msg.id)}
                                        className="px-4 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                      >
                                        Salvar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative group/msg">
                                    <div className={`p-3 lg:p-4 rounded-2xl shadow-sm text-sm lg:text-[15px] leading-relaxed transition-all ${
                                      msg.is_deleted 
                                        ? 'bg-slate-50 text-slate-400 italic border border-slate-100' 
                                        : isMe 
                                          ? 'bg-primary text-white rounded-tr-none shadow-md shadow-primary/10' 
                                          : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                                    }`}>
                                        {msg.content}
                                    </div>
                                    
                                    {!msg.is_deleted && (
                                      <div className={`absolute top-0 flex gap-1 opacity-0 group-hover/msg:opacity-100 transition-all duration-200 p-1 z-10 ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                        {isMe && (
                                          <button 
                                            onClick={() => {
                                              setEditingMessageId(msg.id);
                                              setEditContent(msg.content);
                                            }}
                                            className="size-8 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/20 shadow-lg"
                                            title="Editar"
                                          >
                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                          </button>
                                        )}
                                        <button 
                                          onClick={() => handleDeleteMessage(msg)}
                                          className="size-8 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 shadow-lg"
                                          title="Excluir"
                                        >
                                          <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                            </div>
                         </div>
                       </React.Fragment>
                     );
                   })}
                   <div ref={messagesEndRef} />
                 </>
               )}
          </div>
  
          {userId && (
            <div className="p-4 lg:p-6 bg-white border-t border-border-light">
               <form 
                 onSubmit={handleSendMessage}
                 className="flex items-end gap-2 lg:gap-3 max-w-5xl mx-auto"
               >
                  <div className="flex-1 relative group">
                    <textarea 
                      className="w-full p-3 lg:p-4 pr-12 rounded-2xl bg-slate-50 border-none text-sm lg:text-[15px] focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all placeholder:text-slate-400 resize-none min-h-[48px] max-h-32 custom-scrollbar"
                      placeholder="Escreva sua mensagem..."
                      rows={1}
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button 
                      type="button"
                      className="absolute right-3 bottom-2.5 size-8 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                    </button>
                  </div>
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || loading}
                    className="size-11 lg:size-12 flex items-center justify-center bg-primary text-white rounded-xl lg:rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shrink-0"
                  >
                    <span className="material-symbols-outlined text-[24px] lg:text-[26px]">send</span>
                  </button>
               </form>
            </div>
          )}
      </div>
    </div>
  );
};

export default Chat;