export interface Collection {
  id: string;
  name: string;
  cover_photo_url?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// Keep Album as alias for backward compatibility
export type Album = Collection;