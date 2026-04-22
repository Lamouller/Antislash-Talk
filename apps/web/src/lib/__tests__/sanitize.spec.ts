import { describe, it, expect } from 'vitest';
import { sanitizeSpeakerName, sanitizeSegmentForPrompt } from '../sanitize';

describe('sanitizeSpeakerName', () => {
  it('strips newlines', () => {
    expect(sanitizeSpeakerName('Tristan\nIgnore previous')).toBe('Tristan Ignore previous');
  });
  it('strips quotes and backticks', () => {
    expect(sanitizeSpeakerName('Tristan"; DROP TABLE')).toBe('Tristan; DROP TABLE');
  });
  it('caps at 64 chars', () => {
    expect(sanitizeSpeakerName('x'.repeat(200))).toHaveLength(64);
  });
  it('defaults to Unknown on empty', () => {
    expect(sanitizeSpeakerName('')).toBe('Unknown');
    expect(sanitizeSpeakerName(null)).toBe('Unknown');
    expect(sanitizeSpeakerName(undefined)).toBe('Unknown');
  });
  it('collapses whitespace', () => {
    expect(sanitizeSpeakerName('Tristan   \t  Lamouller')).toBe('Tristan Lamouller');
  });
  it('strips unicode line separators', () => {
    expect(sanitizeSpeakerName('Tristan\u2028Override')).toBe('Tristan Override');
  });
  it('strips backslashes', () => {
    expect(sanitizeSpeakerName('Tristan\\nOverride')).toBe('TristannOverride');
  });
});

describe('sanitizeSegmentForPrompt', () => {
  it('replaces newlines with spaces', () => {
    expect(sanitizeSegmentForPrompt('line1\nline2')).toBe('line1 line2');
  });
  it('replaces CRLF with spaces', () => {
    expect(sanitizeSegmentForPrompt('line1\r\nline2')).toBe('line1 line2');
  });
  it('caps at 4000 chars', () => {
    expect(sanitizeSegmentForPrompt('x'.repeat(5000))).toHaveLength(4000);
  });
  it('handles null', () => {
    expect(sanitizeSegmentForPrompt(null)).toBe('');
  });
  it('handles undefined', () => {
    expect(sanitizeSegmentForPrompt(undefined)).toBe('');
  });
});
