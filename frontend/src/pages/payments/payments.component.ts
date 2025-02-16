import { Component, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

declare var Stripe: any; // Declare Stripe as a global variable 

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent {

  apiUrl = environment.backendUrl;
  stripePublishableKey = environment.production ? environment.publishableStripeKey : environment.testPublishableStripeKey;
  @Input() tokenSub: any | undefined;
  @Input() userProfile: any | undefined; 


  constructor(private http: HttpClient) { }

  setupPayment() {
    if (this.tokenSub) {
      // Use HttpClient to make the POST request
      this.http.post(`${this.apiUrl}/setup-payment-session`, {
        customerId: this.tokenSub,  // Auth0 user sub (or user ID)
        user: this.userProfile
      })
        .subscribe(
          (session: any) => {
            const stripe = Stripe(this.stripePublishableKey);  // Stripe public key
            stripe.redirectToCheckout({ sessionId: session.sessionId });
          },
          (error) => {
            console.error('Error during checkout:', error);
          }
        );
    }
  }

  // Not currently used
  checkout() {
    if (this.tokenSub) {
      // Use HttpClient to make the POST request
      this.http.post(`${this.apiUrl}/create-checkout-session`, {
        customerId: this.tokenSub,  // Auth0 user sub (or user ID)
        user: this.userProfile 
      })
        .subscribe(
          (session: any) => {
            const stripe = Stripe(this.stripePublishableKey);  // Stripe public key
            stripe.redirectToCheckout({ sessionId: session.sessionId });
          },
          (error) => {
            console.error('Error during checkout:', error);
          }
        );
    }

  }

  createPaymentIntent(amount: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-payment-intent`, { amount });
  }

}
