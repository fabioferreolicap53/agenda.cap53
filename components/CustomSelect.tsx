import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string | string[];
  onChange: (value: any) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  startIcon?: string;
  multiSelect?: boolean;
  searchable?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  required = false,
  className = '',
  disabled = false,
  startIcon,
  multiSelect = false,
  searchable = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSelected = (optionValue: string) => {
    if (multiSelect && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const getLabel = () => {
    if (multiSelect && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      if (value.includes('Todos')) {
        const todosOption = options.find(opt => opt.value === 'Todos');
        return todosOption ? todosOption.label : 'Todos';
      }
      if (value.length === 1) return options.find(opt => opt.value === value[0])?.label || placeholder;
      return `${value.length} Selecionados`;
    }
    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  };

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) {
        setSearchTerm('');
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (optionValue: string) => {
    if (multiSelect && Array.isArray(value)) {
      let newValue: string[];
      if (optionValue === 'Todos') {
        newValue = ['Todos'];
      } else {
        newValue = value.filter(v => v !== 'Todos');
        if (newValue.includes(optionValue)) {
          newValue = newValue.filter(v => v !== optionValue);
          if (newValue.length === 0) newValue = ['Todos'];
        } else {
          newValue = [...newValue, optionValue];
        }
      }
      onChange(newValue);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className} ${isOpen ? 'z-[500]' : 'z-20'}`} ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`
          w-full h-full px-4 rounded-lg bg-white border border-gray-300 
          flex items-center justify-between cursor-pointer transition-all duration-300
          outline-none focus:ring-2 focus:ring-primary focus:border-transparent
          ${isOpen ? 'ring-2 ring-primary border-transparent' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-primary/50'}
        `}
      >
        <div className="flex items-center gap-2 overflow-hidden">
            {startIcon && (
                <span className="material-symbols-outlined text-text-secondary text-lg">
                    {startIcon}
                </span>
            )}
            <span className={`text-sm truncate ${value && (Array.isArray(value) ? value.length > 0 : value !== '') ? 'text-[#1e293b]' : 'text-gray-400'}`}>
              {getLabel()}
            </span>
        </div>
        <span className={`material-symbols-outlined text-gray-400 transition-transform duration-300 flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </div>

      {/* Hidden native select for form validation if needed */}
      <select
        value={Array.isArray(value) ? value[0] : value}
        onChange={(e) => onChange(multiSelect ? [e.target.value] : e.target.value)}
        required={required}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {isOpen && (
        <div className="absolute top-full left-0 w-full min-w-[240px] mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5">
          {searchable && (
             <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                     <span className="material-symbols-outlined text-gray-400 text-lg">search</span>
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full py-2 pl-10 pr-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()} 
                  />
                </div>
             </div>
          )}
          <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  px-4 py-2 rounded-lg cursor-pointer transition-colors duration-200
                  flex items-center justify-between
                  ${isSelected(option.value) 
                    ? 'bg-primary/5 text-primary' 
                    : 'text-slate-600 hover:bg-gray-50 hover:text-primary'}
                `}
              >
                <span className="text-sm font-medium">
                  {option.label}
                </span>
                {isSelected(option.value) && (
                  <span className="material-symbols-outlined text-lg">
                    {multiSelect ? 'check_box' : 'check'}
                  </span>
                )}
                {multiSelect && !isSelected(option.value) && (
                  <span className="material-symbols-outlined text-lg opacity-20">check_box_outline_blank</span>
                )}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400 text-center italic">
                Nenhuma opção encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
