import { base64ToBlob, photoFileInfo } from './camera.util';

describe('photoFileInfo', () => {
  it('maps Capacitor formats to an extension and MIME type the API accepts', () => {
    expect(photoFileInfo('jpeg')).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(photoFileInfo(undefined)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(photoFileInfo('PNG')).toEqual({ mime: 'image/png', ext: 'png' });
    expect(photoFileInfo('webp')).toEqual({ mime: 'image/webp', ext: 'webp' });
  });
});

describe('base64ToBlob', () => {
  it('decodes bytes and keeps the MIME type', async () => {
    const blob = base64ToBlob(btoa('\xff\xd8\xff'), 'image/jpeg');
    expect(blob.type).toBe('image/jpeg');
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([0xff, 0xd8, 0xff]);
  });
});
