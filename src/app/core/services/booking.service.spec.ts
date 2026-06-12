import { TestBed } from '@angular/core/testing';
import { BookingService } from './booking.service';
import { AuditService } from './audit.service';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Booking } from '../models/booking.model';

describe('BookingService', () => {
  let service: BookingService;
  let httpMock: HttpTestingController;
  let auditServiceSpy: jasmine.SpyObj<AuditService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AuditService', ['logEvent']);

    TestBed.configureTestingModule({
      providers: [
        BookingService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuditService, useValue: spy }
      ]
    });

    service = TestBed.inject(BookingService);
    httpMock = TestBed.inject(HttpTestingController);
    auditServiceSpy = TestBed.inject(AuditService) as jasmine.SpyObj<AuditService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateCancellation', () => {
    const futureDate35Days = new Date();
    futureDate35Days.setDate(futureDate35Days.getDate() + 35);
    const eventDate35Str = futureDate35Days.toISOString().split('T')[0];

    const futureDate20Days = new Date();
    futureDate20Days.setDate(futureDate20Days.getDate() + 20);
    const eventDate20Str = futureDate20Days.toISOString().split('T')[0];

    const futureDate10Days = new Date();
    futureDate10Days.setDate(futureDate10Days.getDate() + 10);
    const eventDate10Str = futureDate10Days.toISOString().split('T')[0];

    const futureDate5Days = new Date();
    futureDate5Days.setDate(futureDate5Days.getDate() + 5);
    const eventDate5Str = futureDate5Days.toISOString().split('T')[0];

    it('should calculate 100% refund (minus 2% platform fee) for customer cancellations > 30 days', () => {
      const mockBooking: Booking = {
        id: 'bk1',
        bookingNumber: 'BK-1',
        customerId: 'c1',
        customerName: 'Test Customer',
        customerPhone: '123',
        eventTypeId: 'wedding',
        eventName: 'Test Wedding',
        eventDate: eventDate35Str,
        venue: 'Hall',
        city: 'Mumbai',
        guestCount: 100,
        status: 'confirmed',
        advanceAmount: 20000,
        baseAmount: 84745,
        extraServicesAmount: 0,
        damageCharges: 0,
        gstPercent: 18,
        totalAmount: 100000,
        services: [],
        createdAt: '2026-06-01'
      };

      const calc = service.calculateCancellation(mockBooking, 'customer');
      expect(calc.daysUntilEvent).toBeGreaterThan(30);
      expect(calc.refundPercentage).toBe(100);
      expect(calc.platformCancellationFee).toBe(2000); // 2% of 100k
      expect(calc.refundAmount).toBe(18000); // 20k advance - 2k fee
      expect(calc.cancellationFee).toBe(0);
      expect(calc.vendorPenaltyAmount).toBe(0);
      expect(calc.vendorStrikeApplied).toBeFalse();
    });

    it('should calculate 50% refund for customer cancellations between 15 and 30 days', () => {
      const mockBooking: Booking = {
        id: 'bk2',
        bookingNumber: 'BK-2',
        customerId: 'c1',
        customerName: 'Test Customer',
        customerPhone: '123',
        eventTypeId: 'wedding',
        eventName: 'Test Wedding',
        eventDate: eventDate20Str,
        venue: 'Hall',
        city: 'Mumbai',
        guestCount: 100,
        status: 'confirmed',
        advanceAmount: 20000,
        baseAmount: 84745,
        extraServicesAmount: 0,
        damageCharges: 0,
        gstPercent: 18,
        totalAmount: 100000,
        services: [],
        createdAt: '2026-06-01'
      };

      const calc = service.calculateCancellation(mockBooking, 'customer');
      expect(calc.daysUntilEvent).toBe(20);
      expect(calc.refundPercentage).toBe(50);
      expect(calc.refundAmount).toBe(10000); // 50% of 20k
      // 50% retained = 10k. Platform fee standard 10% total (10k) capped at 50% of retained (5k)
      expect(calc.platformCancellationFee).toBe(5000);
      expect(calc.cancellationFee).toBe(5000); // 10k retained - 5k platform
      expect(calc.vendorPenaltyAmount).toBe(0);
      expect(calc.vendorStrikeApplied).toBeFalse();
    });

    it('should calculate 25% refund for customer cancellations between 7 and 14 days', () => {
      const mockBooking: Booking = {
        id: 'bk3',
        bookingNumber: 'BK-3',
        customerId: 'c1',
        customerName: 'Test Customer',
        customerPhone: '123',
        eventTypeId: 'wedding',
        eventName: 'Test Wedding',
        eventDate: eventDate10Str,
        venue: 'Hall',
        city: 'Mumbai',
        guestCount: 100,
        status: 'confirmed',
        advanceAmount: 20000,
        baseAmount: 84745,
        extraServicesAmount: 0,
        damageCharges: 0,
        gstPercent: 18,
        totalAmount: 100000,
        services: [],
        createdAt: '2026-06-01'
      };

      const calc = service.calculateCancellation(mockBooking, 'customer');
      expect(calc.daysUntilEvent).toBe(10);
      expect(calc.refundPercentage).toBe(25);
      expect(calc.refundAmount).toBe(5000); // 25% of 20k
      // 75% retained = 15k. Platform fee standard 10% total (10k) capped at 50% of retained (7.5k)
      expect(calc.platformCancellationFee).toBe(7500);
      expect(calc.cancellationFee).toBe(7500); // 15k retained - 7.5k platform
    });

    it('should calculate 0% refund for customer cancellations < 7 days', () => {
      const mockBooking: Booking = {
        id: 'bk4',
        bookingNumber: 'BK-4',
        customerId: 'c1',
        customerName: 'Test Customer',
        customerPhone: '123',
        eventTypeId: 'wedding',
        eventName: 'Test Wedding',
        eventDate: eventDate5Str,
        venue: 'Hall',
        city: 'Mumbai',
        guestCount: 100,
        status: 'confirmed',
        advanceAmount: 20000,
        baseAmount: 84745,
        extraServicesAmount: 0,
        damageCharges: 0,
        gstPercent: 18,
        totalAmount: 100000,
        services: [],
        createdAt: '2026-06-01'
      };

      const calc = service.calculateCancellation(mockBooking, 'customer');
      expect(calc.daysUntilEvent).toBe(5);
      expect(calc.refundPercentage).toBe(0);
      expect(calc.refundAmount).toBe(0);
      // 100% retained = 20k. Platform fee standard 10% total (10k) capped at 50% of retained (10k)
      expect(calc.platformCancellationFee).toBe(10000);
      expect(calc.cancellationFee).toBe(10000); // 20k retained - 10k platform
    });

    it('should calculate 100% refund, strike, and 10% penalty for vendor cancellations', () => {
      const mockBooking: Booking = {
        id: 'bk5',
        bookingNumber: 'BK-5',
        customerId: 'c1',
        customerName: 'Test Customer',
        customerPhone: '123',
        eventTypeId: 'wedding',
        eventName: 'Test Wedding',
        eventDate: eventDate5Str,
        venue: 'Hall',
        city: 'Mumbai',
        guestCount: 100,
        status: 'confirmed',
        advanceAmount: 20000,
        baseAmount: 84745,
        extraServicesAmount: 0,
        damageCharges: 0,
        gstPercent: 18,
        totalAmount: 100000,
        services: [],
        createdAt: '2026-06-01'
      };

      const calc = service.calculateCancellation(mockBooking, 'vendor');
      expect(calc.refundPercentage).toBe(100);
      expect(calc.refundAmount).toBe(20000); // Full advance refunded
      expect(calc.cancellationFee).toBe(0);
      expect(calc.platformCancellationFee).toBe(0);
      expect(calc.vendorPenaltyAmount).toBe(10000); // 10% of total amount (100k)
      expect(calc.vendorStrikeApplied).toBeTrue();
    });
  });
});
