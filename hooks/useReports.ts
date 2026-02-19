import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../components/AuthContext';
import { startOfMonth, endOfMonth, subMonths, format, isWithinInterval } from 'date-fns';

import { ptBR } from 'date-fns/locale';

export interface ReportStats {
  totalEvents: number;
  activeEvents: number;
  canceledEvents: number;
  averageOccupancy: number;
  popularLocation: string;
  totalGrowth: string;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface TimeChartData {
  name: string;
  value: number;
}

export interface LocationReport {
  name: string;
  events: number;
  status: 'Ocupado' | 'Disponível';
  statusColor: 'red' | 'emerald';
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  nature: string;
  search: string;
}

export const useReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    nature: 'all',
    search: ''
  });

  const [stats, setStats] = useState<ReportStats>({
    totalEvents: 0,
    activeEvents: 0,
    canceledEvents: 0,
    averageOccupancy: 0,
    popularLocation: 'Nenhum',
    totalGrowth: '0%'
  });
  const [occupancyHistory, setOccupancyHistory] = useState<TimeChartData[]>([]);
  const [eventsBySector, setEventsBySector] = useState<ChartData[]>([]);
  const [locationDetails, setLocationDetails] = useState<LocationReport[]>([]);
  const [natures, setNatures] = useState<{ value: string; label: string }[]>([]);

  const fetchReportData = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;

    try {
      setLoading(true);

      // 1. Fetch nature options
      try {
        const types = await pb.collection('agenda_cap53_tipos_evento').getFullList({
          sort: 'name',
          filter: 'active = true'
        });
        const natureOptions = [
          { value: 'all', label: 'Todas as Naturezas' },
          ...types.map(t => ({ value: t.name, label: t.name }))
        ];
        setNatures(natureOptions);
      } catch (err) {
        console.error("Erro ao buscar tipos de evento:", err);
      }

      // 2. Build Filter String
      let filterString = '';
      if (filters.startDate && filters.endDate) {
        filterString += `date_start >= "${filters.startDate} 00:00:00" && date_start <= "${filters.endDate} 23:59:59"`;
      }
      if (filters.nature !== 'all') {
        if (filterString) filterString += ' && ';
        filterString += `nature = "${filters.nature}"`;
      }
      if (filters.search) {
        if (filterString) filterString += ' && ';
        filterString += `(title ~ "${filters.search}" || description ~ "${filters.search}" || nature ~ "${filters.search}")`;
      }

      // 2. Fetch data
      const [events, locations] = await Promise.all([
        pb.collection('agenda_cap53_eventos').getFullList({
          sort: '-date_start',
          expand: 'location',
          filter: filterString
        }),
        pb.collection('agenda_cap53_locais').getFullList()
      ]);

      // Calculate Stats
      const activeEvents = events.filter(e => e.status === 'active' || e.status === 'confirmed');
      const canceledEvents = events.filter(e => e.status === 'canceled');
      
      // For growth, we compare the current filtered period with the previous period of same length
      const currentStart = new Date(filters.startDate);
      const currentEnd = new Date(filters.endDate);
      const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
      
      const lastPeriodStart = new Date(currentStart.getTime() - diffTime);
      const lastPeriodEnd = new Date(currentEnd.getTime() - diffTime);

      const lastPeriodEvents = await pb.collection('agenda_cap53_eventos').getFullList({
        filter: `date_start >= "${format(lastPeriodStart, 'yyyy-MM-dd')} 00:00:00" && date_start <= "${format(lastPeriodEnd, 'yyyy-MM-dd')} 23:59:59"${filters.nature !== 'all' ? ` && nature = "${filters.nature}"` : ''}`
      });
      
      const currentCount = events.length;
      const lastCount = lastPeriodEvents.length;
      
      let growth = '0%';
      if (lastCount > 0) {
        const percent = ((currentCount - lastCount) / lastCount) * 100;
        growth = `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
      } else if (currentCount > 0) {
        growth = '+100%';
      }

      // Popular location
      const locationCounts: Record<string, number> = {};
      events.forEach(e => {
        const locName = e.expand?.location?.name || e.custom_location || 'Outro';
        locationCounts[locName] = (locationCounts[locName] || 0) + 1;
      });
      
      const popularLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhum';

      setStats({
        totalEvents: events.length,
        activeEvents: activeEvents.length,
        canceledEvents: canceledEvents.length,
        averageOccupancy: Math.round((activeEvents.length / (events.length || 1)) * 100),
        popularLocation,
        totalGrowth: growth
      });

      // 3. Occupancy History (Last 6 points based on period)
      // For simplicity, we keep monthly if the range is large, or daily if small
      const history: TimeChartData[] = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        const monthName = format(d, 'MMM', { locale: ptBR });
        const monthRange = { start: startOfMonth(d), end: endOfMonth(d) };
        const count = events.filter(e => {
          try {
            return isWithinInterval(new Date(e.date_start), monthRange);
          } catch {
            return false;
          }
        }).length;
        
        history.push({ name: monthName, value: count });
      }
      setOccupancyHistory(history);

      // 4. Events by Sector (Natureza)
      const sectorCounts: Record<string, number> = {};
      events.forEach(e => {
        const sector = e.nature || 'Não Definida';
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
      });
      
      const colors = ['#1C2E4A', '#456086', '#5B7DAA', '#7C97BB', '#9AB1D0'];
      setEventsBySector(Object.entries(sectorCounts).map(([name, value], i) => ({
        name,
        value,
        color: colors[i % colors.length]
      })));

      // 5. Location Details
      const details: LocationReport[] = locations.map(loc => {
        const locEvents = events.filter(e => e.location === loc.id).length;
        const isOccupied = events.some(e => {
          try {
            return e.location === loc.id && 
                   (e.status === 'active' || e.status === 'confirmed') &&
                   isWithinInterval(now, { start: new Date(e.date_start), end: new Date(e.date_end) });
          } catch {
            return false;
          }
        });

        return {
          name: loc.name,
          events: locEvents,
          status: isOccupied ? 'Ocupado' : 'Disponível',
          statusColor: isOccupied ? 'red' : 'emerald'
        };
      });
      setLocationDetails(details.sort((a, b) => b.events - a.events));

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.role, filters]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  return {
    loading,
    stats,
    filters,
    setFilters,
    occupancyHistory,
    eventsBySector,
    locationDetails,
    natures,
    refresh: fetchReportData
  };
};
