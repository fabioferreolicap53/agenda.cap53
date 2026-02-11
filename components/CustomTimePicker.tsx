import React, { useState, useEffect, useRef } from 'react';

interface CustomTimePickerProps {
  value: string; // Format "HH:mm"
  onChange: (value: string) => void;
  label?: string;
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const currentHour = value ? value.split(':')[0] : '08';
  const currentMinute = value ? value.split(':')[1] : '00';

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll to selected values when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hoursRef.current) {
          const selectedHour = hoursRef.current.querySelector(`[data-hour="${currentHour}"]`);
          if (selectedHour) {
            hoursRef.current.scrollTo({
              top: (selectedHour as HTMLElement).offsetTop - 12,
              behavior: 'smooth'
            });
          }
        }
        if (minutesRef.current) {
          const selectedMinute = minutesRef.current.querySelector(`[data-minute="${currentMinute}"]`);
          if (selectedMinute) {
            minutesRef.current.scrollTo({
              top: (selectedMinute as HTMLElement).offsetTop - 12,
              behavior: 'smooth'
            });
          }
        }
      }, 100);
    }
  }, [isOpen, currentHour, currentMinute]);

  const handleSelectHour = (h: string) => {
    onChange(`${h}:${currentMinute}`);
  };

  const handleSelectMinute = (m: string) => {
    onChange(`${currentHour}:${m}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-[100]' : ''}`} ref={containerRef}>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {label && (
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">
          {label}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`
          relative group w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 
          flex items-center cursor-pointer transition-all duration-300 outline-none
          focus:ring-4 focus:ring-primary/10 focus:border-primary
          ${isOpen ? 'bg-white border-primary shadow-sm ring-4 ring-primary/5' : 'hover:bg-white hover:border-slate-300'}
        `}
      >
        <span className={`material-symbols-outlined mr-3 text-[20px] transition-colors duration-300 ${isOpen ? 'text-primary' : 'text-slate-400'}`}>
          {label?.toLowerCase().includes('volta') ? 'history' : 'schedule'}
        </span>
        <span className={`text-sm font-bold ${value ? 'text-slate-700' : 'text-slate-400'}`}>
          {value || '--:--'}
        </span>
      </div>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-2 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-100 z-[100] p-1.5 animate-in fade-in slide-in-from-top-2 duration-300 min-w-[200px]"
        >
          <div className="flex p-1 gap-1">
            {/* Hours Column */}
            <div 
              ref={hoursRef}
              className="flex-1 max-h-[220px] overflow-y-auto scrollbar-hide p-1 space-y-0.5"
              role="listbox"
              aria-label="Selecionar hora"
            >
              {hours.map((h) => {
                const isSelected = h === currentHour;
                return (
                  <button
                    key={h}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-hour={h}
                    onClick={() => handleSelectHour(h)}
                    className={`
                      w-full py-2.5 rounded-xl text-xs transition-all duration-200 flex items-center justify-center
                      ${isSelected 
                        ? 'bg-slate-900 text-white font-bold shadow-md' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}
                    `}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <div className="w-[1px] bg-slate-100 my-2" />

            {/* Minutes Column */}
            <div 
              ref={minutesRef}
              className="flex-1 max-h-[220px] overflow-y-auto scrollbar-hide p-1 space-y-0.5"
              role="listbox"
              aria-label="Selecionar minutos"
            >
              {minutes.map((m) => {
                const isSelected = m === currentMinute;
                return (
                  <button
                    key={m}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-minute={m}
                    onClick={() => handleSelectMinute(m)}
                    className={`
                      w-full py-2.5 rounded-xl text-xs transition-all duration-200 flex items-center justify-center
                      ${isSelected 
                        ? 'bg-slate-900 text-white font-bold shadow-md' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}
                    `}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-1.5 mt-1 border-t border-slate-50">
            <button 
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-bold hover:bg-slate-800 transition-colors uppercase tracking-widest shadow-sm"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
