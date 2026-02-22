import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAvatarUrl } from '../lib/pocketbase';
import { useAuth } from './AuthContext';

interface AvatarUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AvatarUploadModal: React.FC<AvatarUploadModalProps> = ({ isOpen, onClose }) => {
    const { user, updateAvatar } = useAuth();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('A imagem deve ter no máximo 5MB.');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                setError('Por favor, selecione um arquivo de imagem válido.');
                return;
            }

            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
             if (file.size > 5 * 1024 * 1024) {
                setError('A imagem deve ter no máximo 5MB.');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                setError('Por favor, selecione um arquivo de imagem válido.');
                return;
            }

            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError(null);
        }
    };

    const handleSave = async () => {
        if (!selectedFile) return;

        setLoading(true);
        setError(null);

        try {
            await updateAvatar(selectedFile);
            onClose();
        } catch (err: any) {
            console.error('Error uploading avatar:', err);
            setError('Erro ao atualizar avatar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setError(null);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col border border-slate-100/50">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <h3 className="text-lg font-bold text-slate-800">Alterar Foto de Perfil</h3>
                    <button 
                        onClick={handleClose}
                        className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-6 items-center">
                    <div 
                        className="relative group cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <div className={`size-32 rounded-full overflow-hidden ring-4 ring-offset-2 transition-all duration-300 ${previewUrl ? 'ring-primary' : 'ring-slate-200 group-hover:ring-primary/50'}`}>
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                    {user?.avatar ? (
                                        <img src={getAvatarUrl(user)} alt="Current" className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                                    ) : (
                                        <span className="material-symbols-outlined text-5xl">person</span>
                                    )}
                                </div>
                            )}
                            
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors rounded-full">
                                <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 text-3xl drop-shadow-lg">
                                    photo_camera
                                </span>
                            </div>
                        </div>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-slate-600">
                            Clique ou arraste uma imagem
                        </p>
                        <p className="text-xs text-slate-400">
                            JPG, PNG ou GIF (Max. 5MB)
                        </p>
                    </div>

                    {error && (
                        <div className="w-full p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!selectedFile || loading}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-primary hover:bg-primary-hover active:bg-primary-active rounded-lg shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-sm">check</span>
                                Salvar Foto
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AvatarUploadModal;