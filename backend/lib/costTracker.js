export function calculate({ promptTokens, completionTokens, costPer1kTokens }) {
  const promptTokensCount = promptTokens || 0;
  const completionTokensCount = completionTokens || 0;
  const totalTokens = promptTokensCount + completionTokensCount;

  const ratePerToken = (costPer1kTokens || 0) / 1000;
  const baselineRatePerToken = 0.005 / 1000; // GPT-4o baseline is $0.005 / 1k tokens

  const actualCostUsd = parseFloat((totalTokens * ratePerToken).toFixed(8));
  const baselineCostUsd = parseFloat((totalTokens * baselineRatePerToken).toFixed(8));

  const savedCostUsd = parseFloat(Math.max(0, baselineCostUsd - actualCostUsd).toFixed(8));

  const savingsPct = baselineCostUsd > 0
    ? parseFloat(((savedCostUsd / baselineCostUsd) * 100).toFixed(2))
    : 0;

  return {
    totalTokens,
    baselineCostUsd,
    actualCostUsd,
    savedCostUsd,
    savingsPct
  };
}
