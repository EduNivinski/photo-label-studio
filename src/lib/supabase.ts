import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Supabase project settings.');
  // Create a mock client to prevent app crash
  throw new Error('Supabase not configured. Please set up your environment variables in the Supabase integration.');
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