import { useState, useMemo } from 'react';
import type { Photo, PhotoFilters } from '@/types/photo';

export function usePhotoFilters(photos: Photo[]) {
  const [filters, setFilters] = useState<PhotoFilters>({
    labels: [],
    searchTerm: '',
    showUnlabeled: false,
    dateRange: undefined,
    year: undefined,
    fileTypes: ['RAW', 'JPEG', 'PNG', 'MP4', 'MOV', 'AVI'],
    mediaTypes: ['photo', 'video'],
    sortBy: 'date-desc'
  });
  const [showFavorites, setShowFavorites] = useState(false);
  const [filterMode, setFilterMode] = useState<'AND' | 'OR'>('AND');
  // New state for advanced filtering
  const [includedLabels, setIncludedLabels] = useState<string[]>([]);
  const [excludedLabels, setExcludedLabels] = useState<string[]>([]);

  const filteredPhotos = useMemo(() => {
    let filtered = photos.filter((photo) => {
      // Filter by search term
      const matchesSearch = filters.searchTerm === '' || 
        photo.name.toLowerCase().includes(filters.searchTerm.toLowerCase());

      // Advanced label filtering with inclusion/exclusion
      let matchesAdvancedLabels = true;
      
      // If we have included labels, photo must have ALL of them
      if (includedLabels.length > 0) {
        matchesAdvancedLabels = includedLabels.every(labelId => photo.labels.includes(labelId));
      }
      
      // If we have excluded labels, photo must NOT have ANY of them
      if (excludedLabels.length > 0 && matchesAdvancedLabels) {
        matchesAdvancedLabels = !excludedLabels.some(labelId => photo.labels.includes(labelId));
      }

      // Legacy filter by labels (keep for backward compatibility)
      let matchesLabels = true;
      if (filters.labels.length > 0) {
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

      // Filter by date range
      let matchesDateRange = true;
      if (filters.dateRange?.start || filters.dateRange?.end) {
        const photoDate = photo.originalDate ? new Date(photo.originalDate) : new Date(photo.uploadDate);
        if (filters.dateRange.start) {
          matchesDateRange = photoDate >= filters.dateRange.start;
        }
        if (filters.dateRange.end && matchesDateRange) {
          matchesDateRange = photoDate <= filters.dateRange.end;
        }
      }

      // Filter by year
      let matchesYear = true;
      if (filters.year) {
        const photoDate = photo.originalDate ? new Date(photo.originalDate) : new Date(photo.uploadDate);
        const photoYear = photoDate.getFullYear();
        matchesYear = photoYear === filters.year;
      }

      // Filter by file types - only filter if specific types are selected
      let matchesFileType = true;
      if (filters.fileTypes.length > 0 && filters.fileTypes.length < 6) { // Only filter if not all types are selected
        const photoExtension = photo.name.split('.').pop()?.toLowerCase();
        if (photoExtension) {
          matchesFileType = filters.fileTypes.some(type => 
            type.toLowerCase() === photoExtension
          );
        }
      }

      return matchesSearch && matchesAdvancedLabels && matchesLabels && matchesUnlabeled && matchesFavorites && matchesDateRange && matchesYear && matchesFileType;
    });

    // Sort photos by original date (or upload date as fallback)
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date-desc':
          const dateA_desc = a.originalDate ? new Date(a.originalDate) : new Date(a.uploadDate);
          const dateB_desc = b.originalDate ? new Date(b.originalDate) : new Date(b.uploadDate);
          return dateB_desc.getTime() - dateA_desc.getTime();
        case 'date-asc':
          const dateA_asc = a.originalDate ? new Date(a.originalDate) : new Date(a.uploadDate);
          const dateB_asc = b.originalDate ? new Date(b.originalDate) : new Date(b.uploadDate);
          return dateA_asc.getTime() - dateB_asc.getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [photos, filters, filterMode, includedLabels, excludedLabels, showFavorites]);

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

  // Advanced filtering functions
  const includeLabel = (labelId: string) => {
    setIncludedLabels(prev => 
      prev.includes(labelId) ? prev : [...prev, labelId]
    );
    // Remove from excluded if it was there
    setExcludedLabels(prev => prev.filter(id => id !== labelId));
  };

  const excludeLabel = (labelId: string) => {
    setExcludedLabels(prev => 
      prev.includes(labelId) ? prev : [...prev, labelId]
    );
    // Remove from included if it was there
    setIncludedLabels(prev => prev.filter(id => id !== labelId));
  };

  const removeLabel = (labelId: string) => {
    setIncludedLabels(prev => prev.filter(id => id !== labelId));
    setExcludedLabels(prev => prev.filter(id => id !== labelId));
  };

  // Get related labels from current filtered photos
  const getRelatedLabels = useMemo(() => {
    if (includedLabels.length === 0) return [];
    
    const labelCounts = new Map<string, number>();
    
    // Count labels from photos that match included labels
    photos.filter(photo => 
      includedLabels.every(labelId => photo.labels.includes(labelId))
    ).forEach(photo => {
      photo.labels.forEach(labelId => {
        if (!includedLabels.includes(labelId) && labelId !== 'favorites') {
          labelCounts.set(labelId, (labelCounts.get(labelId) || 0) + 1);
        }
      });
    });

    return Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .slice(0, 20) // Limit to top 20
      .map(([labelId, count]) => ({ labelId, count }));
  }, [photos, includedLabels]);

  const updateFilters = (updates: Partial<PhotoFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  const toggleFileType = (fileType: string) => {
    setFilters(prev => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(fileType)
        ? prev.fileTypes.filter(type => type !== fileType)
        : [...prev.fileTypes, fileType]
    }));
  };

  const clearFilters = () => {
    setFilters({ 
      labels: [], 
      searchTerm: '', 
      showUnlabeled: false,
      dateRange: undefined,
      year: undefined,
      fileTypes: ['RAW', 'JPEG', 'PNG', 'MP4', 'MOV', 'AVI'], // Reset to all types
      mediaTypes: ['photo', 'video'],
      sortBy: 'date-desc'
    });
    setShowFavorites(false);
    setIncludedLabels([]);
    setExcludedLabels([]);
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
    updateFilters,
    toggleLabel,
    toggleUnlabeled,
    toggleFavorites,
    toggleFileType,
    clearFilters,
    // Advanced filtering
    includedLabels,
    excludedLabels,
    includeLabel,
    excludeLabel,
    removeLabel,
    getRelatedLabels
  };
}