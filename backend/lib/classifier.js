export function classify(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return 'simple';
  }

  const words = prompt.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const lowerPrompt = prompt.toLowerCase();

  // 1. Complex Signals
  const hasCodeBlock = prompt.includes('```');
  
  const complexKeywords = [
    'analyze', 'explain', 'compare', 'evaluate', 'design', 
    'architect', 'implement', 'debug', 'refactor', 'optimize', 
    'review', 'step-by-step', 'algorithm', 'database', 'api', 
    'system', 'pros and cons'
  ];
  
  let keywordCount = 0;
  for (const keyword of complexKeywords) {
    if (lowerPrompt.includes(keyword)) {
      keywordCount++;
    }
  }

  if (hasCodeBlock || wordCount > 200 || keywordCount >= 2) {
    return 'complex';
  }

  // 2. Simple Signals
  const simplePrefixes = ['what is', 'who is', 'when did', 'define', 'list', 'name'];
  const hasSimplePrefix = simplePrefixes.some(prefix => lowerPrompt.startsWith(prefix));

  if (hasSimplePrefix && wordCount < 30) {
    return 'simple';
  }

  // 3. Default
  return wordCount < 30 ? 'simple' : 'complex';
}
