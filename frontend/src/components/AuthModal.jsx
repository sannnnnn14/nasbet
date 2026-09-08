import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        toast.success('Welcome back! 🎉');
      } else {
        if (form.password !== form.confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }
        await register(form.username, form.email, form.password);
        toast.success('Account created! 🎉');
      }
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e',
        padding: '40px',
        borderRadius: '30px',
        maxWidth: '420px',
        width: '90%',
        border: '1px solid rgba(255,215,0,0.3)',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <button onClick={onClose} style={{ float: 'right', background: 'none', border: 'none', color: '#aaa', fontSize: '2rem', cursor: 'pointer' }}>×</button>
        <h2 style={{ color: '#ffd700', textAlign: 'center' }}>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              style={{ padding: '14px 20px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', background: '#2a2a44', color: '#fff', fontSize: '1rem' }}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({...form, email: e.target.value})}
            style={{ padding: '14px 20px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', background: '#2a2a44', color: '#fff', fontSize: '1rem' }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({...form, password: e.target.value})}
            style={{ padding: '14px 20px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', background: '#2a2a44', color: '#fff', fontSize: '1rem' }}
            required
          />
          {mode === 'register' && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={e => setForm({...form, confirmPassword: e.target.value})}
              style={{ padding: '14px 20px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.1)', background: '#2a2a44', color: '#fff', fontSize: '1rem' }}
              required
            />
          )}
          <button type="submit" disabled={loading} style={{
            background: 'linear-gradient(135deg, #f7971e, #ffd200)',
            border: 'none',
            padding: '16px',
            borderRadius: '40px',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 700,
            fontSize: '1rem',
            color: '#0a0a1a',
            cursor: 'pointer'
          }}>{loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center', color: '#aaa' }}>
          {mode === 'login' ? (
            <p>Don't have an account? <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: '#ffd700', cursor: 'pointer' }}>Register</button></p>
          ) : (
            <p>Already have an account? <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#ffd700', cursor: 'pointer' }}>Sign In</button></p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
