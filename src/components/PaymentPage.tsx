import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/lib/polar";

interface PaymentPageProps {
  onPaymentInitiated: () => void;
}

interface PricingTier {
  _id?: string;
  polarProductId: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  tier: string;
  features: string[];
  highlighted?: boolean;
  active?: boolean;
}

const defaultPricingTiers: PricingTier[] = [
  {
    polarProductId: "free",
    name: "Free",
    description: "Perfect for getting started",
    price: 0,
    interval: "forever",
    tier: "free",
    features: [
      "Up to 3 projects",
      "Basic analytics",
      "Community support",
      "5GB storage",
    ],
  },
  {
    polarProductId: "pro_monthly",
    name: "Pro",
    description: "Best for growing teams",
    price: 9.99,
    interval: "month",
    tier: "pro",
    highlighted: true,
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority email support",
      "100GB storage",
      "Custom integrations",
      "Team collaboration",
      "Advanced reporting",
    ],
  },
  {
    polarProductId: "enterprise_monthly",
    name: "Enterprise",
    description: "For large organizations",
    price: 29.99,
    interval: "month",
    tier: "enterprise",
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "24/7 phone support",
      "Unlimited storage",
      "SSO & advanced security",
      "Custom contracts",
      "On-premise deployment",
      "SLA guarantees",
    ],
  },
];

export default function PaymentPage({ onPaymentInitiated }: PaymentPageProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(defaultPricingTiers);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch products from API
    const fetchProducts = async () => {
      try {
        console.log('🔄 Fetching products from /api/products...');
        const response = await fetch('/api/products');
        console.log('📡 Response status:', response.status);

        if (response.ok) {
          const products = await response.json();
          console.log('📦 Products received:', products);

          if (products.length > 0) {
            setPricingTiers(products);
            console.log('✅ Products loaded from database:', products.length);
          }
        } else {
          console.warn('⚠️ Failed to fetch products, using defaults. Status:', response.status);
          setFetchError('Using default pricing (database not connected)');
        }
      } catch (error) {
        console.error('❌ Failed to fetch products:', error);
        setFetchError('Using default pricing (server not running)');
      }
    };

    fetchProducts();
  }, []);

  const handlePayment = async (tier: PricingTier) => {
    console.log('💳 Payment button clicked for tier:', tier);

    if (tier.tier === "free") {
      alert("Free tier is already active!");
      return;
    }

    setIsLoading(tier.polarProductId);
    try {
      console.log('🔄 Creating checkout session with product_id:', tier.polarProductId);

      const checkoutSession = await createCheckoutSession({
        product_id: tier.polarProductId || import.meta.env.VITE_POLAR_PRODUCT_ID,
        success_url: `${window.location.origin}/confirmation?status=success&plan=${tier.tier}`,
        cancel_url: `${window.location.origin}/confirmation?status=failed`,
      });

      console.log('✅ Checkout session created:', checkoutSession);

      if (checkoutSession.url) {
        onPaymentInitiated();
        console.log('🔗 Redirecting to:', checkoutSession.url);
        window.location.href = checkoutSession.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("❌ Payment failed:", error);
      setIsLoading(null);
      alert(`Payment initialization failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  return (
    <div className="subscription-container">
      <div className="container mx-auto px-4 py-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-16 slide-in-left">
          <h1
            className="text-5xl md:text-6xl font-bold mb-6 text-white bounce-in"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
          >
            Choose Your Plan
          </h1>
          <p
            className="text-xl text-white max-w-2xl mx-auto leading-relaxed"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
          >
            Select the perfect plan for your needs. Upgrade or downgrade at any
            time with no hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <div
              key={tier._id || tier.polarProductId}
              className={`pricing-card fade-in-up ${
                tier.highlighted ? "pricing-card-highlighted" : ""
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {tier.highlighted && (
                <div className="popular-badge absolute top-0 left-1/2 text-white px-6 py-2 rounded-full text-sm font-semibold z-10">
                  ⭐ Most Popular
                </div>
              )}

              <div className="text-center p-8 pb-4">
                <h3 className="text-3xl font-bold mb-2 text-gray-900">
                  {tier.name}
                </h3>
                <p className="text-gray-700 mb-6">{tier.description}</p>

                <div className="flex items-baseline justify-center mb-8">
                  <span className="text-5xl font-bold text-gray-900">
                    ${tier.price === 0 ? "0" : tier.price}
                  </span>
                  {tier.price > 0 && (
                    <span className="text-gray-700 ml-2 text-lg">
                      /{tier.interval}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-8 pb-8 space-y-8">
                <ul className="space-y-4">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-6 h-6 feature-check mr-4 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-900 font-medium">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePayment(tier)}
                  className={`w-full text-lg py-6 font-semibold ${
                    tier.highlighted
                      ? "gradient-button text-white"
                      : tier.tier === "free"
                      ? "bg-gray-200 hover:bg-gray-300 text-gray-800"
                      : "gradient-button text-white"
                  }`}
                  disabled={isLoading === tier.polarProductId}
                >
                  {isLoading === tier.polarProductId ? (
                    <div className="flex items-center justify-center">
                      <div className="loading-spinner rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Processing...
                    </div>
                  ) : tier.tier === "free" ? (
                    "Current Plan"
                  ) : (
                    `Get Started with ${tier.name}`
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="mt-20 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
            <div className="trust-indicator flex items-center">
              <svg
                className="w-6 h-6 text-green-500 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-semibold text-gray-900">SSL Encrypted</span>
            </div>
            <div className="trust-indicator flex items-center">
              <svg
                className="w-6 h-6 text-green-500 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-semibold text-gray-900">
                Money-back Guarantee
              </span>
            </div>
            <div className="trust-indicator flex items-center">
              <svg
                className="w-6 h-6 text-green-500 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-semibold text-gray-900">
                Cancel Anytime
              </span>
            </div>
          </div>
          <p
            className="text-white text-lg"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
          >
            🔒 Secure payment powered by Polar SH • Trusted by thousands of
            users worldwide
          </p>
        </div>
      </div>
    </div>
  );
}
