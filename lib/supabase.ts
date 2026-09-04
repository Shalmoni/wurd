import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabaseUrl.includes('your-project-ref') &&
  !supabasePublishableKey.includes('your_key'),
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type WordColor = 'mint' | 'blue' | 'coral';

export type WurdProfile = {
  id: string;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country_code: string | null;
  timezone: string;
  xp: number;
  level: 1 | 2 | 3;
  streak_days: number;
  longest_streak: number;
  last_word_date: string | null;
};

export type FeedWord = {
  id: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country_code: string | null;
  word: string;
  emoji: string | null;
  color: WordColor;
  local_date: string;
  created_at: string;
  echo_count: number;
  spoke_count: number;
  echoed_by_me: boolean;
};
