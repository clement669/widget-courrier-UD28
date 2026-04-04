import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function BulleZen({ isDark }) {
    const [isZenMode, setIsZenMode] = useState(false);
    const [zenCountdown, setZenCountdown] = useState(5);

    useEffect(() => {
        if (isZenMode) {
            const interval = setInterval(() => {
                setZenCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setIsZenMode(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isZenMode]);

    const getZenColor = (num) => {
        const colors = { 5: '#0063cb', 4: '#1f8d99', 3: '#29a37e', 2: '#41b658', 1: '#85c441' };
        return colors[num] || '#0063cb';
    };

    return (
        <>
            <button
                onClick={() => { setIsZenMode(true); setZenCountdown(5); }}
                title="Besoin d'une pause ?"
                style={{
                    background: 'var(--bg-app)', border: '1px solid var(--border-color)',
                    borderRadius: '50%', width: '36px', height: '36px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0063cb'; e.currentTarget.style.borderColor = '#0063cb'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 19h16v2H4v-2zm14-14V3H4v12c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-1h2c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-2zm-2 10H6V5h10v10zm2-6h-2V7h2v2z" />
                </svg>
            </button>

            {isZenMode && createPortal(
                <div className="smooth-enter" style={{ position: 'fixed', inset: 0, backgroundColor: isDark ? '#161616' : '#ffffff', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s ease' }}>
                    <style>{`
                        @keyframes zenBreathe { 
                            0% { transform: scale(0.8); opacity: 0.5; } 
                            50% { transform: scale(1.2); opacity: 1; } 
                            100% { transform: scale(0.8); opacity: 0.5; } 
                        }
                    `}</style>
                    <div style={{ animation: 'zenBreathe 4s infinite ease-in-out', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(0, 99, 203, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0063cb', marginBottom: '2rem', border: '2px solid rgba(0, 99, 203, 0.3)' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v5h-2zm0 6h2v2h-2z" /></svg>
                    </div>
                    <h2 style={{ color: 'var(--text-main)', textAlign: 'center', fontWeight: '300' }}>Inspirez profondément...</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Il sera toujours temps de sauver la France dans <span style={{ color: getZenColor(zenCountdown), fontWeight: 'bold', fontSize: '1.2rem', transition: 'color 1s ease' }}>{zenCountdown}</span> secondes.
                    </p>
                </div>, document.body
            )}
        </>
    );
}