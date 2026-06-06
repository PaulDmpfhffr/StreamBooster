import { useState, useEffect } from 'react';
import Onboarding from './pages/Onboarding';
import Main from './pages/Main';

interface Account {
  email: string;
  bandwidthBytesRemaining: number;
}

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    window.sbAPI.getAccount()
      .then((data) => {
        if (data && typeof (data as Account).email === 'string') {
          setAccount(data as Account);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = async () => {
    await window.sbAPI.logout();
    setAccount(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) {
    return <Onboarding onSuccess={setAccount} />;
  }

  return <Main account={account} onLogout={handleLogout} />;
}
