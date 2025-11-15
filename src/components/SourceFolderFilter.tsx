import { useState } from 'react';
import { FolderOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConvertFolderDialog } from './ConvertFolderDialog';

interface SourceFolderFilterProps {
  folders: string[];
  selectedFolder?: string;
  onSelectFolder: (folder: string | undefined) => void;
  onConvertFolder: (sourceFolder: string, collectionName: string) => Promise<void>;
}

export function SourceFolderFilter({ 
  folders, 
  selectedFolder, 
  onSelectFolder,
  onConvertFolder 
}: SourceFolderFilterProps) {
  const [open, setOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [folderToConvert, setFolderToConvert] = useState<string | null>(null);

  const handleClearSelection = () => {
    onSelectFolder(undefined);
    setOpen(false);
  };

  const handleSelectFolder = (folder: string) => {
    onSelectFolder(folder === selectedFolder ? undefined : folder);
    setOpen(false);
  };

  const handleConvertClick = (folder: string) => {
    setFolderToConvert(folder);
    setConvertDialogOpen(true);
  };

  const handleConvertConfirm = async (collectionName: string) => {
    if (folderToConvert) {
      await onConvertFolder(folderToConvert, collectionName);
      setConvertDialogOpen(false);
      setFolderToConvert(null);
    }
  };

  if (folders.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedFolder ? "secondary" : "outline"}
              size="sm"
              className="gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Origem no Drive</span>
              <span className="sm:hidden">Origem</span>
              {selectedFolder && (
                <Badge variant="secondary" className="ml-1 gap-1">
                  {selectedFolder}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Pasta de Origem no Drive</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gerenciado automaticamente pelo sistema
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs">
                        Somente leitura
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Esta pasta é atualizada automaticamente durante a sincronização com o Google Drive.
                        Use o botão "Converter" para criar uma collection editável.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {selectedFolder && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left px-3 py-2 text-xs"
                  onClick={handleClearSelection}
                >
                  <span className="text-muted-foreground">Limpar filtro</span>
                </Button>
              )}
              {folders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center justify-between hover:bg-accent/50 transition-colors"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 justify-start text-left px-3 py-2 text-xs ${
                      selectedFolder === folder ? 'bg-accent' : ''
                    }`}
                    onClick={() => handleSelectFolder(folder)}
                  >
                    <FolderOpen className="h-3 w-3 mr-2 text-muted-foreground" />
                    <span className="truncate">{folder}</span>
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 mr-1"
                          onClick={() => handleConvertClick(folder)}
                        >
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Converter em Collection editável</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <ConvertFolderDialog
        open={convertDialogOpen}
        onClose={() => {
          setConvertDialogOpen(false);
          setFolderToConvert(null);
        }}
        folderName={folderToConvert || ''}
        onConfirm={handleConvertConfirm}
      />
    </>
  );
}