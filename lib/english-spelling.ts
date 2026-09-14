export type SpellingReview = { known: boolean; suggestions: string[] };
let worker: Worker | null = null;
let sequence = 0;

// Suggestions stay on the device; submitted words are not sent to a spelling API.
export function checkEnglishSpelling(word: string): Promise<SpellingReview> {
  if (!worker) worker = new Worker(new URL('./english-spelling.worker.ts', import.meta.url), { type: 'module' });
  const current = worker;
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      current.removeEventListener('message', onMessage);
      current.removeEventListener('error', onError);
    };
    const onMessage = (event: MessageEvent<SpellingReview & { id: number }>) => {
      if (event.data.id !== id) return;
      cleanup(); resolve(event.data);
    };
    const onError = () => {
      cleanup(); current.terminate(); if (worker === current) worker = null;
      reject(new Error('Spelling suggestions are unavailable. Please check your answer before confirming.'));
    };
    const timer = setTimeout(onError, 15_000);
    current.addEventListener('message', onMessage);
    current.addEventListener('error', onError);
    current.postMessage({ id, word });
  });
}
