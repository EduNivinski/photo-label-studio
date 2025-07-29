import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const shortcuts = [
  { key: 'Ctrl + A', description: 'Selecionar todas as fotos' },
  { key: 'Delete', description: 'Deletar fotos selecionadas' },
  { key: 'L', description: 'Gerenciar labels das fotos selecionadas' },
  { key: 'Esc', description: 'Limpar seleção' },
];

export function KeyboardShortcuts() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg hover:bg-background"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium text-sm mb-2">Atalhos de Teclado:</div>
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex justify-between items-center text-xs">
                <span className="font-mono bg-muted px-1 py-0.5 rounded">
                  {shortcut.key}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {shortcut.description}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}