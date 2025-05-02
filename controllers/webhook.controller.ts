import { Request, Response } from 'express';
import prisma from "../prisma/prismaClient";
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '123';

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = rnpm install && npx prisma generate && npx prisma migrate deploy
.rawBody; // Requires body-parser configured with { verify:..., raw: true }

    if (!signature || !body) {
        return res.status(400).send('Missing signature or body');
    }

    // Verify the signature
    const expectedSignature = crypto
        .createHmac('sha256', razorpayWebhookSecret)
        .update(body)
        .digest('hex');

    if (expectedSignature !== signature) {
        console.error('Webhook signature verification failed.');
        return res.status(400).send('Invalid signature');
    }

    const event = req.body; // Parsed JSON body after verification

    try {
        console.log('Received Razorpay webhook event:', event.event);

        // Handle different event types
        switch (event.event) {
            case 'payment.captured':
                // Payment was successful
                const payment = event.payload.payment.entity;
                const razorpayOrderId = payment.order_id; // Get Razorpay Order ID

                // Find your internal order by razorpayOrderId and update its status
                const order = await prisma.order.findUnique({
                    where: { razorpayOrderId: razorpayOrderId },
                });

                if (order) {
                    await prisma.order.update({
                        where: { id: order.id },
                        data: {
                            status: 'Processing', // Or 'Paid' or relevant next status
                            // Optionally store more payment details here (payment.id, method, etc.)
                            // razorpayPaymentId: payment.id, // Add field to schema if needed
                        },
                    });
                    console.log(`Order ${order.id} status updated to Processing (payment captured).`);
                } else {
                    console.warn(`Order with Razorpay ID ${razorpayOrderId} not found in DB.`);
                }
                break;

            case 'payment.failed':
                // Payment failed
                const failedPayment = event.payload.payment.entity;
                const failedRazorpayOrderId = failedPayment.order_id;

                 const failedOrder = await prisma.order.findUnique({
                    where: { razorpayOrderId: failedRazorpayOrderId },
                });

                if (failedOrder && failedOrder.status === 'PendingPayment') {
                    await prisma.order.update({
                        where: { id: failedOrder.id },
                        data: {
                            status: 'PaymentFailed', // Or 'Cancelled'
                            // Optionally store failure reason
                            // paymentFailureReason: failedPayment.error_description,
                        },
                    });
                     console.log(`Order ${failedOrder.id} status updated to PaymentFailed.`);
                      // TODO: Handle inventory rollback or notification for failed payment if needed
                } else if (!failedOrder) {
                     console.warn(`Failed payment webhook received for unknown order with Razorpay ID ${failedRazorpayOrderId}.`);
                }
                // If order status is not PendingPayment, it might be a duplicate webhook or already handled
                break;

            // TODO: Handle other relevant webhook events (e.g., 'order.paid' if you created order first in Razorpay)
            // Razorpay recommends handling 'payment.captured' for Orders created via their Orders API.

            default:
                // Handle other event types or ignore
                console.log(`Unhandled Razorpay event type: ${event.event}`);
                break;
        }

        // Acknowledge receipt of the event
        res.status(200).send('Webhook received');

    } catch (error) {
        console.error('Error processing Razorpay webhook:', error);
        // Respond with 500 to signal failure, but be cautious not to get into a retry loop
        res.status(500).send('Error processing webhook');
    }
};
