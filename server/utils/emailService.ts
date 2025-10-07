/**
 * Email Service Utility
 *
 * This is a placeholder for sending emails to customers.
 * You can integrate with your preferred email service:
 * - Resend (recommended for developers)
 * - SendGrid
 * - Nodemailer (SMTP)
 * - AWS SES
 * - Postmark
 */

interface InvoiceEmailData {
  customerEmail: string;
  customerName?: string;
  invoiceUrl: string;
  orderId: string;
  amount: number;
  currency: string;
  productName?: string;
}

interface RefundEmailData {
  customerEmail: string;
  customerName?: string;
  orderId: string;
  refundAmount: number;
  currency: string;
  refundReason: string;
  productName?: string;
}

/**
 * Send invoice email to customer
 */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<void> {
  console.log('📧 Sending invoice email to:', data.customerEmail);
  console.log('📄 Invoice URL:', data.invoiceUrl);
  console.log('💰 Amount:', `$${(data.amount / 100).toFixed(2)} ${data.currency}`);

  // TODO: Integrate with your email service
  // Example with Resend:
  /*
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'noreply@yourdomain.com',
    to: data.customerEmail,
    subject: `Invoice for your purchase - Order ${data.orderId}`,
    html: `
      <h2>Thank you for your purchase!</h2>
      <p>Hi ${data.customerName || 'there'},</p>
      <p>Your payment has been processed successfully.</p>
      <p><strong>Order ID:</strong> ${data.orderId}</p>
      <p><strong>Product:</strong> ${data.productName || 'Subscription'}</p>
      <p><strong>Amount:</strong> $${(data.amount / 100).toFixed(2)} ${data.currency}</p>
      <p><a href="${data.invoiceUrl}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Download Invoice</a></p>
      <p>If you have any questions, please contact support.</p>
      <p>Best regards,<br>Your Team</p>
    `,
  });
  */

  // For now, just log that we would send an email
  console.log('✅ Invoice email would be sent (email service not configured)');
  console.log('ℹ️ To enable emails, integrate with Resend, SendGrid, or another email service');
}

/**
 * Send refund confirmation email to customer
 */
export async function sendRefundEmail(data: RefundEmailData): Promise<void> {
  console.log('📧 Sending refund confirmation to:', data.customerEmail);
  console.log('💸 Refund Amount:', `$${(data.refundAmount / 100).toFixed(2)} ${data.currency}`);
  console.log('📝 Reason:', data.refundReason);

  // TODO: Integrate with your email service
  // Example with Resend:
  /*
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'noreply@yourdomain.com',
    to: data.customerEmail,
    subject: `Refund Processed - Order ${data.orderId}`,
    html: `
      <h2>Refund Confirmation</h2>
      <p>Hi ${data.customerName || 'there'},</p>
      <p>Your refund has been processed successfully.</p>
      <p><strong>Order ID:</strong> ${data.orderId}</p>
      <p><strong>Product:</strong> ${data.productName || 'Subscription'}</p>
      <p><strong>Refund Amount:</strong> $${(data.refundAmount / 100).toFixed(2)} ${data.currency}</p>
      <p><strong>Reason:</strong> ${data.refundReason.replace(/_/g, ' ')}</p>
      <p>The refund will appear in your account within 5-10 business days.</p>
      <p>If you have any questions, please contact support.</p>
      <p>Best regards,<br>Your Team</p>
    `,
  });
  */

  // For now, just log that we would send an email
  console.log('✅ Refund email would be sent (email service not configured)');
  console.log('ℹ️ To enable emails, integrate with Resend, SendGrid, or another email service');
}

/**
 * Helper to check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  // Check for email service API keys
  return !!(
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY ||
    process.env.SMTP_HOST
  );
}
