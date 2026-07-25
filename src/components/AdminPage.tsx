import React, { useState, useEffect } from 'react';

const AdminPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const ADMIN_USERNAME = 'venomous';
  const ADMIN_PASSWORD = 'venomous99';

  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (session === 'true') {
      setIsLoggedIn(true);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/admin');
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      localStorage.setItem('admin_session', 'true');
      localStorage.setItem('admin_username', username);
      setIsLoggedIn(true);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/admin');
      }
    } else {
      alert('Invalid credentials');
    }
  };

  if (isLoggedIn) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Admin Login</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label>Username</label>
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>
        <button type="submit" style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}>
          Sign In
        </button>
      </form>
    </div>
  );
};

export default AdminPage;
