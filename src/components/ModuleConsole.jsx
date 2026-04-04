import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

/* --- ETATS GLOBAUX DU TERMINAL (Hors cycle React) --- */
let cliLogsBuffer = [];
let gristLogsBuffer = [];
let errorLogsBuffer = [];

const DEFAULT_SUPPORT_EMAIL = "clement.gagnot@developpement-durable.gouv.fr";

/* --- DICTIONNAIRE DES COMMANDES ET ARGUMENTS --- */
const COMMAND_DOCS = {
    'clear': { desc: "Vide l'écran du terminal CLI.", usage: "clear" },
    'stats': { desc: "Affiche l'état de la mémoire.", usage: "stats" },
    'set': { desc: "Édite un champ.", usage: 'set <chrono> <champ> "<valeur>"', example: 'set 260245 Objet "Nouveau titre"' },
    'find': { desc: "Affiche les données brutes d'un courrier.", usage: "find <chrono>", example: "find 260245" },
    'delete': { desc: "Supprime un courrier.", usage: "delete <chrono>", example: "delete 260245" },
    'set_support': { desc: "Modifie l'email du support technique.", usage: "set_support <email>", example: "set_support test@test.fr" },
    'export': { desc: "Génère un export CSV.", usage: "export <cible>", example: "export retard" },
    'help': { desc: "Affiche l'aide.", usage: "help [commande]" }
};
const COMMAND_LIST = Object.keys(COMMAND_DOCS);
const EXPORT_TARGETS = ['entrants', 'sortants', 'retard'];

export default function ModuleConsole({
    courriersEntrants, courriersSortants, affairesIC
}) {
    /* --- ETATS UI --- */
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState('bottom');
    const [activeTab, setActiveTab] = useState('cli');

    /* --- ETATS DONNÉES --- */
    const [cliLogs, setCliLogs] = useState([]);
    const [gristLogs, setGristLogs] = useState([]);
    const [errorLogs, setErrorLogs] = useState([]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Initialisation paresseuse (Lazy init) : On lit le localStorage dès la création de l'état
    const [supportEmail, setSupportEmail] = useState(() => {
        return localStorage.getItem('widget_support_email') || DEFAULT_SUPPORT_EMAIL;
    });

    /* --- REFS --- */
    const cliEndRef = useRef(null);
    const gristEndRef = useRef(null);
    const inputRef = useRef(null);

    /* --- INITIALISATION & INTERCEPTEURS --- */
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.ctrlKey && e.altKey && (e.key === 't' || e.key === 'T')) {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);

        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        const processLog = (type, ...args) => {
            const message = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
            const logEntry = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('fr-FR'), type, message };

            setTimeout(() => {
                if (type === 'error') {
                    errorLogsBuffer = [logEntry, ...errorLogsBuffer].slice(0, 100);
                    setErrorLogs([...errorLogsBuffer]);
                    cliLogsBuffer = [...cliLogsBuffer, logEntry].slice(-200);
                    setCliLogs([...cliLogsBuffer]);
                    return;
                }

                if (message.includes('PLUGIN VIEW') || message.includes('RPC_') || message.includes('Rpc ') || message.includes('dsfr :')) {
                    gristLogsBuffer = [...gristLogsBuffer, logEntry].slice(-300);
                    setGristLogs([...gristLogsBuffer]);
                    return;
                }

                cliLogsBuffer = [...cliLogsBuffer, logEntry].slice(-200);
                setCliLogs([...cliLogsBuffer]);
            }, 0);
        };

        console.log = (...args) => { processLog('info', ...args); originalLog.apply(console, args); };
        console.warn = (...args) => { processLog('warn', ...args); originalWarn.apply(console, args); };
        console.error = (...args) => { processLog('error', ...args); originalError.apply(console, args); };

        const handleGlobalError = (event) => { console.error(`[CRASH] ${event.message || event.reason}`); };
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleGlobalError);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('error', handleGlobalError);
            window.removeEventListener('unhandledrejection', handleGlobalError);
            console.log = originalLog; console.warn = originalWarn; console.error = originalError;
        };
    }, []);

    /* --- AUTO-SCROLL ET FOCUS --- */
    useEffect(() => {
        if (isOpen && activeTab === 'cli' && cliEndRef.current) cliEndRef.current.scrollIntoView({ behavior: 'smooth' });
        if (isOpen && activeTab === 'grist' && gristEndRef.current) gristEndRef.current.scrollIntoView({ behavior: 'smooth' });
        if (isOpen && activeTab === 'cli' && inputRef.current) inputRef.current.focus();
    }, [cliLogs, gristLogs, isOpen, activeTab, position]);


    /* --- AUTOCOMPLÉTION (Calculée à la volée, sans useEffect ni State) --- */
    let suggestion = '';
    const currentInputLower = input.toLowerCase();

    // On ne propose l'autocomplétion que si le texte ne finit pas par un espace
    if (currentInputLower && !currentInputLower.endsWith(' ')) {
        const parts = currentInputLower.split(' ');

        if (parts.length === 1) {
            const match = COMMAND_LIST.find(c => c.startsWith(parts[0]));
            suggestion = match ? match.substring(parts[0].length) : '';
        } else if (parts.length === 2) {
            const cmd = parts[0];
            const argPref = parts[1];
            let opts = [];

            if (cmd === 'help') opts = COMMAND_LIST;
            if (cmd === 'export') opts = EXPORT_TARGETS;

            const match = opts.find(o => o.startsWith(argPref));
            suggestion = match ? match.substring(argPref.length) : '';
        }
    }


    /* --- GENERATION EML ET UTILITAIRES --- */
    const genererFichierEML = useCallback((log) => {
        const emlContent = `To: ${supportEmail}
Subject: [Grist/Courrier/Registre] Rapport d'erreur
X-Unsent: 1
Content-Type: text/plain; charset=utf-8

Bonjour,

Une erreur a été interceptée par le Widget Registre. Voici les détails techniques pour investigation :

--- DÉTAILS DE L'ERREUR ---
Date de l'incident : ${new Date().toLocaleString('fr-FR')}
Type : ${log.type.toUpperCase()}
Message :
${log.message}

--- CONTEXTE TECHNIQUE ---
URL : ${window.location.href}
Navigateur : ${navigator.userAgent}
Mémoire : Entrants (${courriersEntrants?.length || 0}), Sortants (${courriersSortants?.length || 0})
---------------------------
`;
        const blob = new Blob([emlContent], { type: 'message/rfc822' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_erreur_${Date.now()}.eml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [supportEmail, courriersEntrants, courriersSortants]);

    const copierTexte = (texte) => {
        navigator.clipboard.writeText(texte);
        console.log("Erreur copiée dans le presse-papier.");
    };

    /* --- MOTEUR DE COMMANDES (CLI) --- */
    const executeCommand = async (cmdString) => {
        const args = cmdString.match(/(?:[^\s"]+|"[^"]*")+/g);
        if (!args || args.length === 0) return;
        const command = args[0].toLowerCase();

        try {
            switch (command) {
                case 'clear': { cliLogsBuffer = []; setCliLogs([]); break; }
                case 'stats': { console.log(`[STATE] E: ${courriersEntrants?.length || 0} | S: ${courriersSortants?.length || 0} | IC: ${affairesIC?.length || 0}`); break; }

                case 'set_support': {
                    if (args.length < 2) { console.error(`Email actuel: ${supportEmail}\nSyntaxe: set_support <email>`); break; }
                    const newEmail = args[1];
                    setSupportEmail(newEmail);
                    localStorage.setItem('widget_support_email', newEmail);
                    console.log(`Email de support mis à jour : ${newEmail}`);
                    break;
                }

                case 'find': {
                    if (args.length < 2) { console.error("Syntaxe: find <chrono>"); break; }
                    const chrono = args[1];
                    let record = courriersEntrants?.find(c => c.Chrono === chrono) || courriersSortants?.find(c => c.Chrono === chrono);
                    if (!record) { console.error(`Chrono ${chrono} introuvable.`); break; }
                    console.log(`Données pour ${chrono} :`); console.log(record);
                    break;
                }

                case 'delete': {
                    if (args.length < 2) { console.error("Syntaxe: delete <chrono>"); break; }
                    const chrono = args[1];
                    let record = courriersEntrants?.find(c => c.Chrono === chrono);
                    let table = 'Courriers_Entrants';
                    if (!record) { record = courriersSortants?.find(c => c.Chrono === chrono); table = 'Courriers_Sortants'; }
                    if (!record) { console.error(`Chrono ${chrono} introuvable.`); break; }
                    console.warn(`! SUPPRESSION DE ${chrono} EN COURS !`);
                    await window.grist.docApi.applyUserActions([['RemoveRecord', table, record.id]]);
                    console.log("Suppression effectuée.");
                    break;
                }

                case 'export': {
                    if (args.length < 2) { console.error("Cibles valides: entrants, sortants, retard"); break; }
                    const target = args[1].toLowerCase();
                    let data = [];
                    if (target === 'entrants') data = courriersEntrants || [];
                    else if (target === 'sortants') data = courriersSortants || [];
                    else if (target === 'retard') {
                        const now = Date.now() / 1000;
                        data = (courriersEntrants || []).filter(c => c.Date_Limite && c.Date_Limite < now && (!c.Ref_Sortant || c.Ref_Sortant.length === 0));
                    } else { console.error("Cible invalide."); break; }

                    if (data.length === 0) { console.warn("Aucune donnée à exporter."); break; }
                    console.log(`Génération CSV (${data.length} lignes)...`);
                    const csv = Papa.unparse(data, { delimiter: ";" });
                    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
                    saveAs(blob, `export_${target}_cli.csv`);
                    break;
                }

                case 'set': {
                    if (args.length < 4) { console.error("Erreur : set <chrono> <champ> \"valeur\""); break; }
                    const chrono = args[1]; const field = args[2]; const val = args[3].replace(/^"|"$/g, '');
                    let record = courriersEntrants?.find(c => c.Chrono === chrono);
                    let table = 'Courriers_Entrants';
                    if (!record) { record = courriersSortants?.find(c => c.Chrono === chrono); table = 'Courriers_Sortants'; }
                    if (!record) { console.error(`Chrono ${chrono} introuvable.`); break; }
                    console.log(`Update ${chrono} [${table}] -> ${field}="${val}"...`);
                    await window.grist.docApi.applyUserActions([['UpdateRecord', table, record.id, { [field]: val }]]);
                    console.log("Succès.");
                    break;
                }

                case 'help': {
                    if (args.length > 1) {
                        const targetCmd = args[1].toLowerCase();
                        const doc = COMMAND_DOCS[targetCmd];
                        if (doc) {
                            console.log(`\n--- AIDE : ${targetCmd.toUpperCase()} ---`);
                            console.log(`Desc    : ${doc.desc}`);
                            console.log(`Syntaxe : ${doc.usage}`);
                            if (doc.example) console.log(`Exemple : ${doc.example}`);
                        } else console.error(`Commande '${targetCmd}' inconnue.`);
                    } else {
                        console.log("\n--- COMMANDES ---");
                        COMMAND_LIST.forEach(cmd => console.log(`- ${cmd.padEnd(12)} : ${COMMAND_DOCS[cmd].desc}`));
                    }
                    break;
                }
                default: console.error(`Commande '${command}' inconnue.`);
            }
        } catch (err) { console.error(`CLI Error: ${err.message}`); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (input.trim() === '') return;
            console.log(`> ${input}`);
            executeCommand(input.trim());
            setHistory(prev => [...prev, input.trim()]);
            setHistoryIndex(-1);
            setInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIdx); setInput(history[newIdx]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIdx = historyIndex + 1;
                if (newIdx >= history.length) { setHistoryIndex(-1); setInput(''); }
                else { setHistoryIndex(newIdx); setInput(history[newIdx]); }
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (suggestion) {
                setInput(input + suggestion + ' ');
            } else {
                const parts = input.toLowerCase().split(' ');
                let opts = [];
                if (parts.length === 1) opts = COMMAND_LIST.filter(c => c.startsWith(parts[0]));
                else if (parts.length === 2) {
                    if (parts[0] === 'help') opts = COMMAND_LIST.filter(c => c.startsWith(parts[1]));
                    if (parts[0] === 'export') opts = EXPORT_TARGETS.filter(c => c.startsWith(parts[1]));
                }
                if (opts.length > 1) {
                    console.log(`> ${input}`);
                    console.log(`Suggestions : ${opts.join('  ')}`);
                }
            }
        }
    };

    /* --- STYLES DYNAMIQUES --- */
    const getContainerStyle = () => {
        const base = { position: 'fixed', zIndex: 10000, display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(15, 15, 20, 0.98)', color: '#00ff00', fontFamily: 'monospace', boxShadow: '0 0 40px rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', transition: 'all 0.2s ease-in-out' };
        switch (position) {
            case 'fullscreen': return { ...base, inset: 0, border: 'none' };
            case 'top': return { ...base, top: 0, left: 0, right: 0, height: '40vh', borderBottom: '2px solid #0063cb' };
            case 'left': return { ...base, top: 0, left: 0, bottom: 0, width: '40vw', borderRight: '2px solid #0063cb' };
            case 'right': return { ...base, top: 0, right: 0, bottom: 0, width: '40vw', borderLeft: '2px solid #0063cb' };
            case 'bottom': default: return { ...base, bottom: 0, left: 0, right: 0, height: '40vh', borderTop: '2px solid #0063cb' };
        }
    };

    /* --- RENDU --- */
    const trigger = createPortal(
        <button
            onClick={() => setIsOpen(true)}
            title="Ouvrir le terminal (Ctrl+Alt+T)"
            style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 9999, backgroundColor: '#161616', color: errorLogs.length > 0 ? '#ff4444' : '#00ff00', border: '1px solid #333', borderRadius: '50%', width: '42px', height: '42px', cursor: 'pointer', display: isOpen ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', opacity: 0.6, transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm17 16V5H4v14h16zM7.414 7.586L8.828 6.172l5.657 5.657-5.657 5.657-1.414-1.414L11.657 11.83 7.414 7.586zm4.672 8.414h6v2h-6v-2z" /></svg>
            {errorLogs.length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ff4444', color: 'white', fontSize: '10px', fontWeight: 'bold', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {errorLogs.length}
                </span>
            )}
        </button>, document.body
    );

    if (!isOpen) return trigger;

    return createPortal(
        <div style={getContainerStyle()}>

            {/* HEADER ET ONGLETS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderBottom: '1px solid #333' }}>
                <div style={{ display: 'flex' }}>
                    <button onClick={() => setActiveTab('cli')} style={{ background: activeTab === 'cli' ? '#222' : 'transparent', color: activeTab === 'cli' ? '#fff' : '#888', border: 'none', borderBottom: activeTab === 'cli' ? '2px solid #0063cb' : '2px solid transparent', padding: '10px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm17 16V5H4v14h16zM7.414 7.586L8.828 6.172l5.657 5.657-5.657 5.657-1.414-1.414L11.657 11.83 7.414 7.586zm4.672 8.414h6v2h-6v-2z" /></svg>
                        CLI
                    </button>
                    <button onClick={() => setActiveTab('grist')} style={{ background: activeTab === 'grist' ? '#222' : 'transparent', color: activeTab === 'grist' ? '#fff' : '#888', border: 'none', borderBottom: activeTab === 'grist' ? '2px solid #0063cb' : '2px solid transparent', padding: '10px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.19v6.72zm14 0v-6.72l-6 3.39v6.71l6-3.38z" /></svg>
                        Réseau Grist
                    </button>
                    <button onClick={() => setActiveTab('errors')} style={{ background: activeTab === 'errors' ? '#222' : 'transparent', color: activeTab === 'errors' ? '#ff4444' : '#888', border: 'none', borderBottom: activeTab === 'errors' ? '2px solid #ff4444' : '2px solid transparent', padding: '10px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" /></svg>
                        Erreurs {errorLogs.length > 0 && `(${errorLogs.length})`}
                    </button>
                </div>

                {/* DOCKING & CLOSE */}
                <div style={{ display: 'flex', gap: '8px', paddingRight: '16px' }}>
                    <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #444', paddingRight: '8px', marginRight: '4px' }}>
                        <button onClick={() => setPosition('left')} title="Gauche" style={{ background: 'none', border: 'none', color: position === 'left' ? '#0063cb' : '#666', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v14h6V5H5z" /></svg></button>
                        <button onClick={() => setPosition('right')} title="Droite" style={{ background: 'none', border: 'none', color: position === 'right' ? '#0063cb' : '#666', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm16 14V5h-6v14h6z" /></svg></button>
                        <button onClick={() => setPosition('top')} title="Haut" style={{ background: 'none', border: 'none', color: position === 'top' ? '#0063cb' : '#666', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 16h14v-6H5v6z" /></svg></button>
                        <button onClick={() => setPosition('bottom')} title="Bas" style={{ background: 'none', border: 'none', color: position === 'bottom' ? '#0063cb' : '#666', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v6h14V5H5z" /></svg></button>
                        <button onClick={() => setPosition('fullscreen')} title="Plein Écran" style={{ background: 'none', border: 'none', color: position === 'fullscreen' ? '#0063cb' : '#666', cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5z" /></svg></button>
                    </div>
                    <button onClick={() => setIsOpen(false)} title="Fermer" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z" /></svg>
                    </button>
                </div>
            </div>

            {/* CONTENU DES ONGLETS */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '12px 16px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>

                {/* ONGLET CLI */}
                {activeTab === 'cli' && (
                    <>
                        {cliLogs.map(log => (
                            <div key={log.id} style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: '#444', flexShrink: 0 }}>[{log.time}]</span>
                                <span style={{ color: log.type === 'error' ? '#ff4444' : log.type === 'warn' ? '#ffcc00' : log.message.startsWith('>') ? '#fff' : '#00ff00', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {log.message}
                                </span>
                            </div>
                        ))}
                        <div ref={cliEndRef} />
                    </>
                )}

                {/* ONGLET GRIST */}
                {activeTab === 'grist' && (
                    <>
                        {gristLogs.map(log => (
                            <div key={log.id} style={{ display: 'flex', gap: '12px', opacity: 0.7 }}>
                                <span style={{ color: '#444', flexShrink: 0 }}>[{log.time}]</span>
                                <span style={{ color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{log.message}</span>
                            </div>
                        ))}
                        <div ref={gristEndRef} />
                    </>
                )}

                {/* ONGLET ERREURS */}
                {activeTab === 'errors' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {errorLogs.length === 0 ? (
                            <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>Aucune erreur détectée pour le moment.</div>
                        ) : (
                            errorLogs.map(log => (
                                <div key={log.id} style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', border: '1px solid #ff4444', borderRadius: '4px', padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid rgba(255, 68, 68, 0.2)', paddingBottom: '8px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#ff4444' }}>[{log.time}] Exception</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => copierTexte(log.message)} title="Copier" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 6V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3v3c0 .552-.45 1-1 1H4a1 1 0 0 1-1-1V7c0-.552.45-1 1-1h3zm2 0h8v10h2V4H9v2zM5 8v12h10V8H5z" /></svg> Copier
                                            </button>
                                            <button onClick={() => genererFichierEML(log)} title="Créer un mail de support" style={{ background: 'none', border: '1px solid #ff4444', borderRadius: '4px', color: '#ff4444', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm17 4.238l-7.928 7.1L4 7.216V19h16V7.238zM4.511 5l7.55 6.662L19.502 5H4.511z" /></svg> Partager (.eml)
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ color: '#ffaaaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                                        {log.message}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* BARRE DE SAISIE (Uniquement sur l'onglet CLI) */}
            {activeTab === 'cli' && (
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#000', padding: '10px 16px', borderTop: '1px solid #333', position: 'relative' }}>
                    <span style={{ color: '#0063cb', fontWeight: 'bold', marginRight: '10px' }}>root@dreal:~#</span>
                    <div style={{ position: 'relative', flexGrow: 1, height: '20px' }}>
                        {suggestion && (
                            <div style={{ position: 'absolute', left: 0, top: 0, color: '#444', pointerEvents: 'none', whiteSpace: 'pre' }}>
                                <span style={{ visibility: 'hidden' }}>{input}</span>{suggestion}
                            </div>
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', backgroundColor: 'transparent', border: 'none', color: '#fff', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none' }}
                            autoComplete="off"
                            spellCheck="false"
                        />
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}