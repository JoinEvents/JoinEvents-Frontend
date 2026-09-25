import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PackageService } from './package.service';
import { EventPackage } from '../models/event.model';
import { environment } from '../../../environments/environment';

describe('PackageService package mapping', () => {
  let service: PackageService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PackageService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PackageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(body: Record<string, unknown>): EventPackage | null {
    let result: EventPackage | null = null;
    service.getById('pkg_1').subscribe(pkg => (result = pkg));
    http.expectOne(`${environment.apiUrl}/packages/pkg_1`).flush(body);
    return result;
  }

  it('reads the price and capacity from the nested pricing and capacity the API returns', () => {
    const pkg = load({
      id: 'pkg_1',
      name: 'Royal Wedding',
      pricing: { basePrice: 236000 },
      capacity: { maxGuests: 200, parkingCapacity: 40 }
    });

    expect(pkg!.price).toBe(236000);
    expect(pkg!.maxGuests).toBe(200);
  });

  it('separates the per-service details from the description text', () => {
    const pkg = load({
      id: 'pkg_1',
      name: 'Royal Wedding',
      description: 'Our finest package.\n\n---INCLUSION_DETAILS---\n' + JSON.stringify({
        Catering: { description: 'Buffet', minPrice: 450, maxPrice: 450, images: [], keyFeatures: ['Live counters'], inclusions: 'Welcome drinks, Desserts' },
        Venue: { minPrice: 50000, maxPrice: 60000 }
      }),
      includes: []
    });

    expect(pkg!.description).toBe('Our finest package.');
    expect(pkg!.services).toEqual(['Catering', 'Venue']);
    expect(pkg!.serviceDetails!['Catering'].keyFeatures).toEqual(['Live counters']);
    expect(pkg!.serviceDetails!['Catering'].inclusions).toEqual(['Welcome drinks', 'Desserts']);
    expect(pkg!.serviceDetails!['Venue'].maxPrice).toBe(60000);
  });
});
