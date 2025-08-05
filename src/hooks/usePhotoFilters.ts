import { useState, useMemo } from 'react';
import type { Photo, PhotoFilters } from '@/types/photo';

export function usePhotoFilters(photos: Photo[]) {
  const [filters, setFilters] = useState<PhotoFilters>({
    labels: [],
    searchTerm: '',
    showUnlabeled: false,
    fileTypes: ['RAW', 'JPEG', 'PNG', 'MP4', 'MOV', 'AVI'],
    mediaTypes: ['photo', 'video'],
    sortBy: 'date-desc'
  });
  const [filterMode, setFilterMode] = useState<'AND' | 'OR'>('AND');

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Filter by search term
      const matchesSearch = filters.searchTerm === '' || 
        photo.name.toLowerCase().includes(filters.searchTerm.toLowerCase());

      // Filter by labels (always use AND logic - intersection)
      let matchesLabels = true;
      if (filters.labels.length > 0) {
        // ALL selected labels must be present
        matchesLabels = filters.labels.every(labelId => photo.labels.includes(labelId));
      }

      // Filter by unlabeled
      let matchesUnlabeled = true;
      if (filters.showUnlabeled) {
        matchesUnlabeled = photo.labels.length === 0;
      }

      return matchesSearch && matchesLabels && matchesUnlabeled;
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

  const toggleUnlabeled = () => {
    setFilters(prev => ({ ...prev, showUnlabeled: !prev.showUnlabeled }));
  };

  const clearFilters = () => {
    setFilters({ 
      labels: [], 
      searchTerm: '', 
      showUnlabeled: false,
      fileTypes: ['RAW', 'JPEG', 'PNG', 'MP4', 'MOV', 'AVI'],
      mediaTypes: ['photo', 'video'],
      sortBy: 'date-desc'
    });
    // Resetar para mostrar clusters novamente
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('resetClusters'));
    }
  };

  return {
    filters,
    filteredPhotos,
    updateSearchTerm,
    toggleLabel,
    toggleUnlabeled,
    clearFilters
  };
}