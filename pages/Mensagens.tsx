import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { pb } from '../lib/pocketbase';

const Chat: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = searchParams.get('userId');
  
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = pb.authStore.model;

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const fetchUsersAndUnread = async () => {
    try {
      const userRecords = await pb.collection('agenda_cap53_usuarios').getFullList({
        sort: 'name',
        filter: `id != "${currentUser?.id}"`
      });
      setUsers(userRecords);

      // Fetch unread counts for each user
      const unreadRecords = await pb.collection('agenda_cap53_mensagens').getFullList({
        filter: `receiver = "${currentUser?.id}" && read = false`
      });

      const counts: Record<string, number> = {};
      unreadRecords.forEach(msg => {
        counts[msg.sender] = (counts[msg.sender] || 0) + 1;
      });
      setUnreadCounts(counts);
    } catch (error) {
      console.error("Error fetching users/unread:", error);
    }
  };

  // Fetch all users for the sidebar and their unread counts
  useEffect(() => {
    fetchUsersAndUnread();
  }, [currentUser?.id]);

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
          fetchUsersAndUnread();
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
      pb.collection('agenda_cap53_mensagens').subscribe('*', async (data) => {
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
              fetchUsersAndUnread();
            }
          } else if (msg.receiver === currentUser?.id) {
            // New message for another conversation, refresh unread counts
            fetchUsersAndUnread();
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

  const getAvatarUrl = (user: any) => {
    if (user?.avatar) {
      return pb.files.getUrl(user, user.avatar);
    }
    return `https://picsum.photos/seed/${user?.id || 'default'}/200`;
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-140px)] border border-border-light rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Chat Sidebar */}
      <div className="w-80 border-r border-border-light flex flex-col bg-white">
        <div className="p-4 border-b border-border-light">
             <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined text-[20px]">search</span>
                <input 
                    className="w-full h-10 pl-10 pr-4 rounded-lg bg-white border border-border-light text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
                    placeholder="Filtrar por nome..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredUsers.map((user) => (
                <div 
                    key={user.id} 
                    onClick={() => navigate(`/chat?userId=${user.id}`)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${user.id === userId ? 'bg-primary/5 shadow-sm border border-primary/10' : 'hover:bg-primary/[0.02]'}`}
                >
                    <div className="relative">
                        <div 
                            className="size-10 rounded-full bg-primary/10 bg-cover bg-center" 
                            style={{ backgroundImage: `url(${getAvatarUrl(user)})` }}
                        ></div>
                        <span className={`absolute bottom-0 right-0 size-3 border-2 border-white rounded-full ${getStatusColor(user.status)}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                            <p className={`text-sm font-bold truncate ${user.id === userId ? 'text-primary' : 'text-text-main'}`}>{user.name}</p>
                            <span className={`text-[10px] font-medium ${user.status === 'Online' ? 'text-green-500' : 'text-gray-400'}`}>
                                {user.status || 'Offline'}
                            </span>
                        </div>
                        <p className="text-xs text-text-secondary truncate font-medium">{user.sector || 'Sem setor'}</p>
                        {user.observations && (
                            <p className="text-[9px] text-text-secondary/70 truncate italic mt-0.5 leading-tight">
                                {user.observations}
                            </p>
                        )}
                    </div>
                    {unreadCounts[user.id] > 0 && (
                        <div className="bg-red-500 text-white text-[10px] font-bold size-5 flex items-center justify-center rounded-full shrink-0 animate-pulse">
                            {unreadCounts[user.id]}
                        </div>
                    )}
                </div>
            ))}
            {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-text-secondary text-sm">
                    Nenhum usuário encontrado
                </div>
            )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="h-16 border-b border-border-light flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
                 <div className="relative">
                    <div 
                        className="size-10 rounded-full bg-primary/10 bg-cover bg-center" 
                        style={{ backgroundImage: `url(${getAvatarUrl(selectedUser)})` }}
                    ></div>
                    <span className={`absolute bottom-0 right-0 size-3 border-2 border-white rounded-full ${getStatusColor(selectedUser?.status)}`}></span>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-text-main">{selectedUser?.name || 'Selecione um usuário'}</h3>
                    <p className={`text-xs font-medium ${selectedUser?.status === 'Online' ? 'text-green-600' : 'text-gray-500'}`}>{selectedUser?.status || 'Offline'}</p>
                </div>
            </div>
            <div className="flex gap-1 text-text-secondary items-center">
                 {userId && messages.length > 0 && (
                   <button 
                     onClick={handleDeleteConversation}
                     className="size-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300 rounded-full group"
                     title="Excluir conversa"
                   >
                     <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">delete_sweep</span>
                   </button>
                 )}
                 <button className="size-9 flex items-center justify-center hover:bg-primary/[0.05] rounded-full text-slate-400 hover:text-primary transition-all"><span className="material-symbols-outlined text-[20px]">more_vert</span></button>
            </div>
        </div>
  
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
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
                         <div className={`flex gap-4 max-w-2xl group ${isMe ? 'flex-row-reverse ml-auto' : ''}`}>
                             <div 
                               className="size-8 rounded-full bg-primary/10 bg-cover shrink-0" 
                               style={{ backgroundImage: `url(${getAvatarUrl(isMe ? currentUser : selectedUser)})` }}
                             ></div>
                            <div className={`flex flex-col gap-1 relative ${isMe ? 'items-end' : ''}`}>
                                <span className={`text-xs font-bold text-text-main ${isMe ? 'mr-1' : 'ml-1'}`}>
                                  {isMe ? 'Você' : selectedUser?.name} 
                                  <span className="text-gray-400 font-normal ml-1">
                                    {new Date(msg.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {msg.is_edited && !msg.is_deleted && (
                                    <span className="text-[10px] text-gray-400 font-normal ml-1 italic">(editada)</span>
                                  )}
                                </span>

                                {editingMessageId === msg.id ? (
                                  <div className="flex flex-col gap-2 min-w-[200px]">
                                    <textarea
                                      className="p-3 rounded-2xl shadow-sm text-sm border border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      rows={2}
                                      autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => setEditingMessageId(null)}
                                        className="text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-main"
                                      >
                                        Cancelar
                                      </button>
                                      <button 
                                        onClick={() => handleEditMessage(msg.id)}
                                        className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary-hover"
                                      >
                                        Salvar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative group/msg">
                                    <div className={`p-3 rounded-2xl shadow-sm text-sm ${
                                      msg.is_deleted 
                                        ? 'bg-gray-50 text-gray-400 italic border border-gray-100' 
                                        : isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white border border-gray-200 text-text-main rounded-tl-none'
                                    }`}>
                                        {msg.content}
                                    </div>
                                    
                                    {!msg.is_deleted && (
                                      <div className={`absolute top-0 flex gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                        {isMe && (
                                          <button 
                                            onClick={() => {
                                              setEditingMessageId(msg.id);
                                              setEditContent(msg.content);
                                            }}
                                            className="size-7 flex items-center justify-center rounded-full bg-white border border-gray-100 text-gray-400 hover:text-primary hover:border-primary/20 shadow-sm"
                                            title="Editar"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                          </button>
                                        )}
                                        <button 
                                          onClick={() => handleDeleteMessage(msg)}
                                          className="size-7 flex items-center justify-center rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50/50 transition-all duration-300"
                                          title={isMe ? "Excluir para todos" : "Excluir para mim"}
                                        >
                                          <span className="material-symbols-outlined text-[16px]">delete</span>
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

        <div className="p-4 bg-white border-t border-border-light">
             <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-white p-2 rounded-xl border border-border-light focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                <textarea 
                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none text-sm max-h-32 py-2 ml-2" 
                    placeholder={selectedUser ? `Mensagem para ${selectedUser.name}...` : 'Selecione um usuário...'}
                    rows={1} 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={!selectedUser || loading}
                />
                <button 
                  type="submit"
                  disabled={!selectedUser || !newMessage.trim() || loading}
                  className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                      <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">send</span>
                    )}
                </button>
             </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;