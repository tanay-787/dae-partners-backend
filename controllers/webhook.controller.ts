import { Request, Response } from 'express';
import prisma from "../prisma/prismaClient";
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123');
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_123';

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    // Ensure body-parser is configured with { rawBody: true } or similar to get the raw body
    const body = (req as any).rawBody; 

    if (!signature || !body) {
        return res.status(400).send('Missing signature or body');
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
            console.log(`PaymentIntent was successful: ${paymentIntentSucceeded.id}`);
            // Fulfill the purchase, e.g., update order status in your database
            const orderIdSucceeded = paymentIntentSucceeded.metadata.orderId;
            if (orderIdSucceeded) {
                try {
                    await prisma.order.update({
                        where: { id: orderIdSucceeded },
                        data: {
                            status: 'Processing', // Update status
                            // Store payment intent ID if you added the field
                            // stripePaymentIntentId: paymentIntentSucceeded.id,
                        },
                    });
                    console.log(`Order ${orderIdSucceeded} status updated to Processing.`);
                } catch (dbError) {
                    console.error(`Error updating order ${orderIdSucceeded} in DB:`, dbError);
                    // Depending on your retry strategy, you might want to re-throw or handle differently
                }
            } else {
                console.warn(`Received payment_intent.succeeded webhook without orderId in metadata for PaymentIntent: ${paymentIntentSucceeded.id}`);
            }
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
            console.log(`PaymentIntent failed: ${paymentIntentFailed.id}`);
            // Notify the user, rollback inventory, etc.
            const orderIdFailed = paymentIntentFailed.metadata.orderId;
             if (orderIdFailed) {
                try {
                    await prisma.order.update({
                        where: { id: orderIdFailed },
                        data: {
                            status: 'PaymentFailed', // Update status
                            // Store failure reason if needed
                            // paymentFailureReason: paymentIntentFailed.last_payment_error?.message,
                        },
                    });
                    console.log(`Order ${orderIdFailed} status updated to PaymentFailed.`);
                     // TODO: Handle inventory rollback or notification for failed payment if needed
                } catch (dbError) {
                    console.error(`Error updating order ${orderIdFailed} in DB:`, dbError);
                }
            } else {
                console.warn(`Received payment_intent.payment_failed webhook without orderId in metadata for PaymentIntent: ${paymentIntentFailed.id}`);
            }
            break;

        // Handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).json({ received: true });
};
