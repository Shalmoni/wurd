export const levelDefinitions = [
  { level: 1, threshold: 0, reward: 'Core Wurd' },
  { level: 2, threshold: 100, reward: 'New fonts' },
  { level: 3, threshold: 300, reward: 'Emoji picker' },
  { level: 4, threshold: 600, reward: 'More colors' },
  { level: 5, threshold: 1000, reward: 'Profile photo' },
  { level: 6, threshold: 1500, reward: '3 more fonts' },
  { level: 7, threshold: 2200, reward: 'Full color spectrum' },
  { level: 8, threshold: 3000, reward: 'Any emoji' },
  { level: 9, threshold: 4000, reward: 'Wurd animations' },
  { level: 10, threshold: 5200, reward: 'More to come' },
] as const;

export function levelForXp(totalXp: number) {
  return [...levelDefinitions].reverse().find(item => totalXp >= item.threshold)?.level ?? 1;
}

export function levelProgressFor(totalXp: number, level: number) {
  const current = levelDefinitions[level - 1];
  const next = levelDefinitions[level];
  const earned = Math.max(0, totalXp - current.threshold);
  if (!next) return { earned, required: earned, remaining: 0, percent: 100 };
  const required = next.threshold - current.threshold;
  return { earned, required, remaining: Math.max(0, required - earned), percent: Math.min(100, Math.max(0, (earned / required) * 100)) };
}
