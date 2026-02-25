import React, { useState } from 'react';
import { getAvatarUrl } from '../../lib/pocketbase';
import { UsersResponse } from '../../lib/pocketbase-types';

interface UserCardProps {
    user: UsersResponse;
    currentUser: any;
    isMe: boolean;
    unreadCount: number;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onChatClick: (id: string) => void;
    onAvatarClick?: () => void;
    onUpdateProfile: (data: Partial<UsersResponse>) => Promise<void>;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
    user,
    currentUser,
    isMe,
    unreadCount,
    isSelected,
    onToggleSelection,
    onChatClick,
    onAvatarClick,
    onUpdateProfile,
    isFavorite,
    onToggleFavorite
}) => {
    const [activeTab, setActiveTab] = useState<'identity' | 'contact'>('identity');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<UsersResponse>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [imgError, setImgError] = useState(false);

    // Inicializa dados de edição
    const startEditing = () => {
        setEditData({
            name: user.name,
            sector: user.sector,
            observations: user.observations,
            whatsapp: user.whatsapp
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateProfile(editData);
            setIsEditing(false);
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Erro ao salvar perfil. Verifique se você tem permissão para editar estes campos.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditData({});
    };

    const handleImageError = () => {
        setImgError(true);
    };

    // Formatação de data
    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleDateString('pt-BR');
        } catch {
            return dateString;
        }
    };

    // Renderização do conteúdo da aba
    const renderTabContent = () => {
        if (activeTab === 'identity') {
            return (
                <div className="space-y-3">
                    {isMe && isEditing ? (
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400">Nome</label>
                                <input
                                    type="text"
                                    value={editData.name || ''}
                                    onChange={e => setEditData({...editData, name: e.target.value})}
                                    className="w-full text-sm border-b border-primary/50 focus:border-primary outline-none bg-transparent py-1"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400">Observações</label>
                                <textarea
                                    value={editData.observations || ''}
                                    onChange={e => setEditData({...editData, observations: e.target.value})}
                                    rows={2}
                                    className="w-full text-xs border rounded p-1 focus:border-primary outline-none resize-none bg-slate-50"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400">Setor</label>
                                <input
                                    type="text"
                                    value={editData.sector || ''}
                                    onChange={e => setEditData({...editData, sector: e.target.value})}
                                    className="w-full text-xs border-b border-primary/50 focus:border-primary outline-none bg-transparent py-1"
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Tags de Cargo e Setor */}
                            <div className="flex flex-col items-start gap-2 mt-2 mb-3">
                                {user.sector && (
                                    <span className="px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100 uppercase tracking-wide">
                                        {user.sector}
                                    </span>
                                )}
                            </div>

                            {/* Status Display */}
                            <div className="pt-3 border-t border-slate-50 mt-auto">
                                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                        user.status === 'Online' ? 'bg-green-100 text-green-700' :
                                        user.status === 'Ausente' ? 'bg-amber-100 text-amber-700' :
                                        user.status === 'Ocupado' ? 'bg-red-100 text-red-700' :
                                        'bg-slate-100 text-slate-500'
                                    }`}>
                                        {user.context_status || user.status || 'Offline'}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            );
        }

        if (activeTab === 'contact') {
            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group/item">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover/item:text-blue-500 transition-colors">
                            <span className="material-symbols-outlined text-lg">mail</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Email</p>
                            <p className="text-xs font-medium text-slate-700 truncate" title={user.email}>{user.email}</p>
                        </div>
                    </div>

                    {isMe && isEditing ? (
                         <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400">
                                <span className="material-symbols-outlined text-lg">call</span>
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Whatsapp</label>
                                <input
                                    type="text"
                                    value={editData.whatsapp || ''}
                                    onChange={e => setEditData({...editData, whatsapp: e.target.value})}
                                    className="w-full text-xs border-b border-primary/50 bg-transparent outline-none py-1"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                         </div>
                    ) : (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group/item">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover/item:text-green-500 transition-colors">
                                <span className="material-symbols-outlined text-lg">call</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Whatsapp</p>
                                <p className="text-xs font-medium text-slate-700 truncate">
                                    {user.whatsapp || 'Não informado'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
    };

    return (
        <div 
            className={`group relative bg-white rounded-[2rem] border transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:-translate-y-2 h-full flex flex-col overflow-hidden ${
                isSelected 
                    ? 'border-primary ring-4 ring-primary/10 shadow-xl shadow-primary/5' 
                    : 'border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-primary/20'
            }`}
        >
            {/* Background Decorative Element */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br transition-opacity duration-500 opacity-0 group-hover:opacity-10 pointer-events-none ${
                isMe ? 'from-primary to-transparent' : 'from-slate-400 to-transparent'
            }`} style={{ clipPath: 'circle(50% at 100% 0%)' }}></div>

            {/* Header com Avatar e Ações Principais */}
            <div className="p-5 border-b border-slate-50 min-h-[110px] flex flex-col justify-center relative z-10">
                <div className="flex items-start justify-between gap-4">
                    {/* Avatar Area */}
                    <div className="relative shrink-0">
                        <div 
                            onClick={isMe ? onAvatarClick : undefined}
                            className={`relative w-16 h-16 rounded-[1.25rem] overflow-hidden border-2 transition-all duration-300 shadow-sm ${
                                isMe ? 'cursor-pointer border-primary group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:scale-105' : 'border-slate-100 group-hover:border-primary/30 group-hover:scale-105'
                            }`}
                        >
                            <img 
                                src={imgError ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=E2E8F0&color=64748B&size=200&bold=true` : (getAvatarUrl(user) || '')} 
                                alt={user.name} 
                                className="w-full h-full object-cover"
                                onError={handleImageError}
                            />
                            {isMe && (
                                <div className="absolute inset-0 bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                                    <span className="material-symbols-outlined text-white text-xl drop-shadow-md">photo_camera</span>
                                </div>
                            )}
                        </div>
                        {/* Status Indicator */}
                        <div className="absolute -bottom-1.5 -right-1.5 bg-white p-1 rounded-full shadow-sm ring-2 ring-white">
                            <span className={`block w-3.5 h-3.5 rounded-full ${
                                user.status === 'Online' ? 'bg-green-500 animate-pulse' :
                                user.status === 'Ausente' ? 'bg-amber-500' :
                                user.status === 'Ocupado' ? 'bg-red-500' :
                                'bg-slate-300'
                            }`} title={user.context_status || user.status || 'Offline'}></span>
                        </div>
                    </div>

                    {/* Name and Role */}
                    <div className="flex-1 min-w-0 pt-1 flex flex-col h-full">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-extrabold text-slate-800 text-base leading-tight group-hover:text-primary transition-colors" title={user.name}>
                                {user.name}
                            </h3>
                            {/* Checkbox de Seleção */}
                            {!isMe && (
                                <button
                                    onClick={() => onToggleSelection(user.id)}
                                    className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                                        isSelected 
                                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30 scale-110' 
                                            : 'border-slate-200 text-transparent hover:border-primary/50 hover:scale-105'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-xs font-black">check</span>
                                </button>
                            )}
                        </div>
                        {/* Bio Display */}
                        <div className="min-h-[40px] mt-1.5">
                            {!isEditing && user.observations ? (
                                <p className="text-[11px] text-slate-500 italic line-clamp-2 leading-relaxed">
                                    "{user.observations}"
                                </p>
                            ) : (
                                <div className="h-full"></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex bg-slate-50/50 p-1 mx-4 mt-4 rounded-xl shrink-0 border border-slate-100/50">
                {(['identity', 'contact'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-lg relative ${
                            activeTab === tab 
                                ? 'bg-white text-primary shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab === 'identity' && 'Perfil'}
                        {tab === 'contact' && 'Contato'}
                    </button>
                ))}
            </div>

            {/* Tab Content Area */}
            <div className="px-5 py-4 h-[160px] overflow-y-auto custom-scrollbar flex-1 relative z-10">
                {renderTabContent()}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-white border-t border-slate-50 flex items-center justify-between gap-3 mt-auto shrink-0 relative z-10">
                {isMe ? (
                    isEditing ? (
                        <>
                            <button 
                                onClick={handleCancel}
                                className="flex-1 py-2.5 px-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
                                disabled={isSaving}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-1 py-2.5 px-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                disabled={isSaving}
                            >
                                {isSaving ? <span className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full"></span> : 'Confirmar'}
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={startEditing}
                            className="w-full py-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs font-black text-indigo-600 hover:bg-indigo-600 hover:text-white hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 flex items-center justify-center gap-2 group/edit"
                        >
                            <span className="material-symbols-outlined text-lg transition-transform group-hover:rotate-12">edit_square</span>
                            CONFIGURAR PERFIL
                        </button>
                    )
                ) : (
                    <>
                        <button 
                            onClick={() => onChatClick(user.id)}
                            className="flex-[2] py-3 rounded-2xl bg-white border-2 border-slate-100 text-slate-700 hover:border-primary hover:text-primary hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 flex items-center justify-center gap-3 relative group/btn overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-primary opacity-0 group-hover/btn:opacity-[0.03] transition-opacity"></div>
                            <span className="material-symbols-outlined text-xl transition-transform group-hover/btn:-translate-y-1 group-hover/btn:translate-x-1">send</span>
                            <span className="text-xs font-black uppercase tracking-wider">Enviar Mensagem</span>
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-lg shadow-lg animate-bounce">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite?.();
                            }}
                            className={`relative z-10 w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-sm active:scale-90 ${
                                isFavorite 
                                    ? 'border-rose-100 text-rose-500 bg-rose-50 shadow-rose-100' 
                                    : 'border-slate-100 text-slate-300 bg-white hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50/30'
                            }`}
                        >
                            <span 
                                className="material-symbols-outlined text-2xl transition-all duration-300"
                                style={isFavorite ? { fontVariationSettings: "'FILL' 1", transform: 'scale(1.1)' } : undefined}
                            >
                                favorite
                            </span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
