import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { environment } from '../environments/environment';
import { API_ROUTES } from './core/constants/api.constants';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { GlobalErrorHandler } from './core/handlers/global-error.handler';

export function checkBackendAvailability(errorHandler: ErrorHandler) {
  const globalHandler = errorHandler as GlobalErrorHandler;
  return () => {
    // Standard GET on a public endpoint is more robust than an explicit OPTIONS call
    // which may be rejected (405) by many backend configurations.
    return fetch(`${environment.apiUrl}/service-categories`)
      .catch(error => {
        globalHandler.lastError.set({
          title: 'Backend Server Unavailable',
          message: 'The backend services are currently unreachable. Please make sure the API server is running and try again.'
        });
        globalHandler.hasFatalError.set(true);
      });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // [SECURITY] CSRF/XSRF: This app uses Bearer token authentication via the Authorization
    // header (not cookies), which provides inherent CSRF protection since browsers do not
    // automatically attach custom headers to cross-origin requests. If cookie-based auth is
    // ever added, configure withXsrfConfiguration() here.
    provideHttpClient(withInterceptors([authInterceptor, cacheInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: checkBackendAvailability,
      deps: [ErrorHandler],
      multi: true
    }
  ]
};
