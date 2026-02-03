const Razorpay = require('razorpay');

/**
 * Razorpay Configuration
 * Initializes Razorpay instance with API credentials from environment variables
 */

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Validate that Razorpay credentials are configured
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn('⚠️  Razorpay credentials not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.');
    console.warn('   Razorpay payments will not work until configured.');
}

module.exports = razorpayInstance;
