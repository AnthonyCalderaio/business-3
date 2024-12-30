import { Injectable, Inject } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    private auth0: Auth0Service,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** Check if we're in the browser */
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /** Login using Auth0 */
  login() {
    if (this.isBrowser()) {
      this.auth0.loginWithRedirect().subscribe({
        next: () => console.log('Redirecting to login...'),
        error: (err) => console.error('Error during login redirect:', err),
      });
    } else {
      console.warn('Attempted login in a non-browser environment.');
    }
  }

  /** Logout using Auth0 */
  logout() {
    if (this.isBrowser()) {
      this.auth0.logout({ logoutParams: { returnTo: 'https://keyword-extractor-plus.netlify.app/login'  } });
    } else {
      console.warn('Attempted logout in a non-browser environment.');
    }
  }

  /** Check if user is authenticated */
  isAuthenticated(): Observable<any> {
    if (this.isBrowser()) {
      return this.auth0.isAuthenticated$;
    }
    console.warn('Authentication check attempted in a non-browser environment.');
    return of(null);
  }

  getUser(): Observable<any>{
    return this.auth0.user$;
  }

  getToken(): Observable<any>{
    return this.auth0.idTokenClaims$
  }

  /** Handle Auth0 callback */
  handleAuthCallback() {
    if (this.isBrowser()) {
      // Ensure that the redirect callback is only handled in the browser
      this.auth0.handleRedirectCallback().subscribe({
        next: () => console.log('Auth0 callback handled.'),
        error: (err) => console.error('Error during Auth0 callback:', err),
      });
    } else {
      console.warn('Callback handling attempted in a non-browser environment.');
    }
  }
}
