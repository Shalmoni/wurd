export type ReplyBox = { x: number; y: number; width: number; height: number; font: number };

// The cloud is a preview, never a reason to shrink real text below readable size.
export function cloudReplies<T extends { user_id: string }>(replies: T[], userId: string | null): T[] {
  const mine = userId ? replies.find(reply => reply.user_id === userId) : undefined;
  return [...(mine ? [mine] : []), ...replies.filter(reply => reply !== mine)].slice(0, 8);
}

export function arrangeReplies(words: string[], width: number, height: number, obstacle: ReplyBox,
  measure: (word: string, font: number) => number): (ReplyBox | null)[] {
  const occupied = [obstacle];
  const random = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  return words.slice(0, 8).map((word, index) => {
    const font = 14;
    // Includes room for the small drift animation on every edge.
    const w = measure(word, font) + 16;
    const h = font + 14;
    if (w > width || h > height) return null;
    for (let attempt = 0; attempt < 160; attempt++) {
      const seed = index * 1703 + attempt * 2;
      const x = random(seed) * (width - w);
      const y = random(seed + 1) * (height - h);
      if (occupied.some(box => x < box.x + box.width && x + w > box.x && y < box.y + box.height && y + h > box.y)) continue;
      const position = { x, y, width: w, height: h, font };
      occupied.push(position);
      return position;
    }
    return null;
  });
}
