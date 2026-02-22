import React from 'react';

interface StatsProps {
  stats: {
    totalCreated: number;
    organizer: number;
    coorganizer: number;
    participant: number;
    invitesPending: number;
    requestsPending: number;
  };
  activeTab: 'all' | 'organizer' | 'coorganizer' | 'participant' | 'pending' | 'rejected';
  onTabChange: (tab: 'all' | 'organizer' | 'coorganizer' | 'participant' | 'pending' | 'rejected') => void;
}

export const StatsCards: React.FC<StatsProps> = ({ stats, activeTab, onTabChange }) => {
  const items = [
    { 
      id: 'all', 
      label: 'Criados', 
      value: stats.totalCreated, 
      icon: 'edit_calendar', 
      activeColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      inactiveColor: 'text-slate-500 bg-white border-slate-100 hover:border-slate-200'
    },
    { 
      id: 'organizer', 
      label: 'Organizador', 
      value: stats.organizer, 
      icon: 'assignment_ind', 
      activeColor: 'text-blue-600 bg-blue-50 border-blue-200',
      inactiveColor: 'text-slate-500 bg-white border-slate-100 hover:border-slate-200'
    },
    { 
      id: 'coorganizer', 
      label: 'Coorganizador', 
      value: stats.coorganizer, 
      icon: 'group_work', 
      activeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      inactiveColor: 'text-slate-500 bg-white border-slate-100 hover:border-slate-200'
    },
    { 
      id: 'participant', 
      label: 'Participante', 
      value: stats.participant, 
      icon: 'person', 
      activeColor: 'text-violet-600 bg-violet-50 border-violet-200',
      inactiveColor: 'text-slate-500 bg-white border-slate-100 hover:border-slate-200'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id as any)}
            className={`
              relative flex flex-col items-start p-4 rounded-2xl border transition-all duration-300 w-full text-left group
              ${isActive ? item.activeColor : item.inactiveColor}
              ${isActive ? 'shadow-sm' : 'hover:shadow-sm hover:-translate-y-0.5'}
            `}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'} transition-opacity`}>
                {item.icon}
              </span>
              {isActive && (
                <span className="flex h-2 w-2 rounded-full bg-current opacity-60 animate-pulse" />
              )}
            </div>
            
            <div className="space-y-0.5">
              <span className="text-3xl font-bold tracking-tight">
                {item.value}
              </span>
              <p className={`text-xs font-semibold uppercase tracking-wider ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                {item.label}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
