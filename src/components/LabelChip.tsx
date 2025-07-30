import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Label } from '@/types/photo';

interface LabelChipProps {
  label: Label;
  isSelected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  variant?: 'filter' | 'tag';
  showCount?: number;
}

export function LabelChip({ 
  label, 
  isSelected = false, 
  onClick, 
  onRemove, 
  variant = 'filter',
  showCount
}: LabelChipProps) {
  const chipStyle = label.color ? { 
    backgroundColor: isSelected ? label.color : `${label.color}20`,
    borderColor: label.color,
    color: isSelected ? '#ffffff' : label.color
  } : undefined;

  return (
    <Badge
      variant={isSelected ? "default" : "secondary"}
      className={`
        cursor-pointer transition-all duration-200 hover:scale-105
        ${variant === 'filter' ? 'border' : ''}
        ${isSelected ? 'shadow-sm' : 'hover:bg-label-background'}
      `}
      style={chipStyle}
      onClick={onClick}
    >
      {label.name}
      {showCount && <span className="ml-1 opacity-75">({showCount})</span>}
      {variant === 'tag' && onRemove && (
        <X 
          className="ml-1 h-3 w-3 cursor-pointer hover:bg-black/20 rounded" 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </Badge>
  );
}