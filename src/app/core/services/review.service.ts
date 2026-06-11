import { inject, Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable } from 'rxjs';
import { API_ROUTES } from '../constants/api.constants';

export interface ReviewDto {
  bookingId: string;
  vendorId: string;
  customerName: string;
  eventName: string;
  rating: number;
  comment: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService extends BaseApiService {
  submitReview(review: ReviewDto): Observable<any> {
    return this.post<any>(API_ROUTES.REVIEWS.BASE, review, false);
  }
}
