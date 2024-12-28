# business-3

# Backend
## Env keys
- stripe secret key: `heroku config:set STRIPE_SECRET_KEY=`
- Stripe Webhook Secret: `heroku config:set STRIPE_WEBHOOK_SECRET=`
- Front end URL secret: `heroku config:set FRONTEND_URL=`
- Google Extractor secret: `heroku config:set GOOGLE_EXTRACTOR_KEY=`

# Payments
- To simulate payments, use a test card provided by Stripe (e.g., `4242 4242 4242 4242` with any future expiry date and CVC).

# Auth0

Flow After Purchase:
User makes a purchase: After the user successfully completes the Stripe checkout, they are redirected back to your application (e.g., success URL).

Trigger the Post-Login Action: If the user is redirected back to your app and their session is still active, the Post-Login action will automatically run when the user is logged in again (even if they are already logged in).

The Post-Login action is triggered every time the user logs in, including after they come back from a successful purchase.
Update the metadata: The action will then check the user's subscription status (e.g., whether the user is premium or not based on their Stripe data), and it will update the app_metadata with the isPremium field, which indicates their premium status.

User's session updated: The updated metadata will now be available in the user's session, so you can use it in your application without the need for logging out or refreshing the page.

What Happens in the UI:
When the user returns to the home page (or any other page) after the successful payment, their updated metadata will automatically be available in the session, and you can reflect the premium status in your UI.
Key Points:
The action runs post-login, meaning it will be triggered the next time the user logs in or when they are redirected back after the purchase (if they are still logged in).
No logout is needed for the action to take effect, and the app_metadata is updated on the fly once the action is triggered.
This ensures that once the user returns to the application, they will have the correct premium status, and you can show them the appropriate content (e.g., premium features).