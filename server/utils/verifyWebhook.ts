import { Webhook } from 'standardwebhooks';

export const verifyPolarWebhook = (
  payload: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): any => {
  const webhookSecret = secret;

  if (!webhookSecret) {
    throw new Error('POLAR_WEBHOOK_SECRET is not configured');
  }

  try {
    const wh = new Webhook(webhookSecret);

    // Extract signature from headers
    const signature = headers['webhook-signature'] || headers['Webhook-Signature'];

    if (!signature || typeof signature !== 'string') {
      throw new Error('Missing webhook signature');
    }

    // Verify and parse the webhook payload
    const verified = wh.verify(payload, {
      'webhook-signature': signature,
    });

    return verified;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    throw new Error('Webhook signature verification failed');
  }
};
