# business-3

# Backend
## Env keys
- stripe secret key: `heroku config:set STRIPE_SECRET_KEY=`
- Stripe Webhook Secret: `heroku config:set STRIPE_WEBHOOK_SECRET=`
- Front end URL secret: `heroku config:set FRONTEND_URL=`
- Google Extractor secret: `heroku config:set GOOGLE_EXTRACTOR_KEY=`

# Payments
- To simulate payments, use a test card provided by Stripe (e.g., `4242 4242 4242 4242` with any future expiry date and CVC).
