import { useState, useCallback } from 'react';
import type { Photo } from '@/types/photo';

export function usePhotoSelection() {
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((photoId: string) => {
    return selectedPhotoIds.has(photoId);
  }, [selectedPhotoIds]);

  const toggleSelection = useCallback((photoId: string, isShiftPressed = false, allPhotos: Photo[] = []) => {
    setSelectedPhotoIds(prev => {
      const newSelection = new Set(prev);
      
      if (isShiftPressed && prev.size > 0 && allPhotos.length > 0) {
        // Shift + click: select range
        const sortedPhotos = [...allPhotos];
        const lastSelectedId = Array.from(prev).pop();
        const lastSelectedIndex = sortedPhotos.findIndex(p => p.id === lastSelectedId);
        const currentIndex = sortedPhotos.findIndex(p => p.id === photoId);
        
        if (lastSelectedIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastSelectedIndex, currentIndex);
          const end = Math.max(lastSelectedIndex, currentIndex);
          
          for (let i = start; i <= end; i++) {
            newSelection.add(sortedPhotos[i].id);
          }
        }
      } else {
        // Regular click: toggle individual selection
        if (newSelection.has(photoId)) {
          newSelection.delete(photoId);
        } else {
          newSelection.add(photoId);
        }
      }
      
      return newSelection;
    });
  }, []);

  const selectAll = useCallback((photos: Photo[]) => {
    setSelectedPhotoIds(new Set(photos.map(p => p.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPhotoIds(new Set());
  }, []);

  const getSelectedPhotos = useCallback((allPhotos: Photo[]) => {
    return allPhotos.filter(photo => selectedPhotoIds.has(photo.id));
  }, [selectedPhotoIds]);

  return {
    selectedPhotoIds,
    selectedCount: selectedPhotoIds.size,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    getSelectedPhotos
  };
}