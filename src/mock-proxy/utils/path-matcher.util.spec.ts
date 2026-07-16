import { countDynamicSegments, pathToRegex } from './path-matcher.util';

describe('pathToRegex', () => {
  it('matches a concrete path segment for a dynamic parameter', () => {
    const regex = pathToRegex('/orders/{id}');
    expect(regex.test('/orders/abc')).toBe(true);
  });

  it('does not match a longer path with extra segments', () => {
    const regex = pathToRegex('/orders/{id}');
    expect(regex.test('/orders/abc/items')).toBe(false);
  });

  it('matches static paths exactly', () => {
    const regex = pathToRegex('/orders/summary');
    expect(regex.test('/orders/summary')).toBe(true);
    expect(regex.test('/orders/abc')).toBe(false);
  });
});

describe('countDynamicSegments', () => {
  it('returns 0 for a fully static path', () => {
    expect(countDynamicSegments('/orders/summary')).toBe(0);
  });

  it('returns 1 for a path with one dynamic segment', () => {
    expect(countDynamicSegments('/orders/{id}')).toBe(1);
  });

  it('ranks a static path as more specific than a dynamic one', () => {
    expect(countDynamicSegments('/orders/summary')).toBeLessThan(
      countDynamicSegments('/orders/{id}'),
    );
  });
});
