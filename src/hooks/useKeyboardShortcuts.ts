import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onManageLabels: () => void;
  onClearSelection: () => void;
  hasSelectedPhotos: boolean;
}

export function useKeyboardShortcuts({
  onSelectAll,
  onDeleteSelected,
  onManageLabels,
  onClearSelection,
  hasSelectedPhotos
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'a':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onSelectAll();
          }
          break;
        
        case 'delete':
        case 'backspace':
          if (hasSelectedPhotos) {
            event.preventDefault();
            onDeleteSelected();
          }
          break;
        
        case 'l':
          if (hasSelectedPhotos) {
            event.preventDefault();
            onManageLabels();
          }
          break;
        
        case 'escape':
          if (hasSelectedPhotos) {
            event.preventDefault();
            onClearSelection();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSelectAll, onDeleteSelected, onManageLabels, onClearSelection, hasSelectedPhotos]);
}