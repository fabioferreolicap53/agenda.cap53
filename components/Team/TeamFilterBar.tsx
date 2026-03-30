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
        <div className="bg-white/80 backdrop-blur-md py-4 px-4 -mx-4 md:px-0 md:mx-0 border-b border-slate-100 md:bg-transparent md:border-none md:shadow-none transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search Input - Now visible on all screens */}
                <div className="relative group flex-1 max-w-md">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary material-symbols-outlined text-[22px] transition-colors">search</span>
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Buscar por nome, setor ou cargo..."
                        className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all outline-none placeholder:text-slate-400"
                    />
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Sector Filter - Desktop */}
                    <div className="hidden md:block w-72">
                        <CustomSelect
                            value={selectedSectors}
                            onChange={onSectorChange}
                            startIcon="filter_list"
                            className="h-12 text-sm shadow-sm rounded-2xl"
                            multiSelect={true}
                            options={[
                                { value: 'Todos', label: 'Todos os Setores' },
                                ...SECTORS.map(s => ({ value: s, label: s }))
                            ]}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {/* Favorites Toggle */}
                        <button
                            onClick={onToggleFavoritesOnly}
                            className={`flex items-center justify-center h-12 px-4 rounded-2xl border transition-all duration-300 gap-2 font-bold text-sm ${
                                showFavoritesOnly
                                    ? 'bg-rose-50 border-rose-200 text-rose-500 shadow-lg shadow-rose-100' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50/30'
                            }`}
                            title={showFavoritesOnly ? "Mostrar todos" : "Mostrar apenas favoritos"}
                        >
                            <span 
                                className="material-symbols-outlined text-[22px]"
                                style={showFavoritesOnly ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                                favorite
                            </span>
                            <span className="hidden sm:inline">Favoritos</span>
                        </button>

                        {/* Mobile Filter Toggle */}
                        <button
                            onClick={onToggleFilters}
                            className={`md:hidden flex items-center justify-center h-12 w-12 rounded-2xl border transition-all duration-300 ${
                                showFilters || (!selectedSectors.includes('Todos') && selectedSectors.length > 0)
                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[22px]">
                                {showFilters ? 'close' : 'tune'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Sector Filter - Collapsible */}
            <div className={`${showFilters ? 'block' : 'hidden'} md:hidden mt-4 animate-in fade-in slide-in-from-top-2 duration-300`}>
                <CustomSelect
                    value={selectedSectors}
                    onChange={onSectorChange}
                    startIcon="filter_list"
                    className="h-12 text-sm shadow-sm rounded-2xl"
                    multiSelect={true}
                    options={[
                        { value: 'Todos', label: 'Todos os Setores' },
                        ...SECTORS.map(s => ({ value: s, label: s }))
                    ]}
                />
            </div>
        </div>
    );
};
