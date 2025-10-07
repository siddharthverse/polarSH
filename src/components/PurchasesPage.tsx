import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Payment {
  _id: string;
  checkoutId: string;
  productName?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  appName?: string;
  featureDate?: Date;
  discountCode?: string;
  discountAmount?: number;
  createdAt: Date;
  metadata?: {
    order_id?: string;
    refund_reason?: string;
    refunded_at?: Date;
  };
}

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');

  // Refund dialog state
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState('customer_request');
  const [refundComment, setRefundComment] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false);

  useEffect(() => {
    // Get user email from localStorage or prompt
    const email = localStorage.getItem('userEmail');
    if (!email) {
      const promptEmail = prompt('Please enter your email to view purchases:');
      if (!promptEmail) {
        navigate('/');
        return;
      }
      localStorage.setItem('userEmail', promptEmail);
      setUserEmail(promptEmail);
      fetchPayments(promptEmail);
    } else {
      setUserEmail(email);
      fetchPayments(email);
    }
  }, [navigate]);

  const fetchPayments = async (email: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments/user/${email}`);

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      setPayments(data);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Failed to load your purchase history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefundRequest = (payment: Payment) => {
    setSelectedPayment(payment);
    setRefundDialogOpen(true);
  };

  const submitRefund = async () => {
    if (!selectedPayment?.metadata?.order_id) {
      alert('Cannot process refund: Order ID not found');
      return;
    }

    setRefundProcessing(true);

    try {
      const response = await fetch('/api/refunds/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: selectedPayment.metadata.order_id,
          reason: refundReason,
          amount: selectedPayment.amount,
          comment: refundComment || undefined,
          revoke_benefits: true, // Revoke subscription access
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process refund');
      }

      const refund = await response.json();
      console.log('✅ Refund created:', refund);

      alert('Refund request submitted successfully! You will receive confirmation via email.');

      // Refresh payments list
      fetchPayments(userEmail);

      // Close dialog
      setRefundDialogOpen(false);
      setSelectedPayment(null);
      setRefundComment('');
      setRefundReason('customer_request');
    } catch (err) {
      console.error('Refund error:', err);
      alert(`Failed to process refund: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRefundProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      refunded: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your purchases...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Purchase History</h1>
              <p className="text-muted-foreground">
                Viewing purchases for: <span className="font-medium">{userEmail}</span>
                {' '}
                <button
                  onClick={() => {
                    localStorage.removeItem('userEmail');
                    window.location.reload();
                  }}
                  className="text-sm text-primary hover:underline ml-2"
                >
                  (Change)
                </button>
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </div>

        {/* Payments List */}
        {payments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No purchases found</p>
              <Button onClick={() => navigate('/')}>Browse Plans</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <Card key={payment._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl mb-1">
                        {payment.productName || 'Product'}
                      </CardTitle>
                      <CardDescription>
                        {new Date(payment.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </CardDescription>
                    </div>
                    {getStatusBadge(payment.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Payment Details */}
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Amount:</span>{' '}
                        <span className="font-medium text-lg">
                          ${(payment.amount / 100).toFixed(2)} {payment.currency || 'USD'}
                        </span>
                      </div>
                      {payment.discountCode && payment.discountAmount && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Discount:</span>{' '}
                          <span className="font-medium text-green-600">
                            {payment.discountCode} (-${(payment.discountAmount / 100).toFixed(2)})
                          </span>
                        </div>
                      )}
                      {payment.appName && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">App to Feature:</span>{' '}
                          <span className="font-medium">{payment.appName}</span>
                        </div>
                      )}
                      {payment.featureDate && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Feature Date:</span>{' '}
                          <span className="font-medium">
                            {new Date(payment.featureDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end">
                      {payment.status === 'completed' && payment.metadata?.order_id && (
                        <Button
                          variant="outline"
                          onClick={() => handleRefundRequest(payment)}
                          className="w-full md:w-auto"
                        >
                          Request Refund
                        </Button>
                      )}
                      {payment.status === 'refunded' && payment.metadata?.refunded_at && (
                        <div className="text-sm text-muted-foreground text-right">
                          <p className="font-medium mb-1">Refunded</p>
                          <p>
                            {new Date(payment.metadata.refunded_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          {payment.metadata.refund_reason && (
                            <p className="text-xs mt-1">
                              Reason: {payment.metadata.refund_reason.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Refund Dialog */}
        <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Refund</DialogTitle>
              <DialogDescription>
                Please provide a reason for your refund request. Your subscription will be canceled.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Refund Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <Select value={refundReason} onValueChange={setRefundReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer_request">Customer Request</SelectItem>
                    <SelectItem value="duplicate">Duplicate Purchase</SelectItem>
                    <SelectItem value="service_disruption">Service Disruption</SelectItem>
                    <SelectItem value="satisfaction_guarantee">Not Satisfied</SelectItem>
                    <SelectItem value="fraudulent">Fraudulent</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Comments (Optional)</label>
                <Textarea
                  value={refundComment}
                  onChange={(e) => setRefundComment(e.target.value)}
                  placeholder="Please provide any additional details..."
                  rows={4}
                />
              </div>

              {/* Refund Amount */}
              {selectedPayment && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground mb-1">Refund Amount</p>
                  <p className="text-2xl font-bold">
                    ${(selectedPayment.amount / 100).toFixed(2)} {selectedPayment.currency || 'USD'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Transaction fees are non-refundable
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRefundDialogOpen(false)}
                disabled={refundProcessing}
              >
                Cancel
              </Button>
              <Button onClick={submitRefund} disabled={refundProcessing}>
                {refundProcessing ? 'Processing...' : 'Submit Refund Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
