import React, { useState, useEffect, useRef } from 'react';
import { pb, getAvatarUrl } from '../lib/pocketbase';

interface EventChatModalProps {
    event: any;
    user: any;
    isAccepted?: boolean;
    onClose: () => void;
}

const EventChatModal: React.FC<EventChatModalProps> = ({ event, user, isAccepted, onClose }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [room, setRoom] = useState<any>(null);
    const [participantsCount, setParticipantsCount] = useState(0);
    const [isParticipant, setIsParticipant] = useState<boolean | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const checkAccess = () => {
            const isCreator = event.user === user.id;
            // Access is granted if user is creator OR if they have accepted the invitation
            // New: Privileged roles (ADMIN, ALMC, TRA, CE, DCA) have unrestricted access
            const hasPrivilegedRole = ['ADMIN', 'ALMC', 'TRA', 'CE', 'DCA'].includes(user?.role);
            
            setIsParticipant(isCreator || isAccepted === true || hasPrivilegedRole);
        };

        checkAccess();
    }, [event.user, user?.id, isAccepted, user?.role]);

    useEffect(() => {
        const initChat = async () => {
            if (isParticipant === false) {
                setLoading(false);
                return;
            }
            if (isParticipant === null) return;

            try {
                // Get participants count - only those who accepted
                const acceptedParticipants = await pb.collection('agenda_cap53_participantes').getFullList({
                    filter: `event = "${event.id}" && status = "accepted"`,
                    requestKey: null
                });
                
                // Count includes accepted participants + creator
                setParticipantsCount(acceptedParticipants.length + 1);

                const participants = event.participants || [];

                // Find or create room
                let existingRoom;
                try {
                    existingRoom = await pb.collection('agenda_cap53_salas_batepapo').getFirstListItem(`event = "${event.id}"`);
                } catch (e) {
                    // Room doesn't exist, create it
                    existingRoom = await pb.collection('agenda_cap53_salas_batepapo').create({
                        event: event.id,
                        created_by: user.id,
                        status: 'active'
                    });

                    // Notify participants (simple bulk creation)
                    if (participants.length > 0) {
                        for (const pId of participants) {
                            if (pId === user.id) continue;
                            try {
                                await pb.collection('agenda_cap53_notifications').create({
                                    user: pId,
                                    title: 'Novas Discussões para Alinhamento',
                                    message: `Uma sala de discussões para alinhamento foi iniciada para o evento "${event.title}".`,
                                    type: 'chat_room_created',
                                    event: event.id,
                                    read: false
                                });
                            } catch (err) {
                                console.error('Error notifying participant:', err);
                            }
                        }
                    }
                }
                setRoom(existingRoom);

                // Load messages
                const messageRecords = await pb.collection('agenda_cap53_mensagens_salas').getFullList({
                    filter: `room = "${existingRoom.id}"`,
                    sort: 'created',
                    expand: 'sender'
                });
                setMessages(messageRecords);

                // Subscribe to real-time messages
                pb.collection('agenda_cap53_mensagens_salas').subscribe('*', (data) => {
                    if (data.action === 'create' && data.record.room === existingRoom.id) {
                        // We need to expand the sender for the new message
                        pb.collection('agenda_cap53_mensagens_salas').getOne(data.record.id, { expand: 'sender' })
                            .then(fullMsg => {
                                setMessages(prev => [...prev, fullMsg]);
                            });
                    } else if (data.action === 'update' && data.record.room === existingRoom.id) {
                        setMessages(prev => prev.map(m => m.id === data.record.id ? { ...m, ...data.record } : m));
                    } else if (data.action === 'delete' && data.record.room === existingRoom.id) {
                        setMessages(prev => prev.filter(m => m.id !== data.record.id));
                    }
                });

            } catch (error) {
                console.error('Error initializing chat:', error);
            } finally {
                setLoading(false);
            }
        };

        initChat();

        return () => {
            pb.collection('agenda_cap53_mensagens_salas').unsubscribe();
        };
    }, [event.id, user.id, isParticipant]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !room || !user) return;

        const content = newMessage.trim();
        setNewMessage('');

        try {
            await pb.collection('agenda_cap53_mensagens_salas').create({
                room: room.id,
                sender: user.id,
                content: content
            });
        } catch (error) {
            console.error('Error sending message:', error);
            setNewMessage(content); // Restore message on error
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        try {
            await pb.collection('agenda_cap53_mensagens_salas').delete(messageId);
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Erro ao excluir mensagem.');
        }
    };



    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col h-[650px] border border-slate-100/50">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-2xl">forum</span>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 tracking-tight">Discussões para Alinhamento</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    {participantsCount} Participantes
                                </p>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="size-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all duration-300 active:scale-90"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar bg-slate-50/20">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                            <div className="size-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carregando mensagens...</p>
                        </div>
                    ) : isParticipant === false ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                            <div className="size-20 rounded-full bg-red-50 flex items-center justify-center mb-6 text-red-400">
                                <span className="material-symbols-outlined text-4xl">lock</span>
                            </div>
                            <h4 className="text-slate-900 font-bold text-base mb-2">Acesso Restrito</h4>
                            <p className="text-slate-500 text-xs max-w-[240px] leading-relaxed">
                                Apenas participantes confirmados deste evento podem acessar as discussões de alinhamento e visualizar as mensagens.
                            </p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400/60">
                            <div className="size-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl">chat_bubble_outline</span>
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1">Silêncio no momento</p>
                            <p className="text-[10px] font-medium">Inicie a conversa enviando um "Oi"!</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => {
                            const isMe = msg.sender === user?.id;
                            const sender = msg.expand?.sender;
                            const showSender = i === 0 || messages[i-1].sender !== msg.sender;

                            return (
                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1 animate-in slide-in-from-bottom-2 duration-500`}>
                                    {showSender && (
                                        <span className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ${isMe ? 'mr-12' : 'ml-12'} mb-1`}>
                                            {isMe ? 'Você' : (sender?.name || 'Membro')}
                                        </span>
                                    )}
                                    <div className={`flex items-end gap-2.5 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div 
                                            className={`size-9 rounded-xl bg-cover bg-center border-2 border-white shadow-sm shrink-0 transition-transform hover:scale-110 ${!showSender ? 'opacity-0' : 'opacity-100'}`}
                                            style={{ backgroundImage: `url(${getAvatarUrl(isMe ? user : sender)})` }}
                                            title={isMe ? 'Você' : (sender?.name || 'Membro')}
                                        />
                                        <div className={`group relative p-4 rounded-2xl text-[13px] font-medium transition-all duration-300 ${
                                            isMe 
                                            ? 'bg-slate-900 text-white rounded-br-none shadow-lg shadow-slate-200' 
                                            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none shadow-sm hover:shadow-md'
                                        }`}>
                                            {msg.content}
                                            <div className={`absolute bottom-[-18px] ${isMe ? 'right-1' : 'left-1'} opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2`}>
                                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter whitespace-nowrap">
                                                    {new Date(msg.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isMe && (
                                                    <button 
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        className="text-slate-300 hover:text-red-400 transition-colors flex items-center"
                                                        title="Excluir mensagem"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="px-8 py-6 bg-white/80 backdrop-blur-md border-t border-slate-50">
                    {isParticipant !== false ? (
                        <form onSubmit={handleSendMessage} className="relative flex items-center group">
                            <input 
                                className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-5 pr-14 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-[6px] focus:ring-primary/5 transition-all duration-300"
                                placeholder="Mensagem para o grupo..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                            />
                            <button 
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="absolute right-2 size-10 bg-primary text-white rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 disabled:opacity-0 disabled:scale-90 transition-all duration-500 flex items-center justify-center active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[20px]">send</span>
                            </button>
                        </form>
                    ) : (
                        <div className="bg-slate-50 rounded-2xl py-4 px-5 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Chat bloqueado para não participantes
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventChatModal;
