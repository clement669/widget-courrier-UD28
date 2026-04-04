import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

/* --- COMPOSANTS UX GLOBAUX --- */

/**
 * Composant d'infobulle intelligente.
 * Permet un alignement forcé pour éviter le débordement d'écran.
 */
const InfoTooltip = ({ text, align = 'center' }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Styles de base de l'infobulle
    let tooltipStyle = {
        position: 'absolute', bottom: '130%',
        backgroundColor: '#161616', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', width: 'max-content', maxWidth: '220px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: 'normal', whiteSpace: 'normal', textAlign: 'center', lineHeight: '1.4'
    };
    // Styles de base de la flèche
    let arrowStyle = { position: 'absolute', top: '100%', borderWidth: '6px', borderStyle: 'solid', borderColor: '#161616 transparent transparent transparent' };

    // Gestion dynamique de l'alignement
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

/**
 * Carte KPI réutilisable pour afficher un chiffre clé.
 * Supporte une infobulle optionnelle avec alignement forcé.
 */
const KpiCard = ({ title, value, subtitle, color = "var(--text-main)", tooltip, tooltipAlign = 'center' }) => (
    <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {title}
            {tooltip && <InfoTooltip text={tooltip} align={tooltipAlign} />}
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: '900', color: color, lineHeight: '1' }}>{value}</div>
        {subtitle && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>{subtitle}</div>}
    </div>
);

export default function ModulePerformances({ isDark, courriersEntrants, courriersSortants, logsSaisie, annuaire, typesProcedures }) {
    /* --- ETATS --- */
    const [activeTab, setActiveTab] = useState('totaux');
    const [dailyGoal, setDailyGoal] = useState(() => parseInt(localStorage.getItem('widget_daily_goal')) || 50);
    const [showSettings, setShowSettings] = useState(false);
    const [easterEggToast, setEasterEggToast] = useState(null);

    /* --- COULEURS DSFR DYNAMIQUES (Mode Dark support) --- */
    const COLORS = {
        entrant: isDark ? '#8585f6' : '#000091',
        sortant: isDark ? '#2de174' : '#18753c',
        neutre: isDark ? '#383838' : '#e5e5e5',
        text: isDark ? '#cecece' : '#161616',
        grid: isDark ? '#444' : '#eee',
        yes: isDark ? '#2de174' : '#18753c',
        no: isDark ? '#ff6f6f' : '#ce0500',
        palette: isDark
            ? ['#8585f6', '#2de174', '#ff8d5c', '#df70ee', '#ffb08f', '#4691e8']
            : ['#000091', '#18753c', '#b34000', '#9b1fa8', '#e4794a', '#0063cb'],
        heatmapBase: isDark ? '133, 133, 246' : '0, 0, 145'
    };

    /* --- UTILITAIRES DE TEMPS --- */
    const todayStr = new Date().toLocaleDateString('fr-FR');

    const getWeekNumber = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    /* --- CALCULS DES DONNÉES (USEMEMO) --- */
    const stats = useMemo(() => {
        const data = {
            total: 0, entrant: 0, sortant: 0,
            todayTotal: 0, todayEntrant: 0, todaySortant: 0,
            avgDaily: 0, avgEntrant: 0, avgSortant: 0,
            logsByDay: {}, logsByWeek: {}, heatmap: {},
            procedures: {}, reponses: { oui: 0, non: 0 }, tiersDuJour: {}
        };

        if (!logsSaisie) return data;

        /* --- PARCOURS DES LOGS DE SAISIE --- */
        logsSaisie.forEach(log => {
            if (!log.Timestamp) return;
            const dateObj = new Date(log.Timestamp * 1000);
            const dStr = dateObj.toLocaleDateString('fr-FR');
            const wNum = `${dateObj.getFullYear()}-S${getWeekNumber(dateObj).toString().padStart(2, '0')}`;
            const hour = dateObj.getHours();
            const dayOfWeek = dateObj.getDay();

            const isEntrant = log.Type_Courrier === 'Entrant';

            // Totaux
            data.total++;
            if (isEntrant) data.entrant++; else data.sortant++;

            // Journaliers (Aujourd'hui)
            if (dStr === todayStr) {
                data.todayTotal++;
                if (isEntrant) data.todayEntrant++; else data.todaySortant++;
            }

            // Groupements par jour & semaine
            if (!data.logsByDay[dStr]) data.logsByDay[dStr] = { entrant: 0, sortant: 0, total: 0 };
            data.logsByDay[dStr].total++;
            if (isEntrant) data.logsByDay[dStr].entrant++; else data.logsByDay[dStr].sortant++;

            if (!data.logsByWeek[wNum]) data.logsByWeek[wNum] = { name: wNum, Entrants: 0, Sortants: 0 };
            if (isEntrant) data.logsByWeek[wNum].Entrants++; else data.logsByWeek[wNum].Sortants++;

            // Heatmap (Uniquement heures ouvrées 8h-18h, Lundi-Vendredi)
            if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 18) {
                const heatKey = `${dayOfWeek}-${hour}`;
                data.heatmap[heatKey] = (data.heatmap[heatKey] || 0) + 1;
            }
        });

        /* --- MOYENNES --- */
        const daysCount = Object.keys(data.logsByDay).length || 1;
        data.avgDaily = Math.round(data.total / daysCount);
        data.avgEntrant = Math.round(data.entrant / daysCount);
        data.avgSortant = Math.round(data.sortant / daysCount);

        /* --- METADATA (Procédures & Réponses) --- */
        if (courriersEntrants) {
            courriersEntrants.forEach(c => {
                // Procédures
                if (c.Type_de_procedure) {
                    const procName = typesProcedures?.find(t => t.id === c.Type_de_procedure)?.Procedure || "Inconnu";
                    data.procedures[procName] = (data.procedures[procName] || 0) + 1;
                }
                // Réponses
                const aRepondu = c.Ref_Sortant && c.Ref_Sortant.length > 0;
                if (aRepondu) data.reponses.oui++; else data.reponses.non++;

                // Tiers du jour (Entrants)
                const cDate = c.Date_de_Reception ? new Date(c.Date_de_Reception * 1000).toLocaleDateString('fr-FR') : null;
                if (cDate === todayStr && c.Expediteur && c.Expediteur.length > 0) {
                    const tName = annuaire?.find(a => a.id === c.Expediteur[0])?.Nom || "Inconnu";
                    data.tiersDuJour[tName] = (data.tiersDuJour[tName] || 0) + 1;
                }
            });
        }

        if (courriersSortants) {
            courriersSortants.forEach(c => {
                // Procédures
                if (c.Etape_Procedure) {
                    data.procedures[c.Etape_Procedure] = (data.procedures[c.Etape_Procedure] || 0) + 1;
                }
                // Tiers du jour (Sortants)
                const cDate = c.Date_depart ? new Date(c.Date_depart * 1000).toLocaleDateString('fr-FR') : null;
                if (cDate === todayStr && c.Destinataire && c.Destinataire.length > 0) {
                    const tName = annuaire?.find(a => a.id === c.Destinataire[0])?.Nom || "Inconnu";
                    data.tiersDuJour[tName] = (data.tiersDuJour[tName] || 0) + 1;
                }
            });
        }

        return data;
    }, [logsSaisie, courriersEntrants, courriersSortants, typesProcedures, annuaire, todayStr]);

    /* --- FORMATAGE DONNEES POUR RECHARTS --- */
    const chartWeekData = Object.values(stats.logsByWeek).sort((a, b) => a.name.localeCompare(b.name)).slice(-10);
    const chartProcData = Object.entries(stats.procedures).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    const chartTiersData = Object.entries(stats.tiersDuJour).map(([name, Total]) => ({ name, Total })).sort((a, b) => b.Total - a.Total).slice(0, 5);

    const pieTotalData = [
        { name: 'Entrants', value: stats.entrant, color: COLORS.entrant },
        { name: 'Sortants', value: stats.sortant, color: COLORS.sortant }
    ];

    const pieReponseData = [
        { name: 'Répondus', value: stats.reponses.oui, color: COLORS.yes },
        { name: 'Sans réponse', value: stats.reponses.non, color: COLORS.no }
    ];

    /* --- GESTION DES REGLAGES (DAILY GOAL) --- */
    const handleGoalChange = (e) => {
        const val = parseInt(e.target.value) || 1;
        setDailyGoal(val);
        localStorage.setItem('widget_daily_goal', val);
    };

    /* --- EASTER EGG (BOUTON DECOMPRESSION) --- */
    const triggerEasterEgg = () => {
        const messages = [
            "Respiration profonde... Tu fais un travail formidable.",
            "N'oublie pas de t'hydrater ! Un esprit sain dans un corps sain.",
            "Même Rome ne s'est pas construite en un jour (et ils n'avaient pas Grist).",
            "Ferme les yeux 10 secondes. Respire. Souris. C'est reparti !",
            "Ta productivité est impressionnante ! Accorde-toi une pause café.",
            "Pose le clavier quelques secondes pour faire un tour !",
            "Continue comme ça, on va sauver la France ;)",
            "C'est le moment de faire quelques étirements !",
            "Tout ce travail accompli ! Tu as peut-être besoin de prendre un peu l'air :)"
        ];
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];
        setEasterEggToast(randomMsg);
        setTimeout(() => setEasterEggToast(null), 5000);
    };

    /* --- RENDU --- */
    return (
        <div style={{ position: 'relative' }}>

            {/* EASTER EGG TOAST */}
            {easterEggToast && createPortal(
                <div className="smooth-enter" style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#0063cb', color: 'white', padding: '16px 32px', borderRadius: '30px', fontWeight: 'bold', zIndex: 9999, boxShadow: '0 8px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" /></svg>
                    {easterEggToast}
                </div>, document.body
            )}

            {/* EN-TÊTE ET ONGLETS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-alt)', borderRadius: '30px', padding: '4px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                    <button onClick={() => setActiveTab('totaux')} style={{ padding: '8px 24px', borderRadius: '26px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: activeTab === 'totaux' ? 'var(--text-main)' : 'transparent', color: activeTab === 'totaux' ? 'var(--bg-app)' : 'var(--text-main)' }}>Totaux</button>
                    <button onClick={() => setActiveTab('journaliers')} style={{ padding: '8px 24px', borderRadius: '26px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: activeTab === 'journaliers' ? 'var(--text-main)' : 'transparent', color: activeTab === 'journaliers' ? 'var(--bg-app)' : 'var(--text-main)' }}>Journaliers</button>
                    <button onClick={() => setActiveTab('analyse')} style={{ padding: '8px 24px', borderRadius: '26px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: activeTab === 'analyse' ? 'var(--text-main)' : 'transparent', color: activeTab === 'analyse' ? 'var(--bg-app)' : 'var(--text-main)' }}>Analyse</button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={triggerEasterEgg} title="Besoin d'une pause ?" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0063cb' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-5-8.5L8.5 10l2 2 4-4 1.5 1.5L10.5 15 7 11.5z" /></svg>
                    </button>
                    <button onClick={() => setShowSettings(!showSettings)} title="Paramètres" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)', transition: 'transform 0.3s', transform: showSettings ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l9.5 5.5v11L12 23l-9.5-5.5v-11L12 1zm0 2.311L4.5 7.653v8.694l7.5 4.342 7.5-4.342V7.653L12 3.311zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
                    </button>
                </div>
            </div>

            {/* PARAMÈTRES (MODALE) */}
            {showSettings && (
                <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem', animation: 'fadeSlideUp 0.2s ease-out' }}>
                    <h3 className="fr-h6" style={{ marginTop: 0, display: 'flex', alignItems: 'center' }}>
                        Paramètres des Performances
                        <InfoTooltip text="Ces paramètres sont sauvegardés sur votre navigateur actuel." />
                    </h3>
                    <div className="fr-grid-row fr-grid-row--gutters">
                        <div className="fr-col-12 fr-col-md-4">
                            <label className="fr-label">Objectif quotidien (Jauge)</label>
                            <input type="number" className="fr-input" value={dailyGoal} onChange={handleGoalChange} />
                        </div>
                    </div>
                </div>
            )}

            {/* --- ONGLET: TOTAUX --- */}
            {activeTab === 'totaux' && (
                <div className="smooth-enter">
                    <div className="fr-grid-row fr-grid-row--gutters fr-mb-4w">
                        <div className="fr-col-12 fr-col-md-3"><KpiCard title="Volume Total" value={stats.total} subtitle="Depuis le début" tooltip="Le nombre total de courriers (entrants + sortants) enregistrés dans la base de données." /></div>
                        <div className="fr-col-12 fr-col-md-3"><KpiCard title="Total Entrants" value={stats.entrant} color={COLORS.entrant} /></div>
                        <div className="fr-col-12 fr-col-md-3"><KpiCard title="Total Sortants" value={stats.sortant} color={COLORS.sortant} /></div>
                        <div className="fr-col-12 fr-col-md-3"><KpiCard title="Moyenne / Jour" value={stats.avgDaily} subtitle="Entrants + Sortants" tooltip="Calculé en divisant le volume total par le nombre de jours d'activité (jours où au moins un courrier a été saisi)." tooltipAlign="right" /></div>
                    </div>

                    <div className="fr-grid-row fr-grid-row--gutters">
                        <div className="fr-col-12 fr-col-md-4">
                            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', height: '300px' }}>
                                <h4 className="fr-text--sm fr-mb-2w" style={{ textAlign: 'center', fontWeight: 'bold' }}>Répartition Globale</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieTotalData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} stroke="none">
                                            {pieTotalData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="fr-col-12 fr-col-md-8">
                            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', height: '300px' }}>
                                <h4 className="fr-text--sm fr-mb-2w" style={{ textAlign: 'center', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    Volume par Semaine
                                    <InfoTooltip text="Affiche l'évolution du nombre de saisies sur les 10 dernières semaines d'activité." />
                                </h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartWeekData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                        <XAxis dataKey="name" stroke={COLORS.text} fontSize={12} tickLine={false} />
                                        <YAxis stroke={COLORS.text} fontSize={12} tickLine={false} axisLine={false} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }} />
                                        <Legend />
                                        <Bar dataKey="Entrants" stackId="a" fill={COLORS.entrant} radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="Sortants" stackId="a" fill={COLORS.sortant} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="fr-col-12 fr-col-md-6">
                            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', height: '300px' }}>
                                <h4 className="fr-text--sm fr-mb-2w" style={{ textAlign: 'center', fontWeight: 'bold' }}>Top 5 Procédures</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartProcData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                                        <XAxis type="number" stroke={COLORS.text} fontSize={12} hide />
                                        <YAxis dataKey="name" type="category" stroke={COLORS.text} fontSize={10} width={120} tickLine={false} axisLine={false} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {chartProcData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.palette[index % COLORS.palette.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="fr-col-12 fr-col-md-6">
                            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', height: '300px' }}>
                                <h4 className="fr-text--sm fr-mb-2w" style={{ textAlign: 'center', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    Taux de Réponse (Entrants)
                                    <InfoTooltip align="right" text="Proportion de courriers entrants ayant au moins un courrier sortant lié dans la colonne 'Fait suite au sortant'." />
                                </h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieReponseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} stroke="none">
                                            {pieReponseData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ONGLET: JOURNALIERS --- */}
            {activeTab === 'journaliers' && (
                <div className="smooth-enter">
                    <div className="fr-grid-row fr-grid-row--gutters fr-mb-4w">
                        <div className="fr-col-12 fr-col-md-3"><KpiCard title="Saisis Aujourd'hui" value={stats.todayTotal} subtitle={`Moyenne : ${stats.avgDaily}`} tooltip="Se base sur l'horodatage exact de vos clics sur 'Enregistrer' aujourd'hui." /></div>
                        <div className="fr-col-12 fr-col-md-3"><KpiCard title="Entrants du jour" value={stats.todayEntrant} color={COLORS.entrant} subtitle={`Moyenne : ${stats.avgEntrant}`} /></div>
                        <div className="fr-col-12 fr-col-md-3"><KpiCard title="Sortants du jour" value={stats.todaySortant} color={COLORS.sortant} subtitle={`Moyenne : ${stats.avgSortant}`} /></div>
                        <div className="fr-col-12 fr-col-md-3">
                            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    Objectif Quotidien
                                    <InfoTooltip align="right" text="Objectif défini dans les paramètres. Il n'a aucune valeur managériale, c'est uniquement pour vous motiver !" />
                                </div>
                                <div style={{ backgroundColor: 'var(--bg-alt)', borderRadius: '8px', height: '24px', width: '100%', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                                    <div style={{ width: `${Math.min(100, (stats.todayTotal / dailyGoal) * 100)}%`, backgroundColor: stats.todayTotal >= dailyGoal ? COLORS.yes : COLORS.entrant, height: '100%', transition: 'width 0.5s ease-out' }}></div>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '8px', fontWeight: 'bold' }}>{stats.todayTotal} / {dailyGoal}</div>
                            </div>
                        </div>
                    </div>

                    <div className="fr-grid-row fr-grid-row--gutters">
                        <div className="fr-col-12 fr-col-md-6">
                            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', height: '300px' }}>
                                <h4 className="fr-text--sm fr-mb-2w" style={{ textAlign: 'center', fontWeight: 'bold' }}>Aujourd'hui vs Moyenne</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[{ name: 'Entrants', Jour: stats.todayEntrant, Moyenne: stats.avgEntrant }, { name: 'Sortants', Jour: stats.todaySortant, Moyenne: stats.avgSortant }]} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                        <XAxis dataKey="name" stroke={COLORS.text} tickLine={false} />
                                        <YAxis stroke={COLORS.text} tickLine={false} axisLine={false} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }} />
                                        <Legend />
                                        <Bar dataKey="Jour" fill={COLORS.entrant} radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Moyenne" fill={COLORS.neutre} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="fr-col-12 fr-col-md-6">
                            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
                                <h4 className="fr-text--sm fr-mb-2w" style={{ textAlign: 'center', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                                    Tiers traités aujourd'hui
                                    <InfoTooltip align="right" text="Liste les expéditeurs et destinataires avec lesquels vous avez interagi aujourd'hui (Date de réception ou Date d'envoi = Aujourd'hui)." />
                                </h4>
                                <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
                                    {chartTiersData.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '3rem' }}>Aucun Tiers enregistré aujourd'hui.</div>
                                    ) : (
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                            {chartTiersData.map((t, idx) => (
                                                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--border-color)', backgroundColor: idx % 2 === 0 ? 'var(--bg-alt)' : 'transparent' }}>
                                                    <span style={{ fontWeight: 'bold' }}>{t.name}</span>
                                                    <span style={{ backgroundColor: 'var(--bg-alt)', color: COLORS.entrant, border: `1px solid ${COLORS.entrant}`, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t.Total} courriers</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ONGLET: ANALYSE (HEATMAP) --- */}
            {activeTab === 'analyse' && (
                <div className="smooth-enter">
                    <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill={COLORS.entrant}><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm1-10V7h-2v7h6v-2h-4z" /></svg>
                            <h3 className="fr-h5" style={{ margin: 0 }}>Heures de pointe (Heatmap)</h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Cette carte thermique identifie vos moments de plus forte activité de saisie (Jours ouvrés). Plus la case est colorée, plus vous avez enregistré de courriers à cette heure-là.</p>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px', minWidth: '600px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px' }}></th>
                                        {Array.from({ length: 11 }, (_, i) => i + 8).map(hour => (
                                            <th key={`th-${hour}`} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', paddingBottom: '8px' }}>{hour}h</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map((dayName, dayIndex) => {
                                        const actualDayNum = dayIndex + 1; // 1 = Lundi
                                        return (
                                            <tr key={dayName}>
                                                <td style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', textAlign: 'right', paddingRight: '12px' }}>{dayName}</td>
                                                {Array.from({ length: 11 }, (_, i) => i + 8).map(hour => {
                                                    const count = stats.heatmap[`${actualDayNum}-${hour}`] || 0;
                                                    // Calcul de l'intensité (max arbitraire à 10 pour le dégradé)
                                                    const intensity = Math.min(1, count / 10);
                                                    const bg = count === 0 ? 'var(--bg-alt)' : `rgba(${COLORS.heatmapBase}, ${Math.max(0.2, intensity)})`;

                                                    return (
                                                        <td key={`${dayName}-${hour}`} style={{ width: '8%', height: '35px', backgroundColor: bg, borderRadius: '4px', border: count === 0 ? '1px solid var(--border-color)' : 'none', position: 'relative' }} title={`${count} courriers saisis le ${dayName} entre ${hour}h et ${hour + 1}h`}>
                                                            {count > 0 && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: isDark || intensity > 0.6 ? 'white' : 'var(--text-main)', fontWeight: 'bold' }}>{count}</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Moins actif <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--bg-alt)', borderRadius: '2px', border: '1px solid var(--border-color)' }}></div>
                            <div style={{ width: '12px', height: '12px', backgroundColor: `rgba(${COLORS.heatmapBase}, 0.4)`, borderRadius: '2px' }}></div>
                            <div style={{ width: '12px', height: '12px', backgroundColor: `rgba(${COLORS.heatmapBase}, 0.8)`, borderRadius: '2px' }}></div> Plus actif
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}