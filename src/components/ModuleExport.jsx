import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

/* --- COMPOSANTS UX GLOBAUX --- */
const InfoTooltip = ({ text, align = 'center', position = 'top' }) => {
    const [isHovered, setIsHovered] = useState(false);

    let tooltipStyle = {
        position: 'absolute',
        backgroundColor: '#161616', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', width: 'max-content', maxWidth: '220px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: 'normal', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.4'
    };
    let arrowStyle = { position: 'absolute', borderWidth: '6px', borderStyle: 'solid' };

    // Gestion Haut / Bas
    if (position === 'top') {
        tooltipStyle.bottom = '130%';
        arrowStyle.top = '100%';
        arrowStyle.borderColor = '#161616 transparent transparent transparent';
    } else {
        tooltipStyle.top = '130%';
        arrowStyle.bottom = '100%';
        arrowStyle.borderColor = 'transparent transparent #161616 transparent';
    }

    // Gestion Gauche / Droite / Centre
    if (align === 'right') {
        tooltipStyle.right = '-6px';
        arrowStyle.right = '10px';
    } else if (align === 'left') {
        tooltipStyle.left = '-6px';
        arrowStyle.left = '10px';
    } else {
        tooltipStyle.left = '50%'; tooltipStyle.transform = 'translateX(-50%)';
        arrowStyle.left = '50%'; arrowStyle.transform = 'translateX(-50%)';
    }

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px', cursor: 'help' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-muted)">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm2-1.645V14h-2v-1.5a1 1 0 0 1 1-1 1.5 1.5 0 1 0-1.471-1.794l-1.962-.393A3.501 3.501 0 1 1 13 13.355z" />
            </svg>
            {isHovered && (
                <div className="smooth-enter" style={tooltipStyle}>
                    {text}
                    <div style={arrowStyle} />
                </div>
            )}
        </div>
    );
};

export default function ModuleExport({
    isDark, vueActive, courriersEntrants, courriersSortants,
    annuaire, affairesIC, listeAIOT, agents, typesProcedures, logsSaisie
}) {
    /* --- ETATS --- */
    const [isOpen, setIsOpen] = useState(false);
    const [exportScope, setExportScope] = useState('tout'); // 'tout', 'entrants', 'sortants', 'retard', 'logs'
    const [isExporting, setIsExporting] = useState(false);

    /* --- TRADUCTEURS DE DONNÉES (ID -> Texte lisible) --- */
    const getTiersNoms = useCallback((ids) => {
        if (!ids) return '';
        const idArray = Array.isArray(ids) ? ids : [ids];
        return idArray.filter(id => typeof id === 'number' && id > 0)
            .map(id => annuaire?.find(a => a.id === id)?.Nom || 'Inconnu')
            .join(', ');
    }, [annuaire]);

    const getIcNoms = useCallback((ids) => {
        if (!ids) return '';
        const idArray = Array.isArray(ids) ? ids : [ids];
        return idArray.filter(id => typeof id === 'number' && id > 0)
            .map(id => affairesIC?.find(a => a.id === id)?.N_IC || 'Inconnu')
            .join(', ');
    }, [affairesIC]);

    const getAiotNoms = useCallback((courrier, type) => {
        let aiotIds = [];
        if (type === 'Entrant') {
            aiotIds = Array.isArray(courrier.AIOT) ? courrier.AIOT : [courrier.AIOT];
        } else {
            if (courrier.RefIC) {
                const ic = affairesIC?.find(a => a.id === courrier.RefIC);
                if (ic && ic.AIOT) aiotIds = [ic.AIOT];
            }
        }
        return aiotIds.filter(id => typeof id === 'number' && id > 0)
            .map(id => listeAIOT?.find(a => a.id === id)?.aiot_numero || 'Inconnu')
            .join(', ');
    }, [affairesIC, listeAIOT]);

    const getAgentsNoms = useCallback((ids) => {
        if (!ids) return '';
        const idArray = Array.isArray(ids) ? ids : [ids];
        return idArray.filter(id => typeof id === 'number' && id > 0)
            .map(id => {
                const ag = agents?.find(a => a.id === id);
                return ag ? (ag.Initiales || ag.NOM) : 'Inconnu';
            }).join(', ');
    }, [agents]);

    const getProcedureNom = useCallback((id) => {
        if (!id || typeof id !== 'number') return '';
        return typesProcedures?.find(p => p.id === id)?.Procedure || '';
    }, [typesProcedures]);

    const formatDate = (timestamp) => timestamp ? new Date(timestamp * 1000).toLocaleDateString('fr-FR') : '';

    /* --- LOGIQUE D'EXPORT --- */
    const executerExportCSV = () => {
        setIsExporting(true);

        setTimeout(() => {
            let dataToExport = [];
            const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            // Formateur standardisé pour une ligne Excel
            const formatterCourrier = (c, type) => ({
                "Chrono": c.Chrono || '',
                "Flux": type,
                "Date Courrier": formatDate(c.Date_Courrier),
                "Date Traitement": formatDate(type === 'Entrant' ? c.Date_de_Reception : c.Date_depart),
                "Tiers": getTiersNoms(type === 'Entrant' ? c.Expediteur : c.Destinataire),
                "Objet": c.Objet || '',
                "Étape": c.Etape_Procedure || '',
                "Affaires IC": getIcNoms(c.RefIC),
                "AIOT": getAiotNoms(c, type),
                "Agents": getAgentsNoms(type === 'Entrant' ? c.Agents : c.Agent_s_),
                "Procédure": type === 'Entrant' ? getProcedureNom(c.Type_de_procedure) : '',
                "Date Limite": formatDate(c.Date_Limite),
                "Commentaires": c.Commentaires || ''
            });

            // Construction du jeu de données selon le filtre
            if (exportScope === 'tout' || exportScope === 'entrants') {
                dataToExport.push(...(courriersEntrants || []).map(c => formatterCourrier(c, 'Entrant')));
            }
            if (exportScope === 'tout' || exportScope === 'sortants') {
                dataToExport.push(...(courriersSortants || []).map(c => formatterCourrier(c, 'Sortant')));
            }
            if (exportScope === 'retard') {
                const now = Date.now() / 1000;
                const enRetard = (courriersEntrants || []).filter(c => {
                    // Logique simplifiée du retard (Date limite passée et non répondu)
                    const aRepondu = c.Ref_Sortant && c.Ref_Sortant.length > 0;
                    return c.Date_Limite && c.Date_Limite < now && !aRepondu;
                });
                dataToExport.push(...enRetard.map(c => formatterCourrier(c, 'Entrant')));
            }
            if (exportScope === 'logs') {
                dataToExport = (logsSaisie || []).map(log => ({
                    "Date et Heure": log.Timestamp ? new Date(log.Timestamp * 1000).toLocaleString('fr-FR') : '',
                    "Type": log.Type_Courrier || '',
                    "Chrono": log.Chrono || ''
                }));
            }

            // Génération du CSV via PapaParse
            const csv = Papa.unparse(dataToExport, {
                quotes: true, // Protège les sauts de lignes dans les commentaires
                delimiter: ";", // Standard français pour Excel
                header: true
            });

            // Ajout du BOM UTF-8 pour forcer Excel à lire les accents français
            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
            saveAs(blob, `Export_Registre_${exportScope}_${todayStr}.csv`);

            setIsExporting(false);
            setIsOpen(false);
        }, 100); // Petit délai pour laisser le bouton afficher "Exportation..."
    };

    const handlePrint = () => {
        setIsOpen(false);
        window.print();
    };

    /* --- RENDU --- */
    return (
        <>
            {/* BOUTON D'APPEL (A placer dans le header) */}
            <button
                onClick={() => setIsOpen(true)}
                title="Exporter les données"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-alt)', borderRadius: '24px', padding: '0 16px', cursor: 'pointer', height: '32px', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 'bold', gap: '8px', fontSize: '0.85rem' }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11 11V3h2v8h4l-5 5-5-5h4zm9 9H4v-2h16v2z" /></svg>
                Exporter
            </button>

            {/* MODALE D'EXPORT */}
            {isOpen && createPortal(
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsOpen(false)}>
                    <div className="smooth-enter" style={{ backgroundColor: isDark ? '#161616' : '#ffffff', padding: '2rem', borderRadius: '8px', width: '450px', border: '1px solid var(--border-color)', color: isDark ? '#cecece' : '#161616' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 className="fr-h5" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-2-7h4v-2h3l-5-5-5 5h3v2z" /></svg>
                                Exportateur de données
                                <InfoTooltip text="Génère un fichier CSV formaté spécifiquement pour Microsoft Excel (encodage UTF-8 avec BOM, séparateur point-virgule)." />
                            </h3>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z" /></svg>
                            </button>
                        </div>

                        {vueActive === 'stats' ? (
                            // --- VUE PERFORMANCES ---
                            <>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Vous êtes sur le tableau de bord. Souhaitez-vous générer un rapport PDF de ces graphiques, ou exporter les logs bruts ?</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <button className="fr-btn fr-btn--secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePrint}>
                                        Générer un rapport visuel (PDF)
                                    </button>
                                    <button className="fr-btn" style={{ width: '100%', justifyContent: 'center', backgroundColor: '#0063cb' }} onClick={() => { setExportScope('logs'); executerExportCSV(); }}>
                                        Exporter les logs d'activité (CSV)
                                    </button>
                                </div>
                            </>
                        ) : (
                            // --- VUE REGISTRE / SAISIE ---
                            <>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Les données seront converties en texte lisible (noms des tiers, AIOT, etc.) et formatées pour Excel.</p>

                                <label className="fr-label" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                                    Périmètre de l'export
                                    <InfoTooltip text="Seuls les courriers répondant au critère sélectionné seront intégrés dans le fichier." />
                                </label>
                                <select className="fr-select" value={exportScope} onChange={(e) => setExportScope(e.target.value)} style={{ marginBottom: '2rem' }}>
                                    <option value="tout">Registre complet (Entrants + Sortants)</option>
                                    <option value="entrants">Courriers Entrants uniquement</option>
                                    <option value="sortants">Courriers Sortants uniquement</option>
                                    <option value="retard">Courriers Entrants en retard (Date limite dépassée)</option>
                                </select>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button className="fr-btn fr-btn--secondary" onClick={() => setIsOpen(false)}>Annuler</button>
                                    <button className="fr-btn" onClick={executerExportCSV} disabled={isExporting} style={{ minWidth: '140px', justifyContent: 'center', backgroundColor: '#18753c' }}>
                                        {isExporting ? 'Génération...' : 'Télécharger (.csv)'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}