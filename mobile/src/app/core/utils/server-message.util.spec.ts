import { HttpErrorResponse } from '@angular/common/http';
import { serverMessage } from './server-message.util';

describe('serverMessage', () => {
  it('surfaces the API { error } text', () => {
    const err = new HttpErrorResponse({ status: 400, error: { error: 'KYC Verification pending.' } });
    expect(serverMessage(err, 'fallback')).toBe('KYC Verification pending.');
  });

  it('reports an unreachable server distinctly', () => {
    expect(serverMessage(new HttpErrorResponse({ status: 0 }), 'fallback')).toContain('Could not reach the server');
  });

  it('falls back when there is no readable reason', () => {
    expect(serverMessage(new HttpErrorResponse({ status: 500, error: null }), 'fallback')).toBe('fallback');
    expect(serverMessage(new Error('x'), 'fallback')).toBe('fallback');
  });

  it("never shows a server fault's own text such as 'Internal Server Error'", () => {
    const err = new HttpErrorResponse({ status: 500, error: { error: 'Internal Server Error', message: 'An unexpected error occurred.' } });
    expect(serverMessage(err, 'We could not create the booking.')).toBe('We could not create the booking.');
  });
});
