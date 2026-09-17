import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { BookingService } from './booking.service';
import { Booking } from '../models/booking.model';

function bookingAt(daysFromNow: number, overrides: Partial<Booking> = {}): Booking {
  const eventDate = new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
  return {
    id: 'b1',
    bookingNumber: 'JE-001',
    customerId: 'c1',
    customerName: 'Test Customer',
    customerPhone: '9876543210',
    eventTypeId: 'wedding',
    eventName: 'Test Event',
    eventDate,
    venue: 'Test Venue',
    city: 'Pune',
    guestCount: 100,
    status: 'advance_paid',
    advanceAmount: 20_000,
    baseAmount: 80_000,
    extraServicesAmount: 0,
    damageCharges: 0,
    gstPercent: 18,
    totalAmount: 100_000,
    services: [],
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

describe('BookingService.previewCancellation', () => {
  let service: BookingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BookingService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(BookingService);
  });

  it('refunds the advance in full when cancelling 30+ days out', () => {
    const result = service.previewCancellation(bookingAt(45), 'customer');

    expect(result.cancellationFee).toBe(0);
    expect(result.refundAmount).toBe(20_000);
    expect(result.policyLabel).toContain('Free cancellation');
  });

  it('charges 25% between 15 and 29 days out', () => {
    const result = service.previewCancellation(bookingAt(20), 'customer');

    expect(result.cancellationFee).toBe(5_000);
    expect(result.refundAmount).toBe(15_000);
  });

  it('charges 50% between 7 and 14 days out', () => {
    const result = service.previewCancellation(bookingAt(10), 'customer');

    expect(result.cancellationFee).toBe(10_000);
    expect(result.refundAmount).toBe(10_000);
  });

  it('refunds nothing inside 7 days', () => {
    const result = service.previewCancellation(bookingAt(3), 'customer');

    expect(result.cancellationFee).toBe(20_000);
    expect(result.refundAmount).toBe(0);
  });

  it('prefers the actual paid amount over the advance when the balance is settled', () => {
    const booking = bookingAt(3, { finalPaidAmount: 100_000 });
    const result = service.previewCancellation(booking, 'customer');

    expect(result.cancellationFee).toBe(100_000);
  });

  it('makes the customer whole and penalises the vendor on a vendor cancellation', () => {
    const result = service.previewCancellation(bookingAt(3), 'vendor');

    expect(result.cancellationFee).toBe(0);
    expect(result.refundAmount).toBe(20_000);
    expect(result.vendorPenalty).toBe(10_000);
  });
});
