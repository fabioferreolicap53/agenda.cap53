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
            role: user.role,
            sector: user.sector,
            observations: user.observations,
            whatsapp: user.whatsapp,
            birthDate: user.birthDate,
            admissionDate: user.admissionDate
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

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Cargo</label>
                                    <input
                                        type="text"
                                        value={editData.role || ''}
                                        onChange={e => setEditData({...editData, role: e.target.value})}
                                        className="w-full text-xs border-b border-primary/50 focus:border-primary outline-none bg-transparent py-1"
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

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Nascimento</label>
                                    <input
                                        type="date"
                                        value={editData.birthDate ? editData.birthDate.split(' ')[0] : ''}
                                        onChange={e => setEditData({...editData, birthDate: e.target.value})}
                                        className="w-full text-xs border-b border-primary/50 focus:border-primary outline-none bg-transparent py-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Admissão</label>
                                    <input
                                        type="date"
                                        value={editData.admissionDate ? editData.admissionDate.split(' ')[0] : ''}
                                        onChange={e => setEditData({...editData, admissionDate: e.target.value})}
                                        className="w-full text-xs border-b border-primary/50 focus:border-primary outline-none bg-transparent py-1"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Tags de Cargo e Setor */}
                            <div className="flex flex-col items-start gap-2 mt-2 mb-3">
                                {user.role && (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 uppercase">
                                        {user.role}
                                    </span>
                                )}
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
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${user.active ? 'bg-emerald-500' : 'bg-red-400'}`}></span>
                                        <span className={`text-xs font-medium ${user.active ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {user.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
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
            className={`group relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                isSelected 
                    ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10' 
                    : 'border-slate-100 shadow-sm hover:border-slate-200'
            }`}
        >
            {/* Header com Avatar e Ações Principais */}
            <div className="p-4 border-b border-slate-50">
                <div className="flex items-start justify-between gap-3">
                    {/* Avatar Area */}
                    <div className="relative">
                        <div 
                            onClick={isMe ? onAvatarClick : undefined}
                            className={`relative w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all ${
                                isMe ? 'cursor-pointer border-primary group-hover:shadow-lg group-hover:shadow-primary/20' : 'border-slate-100'
                            }`}
                        >
                            <img 
                                src={imgError ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=random&color=fff&size=200` : getAvatarUrl(user)} 
                                alt={user.name} 
                                className="w-full h-full object-cover"
                                onError={handleImageError}
                            />
                            {isMe && (
                                <div className="absolute inset-0 bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors">
                                    <span className="material-symbols-outlined text-white text-lg drop-shadow-md">edit</span>
                                </div>
                            )}
                        </div>
                        {/* Status Indicator */}
                        <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full">
                            <span className={`block w-3 h-3 rounded-full border-2 border-white ${
                                user.active ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}></span>
                        </div>
                    </div>

                    {/* Name and Role */}
                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-sm truncate pr-2" title={user.name}>
                                {user.name}
                            </h3>
                            {/* Checkbox de Seleção */}
                            {!isMe && (
                                <button
                                    onClick={() => onToggleSelection(user.id)}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                        isSelected 
                                            ? 'bg-primary border-primary text-white' 
                                            : 'border-slate-200 text-transparent hover:border-primary/50'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{user.role || 'Membro da Equipe'}</p>
                        
                        {/* Bio Display */}
                        {!isEditing && user.observations && (
                            <p className="text-xs text-slate-600 mt-1.5 line-clamp-3 leading-snug">
                                {user.observations}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-50 px-2">
                {(['identity', 'contact'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
                            activeTab === tab 
                                ? 'text-primary' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab === 'identity' && 'Perfil'}
                        {tab === 'contact' && 'Contato'}
                        
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-t-full"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content Area */}
            <div className="p-4 h-[180px] overflow-y-auto custom-scrollbar">
                {renderTabContent()}
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-slate-50 bg-slate-50/50 rounded-b-2xl flex items-center justify-between gap-2">
                {isMe ? (
                    isEditing ? (
                        <>
                            <button 
                                onClick={handleCancel}
                                className="flex-1 py-1.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                disabled={isSaving}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-1 py-1.5 px-3 rounded-xl bg-primary text-white text-xs font-bold shadow-sm shadow-primary/20 hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                                disabled={isSaving}
                            >
                                {isSaving ? <span className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full"></span> : 'Salvar'}
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={startEditing}
                            className="w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white hover:border-primary hover:text-primary hover:shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">edit_square</span>
                            Editar Perfil
                        </button>
                    )
                ) : (
                    <>
                        <button 
                            onClick={() => onChatClick(user.id)}
                            className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:shadow-sm transition-all flex items-center justify-center gap-2 relative group/btn"
                        >
                            <span className="material-symbols-outlined text-lg">chat_bubble</span>
                            <span className="text-xs font-bold">Chat</span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full shadow-sm">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite?.();
                            }}
                            className={`relative z-10 w-10 h-10 rounded-xl bg-white border flex items-center justify-center transition-all cursor-pointer ${
                                isFavorite 
                                    ? 'border-rose-200 text-rose-500 bg-rose-50' 
                                    : 'border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                            }`}
                        >
                            <span 
                                className="material-symbols-outlined transition-transform active:scale-90"
                                style={isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
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
