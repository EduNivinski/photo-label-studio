import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface Database {
  public: {
    Tables: {
      photos: {
        Row: {
          id: string;
          url: string;
          name: string;
          upload_date: string;
          labels: string[];
        };
        Insert: {
          id?: string;
          url: string;
          name: string;
          upload_date?: string;
          labels?: string[];
        };
        Update: {
          id?: string;
          url?: string;
          name?: string;
          upload_date?: string;
          labels?: string[];
        };
      };
      labels: {
        Row: {
          id: string;
          name: string;
          color: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string | null;
        };
      };
    };
  };
}