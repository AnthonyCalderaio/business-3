import { Component } from '@angular/core';

declare var Stripe: any; // Declare Stripe as a global variable

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss'
})
export class PaymentsComponent {
  constructor() {}

  checkout() {
    // Use the Stripe instance (loaded from the script in index.html)
    const stripe = Stripe('pk_test_51QZ0AuDj4emn7zxBsgePa5u6pljDu874fym798khfLn4Irg6Of0BXuX1Y3CAjn573FB1EemQCA2RIUngUega2ABd00J3rM1bfM'); // Replace with your Stripe publishable key

    // Call your backend to create the checkout session
    fetch('/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: 'USER_STRIPE_CUSTOMER_ID' }), // Pass the Stripe customer ID
    })
      .then((response) => response.json())
      .then((session) => {
        // Redirect to Stripe Checkout
        stripe.redirectToCheckout({ sessionId: session.sessionId });
      })
      .catch((error) => {
        console.error('Error during checkout:', error);
      });
  }

}
