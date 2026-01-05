import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Theater = {
  id: string;
  name: string;
  chain: string;
  latitude: number;
  longitude: number;
  address: string;
  created_at: string;
};

export type Movie = {
  id: string;
  title: string;
  poster_url: string;
  duration: number;
  genre: string;
  ranking?: number;
  rating?: number;
  created_at: string;
};

export type Showtime = {
  id: string;
  theater_id: string;
  movie_id: string;
  showtime: string;
  screen: string;
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
