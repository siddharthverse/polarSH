import { Webhook } from 'standardwebhooks';

export const verifyPolarWebhook = (
  payload: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): any => {
  let webhookSecret = secret;

  if (!webhookSecret) {
    throw new Error('POLAR_WEBHOOK_SECRET is not configured');
  }

  try {
    console.log('🔍 Original secret:', webhookSecret.substring(0, 15) + '...');

    // If the secret starts with polar_whs_, remove the prefix
    // The standardwebhooks library expects just the base64 part
    if (webhookSecret.startsWith('polar_whs_')) {
      webhookSecret = webhookSecret.replace('polar_whs_', '');
      console.log('🔍 Secret after removing prefix:', webhookSecret.substring(0, 15) + '...');
    }

    console.log('🔍 Webhook ID:', headers['webhook-id']);
    console.log('🔍 Webhook Signature:', headers['webhook-signature']);
    console.log('🔍 Webhook Timestamp:', headers['webhook-timestamp']);
    console.log('🔍 Payload length:', payload.length);

    const wh = new Webhook(webhookSecret);

    // The standardwebhooks library looks for specific header names
    // Let's pass all headers directly and let it find what it needs
    const verified = wh.verify(payload, headers);

    return verified;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    throw new Error('Webhook signature verification failed');
  }
};
