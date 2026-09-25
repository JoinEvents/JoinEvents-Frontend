import { formatAssistantText } from './assistant.service';

describe('formatAssistantText', () => {
  it('renders bold and bullet lists', () => {
    const html = formatAssistantText('You have **2** bookings:\n- Reception\n- Sangeet\nDone.');
    expect(html).toBe('<p>You have <strong>2</strong> bookings:</p><ul><li>Reception</li><li>Sangeet</li></ul><p>Done.</p>');
  });

  it('never lets markup through', () => {
    const html = formatAssistantText('<img src=x onerror=alert(1)> **<b>hi</b>**');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('<strong>&lt;b&gt;hi&lt;/b&gt;</strong>');
  });
});
