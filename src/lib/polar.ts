// Checkout helper functions - calls backend API instead of Polar directly
// This keeps the access token secure on the server

export interface CheckoutSessionData {
  product_id: string;
  success_url: string;
  cancel_url?: string;
  customer_email?: string; // Optional: Pass user's email to link to your system
  app_name?: string; // App to feature (Firefox, Firefox Focus, Safari)
  feature_date?: string; // Date when app will be featured
}

export const createCheckoutSession = async (data: CheckoutSessionData) => {
  try {
    console.log('🔄 Calling backend to create checkout...');

    const response = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create checkout');
    }

    const result = await response.json();
    console.log('✅ Checkout created via backend:', result.id);

    return result;
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    throw error;
  }
};

export const getCheckoutSession = async (sessionId: string) => {
  try {
    const response = await fetch(`/api/checkout/${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to get checkout session');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting checkout session:', error);
    throw error;
  }
};