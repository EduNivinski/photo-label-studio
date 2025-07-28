export interface Photo {
  id: string;
  url: string;
  name: string;
  uploadDate: string;
  labels: string[];
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
}