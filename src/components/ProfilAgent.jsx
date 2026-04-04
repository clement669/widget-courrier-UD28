import React, { useState, useRef, useEffect } from 'react';

export default function ProfilAgent({ currentUser, isDark }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!currentUser) return null;

    const getFontSize = (init) => {
        if (!init) return '1rem';
        if (init.length <= 2) return '1rem';
        if (init.length === 3) return '0.85rem';
        return '0.7rem';
    };

    return (
        <div style={{ position: 'relative' }} ref={menuRef}>
            <style>{`
                .agent-badge {
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    background: var(--color-accent, #000091);
                    color: white;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
                    user-select: none;
                }
                .agent-badge:hover {
                    transform: scale(1.08) translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
                }
                .profil-card {
                    position: absolute;
                    top: calc(100% + 12px); right: 0;
                    width: 320px;
                    background: ${isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
                    border-radius: 16px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.2);
                    padding: 0;
                    z-index: 1000;
                    opacity: 0; transform: translateY(-10px);
                    animation: cardEnter 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                    overflow: hidden;
                }
                @keyframes cardEnter { to { opacity: 1; transform: translateY(0); } }
                .profil-header {
                    background: ${isDark ? 'linear-gradient(135deg, rgba(var(--color-accent-rgb),0.4), rgba(49,179,122,0.2))' : 'linear-gradient(135deg, rgba(var(--color-accent-rgb),0.05), rgba(49,179,122,0.1))'};
                    padding: 2rem 1.5rem 1.5rem 1.5rem; display: flex; flex-direction: column; align-items: center; position: relative;
                }
                .avatar-placeholder {
                    width: 72px; height: 72px; border-radius: 50%; background: var(--color-accent, #000091); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 700; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 3px solid ${isDark ? '#222' : '#fff'};
                }
                .profil-nom { font-size: 1.25rem; font-weight: 700; color: var(--text-main); line-height: 1.2; margin-bottom: 0.25rem; }
                .profil-role { font-size: 0.85rem; font-weight: 600; color: var(--color-accent, #000091); background: ${isDark ? 'rgba(var(--color-accent-rgb),0.3)' : 'rgba(var(--color-accent-rgb),0.08)'}; padding: 4px 12px; border-radius: 12px; }
                .profil-body { padding: 1.5rem; }
                .profil-info { display: flex; align-items: center; gap: 12px; color: var(--text-muted); font-size: 0.9rem; }
            `}</style>

            <div className="agent-badge" onClick={() => setIsOpen(!isOpen)} style={{ fontSize: getFontSize(currentUser.initiales) }} title="Mon Profil">
                {currentUser.initiales}
            </div>

            {isOpen && (
                <div className="profil-card">
                    <div className="profil-header">
                        <div className="avatar-placeholder">{currentUser.initiales}</div>
                        <div className="profil-nom">{currentUser.prenom} {currentUser.nom}</div>
                        <div className="profil-role">{currentUser.role}</div>
                    </div>
                    <div className="profil-body">
                        {currentUser.email && (
                            <div className="profil-info">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm17 4.238l-7.928 7.1L4 7.216V19h16V7.238zM4.511 5l7.55 6.662L19.502 5H4.511z" /></svg>
                                <span style={{ wordBreak: 'break-all' }}>{currentUser.email}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}