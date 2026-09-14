import nspell from 'nspell';
// Import text assets rather than dictionary-en's Node-only filesystem loader.
import aff from '../node_modules/dictionary-en/index.aff?raw';
import dic from '../node_modules/dictionary-en/index.dic?raw';
import { spellingSuggestions } from './spelling-suggestions';

const spell = nspell({ aff, dic });
self.onmessage = (event: MessageEvent<{ id: number; word: string }>) => {
  const { id, word } = event.data;
  self.postMessage({ id, ...spellingSuggestions(spell, word) });
};
