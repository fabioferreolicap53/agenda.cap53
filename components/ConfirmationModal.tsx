import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'warning',
          iconColor: 'text-red-600',
          bgColor: 'bg-red-50/50',
          titleColor: 'text-red-900',
          buttonBg: 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
        };
      case 'warning':
        return {
          icon: 'error',
          iconColor: 'text-amber-600',
          bgColor: 'bg-amber-50/50',
          titleColor: 'text-amber-900',
          buttonBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
        };
      case 'info':
      default:
        return {
          icon: 'info',
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50/50',
          titleColor: 'text-blue-900',
          buttonBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${styles.bgColor}`}>
          <h3 className={`font-bold ${styles.titleColor} flex items-center gap-2`}>
            <span className={`material-symbols-outlined ${styles.iconColor}`}>{styles.icon}</span>
            {title}
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={loading}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            {description}
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${styles.buttonBg}`}
              disabled={loading}
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  {confirmText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
