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
              top: (selectedHour as HTMLElement).offsetTop - 80,
              behavior: 'smooth'
            });
          }
        }
        if (minutesRef.current) {
          const selectedMinute = minutesRef.current.querySelector(`[data-minute="${currentMinute}"]`);
          if (selectedMinute) {
            minutesRef.current.scrollTo({
              top: (selectedMinute as HTMLElement).offsetTop - 80,
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

  return (
    <div className="relative w-full" ref={containerRef}>
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
        className={`
          relative group w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 
          flex items-center cursor-pointer transition-all duration-300
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
          className="absolute top-full left-0 mt-2 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-50 z-[100] p-4 animate-in fade-in slide-in-from-top-2 duration-300 min-w-[180px]"
        >
          <div className="text-center mb-2">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Horário</span>
          </div>
          
          <div className="flex gap-2 h-48 relative">
            {/* Hours Column */}
            <div 
              ref={hoursRef}
              className="flex-1 overflow-y-auto scrollbar-hide space-y-1 py-16 px-1"
            >
              {hours.map((h) => {
                const isSelected = h === currentHour;
                return (
                  <button
                    key={h}
                    type="button"
                    data-hour={h}
                    onClick={() => handleSelectHour(h)}
                    className={`
                      w-full py-2 rounded-xl text-sm transition-all duration-300 flex items-center justify-center
                      ${isSelected 
                        ? 'bg-[#1e293b] text-white font-bold shadow-lg shadow-slate-200 scale-105 z-10' 
                        : 'text-slate-300 hover:text-slate-500 font-medium'}
                    `}
                  >
                    {h}h
                  </button>
                );
              })}
            </div>

            {/* Minutes Column */}
            <div 
              ref={minutesRef}
              className="flex-1 overflow-y-auto scrollbar-hide space-y-1 py-16 px-1"
            >
              {minutes.map((m) => {
                const isSelected = m === currentMinute;
                return (
                  <button
                    key={m}
                    type="button"
                    data-minute={m}
                    onClick={() => handleSelectMinute(m)}
                    className={`
                      w-full py-2 rounded-xl text-sm transition-all duration-300 flex items-center justify-center
                      ${isSelected 
                        ? 'bg-[#1e293b] text-white font-bold shadow-lg shadow-slate-200 scale-105 z-10' 
                        : 'text-slate-300 hover:text-slate-500 font-medium'}
                    `}
                  >
                    {m}m
                  </button>
                );
              })}
            </div>

            {/* Selection indicators */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          </div>

          <button 
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full mt-3 py-2.5 rounded-xl bg-slate-50 text-slate-500 text-[10px] font-bold hover:bg-slate-100 transition-colors uppercase tracking-widest"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
