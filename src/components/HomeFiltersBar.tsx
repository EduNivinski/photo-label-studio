import { useState } from 'react';
import { CalendarIcon, Heart, SortAsc, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { PhotoFilters } from '@/types/photo';

interface HomeFiltersBarProps {
  filters: PhotoFilters;
  showFavorites: boolean;
  onUpdateFilters: (updates: Partial<PhotoFilters>) => void;
  onToggleFavorites: () => void;
}

const sortOptions = [
  { value: 'date-desc', label: 'Data (mais recentes)' },
  { value: 'date-asc', label: 'Data (mais antigas)' },
  { value: 'name-asc', label: 'Nome (A → Z)' },
  { value: 'name-desc', label: 'Nome (Z → A)' }
];

const MONTHS = [
  { value: 0, label: 'Janeiro' },
  { value: 1, label: 'Fevereiro' },
  { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Maio' },
  { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' },
  { value: 10, label: 'Novembro' },
  { value: 11, label: 'Dezembro' }
];

export function HomeFiltersBar({ 
  filters, 
  showFavorites, 
  onUpdateFilters, 
  onToggleFavorites 
}: HomeFiltersBarProps) {
  const [dateInput, setDateInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [showMonthSelector, setShowMonthSelector] = useState(false);

  // Generate available years (from 2020 to current year + 1)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    
    // Try to parse the date input
    if (value.length >= 4) {
      const year = parseInt(value.substring(0, 4));
      if (year >= 2020 && year <= currentYear + 1) {
        onUpdateFilters({ year });
      }
    }
    
    // Try to parse full date (DD/MM/YYYY or similar formats)
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = value.match(dateRegex);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        onUpdateFilters({
          dateRange: { start: startOfDay, end: endOfDay }
        });
      }
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      onUpdateFilters({
        dateRange: { start: startOfDay, end: endOfDay }
      });
      setDateInput(format(date, 'dd/MM/yyyy'));
    } else {
      onUpdateFilters({ dateRange: undefined });
      setDateInput('');
    }
    setShowDatePicker(false);
  };

  const handleYearSelect = (year: string) => {
    const yearNum = parseInt(year);
    onUpdateFilters({ year: yearNum });
    setDateInput(year);
    setShowYearSelector(false);
  };

  const handleMonthSelect = (month: string) => {
    const monthNum = parseInt(month);
    const year = filters.year || currentYear;
    
    const startOfMonth = new Date(year, monthNum, 1);
    const endOfMonth = new Date(year, monthNum + 1, 0, 23, 59, 59, 999);
    
    onUpdateFilters({
      dateRange: { start: startOfMonth, end: endOfMonth }
    });
    
    const monthName = MONTHS[monthNum].label;
    setDateInput(`${monthName} ${year}`);
    setShowMonthSelector(false);
  };

  const clearDateFilter = () => {
    setDateInput('');
    onUpdateFilters({ 
      year: undefined, 
      dateRange: undefined 
    });
  };

  const hasDateFilter = !!filters.year || !!filters.dateRange;

  return (
    <div className="flex gap-4 p-4 bg-card border border-border rounded-lg">
      {/* Date Filter */}
      <div className="flex-1 relative">
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Filtrar por data (ano, DD/MM/AAAA)..."
            value={dateInput}
            onChange={(e) => handleDateInputChange(e.target.value)}
            className="pl-10 pr-12"
          />
          {hasDateFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDateFilter}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Date picker options */}
        <div className="absolute top-full left-0 mt-1 flex gap-2 z-10">
          {/* Calendar picker */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                Calendário
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateRange?.start}
                onSelect={handleDateSelect}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Year selector */}
          <Popover open={showYearSelector} onOpenChange={setShowYearSelector}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                Ano
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-3 gap-1">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={filters.year === year ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleYearSelect(year.toString())}
                    className="text-xs"
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Month selector */}
          {filters.year && (
            <Popover open={showMonthSelector} onOpenChange={setShowMonthSelector}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  Mês
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS.map(month => (
                    <Button
                      key={month.value}
                      variant="outline"
                      size="sm"
                      onClick={() => handleMonthSelect(month.value.toString())}
                      className="text-xs"
                    >
                      {month.label.substring(0, 3)}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Favorites Toggle */}
      <Button
        variant={showFavorites ? "default" : "outline"}
        onClick={onToggleFavorites}
        className="flex items-center gap-2"
      >
        <Heart className={`h-4 w-4 ${showFavorites ? 'fill-current' : ''}`} />
        Favoritos
      </Button>

      {/* Sort By */}
      <div className="flex items-center gap-2">
        <SortAsc className="h-4 w-4 text-muted-foreground" />
        <Select 
          value={filters.sortBy} 
          onValueChange={(value) => onUpdateFilters({ sortBy: value as PhotoFilters['sortBy'] })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}