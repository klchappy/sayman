import { describe, expect, it } from 'vitest';
import { escapeIlike, ilikePattern } from './sql-escape';

describe('escapeIlike', () => {
  it('null/undefined/boş için boş string döner', () => {
    expect(escapeIlike(null)).toBe('');
    expect(escapeIlike(undefined)).toBe('');
    expect(escapeIlike('')).toBe('');
  });

  it('wildcard karakteri olmayan input değişmez', () => {
    expect(escapeIlike('Foo Bar')).toBe('Foo Bar');
    expect(escapeIlike('ABC123')).toBe('ABC123');
  });

  it('% backslash ile escape edilir', () => {
    expect(escapeIlike('Foo%Bar')).toBe('Foo\\%Bar');
    expect(escapeIlike('100%')).toBe('100\\%');
  });

  it('_ backslash ile escape edilir', () => {
    expect(escapeIlike('foo_bar')).toBe('foo\\_bar');
  });

  it('\\ kendisi de escape edilir', () => {
    expect(escapeIlike('a\\b')).toBe('a\\\\b');
  });

  it('birden çok wildcard birlikte', () => {
    expect(escapeIlike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });
});

describe('ilikePattern', () => {
  it('input %ile sarılır', () => {
    expect(ilikePattern('test')).toBe('%test%');
  });

  it('escape edilmiş input %ile sarılır', () => {
    expect(ilikePattern('100%')).toBe('%100\\%%');
  });

  it('boş input %% döner (her şeyle eşleşir)', () => {
    expect(ilikePattern('')).toBe('%%');
    expect(ilikePattern(null)).toBe('%%');
  });
});
