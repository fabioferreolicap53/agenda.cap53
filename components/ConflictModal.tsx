
import React from 'react';

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  conflictDetails?: string;
  type?: 'warning' | 'danger';
}

const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  conflictDetails,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const colorClass = 'bg-[#1C2E4A]';
  const buttonClass = 'bg-[#1C2E4A] hover:bg-[#456086] shadow-blue-900/20';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <style>{`
        @keyframes custom-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.1); }
        }
        .animate-custom-bounce {
          animation: custom-bounce 2s infinite ease-in-out;
        }
      `}</style>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-sm w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in duration-300">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {/* Header/Icon Section */}
          <div className={`${colorClass} p-8 flex flex-col items-center text-white text-center relative overflow-hidden`}>
            {/* Background Decorative Elements - Subtle */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-xl" />
            
            <div className="relative mb-4">
              {/* Animated Rings - Compact */}
              <div className="absolute inset-0 bg-white/20 rounded-full animate-ping duration-[2000ms]" />
              
              {/* Icon Container - Smaller */}
              <div className="relative bg-white p-4 rounded-full shadow-lg transform transition-transform hover:scale-105 duration-300">
                <div className="flex items-center justify-center w-10 h-10">
                  <span className="material-symbols-outlined text-[#1C2E4A] text-4xl font-black animate-custom-bounce">
                    priority_high
                  </span>
                </div>
              </div>
            </div>
            
            <h3 className="text-2xl font-black uppercase tracking-tight leading-tight italic">
              {title}
            </h3>
          </div>

          {/* Body Section */}
          <div className="p-8">
            <p className="text-slate-600 text-lg leading-snug text-center font-medium">
              {message}
            </p>
            
            {conflictDetails && (
              <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group transition-all">
                <div className="absolute -top-3 left-6 px-3 py-0.5 bg-[#1C2E4A] rounded-full shadow-md">
                  <p className="text-[9px] font-bold text-white uppercase tracking-widest leading-none">
                    Detalhes
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#1C2E4A]/30 text-xl mt-0.5">info</span>
                  <p className="text-[#1C2E4A] font-bold text-sm leading-tight tracking-tight">
                    {conflictDetails}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer/Actions Section */}
          <div className="p-8 pt-0 flex flex-col gap-3">
            {!isDanger && (
              <button
                onClick={onConfirm}
                className={`w-full ${buttonClass} text-white font-bold py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-base uppercase tracking-wider`}
              >
                Prosseguir
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            )}
            
            <button
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-3.5 rounded-xl transition-all active:scale-95 text-[11px] uppercase tracking-widest"
            >
              {isDanger ? 'VOLTAR E CORRIGIR' : 'CANCELAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal;
