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
      let errorMessage = 'Failed to create checkout';
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('✅ Checkout created via backend:', result.id);

    return result;
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please make sure the server is running.');
    }
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

export const getPaymentBySession = async (sessionId: string) => {
  try {
    const response = await fetch(`/api/payments/session/${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to get payment details');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting payment details:', error);
    throw error;
  }
};

export const getUserPayments = async (email: string) => {
  try {
    const response = await fetch(`/api/payments/user/${email}`);

    if (!response.ok) {
      throw new Error('Failed to get user payments');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting user payments:', error);
    throw error;
  }
};

export interface RefundRequest {
  order_id: string;
  reason: 'customer_request' | 'duplicate' | 'fraudulent' | 'service_disruption' | 'satisfaction_guarantee' | 'other';
  amount: number;
  comment?: string;
  revoke_benefits?: boolean;
}

export const createRefund = async (data: RefundRequest) => {
  try {
    const response = await fetch('/api/refunds/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create refund');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating refund:', error);
    throw error;
  }
};