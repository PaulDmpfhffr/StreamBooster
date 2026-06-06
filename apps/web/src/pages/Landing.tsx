import { Link } from 'react-router-dom';
import { Zap, Shield, Monitor, Globe } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-brand-500">StreamBooster</h1>
        <div className="flex gap-4">
          <Link to="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
            Connexion
          </Link>
          <Link
            to="/register"
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Commencer
          </Link>
        </div>
      </nav>

      <section className="text-center py-24 px-8">
        <h2 className="text-5xl font-bold text-white mb-6">
          Boostez vos streams avec <span className="text-brand-500">plusieurs viewers</span>
        </h2>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Lancez jusqu'à des dizaines d'instances de visionnage simultanées depuis votre machine,
          avec des proxys résidentiels premium.
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl text-lg font-semibold transition-colors"
        >
          <Zap size={20} />
          Démarrer gratuitement
        </Link>
      </section>

      <section className="px-8 py-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <Monitor size={28} className="text-brand-500" />,
              title: 'App desktop légère',
              desc: 'Electron + Playwright — s\'exécute sur votre machine, aucun serveur dédié.',
            },
            {
              icon: <Globe size={28} className="text-green-400" />,
              title: 'Proxys résidentiels',
              desc: 'Pool de proxys résidentiels et mobiles, indétectables comme bots.',
            },
            {
              icon: <Shield size={28} className="text-purple-400" />,
              title: 'Paiement à l\'usage',
              desc: 'Achetez uniquement la bande passante dont vous avez besoin.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-8 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-12">Tarifs simples</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            { name: 'Starter', bytes: '10 Go', price: '4,99 €' },
            { name: 'Standard', bytes: '50 Go', price: '19,99 €' },
            { name: 'Pro', bytes: '200 Go', price: '59,99 €' },
            { name: 'Unlimited', bytes: '∞', price: '99,99 €/mois' },
          ].map((p) => (
            <div key={p.name} className="bg-gray-900 rounded-xl border border-gray-800 p-5 text-center">
              <p className="text-white font-semibold">{p.name}</p>
              <p className="text-brand-500 text-2xl font-bold my-2">{p.bytes}</p>
              <p className="text-gray-400 text-sm">{p.price}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
