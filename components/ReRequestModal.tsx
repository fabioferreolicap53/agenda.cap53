import React, { useState } from 'react';
import { NotificationRecord } from '../lib/notifications';
import { pb } from '../lib/pocketbase';

interface ReRequestModalProps {
  notification: NotificationRecord;
  onClose: () => void;
  onSuccess: () => void;
}

const ReRequestModal: React.FC<ReRequestModalProps> = ({ notification, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const data = typeof notification.data === 'string' 
    ? JSON.parse(notification.data) 
    : (notification.data || {});

  const [quantity, setQuantity] = useState<number>(data.quantity || 1);
  const [transportData, setTransportData] = useState({
    destino: data.destination || '',
    horario_levar: data.horario_levar || '',
    horario_buscar: data.horario_buscar || '',
    qtd_pessoas: data.qtd_pessoas || 1
  });

  const isItemRequest = data.kind === 'almc_item_decision';
  const isTransportRequest = data.kind === 'transport_decision';

  // Carregar dados iniciais se possível (opcional, mas bom para UX)
  // Como não temos os dados originais completos na notificação, começamos limpo ou com defaults seguros

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isItemRequest) {
        const requestId = notification.related_request;
        if (!requestId) throw new Error('ID da solicitação original não encontrado.');

        await pb.collection('agenda_cap53_almac_requests').update(requestId, {
          status: 'pending',
          quantity: quantity,
          justification: null // Limpar justificativa de recusa anterior
        });
      } else if (isTransportRequest) {
        const eventId = notification.event;
        if (!eventId) throw new Error('ID do evento não encontrado.');

        await pb.collection('agenda_cap53_eventos').update(eventId, {
          transporte_status: 'pending',
          transporte_destino: transportData.destino,
          transporte_horario_levar: transportData.horario_levar,
          transporte_horario_buscar: transportData.horario_buscar,
          transporte_qtd_pessoas: transportData.qtd_pessoas
        });
      }

      // Marcar notificação de recusa como lida para limpar a lista
      await pb.collection('agenda_cap53_notifications').update(notification.id, { read: true });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao reenviar solicitação:', error);
      alert('Erro ao reenviar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">restart_alt</span>
            Solicitar Novamente
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm mb-4">
            <p>Você está reabrindo uma solicitação recusada.</p>
            {data.item_name && <p className="font-bold mt-1">Item: {data.item_name}</p>}
            {data.event_title && <p className="text-xs mt-1 opacity-80">Evento: {data.event_title}</p>}
          </div>

          {isItemRequest && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nova Quantidade</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                required
              />
            </div>
          )}

          {isTransportRequest && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Destino</label>
                <input
                  type="text"
                  value={transportData.destino}
                  onChange={e => setTransportData({...transportData, destino: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                  placeholder="Ex: Aeroporto, Hotel..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Horário Ida</label>
                  <input
                    type="time"
                    value={transportData.horario_levar}
                    onChange={e => setTransportData({...transportData, horario_levar: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Horário Volta</label>
                  <input
                    type="time"
                    value={transportData.horario_buscar}
                    onChange={e => setTransportData({...transportData, horario_buscar: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Qtd. Pessoas</label>
                <input
                  type="number"
                  min="1"
                  value={transportData.qtd_pessoas}
                  onChange={e => setTransportData({...transportData, qtd_pessoas: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
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
              className="flex-1 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              disabled={loading}
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Reenviar Solicitação
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReRequestModal;
