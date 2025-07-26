import { useState, useMemo } from 'react';
import type { Photo, PhotoFilters } from '@/types/photo';

export function usePhotoFilters(photos: Photo[]) {
  const [filters, setFilters] = useState<PhotoFilters>({
    labels: [],
    searchTerm: ''
  });

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Filter by search term
      const matchesSearch = filters.searchTerm === '' || 
        photo.name.toLowerCase().includes(filters.searchTerm.toLowerCase());

      // Filter by labels (AND logic - photo must have ALL selected labels)
      const matchesLabels = filters.labels.length === 0 ||
        filters.labels.every(labelId => photo.labels.includes(labelId));

      return matchesSearch && matchesLabels;
    });
  }, [photos, filters]);

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
    updateSearchTerm,
    toggleLabel,
    clearFilters
  };
}