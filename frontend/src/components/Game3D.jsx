import React, { useRef, useEffect } from 'react';

const Game3D = ({ type = 'slot' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background gradient
      const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
      grad.addColorStop(0, '#1a1a3e');
      grad.addColorStop(1, '#0a0a1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 3D effect
      const time = Date.now() / 1000;
      
      if (type === 'slot') {
        // Draw 3 reels
        for (let i = -1; i <= 1; i++) {
          const x = w/2 + i * 80;
          const y = h/2;
          
          // Reel shadow
          ctx.shadowColor = 'rgba(255,215,0,0.2)';
          ctx.shadowBlur = 30;
          
          // Reel
          ctx.fillStyle = 'rgba(255,215,0,0.1)';
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'rgba(255,215,0,0.3)';
          
          const reelH = 120;
          const offset = (time * 50) % 80;
          
          for (let j = -2; j <= 2; j++) {
            const sy = y + j * 40 + offset;
            ctx.beginPath();
            ctx.arc(x, sy % (h + 100) - 50, 12, 0, Math.PI * 2);
            ctx.fillStyle = j === 0 ? '#ffd700' : '#ffffff';
            ctx.fill();
            ctx.stroke();
          }
        }
        
        // Center glow
        const glow = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, 60);
        glow.addColorStop(0, 'rgba(255,215,0,0.1)');
        glow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        
      } else if (type === 'roulette') {
        // Draw roulette wheel
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(255,215,0,0.2)';
        
        const cx = w/2, cy = h/2;
        const radius = Math.min(w, h) / 2 - 20;
        
        // Outer ring
        for (let i = 0; i < 37; i++) {
          const angle = (i / 37) * Math.PI * 2 + time * 0.5;
          const x = cx + Math.cos(angle) * radius * 0.8;
          const y = cy + Math.sin(angle) * radius * 0.8;
          
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? '#00ff00' : (i % 2 === 0 ? '#ff0000' : '#000000');
          ctx.fill();
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        
        // Center
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.fill();
        
      } else {
        // Default: spinning diamond
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(255,215,0,0.3)';
        
        const size = Math.min(w, h) / 2 - 30;
        const rotation = time * 0.5;
        
        ctx.translate(w/2, h/2);
        ctx.rotate(rotation);
        
        // Diamond
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        
        const grad2 = ctx.createLinearGradient(0, -size, 0, size);
        grad2.addColorStop(0, '#ffd700');
        grad2.addColorStop(0.5, '#f7971e');
        grad2.addColorStop(1, '#ffd700');
        ctx.fillStyle = grad2;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    };

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width || 300;
        canvas.height = rect.height || 300;
      }
    };

    resize();
    const loop = () => {
      draw();
      animationId = requestAnimationFrame(loop);
    };
    loop();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
        borderRadius: '12px',
        display: 'block'
      }}
    />
  );
};

export default Game3D;
