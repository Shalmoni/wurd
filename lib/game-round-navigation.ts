type RoundState = { round: { id: string } | null; ended: boolean; my_answer: string | null; answer_count: number };

// Only skip an empty round the player did not enter. Preserve meaningful results.
export async function skipEmptyUnplayedRound<T extends RoundState>(state: T,
  acknowledge: (roundId: string) => Promise<T>, isCurrent: () => boolean = () => true): Promise<T> {
  if (!isCurrent() || !state.round || !state.ended || state.my_answer || state.answer_count !== 0) return state;
  // Acknowledge advances directly to the current round. Never loop if the server
  // has no next round or returns the same cursor.
  return acknowledge(state.round.id);
}
