
import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface HistoryEntry {
  timestamp?: string;
  date?: string;
  action: 'created' | 'approved' | 'rejected' | 're_requested' | 'comment' | 'invite_created' | 'invite_accepted' | 'invite_rejected' | 'invite_resent' | 'transport_confirmed' | 'transport_rejected' | 'request_created' | 'request_approved' | 'request_rejected' | 'request_resent';
  user: string;
  user_name?: string;
  message?: string;
  justification?: string;
  quantity?: number;
  kind?: 'item' | 'transport';
}

interface HistoryChainProps {
  history: HistoryEntry[];
  currentUserId?: string;
  type?: 'item' | 'transport';
}

const HistoryChain: React.FC<HistoryChainProps> = ({ history, currentUserId, type }) => {
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
    <div className="mt-6 space-y-4 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200/60">
      {sortedHistory.map((entry, idx) => {
        const isMe = currentUserId && entry.user === currentUserId;
        const entryDate = getDate(entry);
        
        // Estilos baseados na ação
        let icon = 'circle';
        let statusColor = 'slate';
        let title = 'Ação desconhecida';
        
        switch (entry.action) {
          case 'created':
            icon = 'add';
            statusColor = 'slate';
            title = 'Solicitação Criada';
            break;
          case 'approved':
            icon = 'check_circle';
            statusColor = 'emerald';
            title = 'Solicitação Aprovada';
            break;
          case 'rejected':
            icon = 'cancel';
            statusColor = 'rose';
            title = 'Solicitação Recusada';
            break;
          case 're_requested':
            icon = 'history';
            statusColor = 'blue';
            title = 'Re-solicitado';
            break;
          case 'comment':
            icon = 'chat_bubble';
            statusColor = 'amber';
            title = 'Comentário';
            break;
          case 'invite_created':
            icon = 'mail';
            statusColor = 'slate';
            title = 'Convite Enviado';
            break;
          case 'invite_resent':
            icon = 'forward_to_inbox';
            statusColor = 'blue';
            title = 'Convite Reenviado';
            break;
          case 'invite_accepted':
            icon = 'check_circle';
            statusColor = 'emerald';
            title = 'Convite Aceito';
            break;
          case 'invite_rejected':
            icon = 'cancel';
            statusColor = 'rose';
            title = 'Convite Recusado';
            break;
          case 'transport_confirmed':
            icon = 'local_shipping';
            statusColor = 'emerald';
            title = 'Transporte Confirmado';
            break;
          case 'transport_rejected':
            icon = 'cancel';
            statusColor = 'rose';
            title = 'Transporte Recusado';
            break;
          case 'request_created':
            icon = 'person_add';
            statusColor = 'slate';
            title = 'Participação Solicitada';
            break;
          case 'request_approved':
            icon = 'check_circle';
            statusColor = 'emerald';
            title = 'Participação Aprovada';
            break;
          case 'request_rejected':
            icon = 'cancel';
            statusColor = 'rose';
            title = 'Participação Recusada';
            break;
          case 'request_resent':
            icon = 'history';
            statusColor = 'blue';
            title = 'Participação Reaberta';
            break;
        }

        const colorClasses: Record<string, string> = {
          emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          rose: 'bg-rose-50 text-rose-700 border-rose-100',
          blue: 'bg-blue-50 text-blue-700 border-blue-100',
          amber: 'bg-amber-50 text-amber-700 border-amber-100',
          slate: 'bg-slate-50 text-slate-600 border-slate-200/60'
        };

        const iconClasses: Record<string, string> = {
          emerald: 'border-emerald-200 text-emerald-600 bg-white',
          rose: 'border-rose-200 text-rose-600 bg-white',
          blue: 'border-blue-200 text-blue-600 bg-white',
          amber: 'border-amber-200 text-amber-600 bg-white',
          slate: 'border-slate-200 text-slate-400 bg-white'
        };

        return (
          <div key={`${entry.timestamp}-${idx}`} className="relative pl-9 animate-in fade-in slide-in-from-left-1 duration-500">
            {/* Ícone na linha do tempo */}
            <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-full border flex items-center justify-center z-10 shadow-sm ${iconClasses[statusColor]}`}>
                <span className="material-symbols-outlined text-[16px] font-bold">{icon}</span>
            </div>

            {/* Conteúdo do Card */}
            <div className={`p-3.5 rounded-xl border transition-all duration-300 hover:shadow-sm ${colorClasses[statusColor]}`}>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-80">
                    {title}
                  </span>
                  {entry.user_name && (
                    <>
                      <div className="w-1 h-1 rounded-full bg-current opacity-30"></div>
                      <span className="text-[10px] font-bold opacity-70">
                        {isMe ? 'Você' : entry.user_name}
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[9px] font-bold opacity-50 tabular-nums">
                  {format(entryDate, "dd/MM · HH:mm", { locale: ptBR })}
                </span>
              </div>
              
              {entry.quantity !== undefined && (
                <div className="mb-2 inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/60 border border-white/80 shadow-sm">
                   <span className="text-[9px] font-black uppercase tracking-wider opacity-50">
                     {type === 'transport' || entry.kind === 'transport' || entry.action === 'transport_confirmed' || entry.action === 'transport_rejected' 
                        ? 'Passageiros' 
                        : 'Quantidade'}
                   </span>
                   <div className="w-[1px] h-2 bg-current opacity-20"></div>
                   <span className="text-xs font-bold tabular-nums">{entry.quantity}</span>
                </div>
              )}

              {(entry.message || entry.justification) && (
                (() => {
                  const content = entry.message || entry.justification;
                  if (content && title && content.toLowerCase().trim() === title.toLowerCase().trim()) return null;
                  
                  if (content && title && title.toLowerCase().includes(content.toLowerCase().trim())) {
                    const genericTerms = ['solicitação aprovada', 'solicitação recusada', 'convite aceito', 'convite recusado'];
                    if (genericTerms.includes(content.toLowerCase().trim())) return null;
                  }

                  return (
                    <div className="text-[13px] leading-relaxed font-medium opacity-90">
                      {content}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HistoryChain;
