// F11: Documented provisional credibility formula.
// New accounts start at weight 1.00. A year of account age adds up to 0.20.
// Verified batch or verified purchase evidence would add 0.15 each.
// Neither type of verification is implemented yet, so user claims never get a bonus.
export class CredibilityCalculator {
  calculate(ageDays: number, verifiedBatch = false, verifiedPurchase = false): number {
    const days = Math.min(365, Math.max(0, ageDays));
    const weight = 1 + (days / 365) * 0.2 +
      (verifiedBatch ? 0.15 : 0) + (verifiedPurchase ? 0.15 : 0);
    return Math.round(weight * 100) / 100;
  }
}
