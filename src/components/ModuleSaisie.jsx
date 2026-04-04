import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* --- COMPOSANT UX : INFOBULLE --- */
const InfoTooltip = ({ text, align = 'center', position = 'top' }) => {
    const [isHovered, setIsHovered] = useState(false);

    let tooltipStyle = {
        position: 'absolute',
        backgroundColor: '#161616', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', width: 'max-content', maxWidth: '220px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: 'normal', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.4'
    };
    let arrowStyle = { position: 'absolute', borderWidth: '6px', borderStyle: 'solid' };

    if (position === 'top') {
        tooltipStyle.bottom = '130%'; arrowStyle.top = '100%'; arrowStyle.borderColor = '#161616 transparent transparent transparent';
    } else {
        tooltipStyle.top = '130%'; arrowStyle.bottom = '100%'; arrowStyle.borderColor = 'transparent transparent #161616 transparent';
    }

    if (align === 'right') {
        tooltipStyle.right = '-6px'; arrowStyle.right = '10px';
    } else if (align === 'left') {
        tooltipStyle.left = '-6px'; arrowStyle.left = '10px';
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-accent)">
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

/* --- UTILITAIRES --- */
const DRAFT_STORAGE_KEY = 'dreal_saisie_draft';
const loadDraft = () => {
    try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.warn("Brouillon local ignoré :", e);
        return {};
    }
};

const getEtatInitial = () => ({
    dateAction: new Date().toISOString().split('T')[0],
    dateCourrier: '',
    noOA: '',
    objet: '',
    agent: '',
    etapeProcedure: '',
    dateLimite: '',
    liaisonCourrier: '',
    M: false,
    G: false
});

const findAgentByNomPrenom = (agentString, agentsList) => {
    if (!agentString) return null;
    const str = agentString.toLowerCase().trim();
    return agentsList.find(a => {
        if (!a.NOM || !a.Prenom) return false;
        const combined = `${a.NOM.trim()} ${a.Prenom.trim()}`.toLowerCase();
        return combined === str;
    });
};

export default function ModuleSaisie({ isDark, annuaire, listeAIOT, agents, affairesIC, courriersEntrants, courriersSortants, typesProcedures, logsSaisie, currentUser }) {
    /* --- ETATS --- */
    const [draft] = useState(loadDraft);
    const [typeSaisie, setTypeSaisie] = useState(draft.typeSaisie || 'entrant');
    const [formData, setFormData] = useState(draft.formData || getEtatInitial());
    const [selectedTiers, setSelectedTiers] = useState(draft.selectedTiers || []);
    const [selectedICs, setSelectedICs] = useState(draft.selectedICs || []);
    const [selectedAIOTs, setSelectedAIOTs] = useState(draft.selectedAIOTs || []);
    const [commentairesHistory, setCommentairesHistory] = useState(draft.commentairesHistory || "");

    const [statutSauvegarde, setStatutSauvegarde] = useState('idle');
    const [recordCelebre, setRecordCelebre] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const [zenCountdown, setZenCountdown] = useState(5);
    const [magicPaste, setMagicPaste] = useState('');

    const [searchTiers, setSearchTiers] = useState('');
    const [searchIC, setSearchIC] = useState('');
    const [searchAIOT, setSearchAIOT] = useState('');
    const [draftComment, setDraftComment] = useState("");

    const [focusTiers, setFocusTiers] = useState(false);
    const [focusIC, setFocusIC] = useState(false);
    const [focusAIOT, setFocusAIOT] = useState(false);
    const [focusLiaison, setFocusLiaison] = useState(false);

    const [showModalIC, setShowModalIC] = useState(false);
    const [draftIC, setDraftIC] = useState({ N_IC: '', Objet: '', Type: '', Statut_Global: 'Dossier reçu', AIOT_id: null });

    const [showModalTiers, setShowModalTiers] = useState(false);
    const [draftTiers, setDraftTiers] = useState({ Nom: '', Type: 'Exploitant', Contact: '', AIOT_id: null, AIOT_texte: '', AIOT_numero: '', AIOT_isNew: false });
    const [searchAiotModal, setSearchAiotModal] = useState('');
    const [focusAiotModal, setFocusAiotModal] = useState(false);
    const [lastCalculatedAgent, setLastCalculatedAgent] = useState(null);

    /* --- CIBLE PORTAL BARRE D'OUTILS --- */
    const [portalTarget, setPortalTarget] = useState(null);
    useEffect(() => {
        const timer = setTimeout(() => {
            const target = document.getElementById('header-title-portal');
            if (target) setPortalTarget(target);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    /* --- LOGIQUE AUTO-AFFECTATION INTELLIGENTE --- */
    const computedAgentId = useMemo(() => {
        let foundAgentId = null;

        if (formData.liaisonCourrier) {
            const sourceList = typeSaisie === 'entrant' ? courriersSortants : courriersEntrants;
            const linked = sourceList.find(c => c.Chrono?.toLowerCase() === formData.liaisonCourrier.toLowerCase());
            if (linked) {
                const linkedAgents = typeSaisie === 'entrant' ? linked.Agent_s_ : linked.Agents;
                if (Array.isArray(linkedAgents) && linkedAgents.length > 0) {
                    foundAgentId = linkedAgents.find(v => typeof v === 'number');
                } else if (typeof linkedAgents === 'number') {
                    foundAgentId = linkedAgents;
                }
            }
        }

        if (!foundAgentId && selectedICs.length > 0) {
            for (const ic of selectedICs) {
                const fullIc = affairesIC.find(a => a.id === ic.id);
                if (fullIc && fullIc.Agent) {
                    const icAgents = Array.isArray(fullIc.Agent) ? fullIc.Agent : [fullIc.Agent];
                    const validAgent = icAgents.find(v => typeof v === 'number');
                    if (validAgent) { foundAgentId = validAgent; break; }
                }
            }
        }

        if (!foundAgentId && selectedAIOTs.length > 0) {
            for (const aiot of selectedAIOTs) {
                const fullAiot = listeAIOT.find(a => a.id === aiot.id);
                if (fullAiot && fullAiot.agent) {
                    if (Array.isArray(fullAiot.agent)) {
                        const validId = fullAiot.agent.find(v => typeof v === 'number');
                        if (validId) { foundAgentId = validId; break; }
                    } else if (typeof fullAiot.agent === 'number') {
                        foundAgentId = fullAiot.agent; break;
                    } else {
                        const matchedAgent = findAgentByNomPrenom(fullAiot.agent, agents);
                        if (matchedAgent) { foundAgentId = matchedAgent.id; break; }
                    }
                }
            }
        }

        if (!foundAgentId && selectedTiers.length > 0) {
            for (const tiers of selectedTiers) {
                const fullTiers = annuaire.find(a => a.id === tiers.id);
                if (fullTiers && fullTiers.AIOT_Lie) {
                    const linkedAiot = listeAIOT.find(a => a.id === fullTiers.AIOT_Lie);
                    if (linkedAiot && linkedAiot.agent) {
                        if (Array.isArray(linkedAiot.agent)) {
                            const validId = linkedAiot.agent.find(v => typeof v === 'number');
                            if (validId) { foundAgentId = validId; break; }
                        } else if (typeof linkedAiot.agent === 'number') {
                            foundAgentId = linkedAiot.agent; break;
                        } else {
                            const matchedAgent = findAgentByNomPrenom(linkedAiot.agent, agents);
                            if (matchedAgent) { foundAgentId = matchedAgent.id; break; }
                        }
                    }
                }
            }
        }

        return foundAgentId;
    }, [formData.liaisonCourrier, selectedICs, selectedAIOTs, selectedTiers, typeSaisie, courriersEntrants, courriersSortants, affairesIC, listeAIOT, agents, annuaire]);

    if (computedAgentId !== lastCalculatedAgent) {
        setLastCalculatedAgent(computedAgentId);
        if (computedAgentId) {
            setFormData(prev => ({ ...prev, agent: computedAgentId }));
        }
    }


    /* --- LOGIQUE ANTI-PERTE DE DONNÉES --- */
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentDraft = { typeSaisie, formData, selectedTiers, selectedICs, selectedAIOTs, commentairesHistory };
            const isDirty = formData.objet !== '' || selectedTiers.length > 0 || selectedICs.length > 0 || selectedAIOTs.length > 0 || commentairesHistory !== '';
            if (isDirty) {
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(currentDraft));
            } else {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [typeSaisie, formData, selectedTiers, selectedICs, selectedAIOTs, commentairesHistory]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            const isDirty = formData.objet !== '' || selectedTiers.length > 0 || selectedICs.length > 0 || selectedAIOTs.length > 0;
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [formData, selectedTiers, selectedICs, selectedAIOTs]);


    /* --- LOGIQUE RECORD DU JOUR --- */
    const { recordAbsolu, countToday } = useMemo(() => {
        if (!logsSaisie || logsSaisie.length === 0) return { recordAbsolu: 0, countToday: 0 };

        const todayStr = new Date().toLocaleDateString('fr-FR');
        const counts = {};

        logsSaisie.forEach(log => {
            if (log.Timestamp) {
                const dateStr = new Date(log.Timestamp * 1000).toLocaleDateString('fr-FR');
                counts[dateStr] = (counts[dateStr] || 0) + 1;
            }
        });

        const currentToday = counts[todayStr] || 0;
        const pastDates = Object.keys(counts).filter(d => d !== todayStr);
        const maxPast = pastDates.length > 0 ? Math.max(...pastDates.map(d => counts[d])) : 0;

        return { recordAbsolu: maxPast, countToday: currentToday };
    }, [logsSaisie]);

    /* --- EFFET ZEN MODE --- */
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
        const colors = { 5: 'var(--color-accent)', 4: '#1f8d99', 3: '#29a37e', 2: '#41b658', 1: '#85c441' };
        return colors[num] || 'var(--color-accent)';
    };

    /* --- GESTION FORMULAIRE --- */
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleMagicPaste = (e) => {
        const val = e.target.value;
        setMagicPaste(val);
        const match = val.match(/\[(.*?)\/(.*?)\/(.*?)\/(.*?)\]/);
        if (match) {
            const [, aiotStr, typeStr, agentStr, icStr] = match;
            const foundAiot = listeAIOT.find(a => a.aiot_numero === aiotStr);
            if (foundAiot) addAIOT({ texte: `${foundAiot.aiot_raison_sociale} (${foundAiot.aiot_numero})`, id: foundAiot.id, numero: foundAiot.aiot_numero });
            const foundAgent = agents.find(a => a.Initiales?.toLowerCase() === agentStr.toLowerCase());
            if (foundAgent) {
                setFormData(prev => ({ ...prev, agent: foundAgent.id }));
                setLastCalculatedAgent(foundAgent.id);
            }
            setFormData(prev => ({ ...prev, etapeProcedure: typeStr.toUpperCase() }));
            const foundIC = affairesIC.find(a => a.N_IC?.toUpperCase() === icStr.toUpperCase());
            if (foundIC) {
                addIC({ ...foundIC, isNew: false });
            } else {
                setDraftIC({ N_IC: icStr.toUpperCase(), Objet: '', Type: '', Statut_Global: 'Dossier reçu', AIOT_id: foundAiot ? foundAiot.id : null });
                setShowModalIC(true);
            }
            setTimeout(() => setMagicPaste(''), 1000);
        }
    };

    const basculerMode = (mode) => {
        setTypeSaisie(mode);
        setSelectedTiers([]); setSelectedICs([]); setSelectedAIOTs([]);
        setSearchTiers(''); setSearchIC(''); setSearchAIOT(''); setCommentairesHistory("");
    };

    /* --- GESTION TAGS --- */
    const addTiers = (tiers) => {
        if (typeSaisie === 'entrant') setSelectedTiers([{ id: tiers.id, texte: tiers.texte }]);
        else if (!selectedTiers.find(t => t.id === tiers.id)) setSelectedTiers([...selectedTiers, { id: tiers.id, texte: tiers.texte }]);

        const fullTiers = annuaire.find(a => a.id === tiers.id);
        if (fullTiers && fullTiers.AIOT_Lie) {
            const linkedAiot = listeAIOT.find(a => a.id === fullTiers.AIOT_Lie);
            if (linkedAiot) {
                setSelectedAIOTs(prev => {
                    if (!prev.find(a => a.id === linkedAiot.id)) {
                        return [...prev, { texte: `${linkedAiot.aiot_raison_sociale} (${linkedAiot.aiot_numero})`, id: linkedAiot.id, numero: linkedAiot.aiot_numero }];
                    }
                    return prev;
                });
            }
        }
        setSearchTiers(''); setFocusTiers(false);
    };
    const removeTiers = (id) => setSelectedTiers(selectedTiers.filter(t => t.id !== id));

    const addIC = (affaire) => {
        const typeProcObj = typesProcedures?.find(t => t.id === affaire.Type);
        const typeProcName = typeProcObj ? typeProcObj.Procedure : affaire.Type;
        const newIC = { id: affaire.id, N_IC: affaire.N_IC, typeProcedure: typeProcName, statutGlobal: affaire.Statut_Global, isNew: affaire.isNew, objetGlobal: affaire.Objet };
        if (typeSaisie === 'sortant') setSelectedICs([newIC]);
        else if (!selectedICs.find(ic => ic.id === affaire.id)) setSelectedICs([...selectedICs, newIC]);
        setSearchIC(''); setFocusIC(false);
    };
    const removeIC = (id) => setSelectedICs(selectedICs.filter(ic => ic.id !== id));

    const addAIOT = (aiot) => {
        if (!selectedAIOTs.find(a => a.id === aiot.id)) setSelectedAIOTs([...selectedAIOTs, aiot]);
        setSearchAIOT(''); setFocusAIOT(false);
    };
    const removeAIOT = (id) => setSelectedAIOTs(selectedAIOTs.filter(a => a.id !== id));

    const handleSelectTiersSuggestion = (s) => {
        if (s.source === 'Annuaire') {
            addTiers(s);
        } else if (s.source === 'AIOT') {
            const fullAiot = listeAIOT.find(a => a.id === s.id);
            const infosContact = [];
            if (fullAiot?.aiot_mail) infosContact.push(fullAiot.aiot_mail);
            if (fullAiot?.aiot_telephone) infosContact.push(fullAiot.aiot_telephone);
            const contactString = infosContact.join(' - ');

            setDraftTiers({ Nom: s.texte, Type: 'Exploitant', Contact: contactString, AIOT_id: s.id, AIOT_texte: `${s.texte} (${s.aiot_numero})`, AIOT_numero: s.aiot_numero, AIOT_isNew: false });
            setShowModalTiers(true);
            setFocusTiers(false);
        }
    };

    const updateStatutIC = async (icId, nouveauStatut) => {
        try {
            await window.grist.docApi.applyUserActions([['UpdateRecord', 'Affaires_IC', icId, { Statut_Global: nouveauStatut }]]);
            setSelectedICs(selectedICs.map(ic => ic.id === icId ? { ...ic, statutGlobal: nouveauStatut } : ic));
        } catch (error) {
            console.error(error);
        }
    };

    const ajouterCommentaire = () => {
        if (!draftComment.trim()) return;
        const dateJour = new Date().toLocaleDateString('fr-FR');
        const init = currentUser?.initiales || 'Agent';
        const nouvelleNote = `[${init}] ${init} (${dateJour}) : ${draftComment.trim()}`;
        setCommentairesHistory(prev => prev ? `${prev}\n${nouvelleNote}` : nouvelleNote);
        setDraftComment("");
    };

    /* --- FILTRES RECHERCHE --- */
    const suggestionsTiers = useMemo(() => {
        if (!searchTiers || searchTiers.length < 2) return [];
        const search = searchTiers.toLowerCase();
        const fromAnnuaire = annuaire.filter(a => a.Nom?.toLowerCase().includes(search)).map(a => ({ source: 'Annuaire', texte: a.Nom, texteDropdown: a.Nom, id: a.id }));
        const fromAiot = listeAIOT.filter(a => a.aiot_raison_sociale?.toLowerCase().includes(search) || a.aiot_numero?.toLowerCase().includes(search)).map(a => {
            const isDuplicate = listeAIOT.filter(item => item.aiot_raison_sociale?.trim().toLowerCase() === a.aiot_raison_sociale?.trim().toLowerCase()).length > 1;
            const formatCommune = (str) => str ? str.toLowerCase().replace(/(?:^|[\s-'])\w/g, m => m.toUpperCase()) : '';
            const nomAffiche = (isDuplicate && a.Commune) ? `${a.aiot_raison_sociale.trim()} (${formatCommune(a.Commune.trim())})` : (a.aiot_raison_sociale?.trim() || 'Sans nom');
            return { source: 'AIOT', texte: nomAffiche, texteDropdown: `${nomAffiche} [${a.aiot_numero}]`, id: a.id, aiot_numero: a.aiot_numero };
        });
        return [...fromAnnuaire, ...fromAiot].slice(0, 8);
    }, [searchTiers, annuaire, listeAIOT]);

    const suggestionsAiotModal = useMemo(() => {
        if (!searchAiotModal || searchAiotModal.length < 2) return [];
        const search = searchAiotModal.toLowerCase();
        const exactMatch = listeAIOT.find(a => a.aiot_numero === searchAiotModal);

        const results = listeAIOT.filter(a => a.aiot_numero?.toLowerCase().includes(search) || a.aiot_raison_sociale?.toLowerCase().includes(search))
            .map(a => ({ texte: `${a.aiot_raison_sociale} (${a.aiot_numero})`, id: a.id, numero: a.aiot_numero, isNew: false }))
            .slice(0, 5);

        if (!exactMatch && searchAiotModal.match(/^[0-9]{3,}$/)) {
            results.push({ id: 'NEW', texte: `+ Créer le nouvel AIOT ${searchAiotModal}`, numero: searchAiotModal, isNew: true });
        }
        return results;
    }, [searchAiotModal, listeAIOT]);

    const suggestionsIC = useMemo(() => {
        if (!searchIC || searchIC.length < 2) return [];
        const search = searchIC.toLowerCase();
        const exactMatch = affairesIC.find(a => a.N_IC?.toLowerCase() === search);
        const results = affairesIC.filter(a => a.N_IC?.toLowerCase().includes(search) || a.Objet?.toLowerCase().includes(search)).map(a => ({ ...a, isNew: false })).slice(0, 6);
        if (!exactMatch) results.push({ id: 'NEW', N_IC: searchIC.toUpperCase(), Objet: 'Créer cette nouvelle affaire', isNew: true });
        return results;
    }, [searchIC, affairesIC]);

    const suggestionsAIOT = useMemo(() => {
        if (!searchAIOT || searchAIOT.length < 2) return [];
        const search = searchAIOT.toLowerCase();
        return listeAIOT.filter(a => a.aiot_numero?.toLowerCase().includes(search) || a.aiot_raison_sociale?.toLowerCase().includes(search)).map(a => ({ texte: `${a.aiot_raison_sociale} (${a.aiot_numero})`, id: a.id, numero: a.aiot_numero })).slice(0, 6);
    }, [searchAIOT, listeAIOT]);

    const suggestionsLiaison = useMemo(() => {
        if (!formData.liaisonCourrier || formData.liaisonCourrier.length < 2) return [];
        const search = formData.liaisonCourrier.toLowerCase();
        const base = typeSaisie === 'entrant' ? courriersSortants : courriersEntrants;
        return base.filter(c => c.Chrono?.toLowerCase().includes(search)).slice(0, 5);
    }, [formData.liaisonCourrier, typeSaisie, courriersEntrants, courriersSortants]);

    const proceduresLieesAIOT = useMemo(() => {
        if (selectedAIOTs.length === 0) return [];
        const idsAIOT = selectedAIOTs.map(a => a.id);
        return affairesIC.filter(aff => idsAIOT.includes(aff.AIOT) && !selectedICs.find(ic => ic.id === aff.id));
    }, [selectedAIOTs, affairesIC, selectedICs]);

    /* --- SAUVEGARDE GRIST --- */
    const handleSave = async () => {
        setStatutSauvegarde('saving');
        try {
            const toGristDate = (dateStr) => dateStr ? (new Date(dateStr).getTime() / 1000) : null;
            let payload = {};
            let finalRefICs = selectedICs.map(ic => ic.id);
            const newIC = selectedICs.find(ic => ic.isNew);

            if (newIC) {
                const addedIcResult = await window.grist.docApi.applyUserActions([['AddRecord', 'Affaires_IC', null, { N_IC: newIC.N_IC, Objet: newIC.objetGlobal, Generer_Numero: false }]]);
                finalRefICs = [addedIcResult[0]];
            }

            const tableDestination = typeSaisie === 'entrant' ? 'Courriers_Entrants' : 'Courriers_Sortants';

            if (typeSaisie === 'entrant') {

                let subsToSave = [];
                selectedAIOTs.forEach(aiot => {
                    const fullAiot = listeAIOT.find(a => a.id === aiot.id);
                    if (fullAiot && fullAiot.subdivision) subsToSave.push(fullAiot.subdivision);
                });
                const subStr = subsToSave.length > 0 ? [...new Set(subsToSave)].join(', ') : null;

                payload = {
                    Date_de_Reception: toGristDate(formData.dateAction),
                    Date_Courrier: toGristDate(formData.dateCourrier),
                    Ordre_d_arrivee: formData.noOA ? parseInt(formData.noOA, 10) : null,
                    AIOT: selectedAIOTs.length > 0 ? ["L", ...selectedAIOTs.map(a => a.id)] : null,
                    Expediteur: selectedTiers.length > 0 ? parseInt(selectedTiers[0].id, 10) : 0,
                    Objet: formData.objet,
                    Etape_Procedure: formData.etapeProcedure,
                    RefIC: finalRefICs.length > 0 ? ["L", ...finalRefICs] : null,
                    Commentaires: commentairesHistory,
                    Date_Limite: toGristDate(formData.dateLimite),
                    M: formData.M,
                    G: formData.G,
                    Agents: formData.agent ? ["L", parseInt(formData.agent, 10)] : null,
                    Sub: null,
                    Sub_Suggeree: subStr
                };
                if (formData.liaisonCourrier) {
                    const linked = courriersSortants.find(c => c.Chrono === formData.liaisonCourrier);
                    if (linked) payload.Ref_Sortant = ["L", linked.id];
                }
            } else {
                payload = {
                    Date_depart: toGristDate(formData.dateAction),
                    Date_Courrier: toGristDate(formData.dateCourrier),
                    Destinataire: ["L", ...selectedTiers.map(t => t.id)],
                    Objet: formData.objet,
                    Etape_Procedure: formData.etapeProcedure,
                    Agent_s_: formData.agent ? ["L", parseInt(formData.agent, 10)] : null,
                    RefIC: finalRefICs.length > 0 ? finalRefICs[0] : 0,
                };
                if (formData.liaisonCourrier) {
                    const linked = courriersEntrants.find(c => c.Chrono === formData.liaisonCourrier);
                    if (linked) payload.Ref_Entrant = ["L", linked.id];
                }
            }

            const actionCourrier = ['AddRecord', tableDestination, null, payload];
            const actionLog = ['AddRecord', 'Logs_Saisie', null, {
                Timestamp: Date.now() / 1000,
                Type_Courrier: typeSaisie === 'entrant' ? 'Entrant' : 'Sortant',
                Chrono: "Auto"
            }];

            await window.grist.docApi.applyUserActions([actionCourrier, actionLog]);

            localStorage.removeItem(DRAFT_STORAGE_KEY);

            const nouveauTotal = countToday + 1;
            if (recordAbsolu > 0 && nouveauTotal > recordAbsolu && !recordCelebre) {
                setStatutSauvegarde('record');
                setRecordCelebre(true);
            } else {
                setStatutSauvegarde('success');
            }

            setTimeout(() => {
                setStatutSauvegarde('idle');
                setFormData(getEtatInitial());
                setSelectedTiers([]); setSelectedICs([]); setSelectedAIOTs([]);
                setCommentairesHistory("");
                setLastCalculatedAgent(null);
            }, 3500);

        } catch (error) {
            console.error("Erreur lors de la sauvegarde :", error);
            setStatutSauvegarde('error');
            setTimeout(() => setStatutSauvegarde('idle'), 4000);
        }
    };

    /* --- RENDU --- */
    return (
        <div style={{ position: 'relative' }}>

            <style>{`
                .rr-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
                .rr-switch input { opacity: 0; width: 0; height: 0; }
                .rr-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border-color); transition: .3s cubic-bezier(0.4, 0.0, 0.2, 1); border-radius: 24px; border: 1px solid var(--border-color); }
                .rr-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: var(--bg-app); transition: .3s cubic-bezier(0.4, 0.0, 0.2, 1); border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
                .rr-switch input:checked + .rr-slider { background-color: var(--color-accent); border-color: var(--color-accent); }
                .rr-switch input:checked + .rr-slider:before { transform: translateX(20px); background-color: white; }
                .rr-switch input:focus + .rr-slider { box-shadow: 0 0 0 2px var(--border-color); }
            `}</style>

            {isZenMode && createPortal(
                <div className="smooth-enter" style={{ position: 'fixed', inset: 0, backgroundColor: isDark ? '#161616' : '#ffffff', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s ease' }}>
                    <style>{`
                        @keyframes zenBreathe {
                            0% { transform: scale(0.8); opacity: 0.5; }
                            50% { transform: scale(1.2); opacity: 1; }
                            100% { transform: scale(0.8); opacity: 0.5; }
                        }
                    `}</style>
                    <div style={{ animation: 'zenBreathe 4s infinite ease-in-out', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)', marginBottom: '2rem', border: '2px dashed var(--color-accent)' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v5h-2zm0 6h2v2h-2z" /></svg>
                    </div>
                    <h2 style={{ color: 'var(--text-main)', textAlign: 'center', fontWeight: '300' }}>Inspirez profondément...</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Il sera toujours temps de sauver la France dans <span style={{ color: getZenColor(zenCountdown), fontWeight: 'bold', fontSize: '1.2rem', transition: 'color 1s ease' }}>{zenCountdown}</span> secondes.
                    </p>
                </div>, document.body
            )}

            {statutSauvegarde === 'success' && createPortal(
                <div className="smooth-enter" style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-accent)', color: 'white', padding: '12px 32px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, boxShadow: '0 8px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z" /></svg>
                    Courrier enregistré avec succès
                </div>, document.body
            )}

            {statutSauvegarde === 'record' && createPortal(
                <div className="smooth-enter" style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#9b1fa8', color: 'white', padding: '16px 40px', borderRadius: '40px', fontWeight: 'bold', zIndex: 9999, fontSize: '1.2rem', boxShadow: '0 12px 24px rgba(155, 31, 168, 0.4)', display: 'flex', alignItems: 'center', gap: '12px', border: '2px solid #e8d4f7' }}>
                    🎉🥳 NOUVEAU RECORD ABSOLU ! {countToday + 1} courriers saisis aujourd'hui ! 🥳🎉
                </div>, document.body
            )}

            {statutSauvegarde === 'error' && createPortal(
                <div className="smooth-enter" style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ce0500', color: 'white', padding: '12px 32px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, boxShadow: '0 8px 16px rgba(0,0,0,0.15)' }}>
                    Une erreur est survenue lors de l'enregistrement.
                </div>, document.body
            )}

            {/* --- PORTALS VERS LA BARRE D'OUTILS --- */}
            {portalTarget && createPortal(
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', borderRadius: '30px', padding: '4px', border: '1px solid var(--border-color)', margin: '0 auto' }}>
                    <button onClick={() => basculerMode('entrant')} style={{ padding: '6px 20px', borderRadius: '26px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', backgroundColor: typeSaisie === 'entrant' ? '#000091' : 'transparent', color: typeSaisie === 'entrant' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg> Entrant
                    </button>
                    <button onClick={() => basculerMode('sortant')} style={{ padding: '6px 20px', borderRadius: '26px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', backgroundColor: typeSaisie === 'sortant' ? '#18753c' : 'transparent', color: typeSaisie === 'sortant' ? 'white' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v2h14V4H5zm0 10h4v6h6v-6h4l-7-7-7 7z" /></svg> Sortant
                    </button>
                </div>,
                portalTarget
            )}

            <div className="fr-container--fluid fr-p-2w" style={{ backgroundColor: 'var(--bg-alt)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>

                {/* --- SAISIE MAGIQUE --- */}
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--color-accent)', marginBottom: '1.5rem' }}>
                    <label className="fr-label" style={{ color: 'var(--color-accent)', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                        Saisie Magique <InfoTooltip text="Collez la chaîne GUNenv ici (ex: [0010006662/LAEX/MOF/IC260085])" />
                    </label>
                    <input type="text" className="fr-input fr-input--sm" value={magicPaste} onChange={handleMagicPaste} placeholder="[0010006662/LAEX/MOF/IC260085]" />
                </div>

                <div className="fr-grid-row fr-grid-row--gutters" style={{ opacity: statutSauvegarde === 'saving' ? 0.5 : 1 }}>
                    {/* --- LIGNE 1 : DATES & COMPTEURS --- */}
                    <div className={typeSaisie === 'entrant' ? "fr-col-12 fr-col-md-2" : "fr-col-12 fr-col-md-3"}>
                        <label className="fr-label fr-text--sm">Date {typeSaisie === 'entrant' ? 'réception' : "d'envoi"}</label>
                        <input type="date" className="fr-input" name="dateAction" value={formData.dateAction} onChange={handleChange} />
                    </div>
                    <div className={typeSaisie === 'entrant' ? "fr-col-12 fr-col-md-2" : "fr-col-12 fr-col-md-3"}>
                        <label className="fr-label fr-text--sm">Date Courrier</label>
                        <input type="date" className="fr-input" name="dateCourrier" value={formData.dateCourrier} onChange={handleChange} />
                    </div>

                    {typeSaisie === 'entrant' ? (
                        <>
                            <div className="fr-col-12 fr-col-md-2">
                                <label className="fr-label fr-text--sm">Date Limite (Opt.)</label>
                                <input type="date" className="fr-input" name="dateLimite" value={formData.dateLimite} onChange={handleChange} />
                            </div>
                            <div className="fr-col-12 fr-col-md-2">
                                <label className="fr-label fr-text--sm">N° OA <InfoTooltip text="Ordre d'Arrivée" /></label>
                                <input type="number" className="fr-input" name="noOA" value={formData.noOA} onChange={handleChange} />
                            </div>
                            <div className="fr-col-12 fr-col-md-4" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <label className="rr-switch"><input type="checkbox" checked={formData.M} onChange={(e) => setFormData({ ...formData, M: e.target.checked })} /><span className="rr-slider"></span></label>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: formData.M ? 'var(--color-accent)' : 'var(--text-muted)' }}>M</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <label className="rr-switch"><input type="checkbox" checked={formData.G} onChange={(e) => setFormData({ ...formData, G: e.target.checked })} /><span className="rr-slider"></span></label>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: formData.G ? 'var(--color-accent)' : 'var(--text-muted)' }}>G</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="fr-col-12 fr-col-md-6">
                            <label className="fr-label fr-text--sm">Agent en charge</label>
                            <select className="fr-select" name="agent" value={formData.agent} onChange={handleChange}>
                                <option value="">Sélectionnez un agent...</option>
                                {agents.map(a => <option key={a.id} value={a.id}>{a.NOM} {a.Prenom}</option>)}
                            </select>
                        </div>
                    )}

                    {/* --- LIGNE 2 : CONTACTS & AIOT (PILLS INLINE) --- */}
                    <div className="fr-col-12 fr-col-md-6" style={{ position: 'relative' }}>
                        <label className="fr-label fr-text--sm" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>{typeSaisie === 'entrant' ? 'Expéditeur' : 'Destinataire(s)'}</span>
                            {!(typeSaisie === 'entrant' && selectedTiers.length > 0) && (
                                <button onClick={() => { setDraftTiers({ Nom: searchTiers, Type: 'Exploitant', Contact: '', AIOT_id: null, AIOT_texte: '', AIOT_numero: '', AIOT_isNew: false }); setShowModalTiers(true); }} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>+ NOUVEAU</button>
                            )}
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', backgroundColor: 'var(--bg-app)', alignItems: 'center', minHeight: '40px', borderBottom: focusTiers ? '2px solid var(--color-accent)' : '1px solid var(--border-color)' }}>
                            {selectedTiers.map((t, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-app)', border: '1px solid var(--color-accent)', color: 'var(--text-main)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap' }}>
                                    {t.texte} <button onClick={() => removeTiers(t.id)} style={{ background: 'none', border: 'none', marginLeft: '6px', cursor: 'pointer', padding: 0, color: 'inherit' }}>&times;</button>
                                </div>
                            ))}
                            {!(typeSaisie === 'entrant' && selectedTiers.length > 0) && (
                                <input type="text" value={searchTiers} onChange={(e) => setSearchTiers(e.target.value)} onFocus={() => setFocusTiers(true)} onBlur={() => setTimeout(() => setFocusTiers(false), 200)} placeholder="Rechercher Raison Sociale..." style={{ border: 'none', background: 'transparent', outline: 'none', flexGrow: 1, minWidth: '150px', fontSize: '0.9rem', color: 'var(--text-main)' }} />
                            )}
                        </div>
                        {focusTiers && suggestionsTiers.length > 0 && (
                            <ul style={{ position: 'absolute', top: '100%', left: '0.5rem', right: '0.5rem', background: isDark ? '#1e1e1e' : '#fff', border: '1px solid var(--border-color)', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {suggestionsTiers.map((s, i) => (
                                    <li key={i} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }} onMouseDown={() => handleSelectTiersSuggestion(s)}>
                                        <span>{s.texteDropdown}</span>
                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: s.source === 'AIOT' ? '#f5d662' : 'transparent', border: s.source === 'AIOT' ? 'none' : '1px solid var(--color-accent)', color: 'var(--text-main)' }}>{s.source}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="fr-col-12 fr-col-md-6" style={{ position: 'relative' }}>
                        <label className="fr-label fr-text--sm" style={{ marginBottom: '4px' }}>N° AIOT(s)</label>
                        <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', backgroundColor: 'var(--bg-app)', alignItems: 'center', minHeight: '40px', borderBottom: focusAIOT ? '2px solid var(--color-accent)' : '1px solid var(--border-color)' }}>
                            {selectedAIOTs.map((a, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f5d662', color: '#161616', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap' }}>
                                    <button onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(a.numero); }} title="Copier" style={{ background: 'none', border: 'none', marginRight: '4px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#161616' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                                    </button>
                                    {a.numero}
                                    <button onClick={(e) => { e.preventDefault(); removeAIOT(a.id); }} style={{ background: 'none', border: 'none', marginLeft: '6px', cursor: 'pointer', color: '#161616', padding: 0 }}>&times;</button>
                                </div>
                            ))}
                            <input type="text" value={searchAIOT} onChange={(e) => setSearchAIOT(e.target.value)} onFocus={() => setFocusAIOT(true)} onBlur={() => setTimeout(() => setFocusAIOT(false), 200)} placeholder="Rechercher par Numéro..." style={{ border: 'none', background: 'transparent', outline: 'none', flexGrow: 1, minWidth: '100px', fontSize: '0.9rem', color: 'var(--text-main)' }} />
                        </div>
                        {focusAIOT && suggestionsAIOT.length > 0 && (
                            <ul style={{ position: 'absolute', top: '100%', left: '0.5rem', right: '0.5rem', background: isDark ? '#1e1e1e' : '#fff', border: '1px solid var(--border-color)', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {suggestionsAIOT.map((s, i) => <li key={i} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onMouseDown={() => addAIOT(s)}>{s.texte}</li>)}
                            </ul>
                        )}
                        {proceduresLieesAIOT.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', width: '100%', zIndex: 999, marginTop: '4px', padding: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', border: '1px dashed var(--color-accent)' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                    Affaires actives pour cet AIOT :
                                </div>
                                {proceduresLieesAIOT.map(aff => <button key={aff.id} onClick={() => addIC({ ...aff, isNew: false })} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.75rem', color: 'var(--text-main)' }}>+ <strong>{aff.N_IC}</strong></button>)}
                            </div>
                        )}
                    </div>

                    {/* --- LIGNE 3 : REFERENCES & ETAPES --- */}
                    <div className="fr-col-12 fr-col-md-4" style={{ position: 'relative' }}>
                        <label className="fr-label fr-text--sm" style={{ marginBottom: '4px' }}>Lier à une Affaire IC</label>
                        <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', backgroundColor: 'var(--bg-app)', alignItems: 'center', minHeight: '40px', borderBottom: focusIC ? '2px solid var(--color-accent)' : '1px solid var(--border-color)' }}>
                            {selectedICs.map((ic, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', backgroundColor: ic.isNew ? '#e8d4f7' : 'var(--bg-app)', border: ic.isNew ? 'none' : '1px solid var(--color-accent)', color: ic.isNew ? '#9b1fa8' : 'var(--text-main)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap' }}>
                                    {ic.N_IC}
                                    {!ic.isNew && (
                                        <select value={ic.statutGlobal || ''} onChange={(e) => updateStatutIC(ic.id, e.target.value)} title="Modifier le statut" style={{ marginLeft: '6px', fontSize: '0.75rem', border: 'none', background: 'transparent', color: 'inherit', outline: 'none', cursor: 'pointer', fontWeight: 'normal' }}>
                                            <option value="Dossier reçu">Dossier reçu</option><option value="En cours">En cours</option><option value="Clôturée">Clôturée</option><option value="Contentieux">Contentieux</option>
                                        </select>
                                    )}
                                    <button onClick={() => removeIC(ic.id)} style={{ background: 'none', border: 'none', marginLeft: '6px', cursor: 'pointer', padding: 0, color: 'inherit' }}>&times;</button>
                                </div>
                            ))}
                            {!(typeSaisie === 'sortant' && selectedICs.length > 0) && (
                                <input type="text" value={searchIC} onChange={(e) => setSearchIC(e.target.value)} onFocus={() => setFocusIC(true)} onBlur={() => setTimeout(() => setFocusIC(false), 200)} placeholder="Rechercher par IC..." style={{ border: 'none', background: 'transparent', outline: 'none', flexGrow: 1, minWidth: '100px', fontSize: '0.9rem', color: 'var(--text-main)' }} />
                            )}
                        </div>
                        {focusIC && suggestionsIC.length > 0 && (
                            <ul style={{ position: 'absolute', top: '100%', left: '0.5rem', right: '0.5rem', background: isDark ? '#1e1e1e' : '#fff', border: '1px solid var(--border-color)', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {suggestionsIC.map((s, i) => (
                                    <li key={i} style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: s.isNew ? '#f4e9fa' : 'transparent', borderBottom: '1px solid var(--border-color)' }} onMouseDown={() => s.isNew ? (setDraftIC({ N_IC: s.N_IC, Objet: '', Type: '', Statut_Global: 'Dossier reçu', AIOT_id: selectedAIOTs[0]?.id }), setShowModalIC(true)) : addIC(s)}>
                                        <div style={{ fontWeight: 'bold', color: s.isNew ? '#9b1fa8' : 'var(--color-accent)' }}>{s.isNew && '+ Créer '} {s.N_IC}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="fr-col-12 fr-col-md-4" style={{ position: 'relative' }}>
                        <label className="fr-label fr-text--sm" style={{ marginBottom: '4px' }}>{typeSaisie === 'entrant' ? 'Suite au (Chrono)' : 'Réponse à (Chrono)'}</label>
                        <input type="text" className="fr-input" name="liaisonCourrier" value={formData.liaisonCourrier} onChange={handleChange} onFocus={() => setFocusLiaison(true)} onBlur={() => setTimeout(() => setFocusLiaison(false), 200)} />
                        {focusLiaison && suggestionsLiaison.length > 0 && (
                            <ul style={{ position: 'absolute', top: '100%', left: '0.5rem', right: '0.5rem', background: isDark ? '#1e1e1e' : '#fff', border: '1px solid var(--border-color)', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {suggestionsLiaison.map((s, i) => <li key={i} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onMouseDown={() => setFormData({ ...formData, liaisonCourrier: s.Chrono })}>{s.Chrono}</li>)}
                            </ul>
                        )}
                    </div>

                    <div className="fr-col-12 fr-col-md-4">
                        <label className="fr-label fr-text--sm" style={{ marginBottom: '4px' }}>Étape Procédure</label>
                        <input type="text" className="fr-input" name="etapeProcedure" value={formData.etapeProcedure} onChange={handleChange} />
                    </div>

                    {/* --- LIGNE 4 : TEXTES --- */}
                    <div className={`fr-col-12 ${typeSaisie === 'entrant' ? 'fr-col-md-6' : 'fr-col-md-12'}`}>
                        <label className="fr-label fr-text--sm" style={{ marginBottom: '4px' }}>Objet du courrier</label>
                        <textarea className="fr-input" rows={2} name="objet" value={formData.objet} onChange={handleChange} style={{ resize: 'none' }} />
                    </div>

                    {typeSaisie === 'entrant' && (
                        <div className="fr-col-12 fr-col-md-6">
                            <label className="fr-label fr-text--sm" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                Journal de bord
                                {commentairesHistory && <span style={{ fontSize: '0.7rem', color: 'var(--color-accent)', fontWeight: 'bold' }}>✓ Note en attente</span>}
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <textarea className="fr-input" rows={2} value={draftComment} onChange={(e) => setDraftComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouterCommentaire()} placeholder="Ajouter une note..." style={{ resize: 'none' }} />
                                <button className="fr-btn fr-btn--secondary" onClick={ajouterCommentaire} style={{ height: 'auto', display: 'flex', alignItems: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <button onClick={handleSave} disabled={statutSauvegarde === 'saving'} className="fr-btn" style={{ backgroundColor: 'var(--color-accent)' }}>
                        {statutSauvegarde === 'saving' ? 'Enregistrement...' : `Enregistrer`}
                    </button>
                </div>
            </div>
            {/* --- MODALES --- */}
            {showModalIC && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '2rem', borderRadius: '8px', width: '600px', border: '2px solid #9b1fa8' }}>
                        <h3 className="fr-h4" style={{ color: '#9b1fa8' }}>Création IC {draftIC.N_IC}</h3>
                        <div className="fr-grid-row fr-grid-row--gutters">
                            <div className="fr-col-12"><label className="fr-label">Objet Global</label><input type="text" className="fr-input" value={draftIC.Objet} onChange={(e) => setDraftIC({ ...draftIC, Objet: e.target.value })} autoFocus /></div>
                            <div className="fr-col-12 fr-col-md-6"><label className="fr-label">Procédure</label><select className="fr-select" value={draftIC.Type} onChange={(e) => setDraftIC({ ...draftIC, Type: e.target.value })}><option value="">Sélectionnez...</option>{typesProcedures.map(t => <option key={t.id} value={t.id}>{t.Procedure}</option>)}</select></div>
                            <div className="fr-col-12 fr-col-md-6"><label className="fr-label">Statut Global Initial</label><select className="fr-select" value={draftIC.Statut_Global} onChange={(e) => setDraftIC({ ...draftIC, Statut_Global: e.target.value })}><option value="Dossier reçu">Dossier reçu</option><option value="En cours">En cours</option><option value="Clôturée">Clôturée</option></select></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button className="fr-btn fr-btn--secondary" onClick={() => setShowModalIC(false)}>Annuler</button>
                            <button className="fr-btn" style={{ backgroundColor: '#9b1fa8' }} onClick={async () => {
                                try {
                                    const payload = { N_IC: draftIC.N_IC, Objet: draftIC.Objet, Type: draftIC.Type ? parseInt(draftIC.Type) : 0, Statut_Global: draftIC.Statut_Global, Generer_Numero: false };
                                    if (draftIC.AIOT_id) payload.AIOT = draftIC.AIOT_id;
                                    const addedIc = await window.grist.docApi.applyUserActions([['AddRecord', 'Affaires_IC', null, payload]]);
                                    addIC({ id: addedIc[0], N_IC: draftIC.N_IC, isNew: false, Statut_Global: draftIC.Statut_Global });
                                    setShowModalIC(false);
                                } catch (error) {
                                    console.error("Erreur création Affaire IC :", error);
                                    alert(`Erreur Grist : Impossible de créer l'Affaire IC. Vérifiez les colonnes.`);
                                }
                            }}>Créer l'Affaire</button>
                        </div>
                    </div>
                </div>
            )}

            {showModalTiers && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: 'var(--bg-app)', padding: '2rem', borderRadius: '8px', width: '500px', border: '2px solid var(--color-accent)' }}>
                        <h3 className="fr-h4" style={{ color: 'var(--color-accent)' }}>Créer un contact dans l'Annuaire</h3>

                        <div className="fr-grid-row fr-grid-row--gutters">
                            <div className="fr-col-12">
                                <label className="fr-label">Nom / Raison Sociale</label>
                                <input type="text" className="fr-input" value={draftTiers.Nom} onChange={(e) => setDraftTiers({ ...draftTiers, Nom: e.target.value })} autoFocus />
                            </div>

                            <div className="fr-col-12 fr-col-md-6">
                                <label className="fr-label">Type de Contact</label>
                                <select className="fr-select" value={draftTiers.Type} onChange={(e) => setDraftTiers({ ...draftTiers, Type: e.target.value })}>
                                    <option value="Exploitant">Exploitant</option>
                                    <option value="Préfecture">Préfecture</option>
                                    <option value="Bureau d'études">Bureau d'études</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </div>
                            <div className="fr-col-12 fr-col-md-6">
                                <label className="fr-label">Contact (Email, Tél...)</label>
                                <input type="text" className="fr-input" value={draftTiers.Contact} onChange={(e) => setDraftTiers({ ...draftTiers, Contact: e.target.value })} />
                            </div>

                            <div className="fr-col-12" style={{ position: 'relative' }}>
                                <label className="fr-label">Lier à un AIOT (Optionnel)</label>
                                {draftTiers.AIOT_id || draftTiers.AIOT_isNew ? (
                                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: draftTiers.AIOT_isNew ? '#e8d4f7' : '#f5d662', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold', width: 'fit-content' }}>
                                        {draftTiers.AIOT_isNew && <span style={{ color: '#9b1fa8', marginRight: '4px' }}>+ Nouveau </span>}
                                        {draftTiers.AIOT_numero}
                                        <button onClick={() => setDraftTiers({ ...draftTiers, AIOT_id: null, AIOT_texte: '', AIOT_numero: '', AIOT_isNew: false })} style={{ background: 'none', border: 'none', marginLeft: '8px', cursor: 'pointer' }}>&times;</button>
                                    </div>
                                ) : (
                                    <>
                                        <input type="text" className="fr-input" value={searchAiotModal} onChange={(e) => setSearchAiotModal(e.target.value)} onFocus={() => setFocusAiotModal(true)} onBlur={() => setTimeout(() => setFocusAiotModal(false), 200)} placeholder="Rechercher ou taper un nouveau N° AIOT..." />
                                        {focusAiotModal && suggestionsAiotModal.length > 0 && (
                                            <ul style={{ position: 'absolute', top: '100%', left: '0.5rem', right: '0.5rem', background: isDark ? '#1e1e1e' : '#fff', border: '1px solid var(--border-color)', zIndex: 1000 }}>
                                                {suggestionsAiotModal.map((s, i) => (
                                                    <li
                                                        key={i}
                                                        style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: s.isNew ? '#f4e9fa' : 'transparent', fontWeight: s.isNew ? 'bold' : 'normal', color: s.isNew ? '#9b1fa8' : 'var(--text-main)' }}
                                                        onMouseDown={() => {
                                                            if (s.isNew) {
                                                                setDraftTiers(prev => ({ ...prev, AIOT_id: 'NEW', AIOT_numero: s.numero, AIOT_texte: `Nouveau: ${s.numero}`, AIOT_isNew: true }));
                                                            } else {
                                                                /* LOGIQUE DE PRÉ-REMPLISSAGE INTELLIGENT (Modale -> Modale) */
                                                                const fullAiot = listeAIOT.find(a => a.id === s.id);
                                                                setDraftTiers(prev => {
                                                                    const newTiers = { ...prev, AIOT_id: s.id, AIOT_texte: s.texte, AIOT_numero: s.numero, AIOT_isNew: false };
                                                                    if (!prev.Nom && fullAiot?.aiot_raison_sociale) newTiers.Nom = fullAiot.aiot_raison_sociale;
                                                                    if (!prev.Contact) {
                                                                        const contacts = [];
                                                                        if (fullAiot?.aiot_mail) contacts.push(fullAiot.aiot_mail);
                                                                        if (fullAiot?.aiot_telephone) contacts.push(fullAiot.aiot_telephone);
                                                                        newTiers.Contact = contacts.join(' - ');
                                                                    }
                                                                    return newTiers;
                                                                });
                                                            }
                                                            setSearchAiotModal('');
                                                        }}
                                                    >
                                                        {s.texte}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button className="fr-btn fr-btn--secondary" onClick={() => setShowModalTiers(false)}>Annuler</button>
                            <button className="fr-btn" onClick={async () => {
                                try {
                                    let finalAiotId = draftTiers.AIOT_id;

                                    /* LOGIQUE DE CRÉATION D'AIOT À LA VOLÉE */
                                    if (draftTiers.AIOT_isNew) {
                                        const aiotPayload = {
                                            aiot_numero: draftTiers.AIOT_numero,
                                            aiot_raison_sociale: draftTiers.Nom
                                        };
                                        const addedAiot = await window.grist.docApi.applyUserActions([['AddRecord', 'Liste_installations_suivies_Liste_AIOT', null, aiotPayload]]);
                                        finalAiotId = Array.isArray(addedAiot[0]) ? parseInt(addedAiot[0][0], 10) : parseInt(addedAiot[0], 10);
                                    }

                                    const payload = {
                                        Nom: draftTiers.Nom,
                                        Type: draftTiers.Type,
                                        Contact: draftTiers.Contact
                                    };

                                    // Envoi de la référence AIOT seulement si elle existe vraiment
                                    if (finalAiotId && finalAiotId !== 'NEW') {
                                        payload.AIOT_Lie = finalAiotId;
                                    }

                                    const addedTiers = await window.grist.docApi.applyUserActions([['AddRecord', 'Annuaire_Tiers', null, payload]]);
                                    const safeTiersId = Array.isArray(addedTiers[0]) ? parseInt(addedTiers[0][0], 10) : parseInt(addedTiers[0], 10);

                                    // Rafraîchissement visuel du formulaire parent
                                    addTiers({ id: safeTiersId, texte: draftTiers.Nom, source: 'Annuaire' });

                                    if (finalAiotId && finalAiotId !== 'NEW') {
                                        addAIOT({
                                            id: finalAiotId,
                                            texte: draftTiers.AIOT_isNew ? `${draftTiers.Nom} (${draftTiers.AIOT_numero})` : draftTiers.AIOT_texte,
                                            numero: draftTiers.AIOT_numero
                                        });
                                    }

                                    setShowModalTiers(false);
                                } catch (error) {
                                    console.error("Erreur création Tiers :", error);
                                    alert(`Erreur Grist : Impossible de créer le Tiers. Vérifiez que la colonne s'appelle bien "Email" dans l'Annuaire !`);
                                }
                            }}>Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}