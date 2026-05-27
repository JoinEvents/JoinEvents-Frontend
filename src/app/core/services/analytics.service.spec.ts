import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';
import { BookingService } from './booking.service';
import { of } from 'rxjs';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let bookingServiceSpy: jasmine.SpyObj<BookingService>;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('BookingService', ['getAdminBookings']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AnalyticsService,
        { provide: BookingService, useValue: spy }
      ]
    });
    service = TestBed.inject(AnalyticsService);
    bookingServiceSpy = TestBed.inject(BookingService) as jasmine.SpyObj<BookingService>;
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should compile admin analytics data accurately', (done) => {
    const mockBookings = [
      { id: '1', totalAmount: 100000, status: 'confirmed', eventDate: '2026-05-10' },
      { id: '2', totalAmount: 50000, status: 'completed', eventDate: '2026-06-15' }
    ] as any[];

    bookingServiceSpy.getAdminBookings.and.returnValue(of(mockBookings));

    service.getAdminAnalytics().subscribe(data => {
      expect(data.totalRevenue).toBe(150000);
      expect(data.bookingCountByStatus['confirmed']).toBe(1);
      expect(data.bookingCountByStatus['completed']).toBe(1);
      expect(data.averageBookingValue).toBe(75000);
      done();
    });
  });

  it('should compile vendor analytics data accurately', (done) => {
    const mockServices = [
      { id: 'vs1', name: 'Deluxe Catering', rating: 4.8, totalReviews: 120 }
    ] as any[];

    service.getVendorAnalytics('v1').subscribe(data => {
      expect(data.totalEarnings).toBe(850000);
      expect(data.topPerformingService.name).toBe('Deluxe Catering');
      done();
    });

    const req = httpTestingController.expectOne(request => request.url.includes('/services/getAll?VendorId=v1'));
    expect(req.request.method).toBe('GET');
    req.flush({ Services: mockServices });
  });
});
