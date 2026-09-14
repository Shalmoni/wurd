const partsFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
export function israelRound(now: number) {
  const hour = 3_600_000;
  const anchor = Math.floor(now / hour) * hour;
  const boundaries: { time: number; key: string; hour: number }[] = [];
  // Resolve actual instants, rather than assuming every round lasts 12 hours.
  for (let offset = -26; offset <= 26; offset++) {
    const time = anchor + offset * hour;
    const p = Object.fromEntries(partsFormatter.formatToParts(time).map(part => [part.type, part.value]));
    if (Number(p.hour) === 3 || Number(p.hour) === 15) boundaries.push({ time, key: `${p.year}-${p.month}-${p.day}-${p.hour}`, hour: Number(p.hour) });
  }
  const start = boundaries.filter(b => b.time <= now).at(-1)!;
  const end = boundaries.find(b => b.time > now)!;
  return { id: start.key, startsAt: start.time, endsAt: end.time, revealLabel: end.hour === 15 ? '3 PM' : '3 AM' };
}
export function normalizeAnswer(input: string): string | null {
  const value = input.normalize('NFC').trim().toLowerCase().replaceAll('’', "'");
  // Validate one word, not membership in a category. Spelling is not guessed here.
  return value.length <= 30 && /^[\p{L}\p{M}]+(?:['-][\p{L}\p{M}]+)*$/u.test(value) ? value : null;
}

export function roundForReview(now: number, savedStart: string | null) {
  const start = savedStart === null ? NaN : Number(savedStart);
  // Keep the last visited round until its results have been acknowledged.
  return israelRound(Number.isFinite(start) && start > 0 && start <= now ? start : now);
}

export function menuTimeLeft(deadline: number, now: number) {
  if (now >= deadline) return 'Ended';
  const remaining = deadline - now;
  if (remaining >= 3_600_000) return `${Math.round(remaining / 3_600_000)}h left`;
  return `${Math.max(1, Math.floor(remaining / 60_000))}m left`;
}
export function answerBoard(answers: string[]) {
  const counts = new Map<string, number>();
  for (const answer of answers) counts.set(answer, (counts.get(answer) || 0) + 1);
  return [...counts].map(([answer, count]) => ({ answer, count })).sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer));
}
