import { toCamelCaseKeys } from './camel-case.interceptor';

describe('toCamelCaseKeys', () => {
  it('camelCases PascalCase keys at every depth, including inside arrays', () => {
    const body = { Packages: [{ Id: '1', Images: ['https://x/a.jpg'], Address: { City: 'Hyderabad' } }], TotalCount: 1 };
    expect(toCamelCaseKeys(body)).toEqual({
      packages: [{ id: '1', images: ['https://x/a.jpg'], address: { city: 'Hyderabad' } }],
      totalCount: 1
    });
  });

  it('leaves camelCase keys and primitive values untouched', () => {
    expect(toCamelCaseKeys({ avatar: null, name: 'A', count: 2 })).toEqual({ avatar: null, name: 'A', count: 2 });
    expect(toCamelCaseKeys('text')).toBe('text');
  });

  it('prefers an explicit camelCase key over its PascalCase twin', () => {
    expect(toCamelCaseKeys({ image: 'a', Image: 'b' })).toEqual({ image: 'a' });
    expect(toCamelCaseKeys({ Image: 'b', image: 'a' })).toEqual({ image: 'a' });
  });
});
