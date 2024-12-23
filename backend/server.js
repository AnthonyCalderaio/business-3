require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

const rateLimit = require('express-rate-limit');


// Get API Key from environment variable
const GOOGLE_EXTRACTOR_API_KEY = process.env.GOOGLE_EXTRACTOR_KEY;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeWebookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const frontendUrl = process.env.FRONTEND_URL


// app.use(express.json()); // Parse request body as JSON

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


const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // Limit to 100 requests per hour
    message: "Too many requests from this IP, please try again after an hour."
});

app.use('/extract-keywords', limiter); // Apply rate limiter to the API endpoint

app.post('/extract-keywords', async (req, res) => {
    const { text } = req.body;

    console.log('process.env:');
    console.log(process.env)
    console.log('actual variable:')
    console.log(GOOGLE_EXTRACTOR_API_KEY)

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






app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    console.log('Raw body:', req.body);  // Should be a Buffer object
    console.log('Headers:', req.headers);  // Should contain stripe-signature
    const sig = req.headers['stripe-signature'];
    console.log('Stripe Signature:', sig);  // Check if the signature is there

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, stripeWebookSecret);
        console.log('Event verified successfully:', event);
        res.status(200).send('Received');
    } catch (err) {
        console.error('Error verifying webhook signature:', err);
        res.status(400).send('Webhook error: ' + err.message);
  }
});



app.post('/create-customer', async (req, res) => {
    const { email, name } = req.body; // The user's email and name sent from the frontend

    try {
        // Create a new customer in Stripe
        const customer = await stripe.customers.create({
            email: email,
            name: name,
        });

        // You can now store the Stripe customer ID in your database
        // For example: save customer.id to your user's profile in your DB

        res.status(200).json({ customerId: customer.id });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer in Stripe.' });
    }
});

app.post('/create-checkout-session', async (req, res) => {
    const { customerId } = req.body; // Get customer ID from the frontend (you should pass this when the user clicks on "Pay")

    try {
        // Create a Checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd', // Or your preferred currency
                        product_data: {
                            name: 'Premium Subscription', // The name of your product
                        },
                        unit_amount: 999, // The price in cents (e.g., $9.99)
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment', // Payment mode
            success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/cancel`,
            customer: customerId, // Pass the Stripe customer ID here to associate with the payment
        });

        res.json({ sessionId: session.id }); // Send the session ID to the frontend
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/create-checkout-session', async (req, res) => {
    const YOUR_DOMAIN = 'http://localhost:3000'; // Update to your live URL

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Premium Subscription',
                    },
                    unit_amount: 5000, // Example: $50 for subscription
                },
                quantity: 1,
            },
        ],
        mode: 'subscription',
        success_url: `${YOUR_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${YOUR_DOMAIN}/cancel`,
    });

    res.redirect(303, session.url);
});


app.use('/premium/*', (req, res, next) => {
    if (!req.user || !req.user.isPremium) {
        return res.status(403).json({ error: 'Premium features require a subscription.' });
    }
    next();
});

// Test route
app.get('/test', (req, res) => {
    res.send('I\'m working!');
});

// Start server
const port = process.env.PORT || 3000; // Heroku sets the PORT env variable, otherwise fallback to 3000 locally
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
