import { supabase } from './supabase';

export type CommonWurdState = {
  server_now: string;
  round: { id: string; prompt: string; starts_at: string; ends_at: string } | null;
  ended: boolean;
  my_answer: string | null;
  answer_count: number;
  results: { answer: string; count: number; usernames: string[] }[];
  points: number;
  total_points: number;
};

export async function commonWurdRequest(
  action: 'common_wurd_state' | 'submit_common_wurd' | 'acknowledge_common_wurd',
  args?: { p_round_id: string; p_answer?: string },
): Promise<CommonWurdState> {
  if (!supabase) throw new Error('Sign in to play.');
  const { data, error } = await supabase.rpc(action, args);
  if (error) throw new Error(error.message);
  if (!data || typeof data.server_now !== 'string') throw new Error('Could not load this round. Try refreshing.');
  return data as CommonWurdState;
}

export function gameCountdown(deadline: number, now: number) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
