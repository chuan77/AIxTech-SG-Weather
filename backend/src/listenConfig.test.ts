import { describe, expect, it } from 'vitest';
import { resolveListenConfig } from './listenConfig.js';

describe('resolveListenConfig', () => {
  it('defaults to loopback on port 3000', () => {
    expect(resolveListenConfig({})).toEqual({ host: '127.0.0.1', port: 3000 });
  });

  it('respects HOST and PORT (the container sets 0.0.0.0)', () => {
    expect(resolveListenConfig({ HOST: '0.0.0.0', PORT: '8080' })).toEqual({
      host: '0.0.0.0',
      port: 8080,
    });
  });

  it('treats blank values as unset', () => {
    expect(resolveListenConfig({ HOST: ' ', PORT: '' })).toEqual({ host: '127.0.0.1', port: 3000 });
  });

  it('rejects a PORT that is not a whole number from 1 to 65535', () => {
    for (const port of ['abc', '0', '65536', '30.5', '-1']) {
      expect(() => resolveListenConfig({ PORT: port })).toThrow(/PORT/);
    }
  });
});
