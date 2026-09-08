import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthModal from './AuthModal.jsx';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  return (
    <>
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 50px',
        background: 'rgba(10,10,26,0.95)',
        borderBottom: '1px solid rgba(255,215,0,0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 999
      }}>
        <Link to="/" style={{
          fontSize: '2rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #f7971e, #ffd200)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textDecoration: 'none'
        }}>🎰 PLAY BIG</Link>

        <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
          <Link to="/" style={{ color: '#ccc', textDecoration: 'none' }}>Home</Link>
          {user?.role === 'admin' && <Link to="/admin" style={{ color: '#ccc', textDecoration: 'none' }}>Admin</Link>}
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ color: '#ffd700', padding: '8px 16px', background: 'rgba(255,215,0,0.1)', borderRadius: '20px' }}>
                💰 ${user.balance?.toFixed(2)}
              </span>
              <button onClick={logout} style={{
                background: 'transparent',
                border: '1px solid #ff4444',
                color: '#ff4444',
                padding: '8px 20px',
                borderRadius: '30px',
                cursor: 'pointer',
                fontFamily: 'Orbitron, sans-serif'
              }}>Logout</button>
            </>
          ) : (
            <>
              <button onClick={() => { setAuthMode('login'); setShowAuth(true); }} style={{
                background: 'transparent',
                border: '1px solid #ffd700',
                color: '#ffd700',
                padding: '8px 20px',
                borderRadius: '30px',
                cursor: 'pointer',
                fontFamily: 'Orbitron, sans-serif'
              }}>Login</button>
              <button onClick={() => { setAuthMode('register'); setShowAuth(true); }} style={{
                background: 'linear-gradient(135deg, #f7971e, #ffd200)',
                border: 'none',
                color: '#0a0a1a',
                padding: '8px 20px',
                borderRadius: '30px',
                cursor: 'pointer',
                fontFamily: 'Orbitron, sans-serif'
              }}>Register</button>
            </>
          )}
        </div>
      </nav>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} initialMode={authMode} />
    </>
  );
};

export default Navbar;
