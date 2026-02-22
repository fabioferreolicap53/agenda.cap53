import React, { useState } from 'react';
import { NotificationRecord } from '../lib/notifications';

interface ReInviteModalProps {
  notification: NotificationRecord;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void>;
  loading?: boolean;
}

const ReInviteModal: React.FC<ReInviteModalProps> = ({ notification, onClose, onConfirm, loading }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
          <h3 className="font-bold text-blue-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">person_add</span>
            Convidar Novamente
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Você está convidando novamente o usuário para este evento. Deseja adicionar uma mensagem personalizada?
          </p>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mensagem <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Por favor, tente comparecer, sua presença é importante..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none h-32 text-sm text-slate-600 placeholder:text-slate-400"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Enviar Convite
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReInviteModal;
