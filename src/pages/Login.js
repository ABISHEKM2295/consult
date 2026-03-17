import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import './Login.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      // Try to parse JSON response
      let data;
      try { data = await res.json(); } catch { data = {}; }

      if (!res.ok) {
        // data.error might be a string or a nested { message, status } object
        const errMsg = typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.message || 'Login failed';
        throw new Error(errMsg);
      }

      onLogin(data);
      navigate(data.role === 'client' ? '/client-portal' : '/');
    } catch (err) {
      // Network error (backend not running) gives "Failed to fetch"
      const msg = err.message === 'Failed to fetch'
        ? 'Cannot connect to server. Make sure the backend is running.'
        : (err.message || 'Invalid username or password');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-container">
      <div className="login-background">
        <div className="fabric-pattern"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="company-logo">
            <div className="logo-circle">PTD</div>
          </div>
          <h1>Premier Textile Dyers</h1>
          <p>Production Management System</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <User className="input-icon" size={20} />
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={20} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="login-footer">
            <p className="demo-credentials">
              <strong>Demo Credentials:</strong><br />
              Admin: admin / admin123<br />
              Operator: operator / operator123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
