import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import Game3D from '../components/Game3D.jsx';

const Home = () => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    api.get('/games').then(res => setGames(res.data)).catch(console.error);
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background: 'radial-gradient(circle at center, #1a1a3e, #0a0a1a)',
        padding: '40px 20px'
      }}>
        <div>
          <h1 style={{
            fontSize: '4.5rem',
            fontWeight: 900,
            lineHeight: '1.1',
            marginBottom: '20px'
          }}>
            PLAY BIG<br />
            <span style={{
              background: 'linear-gradient(135deg, #f7971e, #ffd200)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>WIN BIGGER</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#aaa', marginBottom: '30px' }}>
            Your favorite casino games, all in one place.
          </p>
          <button style={{
            background: 'linear-gradient(135deg, #f7971e, #ffd200)',
            border: 'none',
            padding: '18px 48px',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 700,
            fontSize: '1.2rem',
            color: '#0a0a1a',
            borderRadius: '50px',
            cursor: 'pointer'
          }}>🎯 PLAY NOW</button>
        </div>
      </section>

      {/* Games Section */}
      <section style={{ padding: '60px 50px', maxWidth: '1400px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '40px', borderLeft: '6px solid #ffd700', paddingLeft: '20px' }}>
          🔥 Top Games
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '30px'
        }}>
          {games.map(game => (
            <div key={game.id} style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid rgba(255,215,0,0.1)',
              transition: '0.3s'
            }}>
              <div style={{ height: '200px' }}>
                <Game3D type={game.type} />
              </div>
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3 style={{ color: '#fff' }}>{game.name}</h3>
                <p style={{ color: '#aaa', fontSize: '0.8rem' }}>{game.type}</p>
                <button style={{
                  marginTop: '10px',
                  background: 'transparent',
                  border: '1px solid #ffd700',
                  color: '#ffd700',
                  padding: '8px 24px',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron, sans-serif'
                }}>Play Now</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
