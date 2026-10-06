import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import id from '../messages/id.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('messages', () => {
  it('has the same keys in every locale', () => {
    expect(keys(en).sort()).toEqual(keys(id).sort());
  });
});
