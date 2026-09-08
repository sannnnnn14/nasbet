import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import toast from 'react-hot-toast';

const Admin = () => {
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('transactions');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tRes, uRes, sRes] = await Promise.all([
        api.get('/admin/transactions/pending'),
        api.get('/admin/users'),
        api.get('/admin/dashboard/stats')
      ]);
      setTransactions(tRes.data);
      setUsers(uRes.data);
      setStats(sRes.data);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/admin/transactions/${id}/approve`);
      toast.success('Approved!');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/admin/transactions/${id}/reject`);
      toast.success('Rejected!');
      fetchData();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>Loading...</div>;

  return (
    <div style={{ padding: '40px 50px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ color: '#fff', fontSize: '2.5rem', borderLeft: '6px solid #ffd700', paddingLeft: '20px' }}>🎰 Admin Dashboard</h1>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        margin: '30px 0'
      }}>
        {[
          { label: 'Total Users', value: stats.totalUsers || 0 },
          { label: 'Pending Transactions', value: stats.pendingTransactions || 0 },
          { label: 'Total Deposits', value: `$${stats.totalDeposits?.toFixed(2) || '0.00'}` },
          { label: 'Total Withdrawals', value: `$${stats.totalWithdrawals?.toFixed(2) || '0.00'}` }
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(255,215,0,0.1)'
          }}>
            <h3 style={{ color: '#aaa', fontSize: '0.9rem' }}>{stat.label}</h3>
            <p style={{ color: '#ffd700', fontSize: '1.8rem', fontWeight: 700 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => setTab('transactions')} style={{
          padding: '12px 24px',
          borderRadius: '30px',
          border: tab === 'transactions' ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
          background: tab === 'transactions' ? 'linear-gradient(135deg, #f7971e, #ffd200)' : 'rgba(255,255,255,0.05)',
          color: tab === 'transactions' ? '#0a0a1a' : '#aaa',
          cursor: 'pointer',
          fontFamily: 'Orbitron, sans-serif'
        }}>Pending Transactions</button>
        <button onClick={() => setTab('users')} style={{
          padding: '12px 24px',
          borderRadius: '30px',
          border: tab === 'users' ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
          background: tab === 'users' ? 'linear-gradient(135deg, #f7971e, #ffd200)' : 'rgba(255,255,255,0.05)',
          color: tab === 'users' ? '#0a0a1a' : '#aaa',
          cursor: 'pointer',
          fontFamily: 'Orbitron, sans-serif'
        }}>Users</button>
      </div>

      {tab === 'transactions' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,215,0,0.05)' }}>
          <h2 style={{ color: '#fff', marginBottom: '20px' }}>Pending ({transactions.length})</h2>
          {transactions.length === 0 ? (
            <p style={{ color: '#aaa', textAlign: 'center', padding: '40px' }}>No pending transactions</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>User</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Method</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ padding: '14px 16px', color: '#ddd', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.username}</td>
                    <td style={{ padding: '14px 16px', color: tx.type === 'deposit' ? '#2ecc71' : '#e74c3c', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.type}</td>
                    <td style={{ padding: '14px 16px', color: '#ddd', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>${tx.amount}</td>
                    <td style={{ padding: '14px 16px', color: '#ddd', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.method}</td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <button onClick={() => handleApprove(tx.id)} style={{
                        background: '#2ecc71',
                        border: 'none',
                        color: '#fff',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        marginRight: '8px',
                        fontFamily: 'Orbitron, sans-serif',
                        fontSize: '0.7rem'
                      }}>Approve</button>
                      <button onClick={() => handleReject(tx.id)} style={{
                        background: '#e74c3c',
                        border: 'none',
                        color: '#fff',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontFamily: 'Orbitron, sans-serif',
                        fontSize: '0.7rem'
                      }}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255,215,0,0.05)' }}>
          <h2 style={{ color: '#fff', marginBottom: '20px' }}>All Users ({users.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Username</th>
                <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Balance</th>
                <th style={{ textAlign: 'left', padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ padding: '14px 16px', color: '#ddd', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{user.username}</td>
                  <td style={{ padding: '14px 16px', color: '#ddd', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{user.email}</td>
                  <td style={{ padding: '14px 16px', color: '#ffd700', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>${user.balance}</td>
                  <td style={{ padding: '14px 16px', color: user.role === 'admin' ? '#ffd700' : '#aaa', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{user.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Admin;
