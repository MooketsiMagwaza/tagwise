import { describe, expect, it } from 'vitest';
import { isActive, matchPath } from './router';

describe('matchPath', () => {
  it('captures named segments', () => {
    expect(matchPath('/app/assets/:id', '/app/assets/TW-00012')).toEqual({ id: 'TW-00012' });
  });
  it('decodes captured segments', () => {
    expect(matchPath('/app/sites/:id', '/app/sites/head%20office')).toEqual({ id: 'head office' });
  });
  it('rejects a different shape', () => {
    expect(matchPath('/app/assets/:id', '/app/assets')).toBeNull();
    expect(matchPath('/app/assets/:id', '/app/stock/1')).toBeNull();
    expect(matchPath('/app/assets', '/app/assets/1')).toBeNull();
  });
  it('matches anything below a trailing star', () => {
    expect(matchPath('/app/*', '/app/counts/abc')).toEqual({});
  });
});

describe('isActive', () => {
  it('treats children as active unless exact', () => {
    expect(isActive('/app/assets', '/app/assets/1')).toBe(true);
    expect(isActive('/app', '/app/assets', true)).toBe(false);
    expect(isActive('/app/assets', '/app/assetsx')).toBe(false);
  });
});
