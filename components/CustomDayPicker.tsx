import React, { useState, useRef, useEffect } from 'react';
import { useSwipe } from '../hooks/useSwipe';

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
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    // Prevent body scroll when open on mobile
    useEffect(() => {
        if (isOpen && window.innerWidth < 1024) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Update viewDate when value changes externally (if not open)
    useEffect(() => {
        if (!isOpen) {
            setViewDate(new Date(value));
        }
    }, [value, isOpen]);

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const swipeHandlers = useSwipe({
        onSwipeLeft: handleNextMonth,
        onSwipeRight: handlePrevMonth,
        rangeOffset: 40
    });

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
                    className="h-10 w-10 md:h-8 md:w-8 flex items-center justify-center text-[11px] md:text-[10px] text-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
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
                    className={`h-9 w-9 md:h-8 md:w-8 flex flex-col items-center justify-center text-[12px] md:text-[10px] font-bold rounded-xl md:rounded-lg transition-all duration-300 relative active:scale-90 ${
                        isSelected 
                            ? 'bg-[#1e293b] text-white shadow-[0_4px_12px_-2px_rgba(30,41,59,0.25)] scale-105 z-10' 
                            : isToday
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'text-slate-600 hover:bg-slate-100/80 active:bg-slate-200/50'
                    }`}
                >
                    <span className="relative z-10">{i}</span>
                    {hasEvents && !isSelected && (
                        <span className={`absolute bottom-1.5 md:bottom-1 size-1 rounded-full transition-transform duration-300 ${isToday ? 'bg-primary' : 'bg-slate-400/60'}`}></span>
                    )}
                    {isSelected && (
                        <span className="absolute inset-0 bg-white/10 rounded-xl md:rounded-lg animate-pulse"></span>
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
                    className="h-10 w-10 md:h-8 md:w-8 flex items-center justify-center text-[11px] md:text-[10px] text-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
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
                className={`h-[42px] flex items-center gap-2.5 px-5 rounded-xl border transition-all duration-300 group ${
                    isOpen 
                        ? 'bg-[#1e293b] text-white border-[#1e293b] shadow-lg shadow-slate-200' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-slate-50 shadow-sm'
                }`}
            >
                <span className={`material-symbols-outlined text-[18px] transition-colors duration-300 ${isOpen ? 'text-white' : 'text-slate-400 group-hover:text-primary'}`}>
                    calendar_month
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${isOpen ? 'text-white' : 'text-slate-700'}`}>
                    {value.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
                <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : 'text-slate-300 group-hover:text-primary'}`}>
                    expand_more
                </span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop for mobile/tablet */}
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[190] md:hidden animate-in fade-in duration-300"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    <div 
                        {...swipeHandlers}
                        className="fixed inset-x-8 top-1/2 -translate-y-1/2 md:absolute md:inset-auto md:top-full md:left-0 md:translate-y-0 mt-3 w-auto md:w-72 bg-white rounded-[28px] md:rounded-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] border border-slate-100 p-5 md:p-5 z-[9999] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 origin-center md:origin-top-left"
                    >
                        <div className="flex items-center justify-between mb-4 md:mb-4">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePrevMonth(); }}
                                className="size-9 md:size-9 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-primary active:scale-90"
                            >
                                <span className="material-symbols-outlined text-xl md:text-xl">chevron_left</span>
                            </button>
                            <div className="text-[12px] md:text-[11px] font-black uppercase tracking-[0.1em] text-slate-800">
                                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleNextMonth(); }}
                                className="size-9 md:size-9 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all text-slate-300 hover:text-primary active:scale-90"
                            >
                                <span className="material-symbols-outlined text-xl md:text-xl">chevron_right</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2 md:mb-2">
                            {DAYS_SHORT.map((day, index) => (
                                <div key={`header-${index}`} className="h-7 md:h-7 flex items-center justify-center text-[9px] md:text-[9px] font-black text-slate-200 uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {renderCalendar()}
                        </div>

                        <div className="mt-5 md:mt-5 pt-4 md:pt-4 border-t border-slate-50 flex justify-between gap-3 md:gap-3">
                            <button 
                                onClick={() => handleSelectDate(new Date())}
                                className="flex-1 py-2.5 md:py-2.5 text-[10px] md:text-[10px] font-black uppercase tracking-[0.15em] text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-[14px] md:rounded-xl transition-all active:scale-95 shadow-sm"
                            >
                                HOJE
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="flex-1 py-2.5 md:py-2.5 text-[10px] md:text-[10px] font-black uppercase tracking-[0.15em] text-slate-300 bg-slate-50/50 hover:bg-slate-50 rounded-[14px] md:rounded-xl transition-all active:scale-95 shadow-sm"
                            >
                                FECHAR
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CustomDayPicker;
