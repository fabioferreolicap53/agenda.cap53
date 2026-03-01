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
                <div className="space-y-4">
                    {isMe && isEditing ? (
                        <div className="space-y-4">
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
                                    className="w-full text-xs border rounded-md p-2 focus:border-primary outline-none resize-none bg-slate-50"
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
                        <div className="space-y-4">
                            {/* Sector */}
                            {user.sector && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-400 text-lg">work</span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Setor</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100 uppercase tracking-wide">
                                            {user.sector}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Admission Date */}
                            {user.admissionDate && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-400 text-lg">calendar_month</span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Data de Admissão</p>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">{formatDate(user.admissionDate)}</p>
                                </div>
                            )}

                            {/* Birth Date */}
                            {user.birthDate && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-400 text-lg">cake</span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Data de Nascimento</p>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">{formatDate(user.birthDate)}</p>
                                </div>
                            )}

                            {/* Status Display */}
                            <div className="pt-4 border-t border-slate-100 mt-auto">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Status Atual</span>
                                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${
                                        user.status === 'Online' ? 'bg-green-100 text-green-700' :
                                        user.status === 'Ausente' ? 'bg-amber-100 text-amber-700' :
                                        user.status === 'Ocupado' ? 'bg-red-100 text-red-700' :
                                        'bg-slate-100 text-slate-500'
                                    }`}>
                                        {user.context_status || user.status || 'Offline'}
                                    </span>
                                </div>
                            </div>
                        </div>
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
            className={`group relative bg-white rounded-3xl border transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 h-full flex flex-col overflow-hidden ${
                isSelected 
                    ? 'border-primary ring-4 ring-primary/10 shadow-xl shadow-primary/5' 
                    : 'border-slate-100 shadow-sm hover:border-primary/20'
            }`}
        >
            {/* Header com Avatar e Ações Principais */}
            <div className="p-6 pb-4 border-b border-slate-100 flex flex-col items-center relative z-10">
                <div className="relative mb-3">
                    <div 
                        onClick={isMe ? onAvatarClick : undefined}
                        className={`relative w-24 h-24 rounded-full overflow-hidden border-4 transition-all duration-300 shadow-lg ${
                            isMe ? 'cursor-pointer border-primary group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:scale-105' : 'border-slate-100 group-hover:border-primary/30 group-hover:scale-105'
                        }`}
                    >
                        <img 
                            src={imgError ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=E2E8F0&color=64748B&size=200&bold=true` : (getAvatarUrl(user) || '')} 
                            alt={user.name} 
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                        />
                        {isMe && (
                            <div className="absolute inset-0 bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                                <span className="material-symbols-outlined text-white text-2xl drop-shadow-md">photo_camera</span>
                            </div>
                        )}
                    </div>
                    {/* Status Indicator */}
                    <div className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full shadow-md ring-2 ring-white">
                        <span className={`block w-4 h-4 rounded-full ${
                            user.status === 'Online' ? 'bg-green-500 animate-pulse' :
                            user.status === 'Ausente' ? 'bg-amber-500' :
                            user.status === 'Ocupado' ? 'bg-red-500' :
                            'bg-slate-300'
                        }`} title={user.context_status || user.status || 'Offline'}></span>
                    </div>
                </div>

                <h3 className="font-extrabold text-slate-900 text-xl leading-tight text-center group-hover:text-primary transition-colors mb-3" title={user.name}>
                    {user.name}
                </h3>

                {/* Bio Display */}
                <div className="min-h-[40px] text-center">
                    {!isEditing && user.observations ? (
                        <p className="text-xs text-slate-500 italic line-clamp-2 leading-relaxed">
                            "{user.observations}"
                        </p>
                    ) : (
                        <div className="h-full"></div>
                    )}
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex bg-slate-50/50 p-1 mx-5 mt-5 rounded-xl shrink-0 border border-slate-100/50">
                {(['identity', 'contact'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300 rounded-lg relative ${
                            activeTab === tab 
                                ? 'bg-white text-primary shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab === 'identity' && 'Detalhes'}
                        {tab === 'contact' && 'Contato'}
                    </button>
                ))}
            </div>

            {/* Tab Content Area */}
            <div className="px-6 py-5 h-[180px] overflow-y-auto custom-scrollbar flex-1 relative z-10">
                {renderTabContent()}
            </div>

            {/* Footer Actions */}
            <div className="p-5 bg-white border-t border-slate-100 flex items-center justify-between gap-3 mt-auto shrink-0 relative z-10">
                {/* Selection Checkbox */}
                {!isMe && (
                    <button
                        onClick={() => onToggleSelection(user.id)}
                        className={`shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isSelected 
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30 scale-105' 
                                : 'border-slate-200 text-slate-400 hover:border-primary/50 hover:text-primary/70 hover:scale-105'
                        }`}
                        title={isSelected ? "Desselecionar" : "Selecionar"}
                    >
                        <span className="material-symbols-outlined text-base font-black">{isSelected ? 'check_circle' : 'radio_button_unchecked'}</span>
                    </button>
                )}

                <div className="flex-1 flex items-center justify-end gap-3">
                    {/* Chat Button */}
                    <button
                        onClick={() => onChatClick(user.id)}
                        className="flex-none w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all duration-300 shadow-sm"
                        title="Iniciar Conversa"
                    >
                        <span className="material-symbols-outlined text-lg">chat_bubble</span>
                    </button>

                    {/* Favorite Button */}
                    {!isMe && onToggleFavorite && (
                        <button
                            onClick={onToggleFavorite}
                            className={`flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                                isFavorite
                                    ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                                    : 'bg-slate-50 text-slate-400 hover:bg-rose-50/50 hover:text-rose-400'
                            }`}
                            title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                        >
                            <span 
                                className="material-symbols-outlined text-lg"
                                style={isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                                favorite
                            </span>
                        </button>
                    )}

                    {isMe && (
                        isEditing ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-full text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-full text-sm font-bold bg-primary text-white hover:bg-primary-dark transition-colors flex items-center gap-2"
                                >
                                    {isSaving && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
                                    Salvar
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={startEditing}
                                className="flex-none w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-50/50 hover:text-blue-500 transition-all duration-300 shadow-sm"
                                title="Editar Perfil"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
