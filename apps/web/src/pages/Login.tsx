import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">StreamBooster</h1>
          <p className="text-gray-400 mt-2">Connexion à votre compte</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-xl p-8 space-y-5 border border-gray-800"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
              Email ou mot de passe incorrect
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Connexion...' : 'Se connecter'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-brand-500 hover:underline">
              S'inscrire
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
