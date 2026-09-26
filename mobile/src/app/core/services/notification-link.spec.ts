import { notificationLink } from './notification.service';

describe('notificationLink', () => {
  it('opens each role’s own screen', () => {
    expect(notificationLink('customer', 'booking')).toBe('/customer/tabs/bookings');
    expect(notificationLink('vendor', 'booking')).toBe('/vendor/tabs/bookings');
    expect(notificationLink('support', 'support')).toBe('/support/tabs/tickets');
    expect(notificationLink('admin', 'dispute')).toBe('/admin/disputes');
    expect(notificationLink('vendor', 'rfp')).toBe('/vendor/tabs/quote-board');
    expect(notificationLink('customer', 'support')).toBe('/customer/support');
  });

  it('falls back to the role’s notifications list', () => {
    expect(notificationLink('admin', 'general')).toBe('/admin/notifications');
    expect(notificationLink('support', '')).toBe('/support/notifications');
    expect(notificationLink(null, 'whatever')).toBe('/customer/notifications');
  });
});
