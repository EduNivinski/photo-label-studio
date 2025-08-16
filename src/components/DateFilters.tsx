import { useState, useMemo } from 'react';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { PhotoFilters, Photo } from '@/types/photo';

interface DateFiltersProps {
  photos: Photo[];
  filters: PhotoFilters;
  onUpdateFilters: (updates: Partial<PhotoFilters>) => void;
}

const MONTHS = [
  { value: 0, label: 'Jan' },
  { value: 1, label: 'Fev' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Abr' },
  { value: 4, label: 'Mai' },
  { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' },
  { value: 7, label: 'Ago' },
  { value: 8, label: 'Set' },
  { value: 9, label: 'Out' },
  { value: 10, label: 'Nov' },
  { value: 11, label: 'Dez' }
];

export function DateFilters({ photos, filters, onUpdateFilters }: DateFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Extract available years from photos
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    photos.forEach(photo => {
      const year = new Date(photo.uploadDate).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [photos]);

  const hasActiveFilters = selectedYears.length > 0 || selectedMonths.length > 0 || selectedDate;

  const toggleYear = (year: number) => {
    const newYears = selectedYears.includes(year)
      ? selectedYears.filter(y => y !== year)
      : [...selectedYears, year];
    
    setSelectedYears(newYears);
    onUpdateFilters({ 
      year: newYears.length === 1 ? newYears[0] : undefined
    });
  };

  const toggleMonth = (month: number) => {
    const newMonths = selectedMonths.includes(month)
      ? selectedMonths.filter(m => m !== month)
      : [...selectedMonths, month];
    
    setSelectedMonths(newMonths);
    
    // Update date range based on selected months and years
    if (newMonths.length > 0 && selectedYears.length > 0) {
      const startDates = [];
      const endDates = [];
      
      selectedYears.forEach(year => {
        newMonths.forEach(month => {
          startDates.push(new Date(year, month, 1));
          endDates.push(new Date(year, month + 1, 0, 23, 59, 59));
        });
      });
      
      const earliestStart = new Date(Math.min(...startDates.map(d => d.getTime())));
      const latestEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
      
      onUpdateFilters({
        dateRange: { start: earliestStart, end: latestEnd }
      });
    } else {
      onUpdateFilters({ dateRange: undefined });
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      onUpdateFilters({
        dateRange: { start: startOfDay, end: endOfDay }
      });
    } else {
      onUpdateFilters({ dateRange: undefined });
    }
  };

  const clearDateFilters = () => {
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedDate(undefined);
    onUpdateFilters({ 
      year: undefined, 
      dateRange: undefined 
    });
  };

  const getFilterSummary = () => {
    if (selectedDate) {
      return `Mostrando fotos de ${format(selectedDate, 'dd/MM/yyyy')}`;
    }
    
    if (selectedYears.length > 0 && selectedMonths.length > 0) {
      const yearText = selectedYears.length === 1 ? selectedYears[0] : `${selectedYears.length} anos`;
      const monthText = selectedMonths.length === 1 
        ? MONTHS.find(m => m.value === selectedMonths[0])?.label 
        : `${selectedMonths.length} meses`;
      return `Mostrando fotos de ${monthText} de ${yearText}`;
    }
    
    if (selectedYears.length > 0) {
      const yearText = selectedYears.length === 1 ? selectedYears[0] : `${selectedYears.length} anos`;
      return `Mostrando fotos de ${yearText}`;
    }
    
    return null;
  };

  return (
    <div className="space-y-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" />
              Filtros por Data
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  Ativos
                </Badge>
              )}
            </div>
            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4 pt-2">
          {/* Year Filter */}
          {availableYears.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-sidebar-foreground/60">Anos</label>
                {selectedYears.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedYears([]);
                      onUpdateFilters({ year: undefined });
                    }}
                    className="h-6 px-2 text-xs text-sidebar-foreground/60"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={selectedYears.includes(year) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleYear(year)}
                    className="h-7 px-3 text-xs"
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Month Filter */}
          {selectedYears.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-sidebar-foreground/60">Meses</label>
                {selectedMonths.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedMonths([]);
                      onUpdateFilters({ dateRange: undefined });
                    }}
                    className="h-6 px-2 text-xs text-sidebar-foreground/60"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MONTHS.map(month => (
                  <Button
                    key={month.value}
                    variant={selectedMonths.includes(month.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleMonth(month.value)}
                    className="h-7 px-2 text-xs"
                  >
                    {month.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Day Picker */}
          <div className="space-y-2">
            <label className="text-xs text-sidebar-foreground/60">Dia específico</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-8 text-xs",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearDateFilters}
              className="w-full h-8 text-xs"
            >
              Limpar todos os filtros de data
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Filter Summary */}
      {hasActiveFilters && getFilterSummary() && (
        <div className="text-xs text-center text-sidebar-foreground/60 bg-sidebar-accent/50 rounded-md px-3 py-2">
          {getFilterSummary()}
        </div>
      )}
    </div>
  );
}