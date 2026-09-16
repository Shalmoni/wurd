import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
// The complete local product preview shares UI components, but must never
// initialize Auth, restore a live session, or call the production Data API.
const isolatedProductPreview = import.meta.env.DEV && typeof window !== 'undefined'
  && ['product', 'launch-review', 'card-review'].includes(new URLSearchParams(window.location.search).get('preview') || '');

const jwtClockRetryDelays = [600, 1400, 2800];

function wait(milliseconds: number) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function fetchWithJwtClockRetry(input: RequestInfo | URL, init?: RequestInit) {
  const reusableRequest = input instanceof Request ? input.clone() : input;
  const request = () => fetch(reusableRequest instanceof Request ? reusableRequest.clone() : reusableRequest, init);
  let response = await request();

  for (const delay of jwtClockRetryDelays) {
    if (response.status !== 401) return response;
    const errorBody = await response.clone().text();
    if (!/(?:PGRST303|JWT issued at future)/i.test(errorBody)) return response;
    await wait(delay);
    response = await request();
  }

  return response;
}

// Older implicit-flow callbacks stored tokens in the URL hash. The app now uses
// PKCE, whose callback arrives as a `?code=` query parameter. Safari can restore
// an old hash from its page history and make auth-js warn that the recovered JWT
// was "issued in the future" even though Supabase has already accepted the login.
// Remove only that obsolete callback shape before the auth client initializes.
if (!isolatedProductPreview && typeof window !== 'undefined' && /(?:^#|&)access_token=/.test(window.location.hash)) {
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

export const supabase = isSupabaseConfigured && !isolatedProductPreview
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: fetchWithJwtClockRetry,
      },
    })
  : null;

export type WordColor = 'mint' | 'blue' | 'violet' | 'coral' | 'yellow' | 'lime' | 'green' | 'cyan' | 'deepBlue' | 'magenta' | 'pink' | 'red';
export type WordStyle = 'bold' | 'serif' | 'rounded' | 'mono' | 'slab' | 'hand';

export type WurdProfile = {
  id: string;
  created_at: string;
  updated_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country_code: string | null;
  timezone: string;
  xp: number;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
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
  animation?: 'still' | 'pulse' | 'float' | 'shimmer';
  local_date: string;
  created_at: string;
  echo_count: number;
  reply_count: number;
  replies?: WurdReply[];
  spoke_count: number;
  echoed_by_me: boolean;
  my_echo_strength?: number;
};

export type WurdReply = {
  id: number;
  daily_word_id: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  word: string;
  created_at: string;
};
