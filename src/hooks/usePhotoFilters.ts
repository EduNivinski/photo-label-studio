import { useState, useMemo } from 'react';
import type { Photo, PhotoFilters } from '@/types/photo';

export function usePhotoFilters(photos: Photo[]) {
  const [filters, setFilters] = useState<PhotoFilters>({
    labels: [],
    searchTerm: ''
  });
  const [filterMode, setFilterMode] = useState<'AND' | 'OR'>('AND');

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Filter by search term
      const matchesSearch = filters.searchTerm === '' || 
        photo.name.toLowerCase().includes(filters.searchTerm.toLowerCase());

      // Filter by labels
      let matchesLabels = true;
      if (filters.labels.length > 0) {
        if (filterMode === 'AND') {
          // ALL selected labels must be present
          matchesLabels = filters.labels.every(labelId => photo.labels.includes(labelId));
        } else {
          // ANY selected label must be present
          matchesLabels = filters.labels.some(labelId => photo.labels.includes(labelId));
        }
      }

      return matchesSearch && matchesLabels;
    });
  }, [photos, filters, filterMode]);

  const updateSearchTerm = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, searchTerm }));
  };

  const toggleLabel = (labelId: string) => {
    setFilters(prev => ({
      ...prev,
      labels: prev.labels.includes(labelId)
        ? prev.labels.filter(id => id !== labelId)
        : [...prev.labels, labelId]
    }));
  };

  const clearFilters = () => {
    setFilters({ labels: [], searchTerm: '' });
  };

  return {
    filters,
    filteredPhotos,
    filterMode,
    updateSearchTerm,
    toggleLabel,
    clearFilters,
    setFilterMode
  };
}