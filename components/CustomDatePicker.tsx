import React, { useState, useEffect, useRef } from 'react';

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

const DAYS_OF_WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label,
  required = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  
  // State for calendar navigation
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [inputValue, setInputValue] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);
  
  // Track cursor position to restore it after formatting
  const [cursorPos, setCursorPos] = useState<number | null>(null);

  useEffect(() => {
    if (cursorPos !== null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorPos, cursorPos);
      setCursorPos(null);
    }
  }, [inputValue, cursorPos]);

  // Helper to format date for display/input
  const formatDisplayDate = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return '';
    }
  };

  // Initialize from value or current date
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        if (!isOpen) {
          setViewDate(date);
        }
        setInputValue(formatDisplayDate(value));
      }
    } else {
        setInputValue('');
    }
  }, [value, isOpen]);

  // Parse input string to Date
  const parseDateString = (str: string): Date | null => {
    // Expected format: DD/MM/YYYY HH:mm
    if (!str || str.length < 10) return null;

    const parts = str.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '00:00';
    
    const dateParts = datePart.split('/');
    if (dateParts.length !== 3) return null;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    
    // Basic validation
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (year < 1900 || year > 2100) return null;
    if (month < 0 || month > 11) return null;
    if (day < 1 || day > 31) return null;

    const timeParts = timePart.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;
    
    const date = new Date(year, month, day, hours, minutes);
    
    // Final check for date validity (e.g. Feb 30th)
    if (isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() !== month) return null;
    
    return date;
  };

  const toUTCISOString = (date: Date) => {
    return date.toISOString();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const selectionStart = inputRef.current?.selectionStart || 0;
    const separators = [2, 5, 10, 13];

    if (e.key === 'Enter') {
      e.preventDefault(); // Evita submeter o formulário
      const date = parseDateString(inputValue);
      if (date) {
        onChange(toUTCISOString(date));
        setIsOpen(false);
        setIsInvalid(false);
        
        // Mover para o próximo campo de forma robusta
        const form = (e.target as HTMLInputElement).form;
        if (form) {
          const elements = Array.from(form.elements).filter(el => {
            const htmlEl = el as HTMLElement;
            return !htmlEl.hasAttribute('disabled') && 
                   htmlEl.tagName !== 'FIELDSET' && 
                   (htmlEl as any).type !== 'hidden' &&
                   htmlEl.tabIndex !== -1 &&
                   htmlEl.offsetParent !== null;
          });
          
          const index = elements.indexOf(e.target as any);
          if (index > -1 && elements[index + 1]) {
            (elements[index + 1] as HTMLElement).focus();
          }
        }
      } else {
        if (inputValue.trim() === '' || inputValue === '  /  /        :  ') {
          setIsOpen(false);
          setIsInvalid(false);
        } else {
          setIsInvalid(true);
        }
      }
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      let prevPos = selectionStart - 1;
      if (prevPos < 0) return;

      // Se estivermos logo após um separador, queremos apagar o dígito antes dele
      if (separators.includes(prevPos)) {
        prevPos--;
      }
      if (prevPos < 0) return;

      const currentText = inputValue.split('');
      if (currentText.length < 16) {
        // Inicializa se necessário
        const fullMask = '  /  /        :  '.split('');
        for (let i = 0; i < currentText.length; i++) fullMask[i] = currentText[i];
        currentText.splice(0, currentText.length, ...fullMask);
      }

      currentText[prevPos] = ' ';
      const newFormatted = currentText.join('').substring(0, 16);
      setInputValue(newFormatted);
      setCursorPos(prevPos);
      
      // Validação
      const digitsOnly = newFormatted.replace(/\D/g, '');
      if (digitsOnly.length === 0) {
        onChange('');
        setIsInvalid(false);
      }
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      let currentPos = selectionStart;
      if (currentPos >= 16) return;

      // Se estivermos em cima de um separador, apagamos o próximo dígito
      if (separators.includes(currentPos)) {
        currentPos++;
      }
      if (currentPos >= 16) return;

      const currentText = inputValue.split('');
      if (currentText.length < 16) {
        const fullMask = '  /  /        :  '.split('');
        for (let i = 0; i < currentText.length; i++) fullMask[i] = currentText[i];
        currentText.splice(0, currentText.length, ...fullMask);
      }

      currentText[currentPos] = ' ';
      const newFormatted = currentText.join('').substring(0, 16);
      setInputValue(newFormatted);
      setCursorPos(currentPos);
      return;
    }

    // Se for um dígito numérico
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      let currentPos = selectionStart;

      // Se estiver exatamente em cima de um separador, pula para o próximo dígito
      if (separators.includes(currentPos)) {
        currentPos++;
      }

      if (currentPos >= 16) return;

      let currentText = inputValue.split('');
      if (currentText.length < 16) {
        const fullMask = '  /  /        :  '.split('');
        for (let i = 0; i < currentText.length; i++) fullMask[i] = currentText[i];
        currentText = fullMask;
      }
      
      currentText[currentPos] = e.key;
      
      // Re-garantir separadores
      currentText[2] = '/';
      currentText[5] = '/';
      currentText[10] = ' ';
      currentText[13] = ':';

      const newFormatted = currentText.join('').substring(0, 16);
      setInputValue(newFormatted);

      let nextPos = currentPos + 1;
      if (separators.includes(nextPos)) {
        nextPos++;
      }
      setCursorPos(nextPos);

      const digitsOnly = newFormatted.replace(/\D/g, '');
      if (digitsOnly.length >= 8) {
        const date = parseDateString(newFormatted);
        if (date) {
          onChange(toUTCISOString(date));
          if (!isOpen) setViewDate(date);
          setIsInvalid(false);
        } else {
          setIsInvalid(true);
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Se o valor está vazio, limpa tudo
    if (!rawValue) {
      setInputValue('');
      onChange('');
      setIsInvalid(false);
      return;
    }

    // Se a mudança foi uma deleção (Backspace/Delete)
    if (rawValue.length < inputValue.length) {
      // Simplesmente aceitamos a deleção, mas podemos querer re-aplicar a máscara
      // Para manter a "ordem lógica", se o usuário apagar, deixamos ele apagar livremente
      // e o formatador cuidará de manter o que sobrar.
      const digits = rawValue.replace(/\D/g, '').substring(0, 12);
      let formatted = '';
      if (digits.length > 0) {
        formatted += digits.substring(0, 2);
        if (digits.length > 2) {
          formatted += '/' + digits.substring(2, 4);
          if (digits.length > 4) {
            formatted += '/' + digits.substring(4, 8);
            if (digits.length > 8) {
              formatted += ' ' + digits.substring(8, 10);
              if (digits.length > 10) {
                formatted += ':' + digits.substring(10, 12);
              }
            }
          }
        }
      }
      setInputValue(formatted);
      
      if (digits.length >= 8) {
        const date = parseDateString(formatted);
        if (date) {
          onChange(toUTCISOString(date));
          setIsInvalid(false);
        } else {
          setIsInvalid(true);
        }
      } else {
        setIsInvalid(false);
      }
      return;
    }

    // Para colagem (paste) ou outros casos não tratados pelo onKeyDown
    const digits = rawValue.replace(/\D/g, '').substring(0, 12);
    let formatted = '';
    if (digits.length > 0) {
      formatted += digits.substring(0, 2);
      if (digits.length > 2) {
        formatted += '/' + digits.substring(2, 4);
        if (digits.length > 4) {
          formatted += '/' + digits.substring(4, 8);
          if (digits.length > 8) {
            formatted += ' ' + digits.substring(8, 10);
            if (digits.length > 10) {
              formatted += ':' + digits.substring(10, 12);
            }
          }
        }
      }
    }
    setInputValue(formatted);
    
    if (digits.length >= 8) {
      const date = parseDateString(formatted);
      if (date) {
        onChange(toUTCISOString(date));
        setIsInvalid(false);
      } else {
        setIsInvalid(true);
      }
    }
  };


  // Auto-scroll time columns
  useEffect(() => {
    if (isOpen) {
      const scrollTime = () => {
        if (hoursRef.current) {
          const selectedHour = hoursRef.current.querySelector('[data-selected="true"]');
          if (selectedHour) {
            hoursRef.current.scrollTo({
              top: (selectedHour as HTMLElement).offsetTop - 100,
              behavior: 'smooth'
            });
          }
        }
        if (minutesRef.current) {
          const selectedMinute = minutesRef.current.querySelector('[data-selected="true"]');
          if (selectedMinute) {
            minutesRef.current.scrollTo({
              top: (selectedMinute as HTMLElement).offsetTop - 100,
              behavior: 'smooth'
            });
          }
        }
      };
      // Delay slightly to ensure DOM is ready
      const timer = setTimeout(scrollTime, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  // Calendar Logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const currentVal = value ? new Date(value) : new Date();
    // Keep time from current value or default to current time
    const hours = currentVal.getHours();
    const minutes = currentVal.getMinutes();
    
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, hours, minutes);
    
    // Format to local ISO string equivalent (YYYY-MM-DDTHH:mm)
    const isoLocal = toUTCISOString(newDate);
    onChange(isoLocal);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', val: number) => {
    const currentVal = value ? new Date(value) : new Date();
    const newDate = new Date(currentVal);
    
    if (type === 'hours') newDate.setHours(val);
    else newDate.setMinutes(val);
    
    onChange(toUTCISOString(newDate));
  };


  // Render Calendar Grid
  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
    const days = [];

    // Empty slots for days before start of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = value && 
        new Date(value).getDate() === day && 
        new Date(value).getMonth() === viewDate.getMonth() && 
        new Date(value).getFullYear() === viewDate.getFullYear();

      const isToday = 
        new Date().getDate() === day &&
        new Date().getMonth() === viewDate.getMonth() &&
        new Date().getFullYear() === viewDate.getFullYear();

      days.push(
        <button
          key={day}
          onClick={(e) => { e.preventDefault(); handleDateSelect(day); }}
          className={`
            h-10 w-10 rounded-full flex items-center justify-center text-sm transition-all duration-200
            ${isSelected 
              ? 'bg-[#1e293b] text-white shadow-lg shadow-slate-200 scale-100 font-bold' 
              : isToday
                ? 'bg-slate-50 text-[#1e293b] font-bold ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-slate-50 hover:text-[#1e293b]'}
          `}
        >
          {day}
        </button>
      );
    }
    return days;
  };

  // Generate Time Options
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const allMinutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const selectedDate = value ? new Date(value) : null;
  const currentHour = selectedDate ? selectedDate.getHours() : 0;
  const currentMinute = selectedDate ? selectedDate.getMinutes() : 0;

  return (
    <div className={`relative ${className} ${isOpen ? 'z-[60]' : ''}`} ref={containerRef}>
      {/* Trigger Input */}
      <div
        className={`
          group w-full h-14 px-5 rounded-2xl bg-[#f8fafc]/50 border border-[#e2e8f0]/60 
          flex items-center justify-between transition-all duration-300 relative
          ${isOpen ? 'bg-white border-slate-300 shadow-sm' : 'hover:bg-white hover:border-slate-300'}
        `}
      >
        <div className="flex flex-col justify-center flex-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${value ? 'text-slate-400' : 'text-slate-400'}`}>
                {value ? 'Data Selecionada' : 'Definir Data'}
            </span>
            <input 
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={inputValue}
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                placeholder="DD/MM/AAAA HH:mm"
                className={`font-semibold text-sm bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300 w-full outline-none transition-colors duration-200 ${isInvalid ? 'text-red-500' : value ? 'text-[#1e293b]' : 'text-slate-400'}`}
            />
        </div>
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className={`
            size-8 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer
            ${isOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}
        `}>
            <span className="material-symbols-outlined text-lg">calendar_today</span>
        </div>
      </div>

      {/* Hidden Native Input for Validation */}
      <input 
        type="text" 
        className="sr-only" 
        required={required} 
        value={value} 
        onChange={() => {}} 
        tabIndex={-1}
      />

      {/* Popup */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-3 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100 z-50 p-6 animate-in fade-in slide-in-from-top-4 duration-300 flex flex-col md:flex-row gap-8 min-w-[380px]">
          
          {/* Calendar Section */}
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 px-1">
              <div className="flex flex-col">
                <span className="font-bold text-xl text-[#1e293b] capitalize">
                  {MONTHS[viewDate.getMonth()]}
                </span>
                <span className="text-slate-400 text-sm font-medium tracking-tight">
                  {viewDate.getFullYear()}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} className="size-9 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-[#1e293b] transition-all border border-transparent hover:border-slate-100">
                  <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>
                <button onClick={(e) => { e.preventDefault(); handleNextMonth(); }} className="size-9 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-[#1e293b] transition-all border border-transparent hover:border-slate-100">
                  <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  const today = new Date();
                  setViewDate(today);
                  handleDateSelect(today.getDate());
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                Hoje
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setViewDate(tomorrow);
                  handleDateSelect(tomorrow.getDate());
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                Amanhã
              </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 mb-4">
              {DAYS_OF_WEEK.map((d, i) => (
                <span key={i} className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] text-center">{d}</span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {renderCalendarDays()}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px bg-slate-50 self-stretch"></div>

          {/* Time Section */}
          <div className="flex flex-col w-full md:w-36">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-6 text-center">Horário</span>
            
            <div className="flex gap-2 h-[280px] relative bg-slate-50/50 rounded-2xl p-2">
                {/* Hours */}
                <div 
                  ref={hoursRef}
                  className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth no-scrollbar hover:scrollbar-visible"
                >
                    <div className="flex flex-col gap-1 pb-32">
                        {hours.map(h => {
                            const isSel = h === currentHour;
                            return (
                                <button
                                    key={h}
                                    data-selected={isSel}
                                    onClick={(e) => { e.preventDefault(); handleTimeChange('hours', h); }}
                                    className={`
                                        flex-shrink-0 h-10 w-full rounded-xl text-xs transition-all duration-200
                                        ${isSel 
                                            ? 'bg-[#1e293b] text-white font-bold shadow-md' 
                                            : 'text-slate-400 hover:text-[#1e293b] hover:bg-white hover:shadow-sm'}
                                    `}
                                >
                                    {String(h).padStart(2, '0')}h
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Minutes */}
                <div 
                  ref={minutesRef}
                  className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth no-scrollbar"
                >
                    <div className="flex flex-col gap-1 pb-32">
                        {allMinutes.map(m => {
                            const isSel = m === currentMinute;
                            return (
                                <button
                                    key={m}
                                    data-selected={isSel}
                                    onClick={(e) => { e.preventDefault(); handleTimeChange('minutes', m); }}
                                    className={`
                                        flex-shrink-0 h-10 w-full rounded-xl text-xs transition-all duration-200
                                        ${isSel 
                                            ? 'bg-[#1e293b] text-white font-bold shadow-md' 
                                            : 'text-slate-400 hover:text-[#1e293b] hover:bg-white hover:shadow-sm'}
                                    `}
                                >
                                    {String(m).padStart(2, '0')}m
                                </button>
                            );
                        })}
                    </div>
                </div>
                
                {/* Overlays for better depth */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none rounded-t-2xl"></div>
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none rounded-b-2xl"></div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
