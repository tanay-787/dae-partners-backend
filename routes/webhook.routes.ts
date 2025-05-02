import express from 'express';
import { handleRazorpayWebhook } from '../controllers/webhook.controller';
import bodyParser from 'body-parser';

const router = express.Router();

// Razorpay webhook endpoint
// It's crucial to use bodyParser.raw() here before the handler
// as signature verification requires the raw request body.
// The verify function is necessary to attach the raw body to req.rawBody
router.post('/razorpay', bodyParser.raw({ type: '*/', verify: (req: any, res, buf) => { req.rawBody = buf; } }), handleRazorpayWebhook);

export default router;