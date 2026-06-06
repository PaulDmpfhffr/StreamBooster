import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatBytes } from '../lib/utils';
import { Zap, Infinity as InfinityIcon } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  bytes: number | null;
  priceEur: number;
  isSubscription: boolean;
}

export default function Billing() {
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/billing/products').then((r) => r.data),
  });

  const checkout = useMutation({
    mutationFn: (productId: string) =>
      api.post('/billing/checkout', {
        productId,
        successUrl: `${window.location.origin}/dashboard?payment=success`,
        cancelUrl: `${window.location.origin}/billing`,
      }).then((r) => r.data),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Facturation</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <div
            key={p.id}
            className={`bg-gray-900 rounded-xl border p-6 flex flex-col ${
              p.id === 'pro' ? 'border-brand-500' : 'border-gray-800'
            }`}
          >
            {p.id === 'pro' && (
              <span className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-3">
                Populaire
              </span>
            )}
            <h3 className="text-lg font-bold text-white">{p.name}</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">{p.description}</p>

            <div className="flex items-center gap-2 mb-6">
              {p.bytes ? (
                <Zap size={18} className="text-yellow-400" />
              ) : (
                <InfinityIcon size={18} className="text-purple-400" />
              )}
              <span className="text-sm text-gray-300">
                {p.bytes ? formatBytes(p.bytes) : 'Illimité'}
              </span>
            </div>

            <div className="mt-auto">
              <p className="text-3xl font-bold text-white">
                {p.priceEur.toFixed(2)} €
                {p.isSubscription && <span className="text-sm font-normal text-gray-400">/mois</span>}
              </p>
              <button
                onClick={() => checkout.mutate(p.id)}
                disabled={checkout.isPending}
                className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {checkout.isPending ? 'Redirection...' : 'Acheter'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
