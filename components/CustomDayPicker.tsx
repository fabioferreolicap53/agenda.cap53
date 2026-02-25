import React, { useState, useRef, useEffect } from 'react';

interface CustomDayPickerProps {
    value: Date;
    onChange: (date: Date) => void;
    className?: string;
    eventsByDate?: Record<string, any[]>;
}

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const CustomDayPicker: React.FC<CustomDayPickerProps> = ({ value, onChange, className = '', eventsByDate = {} }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date(value));
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Update viewDate when value changes externally (if not open)
    useEffect(() => {
        if (!isOpen) {
            setViewDate(new Date(value));
        }
    }, [value, isOpen]);

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleSelectDate = (date: Date) => {
        onChange(date);
        setIsOpen(false);
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        const days = [];

        // Previous month days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthDays - i);
            days.push(
                <button
                    key={`prev-${i}`}
                    onClick={() => handleSelectDate(d)}
                    className="h-8 w-8 flex items-center justify-center text-[10px] text-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                    {prevMonthDays - i}
                </button>
            );
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            const isSelected = d.toDateString() === value.toDateString();
            const isToday = d.toDateString() === new Date().toDateString();
            const hasEvents = (eventsByDate[d.toDateString()] || []).length > 0;

            days.push(
                <button
                    key={`curr-${i}`}
                    onClick={() => handleSelectDate(d)}
                    className={`h-8 w-8 flex flex-col items-center justify-center text-[10px] font-bold rounded-lg transition-all duration-200 relative ${
                        isSelected 
                            ? 'bg-primary text-white shadow-md scale-110' 
                            : isToday
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <span>{i}</span>
                    {hasEvents && !isSelected && (
                        <span className={`absolute bottom-1 size-1 rounded-full ${isToday ? 'bg-primary' : 'bg-primary/40'}`}></span>
                    )}
                </button>
            );
        }

        // Next month days
        const totalSlots = 42; // 6 weeks
        const nextMonthDaysNeeded = totalSlots - days.length;
        for (let i = 1; i <= nextMonthDaysNeeded; i++) {
            const d = new Date(year, month + 1, i);
            days.push(
                <button
                    key={`next-${i}`}
                    onClick={() => handleSelectDate(d)}
                    className="h-8 w-8 flex items-center justify-center text-[10px] text-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                    {i}
                </button>
            );
        }

        return days;
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`h-full flex items-center gap-2 px-3 rounded-lg border transition-all duration-300 group ${
                    isOpen 
                        ? 'bg-white border-primary shadow-sm ring-2 ring-primary/5' 
                        : 'bg-slate-50/50 border-slate-200 hover:border-primary/30 hover:bg-white'
                }`}
            >
                <span className={`material-symbols-outlined text-[18px] transition-colors duration-300 ${isOpen ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`}>
                    calendar_month
                </span>
                <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black text-text-main uppercase tracking-widest leading-none">
                        {value.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                </div>
                <span className={`material-symbols-outlined text-[16px] transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-slate-300'}`}>
                    expand_more
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-[200] animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                    <div className="flex items-center justify-between mb-4">
                        <button 
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-primary"
                        >
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </div>
                        <button 
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-primary"
                        >
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAYS_SHORT.map(day => (
                            <div key={day} className="h-8 flex items-center justify-center text-[9px] font-black text-slate-400 uppercase">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {renderCalendar()}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between">
                        <button 
                            onClick={() => handleSelectDate(new Date())}
                            className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline"
                        >
                            Hoje
                        </button>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomDayPicker;
