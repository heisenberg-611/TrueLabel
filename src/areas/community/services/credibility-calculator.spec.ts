import { CredibilityCalculator } from './credibility-calculator';

describe('CredibilityCalculator (F11)', () => {
  const calc = new CredibilityCalculator();

  it('starts a new unverified consumer at 1.00', () => {
    expect(calc.calculate(0)).toBe(1);
  });

  it('adds no more than 0.20 for account age', () => {
    expect(calc.calculate(365)).toBe(1.2);
    expect(calc.calculate(3000)).toBe(1.2);
    expect(calc.calculate(-10)).toBe(1);
  });

  it('adds evidence weight only for verified evidence', () => {
    expect(calc.calculate(365, true, true)).toBe(1.5);
    expect(calc.calculate(365, false, false)).toBe(1.2);
  });
});
