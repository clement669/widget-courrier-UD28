import { useEffect, useState } from 'react';
import { Header } from '@codegouvfr/react-dsfr/Header';
import { SideMenu } from '@codegouvfr/react-dsfr/SideMenu';
import ModuleSaisie from './components/ModuleSaisie.jsx';
import ModuleRegistre from './components/ModuleRegistre.jsx';
import ModulePerformances from './components/ModulePerformances.jsx';
import ModuleExport from './components/ModuleExport.jsx';
import ModuleConsole from './components/ModuleConsole.jsx';
import ProfilAgent from './components/ProfilAgent.jsx';
import { createPortal } from 'react-dom';
import BulleZen from './components/BulleZen.jsx';

/* --- UTILITAIRE --- */
const formaterDonneesGrist = (donneesBrutes) => {
    if (!donneesBrutes || !donneesBrutes.id) return [];
    return donneesBrutes.id.map((_, index) => {
        const ligne = {};
        for (const colonne in donneesBrutes) { ligne[colonne] = donneesBrutes[colonne][index]; }
        return ligne;
    });
};

/* --- DICTIONNAIRES DES THEMES --- */
const THEMES_DSFR = [
    { id: 'default', label: 'Bleu France', color: '#000091', rgb: '0, 0, 145' },
    { id: 'tuile', label: 'Tuile', color: '#CE614A', rgb: '206, 97, 74' },
    { id: 'emeraude', label: 'Émeraude', color: '#00A95F', rgb: '0, 169, 95' },
    { id: 'amethyste', label: 'Améthyste', color: '#AF89D5', rgb: '175, 137, 213' }
];

const THEMES_PREMIUM = [
    { id: 'rgb', label: 'Glow RGB (Gamer)', color: '#ff0000', rgb: '255, 0, 0' },
    { id: 'liquid', label: 'Liquid Glass (iOS)', color: '#ffffff', rgb: '255, 255, 255' }
];

/* --- COMPOSANT : MENU PARAMETRES DYNAMIQUE --- */
function MenuParametres({ isOpen, fermer, isDark, currentUser, savePreferences, vueActive }) {
    const [showSecret, setShowSecret] = useState(false);

    if (!isOpen || !currentUser) return null;
    const currentThemeId = currentUser?.preferences?.theme || 'default';

    // Injection directe des couleurs pour pallier la sortie du Portal
    const bgApp = isDark ? '#161616' : '#ffffff';
    const bgAlt = isDark ? '#1e1e1e' : '#f6f6f6';
    const textMain = isDark ? '#cecece' : '#161616';
    const textMuted = isDark ? '#888' : '#666';
    const borderColor = isDark ? '#383838' : '#e5e5e5';

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Overlay cliquable */}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={fermer} />

            {/* Boîte Modale */}
            <div className="smooth-enter" style={{ position: 'relative', backgroundColor: bgApp, color: textMain, border: `1px solid ${borderColor}`, borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 24px 48px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: bgAlt }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: textMain }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ flexShrink: 0, minWidth: '20px', minHeight: '20px' }}>
                            <path d="M19.328 10.938A8.004 8.004 0 0 0 19.4 12c0 .359-.025.711-.072 1.062l2.308 1.48-1.54 2.667-2.604-.842a7.971 7.971 0 0 1-1.834 1.833l.842 2.605-2.667 1.54-1.48-2.308A7.956 7.956 0 0 1 12 19.4a8.004 8.004 0 0 1-1.062-.072l-1.48 2.308-2.667-1.54.842-2.604a7.971 7.971 0 0 1-1.833-1.834l-2.605.842-1.54-2.667 2.308-1.48A8.004 8.004 0 0 1 4.6 12c0-.359.025-.711.072-1.062l-2.308-1.48 1.54-2.667 2.604.842a7.971 7.971 0 0 1 1.834-1.833l-.842-2.605 2.667-1.54 1.48 2.308A8.004 8.004 0 0 1 12 4.6c.359 0 .711.025 1.062.072l1.48-2.308 2.667 1.54-.842 2.604a7.971 7.971 0 0 1 1.833 1.834l2.605-.842 1.54 2.667-2.308 1.48zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                        </svg>
                        Personnalisation de l'outil
                    </h3>
                    <button className="fr-btn fr-btn--tertiary-no-outline" onClick={fermer} style={{ color: textMain }}>Fermer</button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: textMain }}>Thème actif (DSFR)</span>
                            <div title="Découvrir les thèmes expérimentaux" style={{ opacity: showSecret ? 1 : 0.2, cursor: 'pointer', transition: 'all 0.3s', color: textMain }} onClick={() => setShowSecret(!showSecret)}>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.9 2.1l8 8-10.6 10.6-8-8 10.6-10.6zm1.4 2.8l-8.2 8.2 4.2 4.2 8.2-8.2-4.2-4.2zm-2.8-1.4l1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4z" /></svg>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {THEMES_DSFR.map(theme => (
                                <div key={theme.id} onClick={() => savePreferences({ theme: theme.id })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: currentThemeId === theme.id ? 1 : 0.6, transition: 'all 0.2s', transform: currentThemeId === theme.id ? 'scale(1.05)' : 'scale(1)' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: theme.color, border: currentThemeId === theme.id ? `3px solid ${isDark ? '#fff' : '#000'}` : '3px solid transparent', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}></div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: currentThemeId === theme.id ? 'bold' : 'normal', color: textMain }}>{theme.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {showSecret && (
                        <div className="smooth-enter" style={{ backgroundColor: bgAlt, padding: '1rem', borderRadius: '8px', border: `1px dashed ${borderColor}` }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', display: 'block', marginBottom: '1rem', color: '#AF89D5' }}>Expérimental (Hors DSFR)</span>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {THEMES_PREMIUM.map(theme => (
                                    <button key={theme.id} onClick={() => savePreferences({ theme: theme.id })} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${currentThemeId === theme.id ? textMain : borderColor}`, backgroundColor: 'transparent', color: textMain, cursor: 'pointer', transition: 'all 0.2s', opacity: currentThemeId === theme.id ? 1 : 0.6 }}>
                                        {theme.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '1.5rem' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1rem', display: 'block', marginBottom: '1rem', color: textMain }}>
                            {vueActive === 'saisie' ? 'Options de saisie' : (vueActive === 'edition' ? 'Options du Registre' : 'Options des Performances')}
                        </span>
                        <div style={{ fontSize: '0.85rem', color: textMuted }}>
                            {vueActive === 'saisie' && "L'autocomplétion intelligente est activée par défaut."}
                            {vueActive === 'edition' && "Délai de la notification d'annulation : 5 secondes (modifiable prochainement)."}
                            {vueActive === 'stats' && "Le calcul des statistiques inclut le cache en temps réel."}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* --- APPLICATION PRINCIPALE --- */
function App() {
    const [isDark, setIsDark] = useState(false);
    const [estConnecte, setEstConnecte] = useState(false);
    const [erreur, setErreur] = useState("");
    const [vueActive, setVueActive] = useState('saisie');
    const [currentUser, setCurrentUser] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [courriersEntrants, setCourriersEntrants] = useState([]);
    const [courriersSortants, setCourriersSortants] = useState([]);
    const [annuaire, setAnnuaire] = useState([]);
    const [listeAIOT, setListeAIOT] = useState([]);
    const [affairesIC, setAffairesIC] = useState([]);
    const [agents, setAgents] = useState([]);
    const [typesProcedures, setTypesProcedures] = useState([]);
    const [logsSaisie, setLogsSaisie] = useState([]);

    useEffect(() => {
        const handleGlobalKeydown = (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                setVueActive(prev => {
                    if (prev === 'saisie') return 'edition';
                    if (prev === 'edition') return 'stats';
                    return 'saisie';
                });
            }
        };
        window.addEventListener('keydown', handleGlobalKeydown);
        return () => window.removeEventListener('keydown', handleGlobalKeydown);
    }, []);

    useEffect(() => {
        if (window.grist) {
            window.grist.ready({ requiredAccess: 'full' });
            window.grist.onOptions((options) => { if (options?.isDark !== undefined) setIsDark(options.isDark); });

            const chargerDonnees = async () => {
                try {
                    const [resCe, resCs, resAn, resAiot, resAf, resAg, resTp, resLogs] = await Promise.all([
                        window.grist.docApi.fetchTable('Courriers_Entrants'), window.grist.docApi.fetchTable('Courriers_Sortants'), window.grist.docApi.fetchTable('Annuaire_Tiers'),
                        window.grist.docApi.fetchTable('Liste_installations_suivies_Liste_AIOT'), window.grist.docApi.fetchTable('Affaires_IC'), window.grist.docApi.fetchTable('Creator_AgentsUD28'),
                        window.grist.docApi.fetchTable('Types_Procedures'), window.grist.docApi.fetchTable('Logs_Saisie')
                    ]);

                    const agentsFormates = formaterDonneesGrist(resAg);
                    setCourriersEntrants(formaterDonneesGrist(resCe)); setCourriersSortants(formaterDonneesGrist(resCs)); setAnnuaire(formaterDonneesGrist(resAn));
                    setListeAIOT(formaterDonneesGrist(resAiot)); setAffairesIC(formaterDonneesGrist(resAf)); setAgents(agentsFormates);
                    setTypesProcedures(formaterDonneesGrist(resTp)); setLogsSaisie(formaterDonneesGrist(resLogs));

                    setEstConnecte(true);

                    const sessionCache = sessionStorage.getItem('agent_ud_session_v2');
                    if (sessionCache) {
                        setCurrentUser(JSON.parse(sessionCache));
                    } else {
                        const token = crypto.randomUUID();
                        const addedIds = await window.grist.docApi.applyUserActions([['AddRecord', 'Session_Logs', null, { Token: token }]]);
                        const newLogId = addedIds[0];

                        let emailAgent = null;
                        for (let i = 0; i < 6; i++) {
                            await new Promise(r => setTimeout(r, 1000));
                            const records = await window.grist.docApi.fetchTable('Session_Logs', { Token: [token] });
                            if (records?.Email_Agent?.length > 0 && String(records.Email_Agent[0]).includes('@')) {
                                emailAgent = String(records.Email_Agent[0]).trim().toLowerCase();
                                break;
                            }
                        }

                        if (emailAgent) {
                            const agentCorrespondant = agentsFormates.find(a => (a.Email?.toLowerCase() === emailAgent) || (a.Courriel?.toLowerCase() === emailAgent));
                            if (agentCorrespondant) {
                                // Extraction sécurisée des préférences JSON
                                let userPrefs = { theme: 'default' };
                                if (agentCorrespondant.Preferences) {
                                    try { userPrefs = JSON.parse(agentCorrespondant.Preferences); } catch { /* fallback par défaut */ }
                                }

                                const userObj = { id: agentCorrespondant.id, nom: agentCorrespondant.NOM, prenom: agentCorrespondant.Prenom, email: agentCorrespondant.Email, initiales: agentCorrespondant.Initiales || "XX", role: "Agent", preferences: userPrefs };
                                setCurrentUser(userObj);
                                sessionStorage.setItem('agent_ud_session_v2', JSON.stringify(userObj));
                            }
                        }
                        if (newLogId) window.grist.docApi.applyUserActions([['RemoveRecord', 'Session_Logs', newLogId]]).catch(() => { });
                    }
                } catch (err) { console.error("Erreur Grist:", err); setErreur("Erreur de connexion à la base."); }
            };

            chargerDonnees();
            window.grist.onRecords(() => chargerDonnees());
        }
    }, []);

    /* --- MOTEUR DE PREFERENCES --- */
    const savePreferences = async (newPrefsObj) => {
        if (!currentUser) return;
        const mergedPrefs = { ...currentUser.preferences, ...newPrefsObj };
        const updatedUser = { ...currentUser, preferences: mergedPrefs };
        setCurrentUser(updatedUser);
        sessionStorage.setItem('agent_ud_session_v2', JSON.stringify(updatedUser));

        try {
            await window.grist.docApi.applyUserActions([
                ['UpdateRecord', 'Creator_AgentsUD28', currentUser.id, { Preferences: JSON.stringify(mergedPrefs) }]
            ]);
        } catch (e) { console.error("Erreur sauvegarde pref:", e); }
    };

    const toggleTheme = () => {
        const nextDark = !isDark;
        setIsDark(nextDark);
        if (window.grist) window.grist.setOption('isDark', nextDark);
    };

    /* --- INJECTION DYNAMIQUE DU THEME --- */
    const currentThemeId = currentUser?.preferences?.theme || 'default';
    const activeThemeObj = THEMES_DSFR.find(t => t.id === currentThemeId) || THEMES_DSFR[0];
    const isPremium = currentThemeId === 'rgb' || currentThemeId === 'liquid';

    return (
        <div className={`theme-wrapper ${isPremium ? `theme-${currentThemeId}` : ''}`} style={{ transition: 'all 0.3s ease', minHeight: '100vh', '--bg-app': isDark ? '#161616' : '#ffffff', '--bg-alt': isDark ? '#1e1e1e' : '#f6f6f6', '--text-main': isDark ? '#cecece' : '#161616', '--text-muted': isDark ? '#888' : '#666', '--border-color': isDark ? '#383838' : '#e5e5e5', '--color-accent': activeThemeObj.color, '--color-accent-rgb': activeThemeObj.rgb, backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}>

            <style>{`
                @keyframes fadeSlideUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
                .smooth-enter { animation: fadeSlideUp 0.25s ease-out forwards; }
                
                /* THEME CLASSIQUE DSFR DYNAMIQUE AVEC FORCAGE GLOBAL */
                .fr-input, .fr-select { background-color: var(--bg-app); color: var(--text-main); border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px; width: 100%; transition: all 0.2s; }
                
                .theme-wrapper .fr-input:not(:focus), 
                .theme-wrapper .fr-select:not(:focus) { 
                    box-shadow: inset 0 -2px 0 0 var(--border-color) !important; 
                }

                /* Écrasement brutal du Bleu France par notre couleur d'accentuation sur TOUS les champs */
                .theme-wrapper .fr-input:focus, 
                .theme-wrapper .fr-select:focus,
                .theme-wrapper textarea.fr-input:focus { 
                    border-color: var(--color-accent) !important; 
                    outline-color: var(--color-accent) !important;
                    box-shadow: inset 0 -2px 0 0 var(--color-accent) !important; 
                }
                
                .theme-wrapper .fr-btn:not(.fr-btn--secondary):not(.fr-btn--tertiary):not(.fr-btn--tertiary-no-outline) {
                    background-color: var(--color-accent) !important;
                }

                .fr-header { background-color: var(--bg-alt) !important; border-bottom: 1px solid var(--border-color) !important; }
                .fr-header__brand-top { color: var(--text-main) !important; }
                .fr-sidemenu { background-color: var(--bg-app) !important; box-shadow: none !important; color: var(--text-main) !important; }
                .fr-sidemenu__link { color: var(--text-main) !important; transition: all 0.2s; }
                
                /* Menu latéral actif */
                .theme-wrapper .fr-sidemenu__link[aria-current="true"],
                .theme-wrapper .fr-sidemenu__link[aria-current="page"] { 
                    color: var(--color-accent) !important; 
                    font-weight: bold; 
                    box-shadow: inset 4px 0 0 0 var(--color-accent) !important;
                }

                /* THEME PREMIUM : RGB */
                @keyframes rainbowGlow { 0% { border-color: #ff0000; box-shadow: 0 0 12px rgba(255,0,0,0.4); background-color: #ff0000; } 33% { border-color: #00ff00; box-shadow: 0 0 12px rgba(0,255,0,0.4); background-color: #00ff00; } 66% { border-color: #0000ff; box-shadow: 0 0 12px rgba(0,0,255,0.4); background-color: #0000ff; } 100% { border-color: #ff0000; box-shadow: 0 0 12px rgba(255,0,0,0.4); background-color: #ff0000; } }
                @keyframes rainbowBorder { 0% { border-color: #ff0000; box-shadow: inset 0 -2px 0 0 #ff0000; } 33% { border-color: #00ff00; box-shadow: inset 0 -2px 0 0 #00ff00; } 66% { border-color: #0000ff; box-shadow: inset 0 -2px 0 0 #0000ff; } 100% { border-color: #ff0000; box-shadow: inset 0 -2px 0 0 #ff0000; } }
                
                .theme-rgb .fr-input:focus, .theme-rgb .fr-select:focus { animation: rainbowBorder 2s linear infinite !important; }
                .theme-rgb .fr-btn:not(.fr-btn--secondary):not(.fr-btn--tertiary):not(.fr-btn--tertiary-no-outline) { animation: rainbowGlow 3s linear infinite !important; border: none; }
                .theme-rgb .fr-sidemenu__link[aria-current="true"] { background: linear-gradient(90deg, #ff0000, #00ff00, #0000ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; box-shadow: inset 4px 0 0 0 #00ff00 !important; }
                .theme-rgb .agent-badge { animation: rainbowGlow 3s linear infinite !important; color: white !important; }

                /* THEME PREMIUM : LIQUID GLASS */
                .theme-liquid .fr-input:focus, .theme-liquid .fr-select:focus { background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'} !important; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.5) !important; box-shadow: inset 0 -2px 0 0 #fff !important; }
                .theme-liquid .fr-btn:not(.fr-btn--secondary):not(.fr-btn--tertiary):not(.fr-btn--tertiary-no-outline) { background: ${isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))' : 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.4))'} !important; backdrop-filter: blur(10px); color: var(--text-main) !important; border: 1px solid rgba(255,255,255,0.3) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }

                @keyframes pulse-skeleton { 0% { opacity: 0.5; } 50% { opacity: 0.2; } 100% { opacity: 0.5; } }
                .skeleton-box { background-color: var(--border-color); border-radius: 4px; animation: pulse-skeleton 1.5s infinite ease-in-out; }

                @media print {
                    .fr-sidemenu, .fr-header, button { display: none !important; }
                    .fr-col-md-10 { max-width: 100% !important; flex: 0 0 100% !important; }
                    body { background: white !important; color: black !important; }
                }
            `}</style>
            <Header brandTop={<>Préfète<br />de la région<br />Centre-Val de Loire</>} homeLinkProps={{ href: '#' }} serviceTitle="Centre de Saisie Courriers" serviceTagline="DREAL Centre-Val-de-Loire - Secrétariat" />

            <div className="fr-container-fluid fr-px-2w fr-mt-4w">
                <div className="fr-grid-row fr-grid-row--gutters">
                    <div className="fr-col-12 fr-col-md-2">
                        <SideMenu align="left" title="Menu" items={[
                            { isActive: vueActive === 'saisie', linkProps: { href: '#', onClick: (e) => { e.preventDefault(); setVueActive('saisie'); } }, text: <div style={{ display: 'flex', alignItems: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="fr-mr-2v"><path d="M6.41421 15.89L16.5563 5.74786L15.1421 4.33365L5 14.4758V15.89H6.41421ZM7.24264 17.89H3V13.6474L14.435 2.21233C14.8256 1.8218 15.4587 1.8218 15.8492 2.21233L18.6777 5.04075C19.0682 5.43128 19.0682 6.06444 18.6777 6.45497L7.24264 17.89ZM3 19.89H21V21.89H3V19.89Z"></path></svg>Saisie Rapide</div> },
                            { isActive: vueActive === 'edition', linkProps: { href: '#', onClick: (e) => { e.preventDefault(); setVueActive('edition'); } }, text: <div style={{ display: 'flex', alignItems: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="fr-mr-2v"><path d="M4 8H20V21H4V8ZM6 10V19H18V10H6ZM9 12H11V14H9V12ZM9 15H11V17H9V15ZM13 12H15V14H13V12ZM13 15H15V17H13V15ZM4 3H20V7H4V3ZM6 5V6H18V5H6Z"></path></svg>Registre (Édition)</div> },
                            { isActive: vueActive === 'stats', linkProps: { href: '#', onClick: (e) => { e.preventDefault(); setVueActive('stats'); } }, text: <div style={{ display: 'flex', alignItems: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="fr-mr-2v"><path d="M13 6V21H11V6H13ZM17 11V21H15V11H17ZM9 14V21H7V14H9ZM5 17V21H3V17H5ZM19 16V21H21V16H19ZM4.00488 2.5033V4.5033H19.9951V2.5033H4.00488Z"></path></svg>Performances</div> }
                        ]} />
                        <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            <kbd style={{ background: 'var(--bg-alt)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>Ctrl + Espace</kbd> pour naviguer
                        </div>
                    </div>

                    <div className="fr-col-12 fr-col-md-10">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                            {/* ZONE GAUCHE : Profil et Statut */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <ProfilAgent currentUser={currentUser} isDark={isDark} />
                                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-alt)', borderRadius: '20px', padding: '6px 12px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: erreur ? '#ce0500' : (estConnecte ? '#18753c' : '#f5d662'), marginRight: '8px', animation: !estConnecte && !erreur ? 'pulse-skeleton 1s infinite' : 'none' }}></div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{erreur ? "Erreur Grist" : (estConnecte ? "Synchronisé" : "Chargement...")}</span>
                                </div>
                            </div>

                            <div id="header-title-portal" style={{ display: 'flex', alignItems: 'center', flexGrow: 1, justifyContent: 'center', minHeight: '40px' }}>
                                {vueActive !== 'saisie' && (
                                    <h2 className="fr-h4" style={{ margin: 0 }}>
                                        {vueActive === 'edition' ? 'Registre complet (Édition)' : 'Mes Performances'}
                                    </h2>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <ModuleExport isDark={isDark} vueActive={vueActive} courriersEntrants={courriersEntrants} courriersSortants={courriersSortants} annuaire={annuaire} affairesIC={affairesIC} listeAIOT={listeAIOT} agents={agents} typesProcedures={typesProcedures} logsSaisie={logsSaisie} />

                                {/* BOUTON PARAMETRES */}
                                {estConnecte && (
                                    <button className="fr-btn fr-btn--tertiary-no-outline" onClick={() => setSettingsOpen(true)} title="Paramètres d'interface" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ flexShrink: 0, minWidth: '20px', minHeight: '20px' }}>
                                            <path d="M19.328 10.938A8.004 8.004 0 0 0 19.4 12c0 .359-.025.711-.072 1.062l2.308 1.48-1.54 2.667-2.604-.842a7.971 7.971 0 0 1-1.834 1.833l.842 2.605-2.667 1.54-1.48-2.308A7.956 7.956 0 0 1 12 19.4a8.004 8.004 0 0 1-1.062-.072l-1.48 2.308-2.667-1.54.842-2.604a7.971 7.971 0 0 1-1.833-1.834l-2.605.842-1.54-2.667 2.308-1.48A8.004 8.004 0 0 1 4.6 12c0-.359.025-.711.072-1.062l-2.308-1.48 1.54-2.667 2.604.842a7.971 7.971 0 0 1 1.834-1.833l-.842-2.605 2.667-1.54 1.48 2.308A8.004 8.004 0 0 1 12 4.6c.359 0 .711.025 1.062.072l1.48-2.308 2.667 1.54-.842 2.604a7.971 7.971 0 0 1 1.833 1.834l2.605-.842 1.54 2.667-2.308 1.48zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                                        </svg>
                                    </button>
                                )}

                                <div onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-alt)', borderRadius: '24px', padding: '0 6px', cursor: 'pointer', width: '64px', height: '32px', border: '1px solid var(--border-color)', position: 'relative' }}>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill={isDark ? "#555" : "#f5d662"}><path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" /></svg>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill={isDark ? "#888" : "#ccc"}><path d="M10 7a7 7 0 0 0 12 4.9v.1c0 5.5-4.5 10-10 10S2 17.5 2 12s4.5-10 10-10h.1c-.1.3-.1.7-.1 1z" /></svg>
                                    <div style={{ position: 'absolute', width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', top: '2px', left: isDark ? '34px' : '2px', transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                                        {isDark ? <svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M10 7a7 7 0 0 0 12 4.9v.1c0 5.5-4.5 10-10 10S2 17.5 2 12s4.5-10 10-10h.1c-.1.3-.1.7-.1 1z" /></svg> : <svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>}
                                    </div>
                                </div>
                                <BulleZen isDark={isDark} />
                            </div>
                        </div>

                        {!estConnecte && !erreur && (
                            <div className="smooth-enter" style={{ backgroundColor: 'var(--bg-alt)', borderRadius: '8px', padding: '2rem', border: '1px solid var(--border-color)' }}>
                                <div className="skeleton-box" style={{ width: '40%', height: '32px', marginBottom: '2rem' }}></div>
                                <div className="fr-grid-row fr-grid-row--gutters">
                                    <div className="fr-col-12 fr-col-md-3"><div className="skeleton-box" style={{ height: '50px' }}></div></div>
                                    <div className="fr-col-12 fr-col-md-3"><div className="skeleton-box" style={{ height: '50px' }}></div></div>
                                    <div className="fr-col-12 fr-col-md-6"><div className="skeleton-box" style={{ height: '50px' }}></div></div>
                                    <div className="fr-col-12"><div className="skeleton-box" style={{ height: '80px', marginTop: '1rem' }}></div></div>
                                </div>
                            </div>
                        )}

                        {estConnecte && vueActive === 'saisie' && (
                            <div className="smooth-enter">
                                <ModuleSaisie isDark={isDark} annuaire={annuaire} listeAIOT={listeAIOT} agents={agents} affairesIC={affairesIC} courriersEntrants={courriersEntrants} courriersSortants={courriersSortants} typesProcedures={typesProcedures} logsSaisie={logsSaisie} currentUser={currentUser} />
                            </div>
                        )}
                        {estConnecte && vueActive === 'edition' && (
                            <div className="smooth-enter">
                                <ModuleRegistre isDark={isDark} courriersEntrants={courriersEntrants} courriersSortants={courriersSortants} annuaire={annuaire} affairesIC={affairesIC} listeAIOT={listeAIOT} agents={agents} typesProcedures={typesProcedures} />
                            </div>
                        )}
                        {estConnecte && vueActive === 'stats' && (
                            <div className="smooth-enter">
                                <ModulePerformances isDark={isDark} logsSaisie={logsSaisie} courriersEntrants={courriersEntrants} courriersSortants={courriersSortants} typesProcedures={typesProcedures} annuaire={annuaire} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <MenuParametres isOpen={settingsOpen} fermer={() => setSettingsOpen(false)} isDark={isDark} currentUser={currentUser} savePreferences={savePreferences} vueActive={vueActive} />
            <WelcomeToast currentUser={currentUser} />
            <ModuleConsole courriersEntrants={courriersEntrants} courriersSortants={courriersSortants} affairesIC={affairesIC} />
        </div>
    );
}

export default App;