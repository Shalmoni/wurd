type Dictionary = { correct: (word: string) => boolean; suggest: (word: string) => string[] };

export function spellingSuggestions(dictionary: Dictionary, word: string) {
  const known = dictionary.correct(word);
  if (known) return { known, suggestions: [] as string[] };
  const swapped = new Set<string>();
  const swaps = (value: string) => Array.from({ length: Math.max(0, value.length - 1) }, (_, i) =>
    value.slice(0, i) + value[i + 1] + value[i] + value.slice(i + 2));
  // Supplement Hunspell for transposed letters, e.g. organe → orange.
  // These candidates still have to be real English words, never category guesses.
  if (/^[a-z]{1,30}$/.test(word)) {
    for (const candidate of swaps(word)) {
      if (dictionary.correct(candidate)) swapped.add(candidate);
      for (const second of swaps(candidate)) if (second !== word && dictionary.correct(second)) swapped.add(second);
    }
  }
  const suggestions = [...new Set([...swapped, ...dictionary.suggest(word)].map(value => value.toLowerCase()))]
    .filter(value => value !== word && /^[a-z]+(?:['-][a-z]+)*$/.test(value)).slice(0, 3);
  return { known, suggestions };
}
