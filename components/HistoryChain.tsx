
import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface HistoryEntry {
  timestamp?: string;
  date?: string;
  action: 'created' | 'approved' | 'rejected' | 're_requested' | 'comment' | 'invite_created' | 'invite_accepted' | 'invite_rejected' | 'invite_resent';
  user: string;
  user_name?: string;
  message?: string;
  justification?: string;
  quantity?: number;
}

interface HistoryChainProps {
  history: HistoryEntry[];
  currentUserId?: string;
}

const HistoryChain: React.FC<HistoryChainProps> = ({ history, currentUserId }) => {
  if (!history || history.length === 0) return null;

  const getDate = (entry: any) => {
      const dateStr = entry.timestamp || entry.date;
      if (!dateStr) return new Date();
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? new Date() : date;
  };

  // Ordenar do mais antigo para o mais recente (cronológico)
  const sortedHistory = [...history].sort((a, b) => 
    getDate(a).getTime() - getDate(b).getTime()
  );

  return (
    <div className="mt-4 space-y-3 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
      {sortedHistory.map((entry, idx) => {
        const isMe = currentUserId && entry.user === currentUserId;
        const entryDate = getDate(entry);
        
        // Estilos baseados na ação
        let icon = 'circle';
        let bgClass = 'bg-slate-50 text-slate-500 border-slate-100';
        let title = 'Ação desconhecida';
        
        switch (entry.action) {
          case 'created':
            icon = 'add_circle';
            bgClass = 'bg-slate-50 text-slate-500 border-slate-100';
            title = 'Solicitação Criada';
            break;
          case 'approved':
            icon = 'check_circle';
            bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
            title = 'Solicitação Aprovada';
            break;
          case 'rejected':
            icon = 'cancel';
            bgClass = 'bg-red-50 text-red-700 border-red-100';
            title = 'Solicitação Recusada';
            break;
          case 're_requested':
            icon = 'reply'; // Seta de resposta
            bgClass = 'bg-blue-50 text-blue-800 border-blue-100';
            title = 'Re-solicitado (Resposta)';
            break;
          case 'comment':
            icon = 'chat';
            bgClass = 'bg-amber-50 text-amber-800 border-amber-100';
            title = 'Comentário';
            break;
          // Event Invite Actions
          case 'invite_created':
            icon = 'add_circle';
            bgClass = 'bg-slate-50 text-slate-500 border-slate-100';
            title = 'Convite Criado';
            break;
          case 'invite_resent':
            icon = 'reply';
            bgClass = 'bg-blue-50 text-blue-800 border-blue-100';
            title = 'Convite Reenviado (Resposta)';
            break;
          case 'invite_accepted':
            icon = 'check_circle';
            bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
            title = 'Convite Aceito';
            break;
          case 'invite_rejected':
            icon = 'cancel';
            bgClass = 'bg-red-50 text-red-700 border-red-100';
            title = 'Convite Recusado';
            break;
        }

        return (
          <div key={`${entry.timestamp}-${idx}`} className="relative pl-10 animate-in fade-in slide-in-from-top-1 duration-300">
            {/* Ícone na linha do tempo */}
            <div className={`absolute left-0 top-0 w-10 h-10 flex items-center justify-center z-10`}>
               <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white ${
                 entry.action === 'rejected' || entry.action === 'invite_rejected' ? 'border-red-100 text-red-500' :
                 entry.action === 'approved' || entry.action === 'invite_accepted' ? 'border-emerald-100 text-emerald-500' :
                 entry.action === 're_requested' ? 'border-blue-100 text-blue-500' :
                 'border-slate-100 text-slate-400'
               }`}>
                  <span className="material-symbols-outlined text-[16px]">{icon}</span>
               </div>
            </div>

            {/* Conteúdo do Card */}
            <div className={`p-3 rounded-lg border text-xs ${bgClass}`}>
              <div className="flex justify-between items-start mb-1">
                <strong className="font-bold uppercase tracking-wide opacity-80 text-[10px]">
                  {title}
                </strong>
                <span className="text-[10px] opacity-60 font-medium">
                  {format(entryDate, "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
              
              {entry.user_name && (
                <div className="text-[10px] opacity-70 mb-1 flex items-center gap-1">
                   <span className="material-symbols-outlined text-[12px]">person</span>
                   {isMe ? 'Você' : entry.user_name}
                </div>
              )}

              {entry.quantity !== undefined && (
                <div className="mt-2 mb-2 inline-flex items-center gap-2 pl-2.5 pr-3 py-1 rounded-md bg-white/50 border border-white/60 shadow-sm transition-all hover:bg-white/80 hover:shadow-md cursor-default">
                   <span className="text-[9px] font-black uppercase tracking-wider opacity-60">Nova Qtd</span>
                   <div className="w-px h-3 bg-current opacity-20"></div>
                   <span className="text-sm font-bold tabular-nums tracking-tight">{entry.quantity}</span>
                </div>
              )}

              {(entry.message || entry.justification) && (
                <div className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {entry.message || entry.justification}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HistoryChain;
