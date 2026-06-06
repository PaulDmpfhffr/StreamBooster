export interface BillingProductDto {
  id: string;
  name: string;
  description: string;
  bytes: number | null;
  priceEur: number;
  isSubscription: boolean;
  stripePriceId: string;
}

export interface CreateCheckoutDto {
  productId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResponseDto {
  checkoutUrl: string;
  sessionId: string;
}

export interface BandwidthTransactionDto {
  id: string;
  type: 'purchase' | 'consumption' | 'refund';
  bytesDelta: number;
  description: string;
  stripePaymentId: string | null;
  createdAt: string;
}

export interface AccountDto {
  id: string;
  email: string;
  role: 'user' | 'admin';
  bandwidthBytesRemaining: number;
  bandwidthBytesUsedTotal: number;
}
