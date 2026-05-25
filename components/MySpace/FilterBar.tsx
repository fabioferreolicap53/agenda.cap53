import React from 'react';

interface FilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  searchTerm, 
  onSearchChange, 
  resultCount
}) => {
  return (
    <div className="relative group">
      {/* Glow effect background */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
      
      <div className="relative flex flex-col md:flex-row items-center gap-4 bg-white/80 backdrop-blur-xl p-3 sm:p-4 rounded-[1.8rem] border border-slate-200/60 shadow-xl shadow-slate-200/40">
        <div className="flex flex-1 w-full gap-3">
          <div className="relative flex-1 group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-400 group-focus-within/input:text-indigo-500 transition-colors duration-300">search</span>
            </div>
            
            <input
              type="text"
              placeholder="Buscar por título, local, natureza..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-100/50 hover:bg-slate-100 border border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl h-12 pl-12 pr-12 text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 shadow-inner"
            />

            {searchTerm && (
              <button 
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 pl-2 pr-4 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 whitespace-nowrap self-stretch md:self-auto transition-all hover:bg-indigo-50">
          <div className="flex items-center justify-center size-8 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-200">
            <span className="text-[11px] font-black text-white">
              {resultCount}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-600/80 leading-none">
              Resultados
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Encontrados
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
