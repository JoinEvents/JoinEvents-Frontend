import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { BookingService } from './booking.service';
import { Booking } from '../models/booking.model';
import { environment } from '../../../environments/environment';

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

describe('BookingService quote and create', () => {
  let service: BookingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BookingService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(BookingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks the server to price a package for a guest count', () => {
    let total = 0;
    service.quote('pkg_1', 150).subscribe(result => {
      if (result.ok) total = result.value.totalAmount;
    });

    const req = http.expectOne(`${environment.apiUrl}/booking/quote`);
    expect(req.request.body).toEqual({ packageId: 'pkg_1', guestCount: 150 });
    req.flush({ totalAmount: 141600 });
    expect(total).toBe(141600);
  });

  it("passes the server's reason through when a booking is refused", () => {
    let error = '';
    service.create({ packageId: 'pkg_1', eventDate: '2026-12-01', guestCount: 500 }).subscribe(result => {
      if (!result.ok) error = result.error;
    });

    http.expectOne(`${environment.apiUrl}/booking`)
      .flush({ error: 'This package caters for up to 300 guests.' }, { status: 400, statusText: 'Bad Request' });
    expect(error).toBe('This package caters for up to 300 guests.');
  });

  it('never sends an amount when creating a booking', () => {
    service.create({ packageId: 'pkg_1', eventDate: '2026-12-01', guestCount: 100, venue: 'Lawn', city: 'Pune' }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/booking`);
    expect(Object.keys(req.request.body)).not.toContain('totalAmount');
    expect(Object.keys(req.request.body)).not.toContain('advanceAmount');
    req.flush({ id: 'b1' });
  });
});
