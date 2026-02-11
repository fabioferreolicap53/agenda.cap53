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
  multiSelect = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSelected = (optionValue: string) => {
    if (multiSelect && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const getLabel = () => {
    if (multiSelect && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      if (value.includes('Todos')) return 'Todos os Setores';
      if (value.length === 1) return options.find(opt => opt.value === value[0])?.label || placeholder;
      return `${value.length} Selecionados`;
    }
    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  };

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
    <div className={`relative ${className} ${isOpen ? 'z-[100]' : 'z-20'}`} ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full h-full px-5 rounded-2xl bg-white border border-[#e2e8f0]/60 
          flex items-center justify-between cursor-pointer transition-all duration-300
          ${isOpen ? 'ring-4 ring-primary/10 border-primary' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-primary/50'}
        `}
      >
        <div className="flex items-center gap-2 overflow-hidden">
            {startIcon && (
                <span className="material-symbols-outlined text-text-secondary text-lg">
                    {startIcon}
                </span>
            )}
            <span className={`font-semibold text-sm truncate ${value && (Array.isArray(value) ? value.length > 0 : value !== '') ? 'text-[#1e293b]' : 'text-gray-400'}`}>
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
          <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-2 space-y-1">
            {options.map((option) => (
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
            {options.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400 text-center italic">
                Nenhuma opção disponível
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
