import React, { useState, useEffect, useCallback } from 'react';
import { DamlLedger } from '@c7/react';
import { MarginDashboard } from './MarginDashboard';
import './App.css'; // Assuming a basic CSS file for styling

// --- Constants ---
const LEDGER_URL = 'http://localhost:7575';
const TOKEN_STORAGE_KEY = 'clearinghouse-app-token';
const PARTY_ID_STORAGE_KEY = 'clearinghouse-app-party-id';

type Credentials = {
  partyId: string;
  token: string;
};

// --- Login Component ---
const Login: React.FC<{ onLogin: (creds: Credentials) => void }> = ({ onLogin }) => {
  const [partyId, setPartyId] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId.trim() || !token.trim()) {
      setError('Party ID and Token are required.');
      return;
    }
    setError('');
    onLogin({ partyId, token });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Derivatives Clearing Portal</h2>
        <p>
          Login with your Party ID and a corresponding JWT token.
          <br />
          In a production environment, this would be an OAuth flow.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="partyId">Party ID</label>
            <input
              id="partyId"
              type="text"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              placeholder="Enter your Party ID"
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label htmlFor="token">Ledger JWT Token</label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your JWT token"
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="login-button">
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Main Application Component ---
const App: React.FC = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  useEffect(() => {
    // On initial load, check local storage for saved credentials
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedPartyId = localStorage.getItem(PARTY_ID_STORAGE_KEY);

    if (savedToken && savedPartyId) {
      setCredentials({ token: savedToken, partyId: savedPartyId });
    }
  }, []);

  const handleLogin = useCallback((creds: Credentials) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, creds.token);
    localStorage.setItem(PARTY_ID_STORAGE_KEY, creds.partyId);
    setCredentials(creds);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(PARTY_ID_STORAGE_KEY);
    setCredentials(null);
  }, []);

  if (!credentials) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <DamlLedger
      token={credentials.token}
      party={credentials.partyId}
      httpBaseUrl={LEDGER_URL}
    >
      <div className="app-container">
        <header className="app-header">
          <div className="header-title">
            <h1>Derivatives Clearing Portal</h1>
          </div>
          <div className="header-user-info">
            <span>
              Logged in as: <strong>{credentials.partyId}</strong>
            </span>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        </header>
        <main className="app-main">
          <MarginDashboard />
        </main>
        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} Canton Derivatives Clearing. All rights reserved.</p>
        </footer>
      </div>
    </DamlLedger>
  );
};

export default App;