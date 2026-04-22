import { describe, it, expect } from 'vitest';
import { segmentHash } from '../segmentHash';

describe('segmentHash', () => {
  it('same speaker + text = same hash', () => {
    expect(segmentHash('Tristan', 'Bonjour à tous')).toBe(
      segmentHash('Tristan', 'Bonjour à tous'),
    );
  });

  it('case insensitive speaker', () => {
    expect(segmentHash('TRISTAN', 'bonjour')).toBe(segmentHash('tristan', 'bonjour'));
  });

  it('case insensitive text', () => {
    expect(segmentHash('tristan', 'BONJOUR')).toBe(segmentHash('tristan', 'bonjour'));
  });

  it('case insensitive both', () => {
    expect(segmentHash('TRISTAN', 'BONJOUR')).toBe(segmentHash('tristan', 'bonjour'));
  });

  it('whitespace normalized in text', () => {
    expect(segmentHash('A', 'foo  bar')).toBe(segmentHash('A', 'foo bar'));
  });

  it('leading/trailing whitespace normalized in text', () => {
    expect(segmentHash('A', '  foo bar  ')).toBe(segmentHash('A', 'foo bar'));
  });

  it('leading/trailing whitespace normalized in speaker', () => {
    expect(segmentHash('  Tristan  ', 'hello')).toBe(segmentHash('Tristan', 'hello'));
  });

  it('text sliced to 30 chars — suffix beyond 30 is ignored', () => {
    const h1 = segmentHash('A', 'x'.repeat(50) + 'unique_suffix');
    const h2 = segmentHash('A', 'x'.repeat(30));
    expect(h1).toBe(h2);
  });

  it('text shorter than 30 chars is kept as-is', () => {
    const h1 = segmentHash('A', 'hello');
    const h2 = segmentHash('A', 'hello');
    expect(h1).toBe(h2);
  });

  it('different speakers = different hash', () => {
    expect(segmentHash('A', 'hi')).not.toBe(segmentHash('B', 'hi'));
  });

  it('different texts = different hash', () => {
    expect(segmentHash('A', 'hello world')).not.toBe(segmentHash('A', 'foo bar'));
  });

  it('null speaker safe → empty speaker part', () => {
    expect(segmentHash(null, 'hello')).toBe('::hello');
  });

  it('undefined speaker safe → empty speaker part', () => {
    expect(segmentHash(undefined, 'hello')).toBe('::hello');
  });

  it('null text safe → empty text part', () => {
    expect(segmentHash('Tristan', null)).toBe('tristan::');
  });

  it('undefined text safe → empty text part', () => {
    expect(segmentHash('Tristan', undefined)).toBe('tristan::');
  });

  it('null + null → "::"', () => {
    expect(segmentHash(null, null)).toBe('::');
  });

  it('undefined + undefined → "::"', () => {
    expect(segmentHash(undefined, undefined)).toBe('::');
  });

  it('separator "::" is present in output', () => {
    expect(segmentHash('Tristan', 'Bonjour')).toContain('::');
  });

  it('tabs in text are normalised to space', () => {
    expect(segmentHash('A', 'foo\tbar')).toBe(segmentHash('A', 'foo bar'));
  });

  it('newline in text is normalised to space', () => {
    expect(segmentHash('A', 'foo\nbar')).toBe(segmentHash('A', 'foo bar'));
  });
});
