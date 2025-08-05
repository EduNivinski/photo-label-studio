import { useState, useMemo } from 'react';
import type { Photo, PhotoFilters } from '@/types/photo';

export function useAdvancedFilters(photos: Photo[]) {
  const [filters, setFilters] = useState<PhotoFilters>({
    labels: [],
    searchTerm: '',
    showUnlabeled: false,
    fileTypes: ['RAW', 'JPEG', 'PNG', 'MP4', 'MOV', 'AVI'],
    mediaTypes: ['photo', 'video'],
    sortBy: 'date-desc'
  });

  const filteredPhotos = useMemo(() => {
    let filtered = photos.filter((photo) => {
      // Filter by search term
      const matchesSearch = filters.searchTerm === '' || 
        photo.name.toLowerCase().includes(filters.searchTerm.toLowerCase());

      // Filter by labels
      let matchesLabels = true;
      if (filters.labels.length > 0) {
        matchesLabels = filters.labels.every(labelId => photo.labels.includes(labelId));
      }

      // Filter by unlabeled
      let matchesUnlabeled = true;
      if (filters.showUnlabeled) {
        matchesUnlabeled = photo.labels.length === 0;
      }

      // Filter by file types
      let matchesFileType = true;
      if (filters.fileTypes.length > 0 && filters.fileTypes.length < 6) {
        const fileExtension = photo.name.split('.').pop()?.toUpperCase() || '';
        matchesFileType = filters.fileTypes.includes(fileExtension);
      }

      // Filter by media types
      let matchesMediaType = true;
      if (filters.mediaTypes.length > 0 && filters.mediaTypes.length < 2) {
        const fileExtension = photo.name.split('.').pop()?.toUpperCase() || '';
        const isVideo = ['MP4', 'MOV', 'AVI'].includes(fileExtension);
        const isPhoto = ['RAW', 'JPEG', 'JPG', 'PNG'].includes(fileExtension);
        
        if (filters.mediaTypes.includes('video') && !filters.mediaTypes.includes('photo')) {
          matchesMediaType = isVideo;
        } else if (filters.mediaTypes.includes('photo') && !filters.mediaTypes.includes('video')) {
          matchesMediaType = isPhoto;
        }
      }

      // Filter by date range
      let matchesDateRange = true;
      if (filters.dateRange?.start || filters.dateRange?.end) {
        const photoDate = new Date(photo.uploadDate);
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
        const photoYear = new Date(photo.uploadDate).getFullYear();
        matchesYear = photoYear === filters.year;
      }

      return matchesSearch && matchesLabels && matchesUnlabeled && 
             matchesFileType && matchesMediaType && matchesDateRange && matchesYear;
    });

    // Sort photos
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date-desc':
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        case 'date-asc':
          return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [photos, filters]);

  const updateFilters = (updates: Partial<PhotoFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

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

  const toggleFileType = (fileType: string) => {
    setFilters(prev => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(fileType)
        ? prev.fileTypes.filter(ft => ft !== fileType)
        : [...prev.fileTypes, fileType]
    }));
  };

  const toggleMediaType = (mediaType: string) => {
    setFilters(prev => ({
      ...prev,
      mediaTypes: prev.mediaTypes.includes(mediaType)
        ? prev.mediaTypes.filter(mt => mt !== mediaType)
        : [...prev.mediaTypes, mediaType]
    }));
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
  };

  return {
    filters,
    filteredPhotos,
    updateFilters,
    updateSearchTerm,
    toggleLabel,
    toggleFileType,
    toggleMediaType,
    clearFilters
  };
}