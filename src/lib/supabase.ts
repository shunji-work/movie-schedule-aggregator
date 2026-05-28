import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type Theater = {
  id: string;
  name: string;
  chain: string;
  latitude: number;
  longitude: number;
  has_location?: boolean;
  website_url?: string;
  address: string;
  created_at: string;
};

export type Movie = {
  id: string;
  title: string;
  poster_url: string;
  poster_urls?: string[];
  duration: number;
  genre: string;
  ranking?: number;
  rating?: number;
  rating_source?: string;
  rating_url?: string;
  created_at: string;
};

export type Showtime = {
  id: string;
  theater_id: string;
  movie_id: string;
  showtime: string;
  screen: string;
  booking_url?: string;
  movie_version?: string;
  raw_movie_title?: string;
  created_at: string;
};

export type UserFavoriteTheater = {
  id: string;
  user_id: string;
  theater_id: string;
  created_at: string;
};

export type UserWatchlist = {
  id: string;
  user_id: string;
  movie_id: string;
  created_at: string;
};

export type UserWatchedMovie = {
  id: string;
  user_id: string;
  movie_id: string;
  theater_id: string | null;
  watched_at: string;
  memo: string;
  created_at: string;
};
