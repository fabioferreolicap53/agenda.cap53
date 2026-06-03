import React from 'react';

interface LogisticsWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const LogisticsWarningModal: React.FC<LogisticsWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <style>{`
        @keyframes pulse-warning {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        .animate-pulse-warning {
          animation: pulse-warning 2.5s infinite ease-in-out;
        }
      `}</style>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in duration-300">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {/* Header/Icon Section */}
          <div className="bg-amber-500 p-8 flex flex-col items-center text-white text-center relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
            
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-white/30 rounded-full animate-ping duration-[2000ms]" />
              <div className="relative bg-white p-4 rounded-full shadow-lg transform transition-transform hover:scale-105 duration-300">
                <div className="flex items-center justify-center w-12 h-12">
                  <span className="material-symbols-outlined text-amber-500 text-5xl font-black animate-pulse-warning">
                    schedule_warning
                  </span>
                </div>
              </div>
            </div>
            
            <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">
              Aviso de Prazo
            </h3>
          </div>

          {/* Body Section */}
          <div className="p-8">
            <p className="text-slate-600 text-base leading-relaxed text-center font-medium mb-6">
              Você está criando um evento com <strong>menos de 48 horas de antecedência</strong> e solicitando recursos logísticos.
            </p>
            
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 relative group transition-all">
              <div className="absolute -top-3 left-6 px-3 py-0.5 bg-amber-500 rounded-full shadow-md">
                <p className="text-[9px] font-bold text-white uppercase tracking-widest leading-none">
                  Atenção
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500/50 text-2xl mt-0.5">info</span>
                <div className="text-amber-900 font-bold text-sm leading-snug tracking-tight w-full">
                  O atendimento aos itens solicitados (Almoxarifado, Copa, Informática e Transporte) estará sujeito à disponibilidade imediata e viabilidade operacional do setor responsável.
                </div>
              </div>
            </div>
          </div>

          {/* Footer/Actions Section */}
          <div className="p-8 pt-0 flex flex-col gap-3">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white font-bold py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-base uppercase tracking-wider"
            >
              Ciente, Prosseguir
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
            
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-3.5 rounded-xl transition-all active:scale-95 text-[11px] uppercase tracking-widest"
            >
              Cancelar e Revisar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsWarningModal;
