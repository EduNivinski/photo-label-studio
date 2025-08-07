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
  const [showFavorites, setShowFavorites] = useState(false);
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
        matchesUnlabeled = photo.labels.filter(label => label !== 'favorites').length === 0;
      }

      // Filter by favorites
      let matchesFavorites = true;
      if (showFavorites) {
        matchesFavorites = photo.labels.includes('favorites');
      }

      return matchesSearch && matchesLabels && matchesUnlabeled && matchesFavorites;
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

  const toggleFavorites = () => {
    setShowFavorites(prev => !prev);
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
    setShowFavorites(false);
    // Resetar para mostrar clusters novamente
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('resetClusters'));
    }
  };

  return {
    filters,
    filteredPhotos,
    showFavorites,
    updateSearchTerm,
    toggleLabel,
    toggleUnlabeled,
    toggleFavorites,
    clearFilters
  };
}