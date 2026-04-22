import { describe, it, expect } from 'vitest';
import { createReconnectStrategy, defaultShouldRetry } from '../wsReconnect';

describe('createReconnectStrategy', () => {
  it('default sequence: 500, 1000, 2000, 4000, 8000, 8000', () => {
    const s = createReconnectStrategy();
    expect(s.next()).toBe(500);
    expect(s.next()).toBe(1000);
    expect(s.next()).toBe(2000);
    expect(s.next()).toBe(4000);
    expect(s.next()).toBe(8000);
    expect(s.next()).toBe(8000); // capped at maxDelayMs
    expect(s.next()).toBe(null); // maxAttempts=6 reached
  });

  it('peek does not consume', () => {
    const s = createReconnectStrategy();
    expect(s.peek()).toBe(500);
    expect(s.peek()).toBe(500);
    expect(s.next()).toBe(500);
    expect(s.peek()).toBe(1000);
  });

  it('reset brings attempts to 0', () => {
    const s = createReconnectStrategy();
    s.next(); s.next(); s.next();
    expect(s.attempts).toBe(3);
    s.reset();
    expect(s.attempts).toBe(0);
    expect(s.next()).toBe(500);
  });

  it('custom config', () => {
    const s = createReconnectStrategy({ initialDelayMs: 100, maxDelayMs: 400, maxAttempts: 3 });
    expect(s.next()).toBe(100);
    expect(s.next()).toBe(200);
    expect(s.next()).toBe(400);
    expect(s.next()).toBe(null);
  });

  it('attempts counter', () => {
    const s = createReconnectStrategy();
    expect(s.attempts).toBe(0);
    s.next();
    expect(s.attempts).toBe(1);
    s.next();
    expect(s.attempts).toBe(2);
  });

  it('peek returns null when exhausted', () => {
    const s = createReconnectStrategy({ maxAttempts: 1 });
    s.next(); // consume the single attempt
    expect(s.peek()).toBe(null);
  });

  it('next after exhaustion keeps returning null without incrementing attempts', () => {
    const s = createReconnectStrategy({ maxAttempts: 2 });
    s.next(); s.next();
    expect(s.attempts).toBe(2);
    expect(s.next()).toBe(null);
    expect(s.next()).toBe(null);
    expect(s.attempts).toBe(2); // should not grow beyond maxAttempts
  });

  it('reset after exhaustion allows fresh sequence', () => {
    const s = createReconnectStrategy({ maxAttempts: 2 });
    s.next(); s.next();
    expect(s.next()).toBe(null);
    s.reset();
    expect(s.next()).toBe(500);
    expect(s.next()).toBe(1000);
    expect(s.next()).toBe(null);
  });
});

describe('defaultShouldRetry', () => {
  it('retries 1006 (abnormal)', () => expect(defaultShouldRetry(1006, 'abnormal')).toBe(true));
  it('retries 1011 (internal error)', () => expect(defaultShouldRetry(1011, '')).toBe(true));
  it('retries 1001 (going away)', () => expect(defaultShouldRetry(1001, '')).toBe(true));
  it('does NOT retry 1000 (normal)', () => expect(defaultShouldRetry(1000, '')).toBe(false));
  it('does NOT retry 1008 (policy violation)', () => expect(defaultShouldRetry(1008, 'unauthorized')).toBe(false));
  it('works with no reason argument', () => expect(defaultShouldRetry(1006)).toBe(true));
});
