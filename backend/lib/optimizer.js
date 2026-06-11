export function optimize(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return {
      optimized: '',
      originalTokens: 0,
      optimizedTokens: 0,
      savedTokens: 0,
      savingsPct: 0
    };
  }

  const fillerPhrases = [
    "could you please",
    "please could you",
    "kindly",
    "as an ai language model",
    "as a large language model",
    "i want you to",
    "i need you to",
    "i would like you to",
    "can you please",
    "would you be able to",
    "note that",
    "please note",
    "it is worth noting",
    "in order to",
    "due to the fact that"
  ];

  let cleaned = prompt;

  // 1. Remove filler phrases (case-insensitive)
  for (const phrase of fillerPhrases) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // 2. Normalize line endings and collapse 3+ newlines -> 2 newlines
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  // 3. Collapse 2+ spaces -> 1 space
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  // 4. Collapse repeated punctuation (e.g. !!, ???)
  cleaned = cleaned.replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?');

  // 5. Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  // 6. Truncate prompts over 2000 words: keep first 1800 words + "[...truncated...]" + last 200 words
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 2000) {
    const firstPart = words.slice(0, 1800).join(' ');
    const lastPart = words.slice(-200).join(' ');
    cleaned = `${firstPart} [...truncated...] ${lastPart}`;
  }

  // Calculate estimated tokens: Math.ceil(wordCount / 0.75)
  const originalWords = prompt.split(/\s+/).filter(w => w.length > 0).length;
  const optimizedWords = cleaned.split(/\s+/).filter(w => w.length > 0).length;

  const originalTokens = Math.ceil(originalWords / 0.75);
  const optimizedTokens = Math.ceil(optimizedWords / 0.75);
  const savedTokens = Math.max(0, originalTokens - optimizedTokens);
  
  const savingsPct = originalTokens > 0 
    ? parseFloat(((savedTokens / originalTokens) * 100).toFixed(2)) 
    : 0;

  return {
    optimized: cleaned,
    originalTokens,
    optimizedTokens,
    savedTokens,
    savingsPct
  };
}
