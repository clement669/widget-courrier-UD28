import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/* --- COMPOSANTS UX GLOBAUX --- */
const InfoTooltip = ({ text, align = 'center', position = 'top' }) => {
    const [isHovered, setIsHovered] = useState(false);

    let tooltipStyle = { position: 'absolute', backgroundColor: '#161616', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', width: 'max-content', maxWidth: '220px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: 'normal', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.4' };
    let arrowStyle = { position: 'absolute', borderWidth: '6px', borderStyle: 'solid' };

    if (position === 'top') { tooltipStyle.bottom = '130%'; arrowStyle.top = '100%'; arrowStyle.borderColor = '#161616 transparent transparent transparent'; }
    else { tooltipStyle.top = '130%'; arrowStyle.bottom = '100%'; arrowStyle.borderColor = 'transparent transparent #161616 transparent'; }

    if (align === 'right') { tooltipStyle.right = '-6px'; arrowStyle.right = '10px'; }
    else if (align === 'left') { tooltipStyle.left = '-6px'; arrowStyle.left = '10px'; }
    else { tooltipStyle.left = '50%'; tooltipStyle.transform = 'translateX(-50%)'; arrowStyle.left = '50%'; arrowStyle.transform = 'translateX(-50%)'; }

    return (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px', cursor: 'help' }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-muted)"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm2-1.645V14h-2v-1.5a1 1 0 0 1 1-1 1.5 1.5 0 1 0-1.471-1.794l-1.962-.393A3.501 3.501 0 1 1 13 13.355z" /></svg>
            {isHovered && <div className="smooth-enter" style={tooltipStyle}>{text}<div style={arrowStyle} /></div>}
        </div>
    );
};

export default function ModuleRegistre({ isDark, courriersEntrants, courriersSortants, annuaire, affairesIC, listeAIOT, agents, typesProcedures }) {
    /* --- ETATS --- */
    const [mode, setMode] = useState('entrant');
    const [searchTerm, setSearchTerm] = useState('');
    const [undoDelay, setUndoDelay] = useState(2000);
    const [showSettings, setShowSettings] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [courrierEdite, setCourrierEdite] = useState(null);
    const [draft, setDraft] = useState({});
    const [activeField, setActiveField] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [toast, setToast] = useState(null);
    const [hoveredCard, setHoveredCard] = useState(null);
    const [zenMode, setZenMode] = useState(false);

    /* --- REFS --- */
    const toastTimer = useRef(null);
    const hoverTimer = useRef(null);
    const searchInputRef = useRef(null);

    /* --- UTILITAIRES --- */
    const formatDateAffichage = (timestamp) => {
        if (!timestamp) return '-';
        const d = new Date(timestamp * 1000);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR');
    };

    const timestampToInputDate = (timestamp) => {
        if (!timestamp) return '';
        const d = new Date(timestamp * 1000);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    };

    const inputDateToTimestamp = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : (d.getTime() / 1000);
    };

    const formatArray = (val) => Array.isArray(val) ? val : (val ? [val] : []);

    const portalBgColor = isDark ? '#161616' : '#ffffff';
    const portalTextColor = isDark ? '#cecece' : '#161616';

    const getBadgeStyle = (etape) => {
        if (!etape) return null;
        const e = etape.toLowerCase();
        if (e.includes('racno') || e.includes('complément') || e.includes('attente') || e.includes('demeure')) return { bg: '#fee9ea', color: '#ce0500' };
        if (e.includes('racok') || e.includes('complet') || e.includes('clôturé') || e.includes('ap')) return { bg: '#e5f5e5', color: '#18753c' };
        return { bg: '#e3e3fd', color: '#000091' };
    };

    /* --- CALLBACKS DATA --- */
    const getTiersNoms = useCallback((tiersData) => {
        const ids = formatArray(tiersData).filter(id => id > 0);
        return ids.map(id => annuaire?.find(a => a.id === id)?.Nom || `Inconnu`).join(', ') || '-';
    }, [annuaire]);

    const getIcNoms = useCallback((icData) => {
        const ids = formatArray(icData).filter(id => id > 0);
        return ids.map(id => affairesIC?.find(a => a.id === id)?.N_IC || `Inconnu`).join(', ') || '-';
    }, [affairesIC]);

    const getAiotCodes = useCallback((courrier) => {
        let aiotIds = mode === 'entrant' ? formatArray(courrier.AIOT) : (courrier.RefIC ? [affairesIC?.find(a => a.id === courrier.RefIC)?.AIOT] : []);
        return formatArray(aiotIds).filter(id => id > 0).map(id => listeAIOT?.find(a => a.id === id)?.aiot_numero).filter(Boolean);
    }, [listeAIOT, mode, affairesIC]);

    /* --- CALLBACKS INTERFACE --- */
    const showToast = useCallback((message, type = 'success', undoAction = null) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message, type, undoAction });
        const delay = undoAction && undoDelay > 0 ? undoDelay : 3000;
        if (undoAction && undoDelay === 0) setToast({ message, type, undoAction: null });
        toastTimer.current = setTimeout(() => setToast(null), delay);
    }, [undoDelay]);

    const handleUndoClick = () => {
        if (toast?.undoAction) {
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toast.undoAction();
            setToast(null);
        }
    };

    const ouvrirEdition = useCallback((courrier, e = null) => {
        if (e) e.stopPropagation();
        setCourrierEdite(courrier);
        setActiveField(null);

        // Règle d'or Grist : Il faut copier les "getters" explicitement, le destructuring {...c} ne suffit pas.
        const fields = ['id', 'Chrono', 'Date_de_Reception', 'Date_depart', 'Date_Courrier', 'Date_Limite', 'Expediteur', 'Destinataire', 'AIOT', 'Objet', 'Type_de_procedure', 'RefIC', 'Agents', 'Agent_s_', 'Etape_Procedure', 'M', 'G', 'Commentaires'];
        const newDraft = { nouveauCommentaire: '' };
        fields.forEach(key => newDraft[key] = courrier[key]);

        ['Date_de_Reception', 'Date_depart', 'Date_Courrier', 'Date_Limite'].forEach(d => {
            if (newDraft[d]) newDraft[d] = timestampToInputDate(newDraft[d]);
        });
        setDraft(newDraft);
    }, []);

    const copierAiot = useCallback((courrier, e) => {
        if (e) e.stopPropagation();
        const codes = getAiotCodes(courrier);
        if (codes.length > 0) {
            navigator.clipboard.writeText(codes.join(', '));
            showToast(`Code AIOT copié : ${codes.join(', ')}`, 'info');
        } else showToast(`Aucun code AIOT trouvé pour ce courrier`, 'error');
    }, [getAiotCodes, showToast]);

    const copierChrono = useCallback((courrier, e) => {
        if (e) e.stopPropagation();
        if (courrier.Chrono) { navigator.clipboard.writeText(courrier.Chrono); showToast(`Chrono copié : ${courrier.Chrono}`, 'info'); }
        else showToast(`Aucun Chrono pour ce courrier`, 'error');
    }, [showToast]);

    const handleMouseEnterInfo = (e, type, ids) => {
        const validIds = formatArray(ids).filter(id => id > 0);
        if (validIds.length === 0) return;
        hoverTimer.current = setTimeout(() => {
            let dataObjects = type === 'tiers' ? validIds.map(id => annuaire?.find(a => a.id === id)) : validIds.map(id => affairesIC?.find(a => a.id === id));
            if (dataObjects.filter(Boolean).length > 0) setHoveredCard({ type, data: dataObjects.filter(Boolean) });
        }, 500);
    };

    const handleMouseLeaveInfo = () => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setHoveredCard(null);
    };

    /* --- FILTRES --- */
    const courriersFiltres = useMemo(() => {
        const baseDonnees = mode === 'entrant' ? courriersEntrants : courriersSortants;
        if (!baseDonnees) return [];
        let resultats = [...baseDonnees].sort((a, b) => (b.Chrono || '').localeCompare(a.Chrono || ''));
        if (searchTerm.trim().length > 0) {
            const search = searchTerm.toLowerCase();
            resultats = resultats.filter(c =>
                c.Chrono?.toLowerCase().includes(search) || c.Objet?.toLowerCase().includes(search) || c.Etape_Procedure?.toLowerCase().includes(search) ||
                getTiersNoms(mode === 'entrant' ? c.Expediteur : c.Destinataire).toLowerCase().includes(search) || getIcNoms(c.RefIC).toLowerCase().includes(search)
            );
        }
        return resultats;
    }, [mode, courriersEntrants, courriersSortants, searchTerm, getTiersNoms, getIcNoms]);

    /* --- NAVIGATION CLAVIER --- */
    useEffect(() => { setSelectedIndex(-1); }, [mode, searchTerm]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.altKey && e.key === 'z') { e.preventDefault(); setZenMode(prev => !prev); showToast(zenMode ? "Mode Zen désactivé." : "Mode Zen activé. Respirez.", "info"); return; }
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (showSettings) return;

            if (showShortcuts) {
                if (e.key === 'Escape' || (e.shiftKey && e.key === '?')) setShowShortcuts(false);
                return;
            }

            switch (e.key) {
                case 'Escape': if (courrierEdite) { setCourrierEdite(null); setActiveField(null); } break;
                case 'ArrowDown': e.preventDefault(); setSelectedIndex(s => s < courriersFiltres.length - 1 ? s + 1 : s); break;
                case 'ArrowUp': e.preventDefault(); setSelectedIndex(s => s > 0 ? s - 1 : 0); break;
                case 'Enter': e.preventDefault(); if (selectedIndex >= 0 && selectedIndex < courriersFiltres.length) ouvrirEdition(courriersFiltres[selectedIndex]); break;
                case '?': if (e.shiftKey) setShowShortcuts(true); break;
                default: break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [courriersFiltres, selectedIndex, courrierEdite, showShortcuts, showSettings, ouvrirEdition, zenMode, showToast]);

    useEffect(() => { if (activeField && searchInputRef.current) searchInputRef.current.focus(); }, [activeField]);

    /* --- API GRIST --- */
    const handleUpdate = async () => {
        setIsSaving(true);
        try {
            const table = mode === 'entrant' ? 'Courriers_Entrants' : 'Courriers_Sortants';
            let newPayload = {};
            let oldPayload = {};
            let hasChanges = false;

            const fieldsToCheck = mode === 'entrant'
                ? ['Chrono', 'Date_de_Reception', 'Date_Courrier', 'Date_Limite', 'Expediteur', 'AIOT', 'Objet', 'Type_de_procedure', 'RefIC', 'Agents', 'Etape_Procedure', 'M', 'G']
                : ['Date_depart', 'Date_Courrier', 'Destinataire', 'Objet', 'Agent_s_', 'RefIC', 'Etape_Procedure'];

            fieldsToCheck.forEach(key => {
                let draftVal = draft[key];
                let origVal = courrierEdite[key];

                if (key.startsWith('Date_')) {
                    draftVal = inputDateToTimestamp(draft[key]);
                    if (draftVal !== origVal && !(draftVal === null && !origVal)) {
                        newPayload[key] = draftVal; oldPayload[key] = origVal; hasChanges = true;
                    }
                }
                else if (Array.isArray(origVal) || Array.isArray(draftVal)) {
                    const arrDraft = formatArray(draftVal);
                    const arrOrig = formatArray(origVal);
                    if (JSON.stringify(arrDraft.sort()) !== JSON.stringify(arrOrig.sort())) {
                        newPayload[key] = ["L", ...arrDraft];
                        oldPayload[key] = ["L", ...arrOrig];
                        hasChanges = true;
                    }
                }
                else {
                    if (draftVal !== origVal) {
                        newPayload[key] = draftVal; oldPayload[key] = origVal; hasChanges = true;
                    }
                }
            });

            if (mode === 'entrant' && draft.nouveauCommentaire && draft.nouveauCommentaire.trim()) {
                const dateJour = new Date().toLocaleDateString('fr-FR');
                const noteFormattee = `[CG] CG (${dateJour}) : ${draft.nouveauCommentaire.trim()}`;
                newPayload.Commentaires = courrierEdite.Commentaires ? `${courrierEdite.Commentaires}\n${noteFormattee}` : noteFormattee;
                oldPayload.Commentaires = courrierEdite.Commentaires || "";
                hasChanges = true;
            }

            if (!hasChanges) {
                showToast("Aucune modification détectée", 'info');
                setCourrierEdite(null);
                setIsSaving(false);
                return;
            }

            await window.grist.docApi.applyUserActions([['UpdateRecord', table, courrierEdite.id, newPayload]]);

            const undoAction = async () => {
                try {
                    await window.grist.docApi.applyUserActions([['UpdateRecord', table, courrierEdite.id, oldPayload]]);
                    showToast("Modification annulée", 'info');
                } catch (error) {
                    console.error("Erreur d'annulation :", error);
                    showToast("Impossible d'annuler", 'error');
                }
            };

            setCourrierEdite(null);
            showToast("Modifications enregistrées", 'success', undoAction);
        } catch (error) {
            console.error("Erreur de mise à jour :", error);
            showToast("Erreur lors de la mise à jour", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    /* --- SOUS-COMPOSANTS D'EDITION --- */

    const Diode = ({ label, active, onClick }) => (
        <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s' }} className="hover-edit-bg">
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: active ? '#00ff00' : (isDark ? '#444' : '#ccc'), boxShadow: active ? '0 0 10px 2px rgba(0,255,0,0.4)' : 'inset 0 2px 4px rgba(0,0,0,0.2)', border: `1px solid ${active ? '#00ff00' : 'transparent'}`, transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }} />
            <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: active ? 'var(--text-main)' : 'var(--text-muted)' }}>{label}</span>
        </div>
    );

    const PillSelector = ({ field, label, options, displayKey, isMulti = true }) => {
        const isEditing = activeField === field;
        const currentIds = formatArray(draft[field]);
        const [localSearch, setLocalSearch] = useState('');

        const handleRemove = (e, idToRemove) => {
            e.stopPropagation();
            setDraft({ ...draft, [field]: isMulti ? currentIds.filter(id => id !== idToRemove) : null });
        };

        const handleAdd = (idToAdd) => {
            setDraft({ ...draft, [field]: isMulti ? [...new Set([...currentIds, idToAdd])] : idToAdd });
            setLocalSearch('');
            if (!isMulti) setActiveField(null);
        };

        const availableOptions = options?.filter(o => !currentIds.includes(o.id) && (o[displayKey] || '').toLowerCase().includes(localSearch.toLowerCase())).slice(0, 10) || [];

        return (
            <div style={{ marginBottom: '12px' }}>
                <label className="fr-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                <div onClick={() => setActiveField(field)} className="hover-edit-border" style={{ minHeight: '38px', padding: '6px', borderRadius: '6px', border: isEditing ? '2px solid #000091' : '1px solid transparent', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', cursor: isEditing ? 'text' : 'pointer', transition: 'all 0.2s', backgroundColor: isEditing ? 'var(--bg-app)' : 'transparent' }}>

                    {currentIds.length === 0 && !isEditing && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem', paddingLeft: '4px' }}>Vide</span>}

                    {currentIds.map(id => {
                        const obj = options?.find(o => o.id === id);
                        return (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-alt)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2px 8px 2px 12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {obj ? obj[displayKey] : `ID ${id}`}
                                <button onClick={(e) => handleRemove(e, id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '4px', padding: '0 2px', display: 'flex', alignItems: 'center' }}>&times;</button>
                            </div>
                        );
                    })}

                    {isEditing && (
                        <div style={{ position: 'relative', flexGrow: 1, minWidth: '120px' }}>
                            <input ref={searchInputRef} type="text" value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} onBlur={() => setTimeout(() => setActiveField(null), 200)} placeholder="Rechercher..." style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                            {localSearch && availableOptions.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: portalBgColor, border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                                    {availableOptions.map(opt => (
                                        <div key={opt.id} onMouseDown={(e) => { e.preventDefault(); handleAdd(opt.id); }} style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} className="hover-bg-alt">
                                            {opt[displayKey]}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const EditableText = ({ field, label, type = 'text', rows = 1 }) => {
        const isEditing = activeField === field;
        const val = draft[field] || '';

        return (
            <div style={{ marginBottom: '12px' }}>
                <label className="fr-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</label>
                {isEditing ? (
                    type === 'textarea' ?
                        <textarea autoFocus value={val} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} onBlur={() => setActiveField(null)} className="fr-input" rows={rows} style={{ fontSize: '0.85rem', padding: '8px' }} /> :
                        <input autoFocus type={type} value={val} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} onBlur={() => type !== 'date' && setActiveField(null)} onKeyDown={(e) => e.key === 'Enter' && setActiveField(null)} className="fr-input" style={{ fontSize: '0.85rem', padding: '8px', height: 'auto' }} />
                ) : (
                    <div onClick={() => setActiveField(field)} className="hover-edit-border" style={{ minHeight: '34px', padding: '6px 8px', borderRadius: '6px', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', whiteSpace: type === 'textarea' ? 'pre-wrap' : 'nowrap', overflow: type !== 'textarea' ? 'hidden' : 'visible', textOverflow: type !== 'textarea' ? 'ellipsis' : 'clip' }}>
                        {type === 'date' ? (val && !isNaN(new Date(val).getTime()) ? new Date(val).toLocaleDateString('fr-FR') : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Vide</span>) : (val || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Vide</span>)}
                    </div>
                )}
            </div>
        );
    };

    /* --- RENDU --- */
    return (
        <div style={{ position: 'relative' }}>
            <style>{`
                @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideUpToast { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes popInCard { 0% { opacity: 0; transform: scale(0.95) translateY(5px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
                .side-panel { animation: slideInRight 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .toast-enter { animation: slideUpToast 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .hover-card { animation: popInCard 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                
                .zen-bg { animation: breath 8s infinite alternate ease-in-out; }
                @keyframes breath { 0% { box-shadow: inset 0 0 0px rgba(0, 145, 145, 0); } 100% { box-shadow: inset 0 0 40px rgba(0, 145, 145, 0.1); } }

                .hover-edit-border:hover { border-color: var(--border-color) !important; background-color: var(--bg-alt); }
                .hover-edit-bg:hover { background-color: var(--bg-alt); }
                .hover-bg-alt:hover { background-color: var(--bg-alt); }

                kbd { background-color: var(--bg-alt); border: 1px solid var(--border-color); border-bottom-width: 2px; border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.85em; font-weight: bold; color: var(--text-main); display: inline-block; }
                input[type="date"] { position: relative; }
                input[type="date"]::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
            `}</style>

            {hoveredCard && createPortal(
                <div className="hover-card" style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 9999, backgroundColor: portalBgColor, color: portalTextColor, border: '1px solid var(--border-color)', borderLeft: `4px solid ${hoveredCard.type === 'tiers' ? '#000091' : '#18753c'}`, borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', padding: '16px', width: '350px', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" /></svg> Aperçu rapide </div>
                    {hoveredCard.data.map((item, idx) => (
                        <div key={idx} style={{ marginBottom: idx < hoveredCard.data.length - 1 ? '12px' : '0', paddingBottom: idx < hoveredCard.data.length - 1 ? '12px' : '0', borderBottom: idx < hoveredCard.data.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                            {hoveredCard.type === 'tiers' ? (
                                <><div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{item.Nom || 'Tiers inconnu'}</div><div style={{ fontSize: '0.85rem', color: '#000091', marginTop: '2px', fontWeight: 'bold' }}>{item.Type || 'Type non défini'}</div>{item.Contact && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm17 4.238l-7.928 7.1L4 7.216V19h16V7.238zM4.511 5l7.55 6.662L19.502 5H4.511z" /></svg>{item.Contact}</div>}</>
                            ) : (
                                <><div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{item.N_IC || 'Affaire inconnue'}</div><div style={{ fontSize: '0.85rem', color: '#18753c', marginTop: '2px', fontWeight: 'bold' }}>{item.Societe || 'Société non renseignée'}</div>{item.Objet && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic', lineHeight: '1.4', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.Objet}</div>}</>
                            )}
                        </div>
                    ))}
                </div>, document.body
            )}

            {toast && createPortal(
                <div className="toast-enter" style={{ position: 'fixed', bottom: '2rem', right: '2rem', backgroundColor: toast.type === 'error' ? '#ce0500' : '#161616', color: '#fff', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        {toast.type === 'success' && <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z" /></svg>}
                        {toast.type === 'error' && <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z" /></svg>}
                        {toast.type === 'info' && <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 6V3C7 2.448 7.448 2 8 2h11c.552 2 1 2.448 1 3v13c0 .552-.448 1-1 1h-3v3c0 .552-.448 1-1 1H4c-.552 0-1-.448-1-1V7c0-.552.448-1 1-1h3zm-2 2v11h9V8H5zm4-4v2h9V4H9z" /></svg>}
                        {toast.message}
                    </div>
                    {toast.undoAction && <button onClick={handleUndoClick} style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'background 0.2s' }}>Annuler</button>}
                </div>, document.body
            )}

            <div className={`fr-container fr-p-3w ${zenMode ? 'zen-bg' : ''}`} style={{ backgroundColor: 'var(--bg-alt)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                    <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', borderRadius: '30px', padding: '4px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                        <button onClick={() => setMode('entrant')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px', borderRadius: '26px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: mode === 'entrant' ? '#000091' : 'transparent', color: mode === 'entrant' ? 'white' : 'var(--text-main)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v4H3V3zm0 18V9h18v12H3zm10-8V8h-2v5H8l4 4 4-4h-3z" /></svg> Entrants
                        </button>
                        <button onClick={() => setMode('sortant')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px', borderRadius: '26px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: mode === 'sortant' ? '#18753c' : 'transparent', color: mode === 'sortant' ? 'white' : 'var(--text-main)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v4H3V3zm0 18V9h18v12H3zm9-4l4 4h-3v5h-2v-5H8l4-4z" /></svg> Sortants
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, maxWidth: '500px' }}>
                        <div style={{ flexGrow: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input type="text" className="fr-input" placeholder="Rechercher (Chrono, Tiers, Objet...)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.5rem', borderRadius: '24px' }} />
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z" /></svg></span>
                        </div>
                        <button onClick={() => setShowSettings(true)} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)', marginLeft: '8px' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l9.5 5.5v11L12 23l-9.5-5.5v-11L12 1zm0 2.311L4.5 7.653v8.694l7.5 4.342 7.5-4.342V7.653L12 3.311zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg></button>
                        <button onClick={() => setShowShortcuts(true)} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5v14h16V5H4zM3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 4h2v2H5V7zm4 0h2v2H9V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zM5 11h2v2H5v-2zm4 0h2v2H9v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 15h10v2H7v-2z" /></svg></button>
                    </div>
                </div>

                <div style={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'auto', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    <table className="fr-table fr-table--layout-fixed" style={{ width: '100%', margin: 0, minWidth: '900px', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: isDark ? '#1e1e1e' : '#f6f6f6' }}>
                            <tr>
                                <th style={{ width: '12%', padding: '12px', borderBottom: '2px solid var(--border-color)' }}>Chrono</th>
                                <th style={{ width: '10%', padding: '12px', borderBottom: '2px solid var(--border-color)' }}>Date</th>
                                <th style={{ width: '18%', padding: '12px', borderBottom: '2px solid var(--border-color)' }}>{mode === 'entrant' ? 'Expéditeur' : 'Destinataire'}</th>
                                <th style={{ width: '35%', padding: '12px', borderBottom: '2px solid var(--border-color)' }}>Objet & Étape</th>
                                <th style={{ width: '15%', padding: '12px', borderBottom: '2px solid var(--border-color)' }}>Affaire(s) IC</th>
                                <th style={{ width: '10%', padding: '12px', textAlign: 'right', borderBottom: '2px solid var(--border-color)' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courriersFiltres.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Aucun courrier trouvé.</td></tr>
                            ) : (
                                courriersFiltres.map((c, index) => {
                                    const badge = getBadgeStyle(c.Etape_Procedure);
                                    const isFocused = index === selectedIndex;
                                    return (
                                        <tr key={c.id} onClick={(e) => { setSelectedIndex(index); ouvrirEdition(c, e); }} style={{ transition: 'all 0.15s ease', cursor: 'pointer', backgroundColor: isFocused ? 'var(--bg-alt)' : 'transparent', outline: isFocused ? `2px solid ${mode === 'entrant' ? '#000091' : '#18753c'}` : 'none', outlineOffset: '-1px', boxShadow: isFocused ? '0 4px 12px rgba(0,0,0,0.1)' : 'none', position: isFocused ? 'relative' : 'static', zIndex: isFocused ? 2 : 'auto' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold', color: mode === 'entrant' ? '#000091' : '#18753c', borderBottom: '1px solid var(--border-color)' }}>{c.Chrono || '-'}</td>
                                            <td style={{ padding: '12px', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)' }}>{formatDateAffichage(mode === 'entrant' ? c.Date_de_Reception : c.Date_depart)}</td>
                                            <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', textDecoration: 'underline dotted', textUnderlineOffset: '4px' }} onMouseEnter={(e) => handleMouseEnterInfo(e, 'tiers', mode === 'entrant' ? c.Expediteur : c.Destinataire)} onMouseLeave={handleMouseLeaveInfo}>
                                                {getTiersNoms(mode === 'entrant' ? c.Expediteur : c.Destinataire)}
                                            </td>
                                            <td style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '6px' }}>{c.Objet || 'Sans objet'}</div>
                                                {c.Etape_Procedure && <span style={{ fontSize: '0.75rem', backgroundColor: badge?.bg || '#e3e3fd', color: badge?.color || '#000091', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{c.Etape_Procedure}</span>}
                                            </td>
                                            <td style={{ padding: '12px', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', textDecoration: 'underline dotted', textUnderlineOffset: '4px' }} onMouseEnter={(e) => handleMouseEnterInfo(e, 'ic', c.RefIC)} onMouseLeave={handleMouseLeaveInfo}>
                                                {getIcNoms(c.RefIC)}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', opacity: isFocused ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                                                    <button onClick={(e) => copierChrono(c, e)} title="Copier le Chrono" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', cursor: 'pointer', color: 'var(--text-main)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg></button>
                                                    <button onClick={(e) => copierAiot(c, e)} title="Copier le code AIOT" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', cursor: 'pointer', color: 'var(--text-main)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 8H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h10c1.103 0 2-.897 2-2V10c0-1.103-.897-2-2-2zM4 20V10h10l.002 10H4z" /><path d="M20 2H10c-1.103 0-2 .897-2 2v2h2V4h10v10h-2v2h2c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2z" /></svg></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showSettings && createPortal(
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseDown={() => setShowSettings(false)}>
                    <div className="smooth-enter" style={{ backgroundColor: portalBgColor, padding: '2rem', borderRadius: '8px', width: '400px', border: '1px solid var(--border-color)', color: portalTextColor }} onMouseDown={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 className="fr-h5" style={{ margin: 0, color: portalTextColor }}>Paramètres du Registre</h3>
                            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z" /></svg>
                            </button>
                        </div>
                        <label className="fr-label" style={{ color: portalTextColor }}>Délai d'annulation (secondes)</label>
                        <select className="fr-select" value={undoDelay} onChange={(e) => setUndoDelay(parseInt(e.target.value))}>
                            <option value={0}>Désactivé</option>
                            <option value={2000}>2 secondes</option>
                            <option value={5000}>5 secondes</option>
                        </select>
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="fr-btn" onClick={() => setShowSettings(false)}>Fermer</button>
                        </div>
                    </div>
                </div>, document.body
            )}

            {showShortcuts && createPortal(
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowShortcuts(false)}>
                    <div className="smooth-enter" style={{ backgroundColor: portalBgColor, padding: '2rem', borderRadius: '8px', width: '500px', border: '1px solid var(--border-color)', color: portalTextColor }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 className="fr-h5" style={{ margin: 0, color: portalTextColor }}>Raccourcis Clavier</h3>
                            <button onClick={() => setShowShortcuts(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z" /></svg>
                            </button>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}><span>Naviguer dans la liste</span><div><kbd>↑</kbd> <kbd>↓</kbd></div></li>
                            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}><span>Ouvrir le courrier sélectionné</span><div><kbd>Entrée ↵</kbd></div></li>
                            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}><span>Fermer le tiroir ou la modale</span><div><kbd>Échap</kbd></div></li>
                            <li style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}><span>Afficher cette aide</span><div><kbd>Maj</kbd> + <kbd>?</kbd></div></li>
                        </ul>
                    </div>
                </div>, document.body
            )}

            {courrierEdite && createPortal(
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998, display: 'flex', justifyContent: 'flex-end' }} onMouseDown={() => setCourrierEdite(null)}>
                    <div className="side-panel" style={{ backgroundColor: portalBgColor, color: portalTextColor, width: '480px', maxWidth: '100%', height: '100%', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${mode === 'entrant' ? '#000091' : '#18753c'}` }} onMouseDown={(e) => e.stopPropagation()}>

                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 className="fr-h5" style={{ margin: 0, color: mode === 'entrant' ? '#000091' : '#18753c', display: 'flex', alignItems: 'center' }}>
                                    {courrierEdite.Chrono || 'Édition Rapide'}
                                </h3>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Modifiez les champs d'un simple clic.</div>
                            </div>
                            <button onClick={() => setCourrierEdite(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z" /></svg></button>
                        </div>

                        <div style={{ padding: '1.5rem', overflowY: 'auto', flexGrow: 1 }}>

                            {mode === 'entrant' && (
                                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', backgroundColor: isDark ? '#222' : '#f9f9f9', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <Diode label="M" active={draft.M} onClick={() => setDraft({ ...draft, M: !draft.M })} />
                                    <Diode label="G" active={draft.G} onClick={() => setDraft({ ...draft, G: !draft.G })} />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                                {mode === 'entrant' && <EditableText field="Chrono" label="Chrono" />}
                                <EditableText field={mode === 'entrant' ? 'Date_de_Reception' : 'Date_depart'} label={mode === 'entrant' ? 'Date de réception' : 'Date de départ'} type="date" />
                                <EditableText field="Date_Courrier" label="Date du courrier" type="date" />
                                {mode === 'entrant' && <EditableText field="Date_Limite" label="Date limite (Surcharge)" type="date" />}
                            </div>

                            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <PillSelector field={mode === 'entrant' ? 'Expediteur' : 'Destinataire'} label={mode === 'entrant' ? 'Expéditeur(s)' : 'Destinataire(s)'} options={annuaire} displayKey="Nom" isMulti={mode === 'sortant'} />
                                <EditableText field="Objet" label="Objet" type="textarea" rows={3} />
                                <EditableText field="Etape_Procedure" label="Étape de la Procédure" />
                                {mode === 'entrant' && <PillSelector field="Type_de_procedure" label="Type de Procédure" options={typesProcedures} displayKey="Procedure" isMulti={false} />}
                            </div>

                            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <PillSelector field="RefIC" label="Affaire(s) IC liée(s)" options={affairesIC} displayKey="N_IC" isMulti={mode === 'entrant'} />
                                {mode === 'entrant' && <PillSelector field="AIOT" label="Code(s) AIOT" options={listeAIOT} displayKey="aiot_numero" isMulti={true} />}
                                <PillSelector field={mode === 'entrant' ? 'Agents' : 'Agent_s_'} label="Agent(s) assigné(s)" options={agents} displayKey="NOM" isMulti={true} />
                            </div>

                            {mode === 'entrant' && (
                                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                    <label className="fr-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: portalTextColor, fontSize: '0.75rem', marginBottom: '8px' }}>
                                        Journal de bord <InfoTooltip align="right" text="L'historique des notes est conservé. Rédigez une nouvelle note, elle sera horodatée à l'enregistrement." />
                                    </label>
                                    <div style={{ backgroundColor: isDark ? '#222' : '#f9f9f9', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '12px', fontSize: '0.85rem', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', color: 'var(--text-main)' }}>
                                        {courrierEdite.Commentaires ? courrierEdite.Commentaires : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune note antérieure.</span>}
                                    </div>
                                    <textarea
                                        className="fr-input"
                                        placeholder="Ajouter une nouvelle note au dossier..."
                                        value={draft.nouveauCommentaire || ''}
                                        onChange={(e) => setDraft({ ...draft, nouveauCommentaire: e.target.value })}
                                        rows={2}
                                        style={{ fontSize: '0.85rem', padding: '8px' }}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: isDark ? '#1a1a1a' : '#f6f6f6', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="fr-btn fr-btn--secondary" onClick={() => setCourrierEdite(null)} disabled={isSaving}>Annuler</button>
                            <button className="fr-btn" style={{ backgroundColor: mode === 'entrant' ? '#000091' : '#18753c' }} onClick={handleUpdate} disabled={isSaving}>{isSaving ? 'Mise à jour...' : 'Enregistrer les modifications'}</button>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
}