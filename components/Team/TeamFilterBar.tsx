import React from 'react';
import CustomSelect from '../CustomSelect';
import { SECTORS } from '../AuthContext';

interface TeamFilterBarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    showFilters: boolean;
    onToggleFilters: () => void;
    selectedSectors: string[];
    onSectorChange: (sectors: string[]) => void;
    showFavoritesOnly: boolean;
    onToggleFavoritesOnly: () => void;
}

export const TeamFilterBar: React.FC<TeamFilterBarProps> = ({
    searchTerm,
    onSearchChange,
    showFilters,
    onToggleFilters,
    selectedSectors,
    onSectorChange,
    showFavoritesOnly,
    onToggleFavoritesOnly
}) => {
    return (
        <div className="sticky -top-2 z-[99] bg-white py-3 px-4 -mx-4 md:px-0 md:mx-0 border-b border-gray-100 shadow-sm md:static md:bg-transparent md:mb-4 md:border-none md:shadow-none transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-end gap-2 md:gap-3">
                {/* Mobile Search Input */}
                <div className="md:hidden w-full relative group mb-2">
                    <span className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-primary material-symbols-outlined text-[20px] transition-colors">search</span>
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Buscar na equipe..."
                        className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all outline-none"
                    />
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto ml-auto">
                    {/* Favorites Filter Toggle */}
                    <button
                        onClick={onToggleFavoritesOnly}
                        className={`flex-none flex items-center justify-center h-10 w-10 md:h-12 md:w-12 rounded-xl border transition-all duration-200 shadow-sm ${
                            showFavoritesOnly
                                ? 'bg-rose-50 border-rose-200 text-rose-500 shadow-rose-100' 
                                : 'bg-white border-gray-200 text-slate-400 hover:text-rose-400 hover:border-rose-200 hover:bg-rose-50/50'
                        }`}
                        title={showFavoritesOnly ? "Mostrar todos" : "Mostrar apenas favoritos"}
                    >
                        <span 
                            className="material-symbols-outlined text-[20px] md:text-[24px]"
                            style={showFavoritesOnly ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                            favorite
                        </span>
                    </button>

                    {/* Mobile Filter Toggle */}
                    <button
                        onClick={onToggleFilters}
                        className={`md:hidden flex-none flex items-center justify-center h-10 w-10 rounded-xl border transition-all duration-200 shadow-sm ${
                            showFilters || (!selectedSectors.includes('Todos') && selectedSectors.length > 0)
                                ? 'bg-primary border-primary text-white shadow-primary/20' 
                                : 'bg-white border-gray-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {showFilters ? 'close' : 'filter_list'}
                        </span>
                    </button>
                </div>

                {/* Sector Filter - Collapsible on Mobile */}
                <div className={`${showFilters ? 'block' : 'hidden'} md:block w-full md:w-72 animate-in fade-in slide-in-from-top-2 duration-200`}>
                    <CustomSelect
                        value={selectedSectors}
                        onChange={onSectorChange}
                        startIcon="filter_list"
                        className="h-10 md:h-12 text-xs md:text-sm shadow-sm"
                        multiSelect={true}
                        options={[
                            { value: 'Todos', label: 'Todos os Setores' },
                            ...SECTORS.map(s => ({ value: s, label: s }))
                        ]}
                    />
                </div>
            </div>
        </div>
    );
};
