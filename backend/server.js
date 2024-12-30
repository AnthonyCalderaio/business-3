require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const app = express();

const rateLimit = require('express-rate-limit');

// Load environment variables
const GOOGLE_EXTRACTOR_API_KEY = process.env.GOOGLE_EXTRACTOR_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const frontendUrl = process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : 'http://localhost:4200';
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0ClientId = process.env.AUTH0_CLIENT_ID;
const auth0ClientSecret = process.env.AUTH0_CLIENT_SECRET;

// CORS setup
const allowedOrigins = [
    'https://keyword-extractor-plus.netlify.app', // Your Netlify URL
    'http://localhost:4200', // Local testing URL (if you're working locally)
];

app.use(cors({
    origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true); // Allow the request
        } else {
            callback(new Error('Not allowed by CORS')); // Reject the request
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware to parse JSON for all routes except /webhook
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next(); // Skip JSON parsing for /webhook
    } else {
        express.json()(req, res, next); // Apply JSON parsing
    }
});

// Rate limit for the keyword extraction route
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // Limit to 100 requests per hour
    message: "Too many requests from this IP, please try again after an hour."
});
app.use('/extract-keywords', limiter); // Apply rate limiter to the API endpoint

// Function to fetch the Auth0 Management API token dynamically
async function getAuth0ManagementToken() {
    try {
        const response = await axios.post(`https://${auth0Domain}/oauth/token`, {
            client_id: auth0ClientId,
            client_secret: auth0ClientSecret,
            audience: `https://${auth0Domain}/api/v2/`,
            grant_type: 'client_credentials',
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching Auth0 Management token:', error.message);
        throw new Error('Unable to get Auth0 Management token');
    }
}


// Route to extract keywords
app.post('/extract-keywords', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        console.log('No text provided.');
        return res.status(400).json({ error: 'Text input is required.' });
    }

    if (!GOOGLE_EXTRACTOR_API_KEY) {
        console.error('Google Extractor API Key is not set.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    try {
        const endpoint = `https://language.googleapis.com/v1/documents:analyzeEntities?key=${GOOGLE_EXTRACTOR_API_KEY}`;
        const response = await axios.post(endpoint, {
            document: {
                content: text,
                type: 'PLAIN_TEXT',
            },
        });

        const keywords = response.data.entities
            .filter(entity => entity.salience > 0.1) // Filter out low salience entities
            .map(entity => ({
                name: entity.name,
                type: entity.type,
                salience: entity.salience,
            }));

        res.status(200).json({ success: true, keywords });
    } catch (error) {
        console.error('Error analyzing text:', error.response?.data || error.message || 'Unknown error');
        res.status(500).json({ error: 'Failed to extract keywords.' });
    }
});

// Webhook to handle Stripe events
async function updateAuth0User(auth0Sub, stripeCustomerId) {
    try {
        const auth0Token = await getAuth0ManagementToken();
        const url = `https://${auth0Domain}/api/v2/users/${auth0Sub}`;
        
        const response = await axios.patch(url, {
            app_metadata: {
                stripeCustomerId: stripeCustomerId  // Save the Stripe customer ID
            }
        }, {
            headers: {
                Authorization: `Bearer ${auth0Token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Auth0 user updated:', response.data);
    } catch (error) {
        console.error('Error updating Auth0 user:', error.response?.data || error.message);
    }
}

app.post('/api/user-metadata', async (req, res) => {
    console.log('this got hit')
    const userToken = req.body.token; // Token sent from frontend
    console.log(userToken)
  
    if (!userToken) {
      return res.status(400).json({ error: 'Token is required' });
    }
  
    try {
      // Decode the user token to extract user ID (sub)
      const userId = userToken.sub;
  
      if (!userId) {
        return res.status(400).json({ error: 'Invalid token' });
      }
  
      // Fetch metadata using the Management API
      const auth0Token = await getAuth0ManagementToken();  // Fetch the token dynamically
      const url = `https://${auth0Domain}/api/v2/users/${userId}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${auth0Token}`, // Management API token
        },
      });
  
      // Return the app_metadata to the frontend
      res.status(200).json(response.data.app_metadata);
    } catch (error) {
      console.error('Error fetching metadata:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  });

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = stripeWebhookSecret;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const stripeCustomerId = session.customer;

        try {
            // Query Auth0 by Stripe Customer ID
            const auth0Token = await getAuth0ManagementToken();  // Fetch the token dynamically
            const url = `https://${auth0Domain}/api/v2/users?q=app_metadata.stripeCustomerId:"${stripeCustomerId}"&search_engine=v3`;
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${auth0Token}`,
                },
            });

            const user = response.data[0];
            if (user) {
                // Update isPremium status
                await axios.patch(
                    `https://${auth0Domain}/api/v2/users/${user.user_id}`,
                    { app_metadata: { isPremium: true } },
                    {
                        headers: {
                            Authorization: `Bearer ${auth0Token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
                console.log(`Premium status added to user: ${user.user_id}`);
            } else {
                console.error('No Auth0 user found for the given Stripe Customer ID.');
            }
        } catch (error) {
            console.error('Error updating Auth0 user:', error.response?.data || error.message);
        }
    } else {
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

// Create a payment intent for Stripe
app.post('/create-payment-intent', async (req, res) => {
    const { amount } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
        });
        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Create a Stripe customer
app.post('/create-customer', async (req, res) => {
    const { email, name } = req.body;

    try {
        const customer = await stripe.customers.create({
            email,
            name,
        });

        res.status(200).json({ customerId: customer.id });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer in Stripe.' });
    }
});

// Create a Stripe checkout session
app.post('/create-checkout-session', async (req, res) => {
    const { customerId, user } = req.body;

    try {
        let stripeCustomerId = customerId;

        if (!user?.app_metadata?.stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
            });

            stripeCustomerId = customer.id;

            // Store Stripe customer ID in Auth0
            await updateAuth0User(user.sub, stripeCustomerId);  // Use user.sub (Auth0 user ID)
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: { name: 'Premium Subscription' },
                        unit_amount: 999,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/cancel`,
            customer: stripeCustomerId,
        });

        res.json({ sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Check subscription status
app.get('/check-subscription/:stripeCustomerId', async (req, res) => {
    const { stripeCustomerId } = req.params;

    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
            limit: 1
        });

        const isPremium = subscriptions.data.length > 0;

        res.status(200).json({ isPremium });
    } catch (error) {
        console.error('Error checking subscription:', error.message);
        res.status(500).json({ error: 'Failed to check subscription.' });
    }
});

// Protect routes that require premium access
app.use('/premium/*', (req, res, next) => {
    if (!req.user || !req.user.isPremium) {
        return res.status(403).json({ error: 'Premium features require a subscription.' });
    }
    next();
});

// Test route
app.get('/test', (req, res) => {
    console.log('test hit')
    res.send('I\'m working!');
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
