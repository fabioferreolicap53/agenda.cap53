import React, { useState, useEffect, useRef } from 'react';

interface CustomTimePickerProps {
  value: string; // Format "HH:mm"
  onChange: (value: string) => void;
  label?: string;
  tabIndex?: number;
  placeholderTime?: string; // Add this prop
}

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  label,
  tabIndex = 0,
  placeholderTime = '08:00' // Default if not provided
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const currentHour = value ? value.split(':')[0] : placeholderTime.split(':')[0];
  const currentMinute = value ? value.split(':')[1] : placeholderTime.split(':')[1];

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
        tabIndex={tabIndex}
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

        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="ml-auto p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
            title="Limpar"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div 
            onClick={(e) => e.stopPropagation()}
            className="fixed md:absolute bottom-0 md:top-full md:bottom-auto left-0 md:left-0 right-0 md:right-auto md:translate-x-0 mt-0 md:mt-2 bg-white/95 backdrop-blur-xl rounded-t-[32px] md:rounded-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.04)] md:shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-t md:border border-slate-200/50 z-[100] p-4 md:p-1.5 animate-in slide-in-from-bottom-full md:slide-in-from-top-2 fade-in duration-300 w-full md:w-auto md:min-w-[240px] overflow-hidden"
          >
            {/* Mobile Handle */}
            <div className="w-10 h-1 bg-slate-200/50 rounded-full mx-auto mb-4 md:hidden shrink-0" />

            <div className="flex-1 overflow-y-auto no-scrollbar min-w-0">
              <div className="flex items-center justify-between mb-3 px-2 md:hidden">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Selecionar Horário</span>
                <div className="px-2 py-0.5 bg-slate-50/50 rounded-full">
                  <span className="text-[10px] font-bold text-slate-500">{currentHour}:{currentMinute}</span>
                </div>
              </div>

              <div className="flex p-0.5 gap-2 md:gap-1 bg-slate-50/30 md:bg-transparent rounded-2xl md:rounded-none overflow-hidden">
                {/* Hours Column */}
                <div 
                  ref={hoursRef}
                  className="flex-1 max-h-[180px] md:max-h-[220px] overflow-y-auto scrollbar-hide p-1 space-y-0.5 min-w-0"
                  role="listbox"
                  aria-label="Selecionar hora"
                >
                  <div className="py-16 md:py-0 px-0.5">
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
                            w-full py-2.5 rounded-lg text-xs transition-all duration-200 flex items-center justify-center
                            ${isSelected 
                              ? 'bg-slate-800 text-white font-bold shadow-md scale-100 z-10' 
                              : 'text-slate-400 hover:bg-white hover:text-slate-800 font-medium'}
                          `}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="w-[1px] bg-slate-200/30 my-2 md:my-2 shrink-0" />

                {/* Minutes Column */}
                <div 
                  ref={minutesRef}
                  className="flex-1 max-h-[180px] md:max-h-[220px] overflow-y-auto scrollbar-hide p-1 space-y-0.5 min-w-0"
                  role="listbox"
                  aria-label="Selecionar minutos"
                >
                  <div className="py-16 md:py-0 px-0.5">
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
                            w-full py-2.5 rounded-lg text-xs transition-all duration-200 flex items-center justify-center
                            ${isSelected 
                              ? 'bg-slate-800 text-white font-bold shadow-md scale-100 z-10' 
                              : 'text-slate-400 hover:bg-white hover:text-slate-800 font-medium'}
                          `}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-0.5 md:p-1.5 mt-3 md:mt-1 border-t md:border-t border-slate-100/50 shrink-0">
              <button 
                type="button"
                onClick={() => {
                  if (!value) {
                    onChange(`${currentHour}:${currentMinute}`);
                  }
                  setIsOpen(false);
                }}
                className="w-full py-3 rounded-full bg-slate-800 text-white text-[10px] font-bold hover:bg-slate-900 transition-all uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-[0.98]"
              >
                Confirmar
              </button>
            </div>
          </div>
            
          {/* Mobile Overlay Background */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[90] md:hidden"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
};

export default CustomTimePicker;
