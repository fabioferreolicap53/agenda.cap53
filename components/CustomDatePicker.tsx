import React, { useState, useEffect, useRef } from 'react';

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  tabIndex?: number;
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
  className = '',
  tabIndex
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

    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

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
      days.push(<div key={`empty-${i}`} className="h-8 w-full" />);
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
          key={`day-${day}`}
          onClick={(e) => { e.preventDefault(); handleDateSelect(day); }}
          className={`
            h-8 w-full rounded-lg text-[10px] flex items-center justify-center transition-all duration-200 relative
            ${isSelected 
              ? 'bg-slate-800 text-white font-black shadow-lg shadow-slate-200 scale-105 z-10' 
              : isToday
                ? 'bg-slate-100 text-slate-900 font-black'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 font-bold'}
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
    <div className={`relative ${className} ${isOpen ? 'z-[100]' : ''}`} ref={containerRef}>
      {/* Trigger Input */}
      <div 
        className="group w-full flex items-center gap-2 px-3.5 py-3 bg-white border border-slate-200 rounded-2xl hover:border-slate-400 focus-within:border-slate-800 focus-within:ring-4 focus-within:ring-slate-50 transition-all duration-300"
      >
        <div className="flex-1 min-w-0">
            <input 
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={inputValue}
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                placeholder="DD/MM/AAAA HH:mm"
                tabIndex={tabIndex}
                className={`font-bold text-[13px] bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300 w-full outline-none transition-colors duration-200 ${isInvalid ? 'text-red-500' : value ? 'text-slate-800' : 'text-slate-400'}`}
            />
        </div>

        {value && (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                }}
                className="p-1 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                title="Limpar"
            >
                <span className="material-symbols-outlined text-[17px]">close</span>
            </button>
        )}

        <div 
            onClick={() => setIsOpen(!isOpen)}
            className={`
            size-7 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer
            ${isOpen ? 'bg-slate-800 text-white rotate-90 shadow-lg shadow-slate-200' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}
        `}>
            <span className="material-symbols-outlined text-base">calendar_today</span>
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
        <>
          <div 
            role="dialog"
            aria-label="Calendário e seletor de horário"
            className="fixed md:absolute bottom-0 md:top-[calc(100%+8px)] md:bottom-auto left-0 md:left-0 right-0 md:right-auto md:translate-x-0 bg-white/95 backdrop-blur-xl rounded-t-[32px] md:rounded-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.04)] md:shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-t md:border border-slate-200/50 z-[110] p-4 md:p-5 animate-in slide-in-from-bottom-full md:slide-in-from-top-4 fade-in duration-300 flex flex-col md:flex-row gap-3 md:gap-6 w-full md:w-[480px] max-h-[90vh] md:max-h-none overflow-hidden"
          >
            {/* Mobile Handle */}
            <div className="w-10 h-1 bg-slate-200/50 rounded-full mx-auto mb-3 md:hidden shrink-0" />
            
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col md:flex-row gap-3 md:gap-6">
              {/* Calendar Section */}
              <div className="flex-[1.2] min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg text-slate-800 tracking-tight capitalize">
                      {MONTHS[viewDate.getMonth()]}
                    </span>
                    <span className="text-slate-400 text-[10px] font-medium tracking-wider">
                      {viewDate.getFullYear()}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} className="size-8 flex items-center justify-center hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-800 transition-all">
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <button onClick={(e) => { e.preventDefault(); handleNextMonth(); }} className="size-8 flex items-center justify-center hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-800 transition-all">
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-0.5">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const today = new Date();
                      setViewDate(today);
                      handleDateSelect(today.getDate());
                    }}
                    className="px-3 py-1.5 rounded-full bg-slate-50 text-slate-500 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-colors whitespace-nowrap"
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
                    className="px-3 py-1.5 rounded-full bg-slate-50 text-slate-500 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    Amanhã
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <div key={i} className="h-7 flex items-center justify-center text-[9px] font-medium text-slate-400 uppercase tracking-widest">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {renderCalendarDays()}
                </div>
              </div>

              {/* Time Section */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horário</span>
                  {value && (
                    <div className="px-2 py-0.5 bg-slate-50 rounded-full">
                      <span className="text-[10px] font-bold text-slate-500">
                        {String(currentHour).padStart(2, '0')}:{String(currentMinute).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 h-[180px] md:h-[220px] relative bg-slate-50/30 rounded-2xl p-1 overflow-hidden">
                {/* Hours */}
                <div 
                  ref={hoursRef}
                  className="flex-1 overflow-y-auto scroll-smooth no-scrollbar"
                >
                  <div className="flex flex-col gap-0.5 py-16 md:py-12 px-0.5">
                      {hours.map(h => {
                        const isSel = h === currentHour;
                        return (
                          <button
                            key={h}
                            data-selected={isSel}
                            onClick={(e) => { e.preventDefault(); handleTimeChange('hours', h); }}
                            className={`
                              flex-shrink-0 h-9 w-full rounded-lg text-xs transition-all duration-300
                              ${isSel 
                                ? 'bg-slate-800 text-white font-bold shadow-md scale-100 z-10' 
                                : 'text-slate-400 font-medium hover:text-slate-800 hover:bg-white'}
                            `}
                          >
                            {String(h).padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="w-[1px] bg-slate-200/50 my-2 shrink-0" />

                  {/* Minutes */}
                <div 
                  ref={minutesRef}
                  className="flex-1 overflow-y-auto scroll-smooth no-scrollbar"
                >
                  <div className="flex flex-col gap-0.5 py-16 md:py-12 px-0.5">
                      {allMinutes.map(m => {
                        const isSel = m === currentMinute;
                        return (
                          <button
                            key={m}
                            data-selected={isSel}
                            onClick={(e) => { e.preventDefault(); handleTimeChange('minutes', m); }}
                            className={`
                              flex-shrink-0 h-9 w-full rounded-lg text-xs transition-all duration-300
                              ${isSel 
                                ? 'bg-slate-800 text-white font-bold shadow-md scale-100 z-10' 
                                : 'text-slate-400 font-medium hover:text-slate-800 hover:bg-white'}
                            `}
                          >
                            {String(m).padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                    
                    {/* Overlays for better depth */}
                    <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-slate-50/50 to-transparent pointer-events-none rounded-t-2xl"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-50/50 to-transparent pointer-events-none rounded-b-2xl"></div>
                    
                    {/* Center Indicator */}
                    <div className="absolute top-1/2 left-1 right-1 h-9 -translate-y-1/2 border-y border-slate-200/30 pointer-events-none"></div>
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <div className="mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-slate-100 shrink-0">
              <button 
                onClick={(e) => { e.preventDefault(); setIsOpen(false); }}
                className="w-full py-3.5 md:py-3 rounded-2xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition-all uppercase tracking-widest shadow-lg shadow-slate-200 active:scale-[0.98]"
              >
                Confirmar
              </button>
            </div>
          </div>

          {/* Mobile Overlay Background */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] md:hidden"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
};

export default CustomDatePicker;
