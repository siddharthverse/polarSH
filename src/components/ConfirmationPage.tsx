import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCheckoutSession, getPaymentBySession } from '@/lib/polar';

type PaymentStatus = 'success' | 'failed' | 'loading';

interface PaymentDetails {
  appName?: string;
  featureDate?: Date;
  productName?: string;
  amount?: number;
  currency?: string;
}

export default function ConfirmationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [message, setMessage] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);

  useEffect(() => {
    const validatePayment = async () => {
      const paymentStatus = searchParams.get('status');
      const sessionId = searchParams.get('session_id');

      if (paymentStatus === 'failed') {
        setStatus('failed');
        setMessage('Payment was cancelled or failed. Please try again.');
        return;
      }

      if (sessionId) {
        try {
          // Validate the session with Polar SH
          const session = await getCheckoutSession(sessionId);

          if (session.status === 'confirmed') {
            setStatus('success');
            setMessage('Your payment has been processed successfully!');

            // Fetch payment details to get app name and feature date
            try {
              const payment = await getPaymentBySession(sessionId);
              setPaymentDetails({
                appName: payment.appName,
                featureDate: payment.featureDate,
                productName: payment.productName,
                amount: payment.amount,
                currency: payment.currency,
              });
            } catch (err) {
              console.error('Failed to fetch payment details:', err);
            }
          } else if (session.status === 'expired') {
            setStatus('failed');
            setMessage('Payment session expired. Please try again.');
          } else if (session.status === 'open') {
            setStatus('failed');
            setMessage('Payment is still pending. Please complete the checkout process.');
          } else {
            setStatus('failed');
            setMessage('Payment could not be completed. Please try again.');
          }
        } catch (error) {
          console.error('Error validating session:', error);
          setStatus('failed');
          setMessage('Unable to verify payment status. Please contact support.');
        }
      } else if (paymentStatus === 'success') {
        // Fallback for direct success status without session ID
        setStatus('success');
        setMessage('Your payment has been processed successfully!');
      } else {
        setStatus('failed');
        setMessage('Invalid payment session. Please try again.');
      }
    };

    validatePayment();
  }, [searchParams]);

  const handleReturnHome = () => {
    navigate('/');
  };

  const handleRetry = () => {
    navigate('/');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Processing your payment...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {status === 'success' ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Payment Successful
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                Payment Failed
              </div>
            )}
          </CardTitle>
          <CardDescription className="text-center">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' ? (
            <div className="space-y-4">
              {paymentDetails && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm">Purchase Details</h3>
                  {paymentDetails.productName && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Plan:</span>{' '}
                      <span className="font-medium">{paymentDetails.productName}</span>
                    </div>
                  )}
                  {paymentDetails.appName && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">App to Feature:</span>{' '}
                      <span className="font-medium">{paymentDetails.appName}</span>
                    </div>
                  )}
                  {paymentDetails.featureDate && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Feature Date:</span>{' '}
                      <span className="font-medium">
                        {new Date(paymentDetails.featureDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  {paymentDetails.amount && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Amount:</span>{' '}
                      <span className="font-medium">
                        ${(paymentDetails.amount / 100).toFixed(2)} {paymentDetails.currency || 'USD'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="text-sm text-muted-foreground text-center">
                <p>You now have access to all premium features.</p>
                <p className="mt-2">A confirmation email has been sent to your inbox.</p>
              </div>
              <div className="flex flex-col space-y-2">
                <Button onClick={handleReturnHome} className="w-full">
                  Continue to Dashboard
                </Button>
                <Button onClick={() => navigate('/purchases')} variant="outline" className="w-full">
                  View Purchase History
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                <p>Don't worry, your card was not charged.</p>
                <p className="mt-2">Please check your payment details and try again.</p>
              </div>
              <div className="flex flex-col space-y-2">
                <Button onClick={handleRetry} className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleReturnHome} variant="outline" className="w-full">
                  Back to Home
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}