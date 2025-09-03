export interface Photo {
  id: string;
  url: string;
  name: string;
  uploadDate: string;
  originalDate?: string;
  labels: string[];
  alias?: string;
  mediaType: 'photo' | 'video';
}

export interface Label {
  id: string;
  name: string;
  color?: string;
}

export interface PhotoFilters {
  labels: string[];
  searchTerm: string;
  showUnlabeled: boolean;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  year?: number;
  fileTypes: string[];
  mediaTypes: string[]; // 'photo' | 'video'
  sortBy: 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
}