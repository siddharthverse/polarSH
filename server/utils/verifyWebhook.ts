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
    // Convert Express headers to the format expected by validateEvent
    // standardwebhooks expects Record<string, string>
    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        normalizedHeaders[key] = Array.isArray(value) ? value[0] : value;
      }
    }

    // Use Polar's built-in validateEvent function
    // It handles all the signature verification automatically
    const event = validateEvent(payload, normalizedHeaders, secret);

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
