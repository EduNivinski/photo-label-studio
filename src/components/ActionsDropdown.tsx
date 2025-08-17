import { Plus, Upload, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ActionsDropdownProps {
  onUpload: () => void;
  onCreateLabel: () => void;
}

export function ActionsDropdown({ onUpload, onCreateLabel }: ActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="default" 
          className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Ações
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onUpload} className="gap-2">
          <Upload className="h-4 w-4" />
          Upload de Arquivos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateLabel} className="gap-2">
          <Tag className="h-4 w-4" />
          Nova Label
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}