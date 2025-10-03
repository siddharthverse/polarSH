import { Polar } from '@polar-sh/sdk';

// Initialize Polar SDK
export const polar = new Polar({
  accessToken: import.meta.env.VITE_POLAR_ACCESS_TOKEN,
});

export interface CheckoutSessionData {
  product_id: string;
  success_url: string;
  cancel_url?: string;
}

export const createCheckoutSession = async (data: CheckoutSessionData) => {
  try {
    const response = await polar.checkouts.create({
      products: [data.product_id],
      successUrl: data.success_url,
      ...(data.cancel_url && { cancelUrl: data.cancel_url }),
    });
    
    return response;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const getCheckoutSession = async (sessionId: string) => {
  try {
    const response = await polar.checkouts.get({
      id: sessionId,
    });
    
    return response;
  } catch (error) {
    console.error('Error getting checkout session:', error);
    throw error;
  }
};