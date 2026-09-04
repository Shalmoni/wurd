import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Older implicit-flow callbacks stored tokens in the URL hash. The app now uses
// PKCE, whose callback arrives as a `?code=` query parameter. Safari can restore
// an old hash from its page history and make auth-js warn that the recovered JWT
// was "issued in the future" even though Supabase has already accepted the login.
// Remove only that obsolete callback shape before the auth client initializes.
if (typeof window !== 'undefined' && /(?:^#|&)access_token=/.test(window.location.hash)) {
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
}

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
export type WordStyle = 'bold' | 'serif';

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
  level: 1 | 2 | 3 | 4;
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
  word_style: WordStyle;
  local_date: string;
  created_at: string;
  echo_count: number;
  spoke_count: number;
  echoed_by_me: boolean;
};
