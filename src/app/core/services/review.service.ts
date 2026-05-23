import { inject, Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable } from 'rxjs';

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
    return this.post<any>('/reviews', review, false);
  }
}
