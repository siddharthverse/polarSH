import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';

export const verifyPolarWebhook = (
  payload: Buffer | string,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): any => {
  if (!secret) {
    throw new Error('POLAR_WEBHOOK_SECRET is not configured');
  }

  try {
    // Use Polar's built-in validateEvent function
    // It handles all the signature verification automatically
    const event = validateEvent(payload, headers, secret);

    console.log('✅ Webhook signature verified successfully');
    return event;
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.error('❌ Webhook signature verification failed');
      throw new Error('Invalid webhook signature');
    }
    console.error('❌ Webhook verification error:', error);
    throw error;
  }
};
