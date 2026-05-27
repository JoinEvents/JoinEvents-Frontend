import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VendorService extends BaseApiService {
  
  getDashboard(): Observable<any> {
    return this.get<any>('/vendor/dashboard', undefined, false);
  }

  getDashboardTasks(): Observable<any[]> {
    return this.get<any[]>('/vendor/dashboard/tasks', undefined, false);
  }

  getVerificationStatus(): Observable<any> {
    return this.get<any>('/vendor/verification/status', { t: Date.now().toString() }, false);
  }

  uploadVerificationDocument(file: File, documentType: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    
    return this.post<any>('/vendor/verification/upload', formData, false);
  }
}
