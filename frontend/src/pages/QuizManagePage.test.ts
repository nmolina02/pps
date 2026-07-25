import { describe, expect, it } from 'vitest';
import { parseComisiones } from './QuizManagePage';

describe('parseComisiones', () => {
  it('splits comma-separated comisiones', () => {
    expect(parseComisiones('K3054,K3154')).toEqual(['K3054', 'K3154']);
  });

  it('trims surrounding whitespace around each comisión', () => {
    expect(parseComisiones('  K3054 ,  K3154  ')).toEqual(['K3054', 'K3154']);
  });

  it('uppercases lowercase input to match backend normalization', () => {
    expect(parseComisiones('k3054, k3154')).toEqual(['K3054', 'K3154']);
  });

  it('deduplicates repeated comisiones regardless of case', () => {
    expect(parseComisiones('K3054, k3054, K3054')).toEqual(['K3054']);
  });

  it('drops empty entries from trailing commas or blank segments', () => {
    expect(parseComisiones('K3054,,K3154,')).toEqual(['K3054', 'K3154']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseComisiones('')).toEqual([]);
    expect(parseComisiones('   ')).toEqual([]);
  });
});
