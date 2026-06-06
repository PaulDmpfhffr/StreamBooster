import { useState } from 'react';
import Onboarding from './pages/Onboarding';
import Main from './pages/Main';

interface Account {
  email: string;
  bandwidthBytesRemaining: number;
}

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);

  const handleLogout = async () => {
    await window.sbAPI.logout();
    setAccount(null);
  };

  if (!account) {
    return <Onboarding onSuccess={setAccount} />;
  }

  return <Main account={account} onLogout={handleLogout} />;
}
