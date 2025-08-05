export interface Collection {
  id: string;
  name: string;
  labels: string[];
  cover_photo_url?: string;
  created_at: string;
  updated_at: string;
}

// Keep Album as alias for backward compatibility
export type Album = Collection;