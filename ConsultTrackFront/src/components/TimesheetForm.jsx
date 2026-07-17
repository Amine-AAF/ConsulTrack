import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axiosConfig';
import {
    PageHeader, StatCard, Button, Card, BudgetGauge, COLORS,
} from './ui';
import {
    CalendarCheck, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Save, Send, Lock,
    AlertTriangle, CheckCircle2, XCircle, Users, Palmtree, Wand2,
    CalendarRange, Wrench, Briefcase, FileText,
} from 'lucide-react';
import RaSaisieSection from './RaSaisieSection.jsx';

/* ============================================================
   Ma Présence (RPI) — saisie mensuelle de présence par BC.
   Un jour ouvré = présence (peinte sur un BC), absence (via
   demande), ou férié (géré par l'admin). Soumission mensuelle.
   ============================================================ */

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS_ENTETE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOTIFS_ABSENCE = ['Congé annuel', 'Maladie', 'Récupération', 'Sans solde'];

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const normDate = (d) => String(d).slice(0, 10);

/** Jours ouvrés (lun-ven) du mois : [{ day, dateStr, dow }] */
const weekdaysOfMonth = (annee, mois) => {
    const res = [];
    const nbJours = new Date(annee, mois, 0).getDate();
    for (let d = 1; d <= nbJours; d++) {
        const dow = new Date(annee, mois - 1, d).getDay();
        if (dow !== 0 && dow !== 6) res.push({ day: d, dateStr: iso(annee, mois, d), dow });
    }
    return res;
};

/** Regroupe des dates ISO triées en plages contiguës (les week-ends ne coupent pas). */
const contiguousRuns = (dateStrs) => {
    const sorted = [...dateStrs].sort();
    const runs = [];
    sorted.forEach((ds) => {
        const last = runs[runs.length - 1];
        if (last) {
            const next = new Date(`${last.fin}T00:00:00`);
            do { next.setDate(next.getDate() + 1); } while ([0, 6].includes(next.getDay()));
            if (iso(next.getFullYear(), next.getMonth() + 1, next.getDate()) === ds) { last.fin = ds; return; }
        }
        runs.push({ debut: ds, fin: ds });
    });
    return runs;
};

const TimesheetForm = ({ userRole = 'ADMIN', userId = null }) => {
    const isConsultant = userRole === 'CONSULTANT';
    const today = new Date();

    // --- Navigation / sélection ---
    const [annee, setAnnee] = useState(today.getFullYear());
    const [mois, setMois] = useState(today.getMonth() + 1);
    const [consultants, setConsultants] = useState([]);
    const [consultantId, setConsultantId] = useState(isConsultant ? String(userId ?? '') : '');

    // --- Données chargées (clé = date ISO "YYYY-MM-DD") ---
    const [saisies, setSaisies] = useState({});     // TacheRealiseeDTO par jour
    const [absences, setAbsences] = useState({});   // AbsenceDTO par jour
    const [feries, setFeries] = useState({});       // libellé par jour
    const [bcs, setBcs] = useState([]);
    const [prevMonthOk, setPrevMonthOk] = useState(true);

    // --- Édition locale ---
    // painted : jours de présence éditables (brouillons chargés, rejets corrigés, nouveaux clics)
    const [painted, setPainted] = useState({});     // { dateStr: {bcId, duree, desc, type, jira, isNew} }
    const [selectedBcId, setSelectedBcId] = useState('');
    const [uiMode, setUiMode] = useState('PRESENCE'); // 'PRESENCE' | 'ABSENCE'
    const [absSelection, setAbsSelection] = useState([]); // dates ISO sélectionnées pour demande
    const [absMotif, setAbsMotif] = useState(MOTIFS_ABSENCE[0]);

    // --- UI ---
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [missingDays, setMissingDays] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showRa, setShowRa] = useState(false); // encart Rapport d'Activité (replié par défaut)

    const notify = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 5000);
    };

    // ============================== CHARGEMENT ==============================

    useEffect(() => {
        if (isConsultant) { setConsultantId(String(userId ?? '')); return; }
        api.get('/admin/consultants')
            // Comptes inactifs (mission terminée) exclus de la saisie
            .then((res) => setConsultants((res.data || []).filter((c) => c.actif !== false)))
            .catch(() => notify('error', 'Impossible de charger les consultants.'));
    }, [isConsultant, userId]);

    useEffect(() => {
        setSaisies({}); setAbsences({}); setFeries({}); setBcs([]);
        setPainted({}); setAbsSelection([]); setMissingDays([]);
        setPrevMonthOk(true);
        if (!consultantId) return;

        const load = async () => {
            setLoading(true);
            try {
                const [resTaches, resBcs, resAbs, resFeries, resStatus] = await Promise.all([
                    api.get(`/dashboard/timesheet/${consultantId}?annee=${annee}&mois=${mois}`),
                    api.get('/admin/bcs'),
                    api.get(`/dashboard/absences/${consultantId}?annee=${annee}&mois=${mois}`),
                    api.get(`/jours-feries?annee=${annee}`),
                    api.get(`/timesheet/status?consultantId=${consultantId}&annee=${annee}&mois=${mois}`),
                ]);

                const saisiesMap = {};
                const paintedMap = {};
                resTaches.data.forEach((t) => {
                    const ds = normDate(t.date);
                    saisiesMap[ds] = t;
                    // Les brouillons restent directement éditables (repeints à l'écran)
                    if (t.statut === 'BROUILLON') {
                        paintedMap[ds] = {
                            bcId: t.bonDeCommande?.id ?? t.bcId, duree: t.duree,
                            desc: t.descriptionTache, type: t.typePrestation, jira: t.ticketJira,
                            isNew: false,
                        };
                    }
                });
                const absMap = {};
                resAbs.data.forEach((a) => { absMap[normDate(a.date)] = a; });
                const feriesMap = {};
                resFeries.data.forEach((jf) => { feriesMap[normDate(jf.date)] = jf.libelle; });

                const cid = parseInt(consultantId, 10);
                // BC pointables pour l'année affichée : année courante (ou sans année, compat)
                // + BC N-1 dont le reliquat est reporté et non épuisé.
                const mesBcs = resBcs.data.filter(
                    (bc) => (bc.consultantId === cid || bc.consultant?.id === cid)
                        && (bc.anneeBudgetaire == null
                            || bc.anneeBudgetaire === annee
                            || (bc.anneeBudgetaire === annee - 1 && bc.reportReliquat
                                && ((bc.joursMax ?? 0) - (bc.joursConsommes ?? 0) - (bc.joursEngages ?? 0)) > 0)),
                );

                setSaisies(saisiesMap);
                setPainted(paintedMap);
                setAbsences(absMap);
                setFeries(feriesMap);
                setBcs(mesBcs);
                setSelectedBcId((prev) => {
                    if (mesBcs.some((b) => String(b.id) === String(prev))) return prev;
                    const dispo = mesBcs.find((b) => (b.joursMax || 0) - (b.joursConsommes || 0) - (b.joursEngages || 0) > 0);
                    return String((dispo || mesBcs[0])?.id ?? '');
                });
                setPrevMonthOk(resStatus.data === true);
            } catch (err) {
                console.error('Erreur chargement RPI:', err);
                notify('error', 'Erreur lors du chargement des données du mois.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [consultantId, annee, mois, refreshKey]);

    // ============================== DÉRIVATIONS ==============================

    const weekdays = useMemo(() => weekdaysOfMonth(annee, mois), [annee, mois]);

    /** Semaines ouvrées du mois : tableau de tableaux de dateStr. */
    const weeks = useMemo(() => {
        const res = [];
        let current = [];
        weekdays.forEach((wd) => {
            if (wd.dow === 1 && current.length) { res.push(current); current = []; }
            current.push(wd.dateStr);
        });
        if (current.length) res.push(current);
        return res;
    }, [weekdays]);

    /** État d'un jour ouvré pour la grille et les règles de clic. */
    const getDayState = useCallback((dateStr) => {
        if (painted[dateStr]) return { kind: 'PAINTED', locked: false };
        if (feries[dateStr]) return { kind: 'FERIE', locked: true };
        const abs = absences[dateStr];
        if (abs) {
            return abs.statut === 'VALIDE'
                ? { kind: 'ABS_VALIDE', locked: true }
                : { kind: 'ABS_ATTENTE', locked: true };
        }
        const s = saisies[dateStr];
        if (s) {
            if (s.statut === 'VALIDE') return { kind: 'SAISIE_VALIDE', locked: true };
            if (s.statut === 'EN_ATTENTE') return { kind: 'SAISIE_ATTENTE', locked: true };
            if (s.statut === 'REJETE') return { kind: 'REJETE', locked: true }; // débloqué via « Corriger »
        }
        return { kind: 'LIBRE', locked: false };
    }, [painted, feries, absences, saisies]);

    const rejectedDays = useMemo(
        () => weekdays
            .filter(({ dateStr }) => saisies[dateStr]?.statut === 'REJETE' && !painted[dateStr])
            .map(({ dateStr }) => ({ dateStr, saisie: saisies[dateStr] })),
        [weekdays, saisies, painted],
    );

    /** Étape de la timeline du mois, dérivée des saisies chargées. */
    const monthStep = useMemo(() => {
        const entries = Object.values(saisies);
        if (entries.some((t) => t.statut === 'REJETE')) return 'REJETE';
        if (entries.length && entries.every((t) => t.statut === 'VALIDE')) return 'VALIDE';
        if (entries.some((t) => t.statut === 'EN_ATTENTE')) return 'SOUMIS';
        return 'BROUILLON';
    }, [saisies]);

    /** Consommation à l'écran d'un BC (brouillons peints, non comptés côté serveur). */
    const paintedByBc = useMemo(() => {
        const map = {};
        Object.values(painted).forEach((p) => {
            map[p.bcId] = (map[p.bcId] || 0) + (p.duree || 0);
        });
        return map;
    }, [painted]);

    const bcConso = (bc) => (bc.joursConsommes || 0) + (bc.joursEngages || 0) + (paintedByBc[bc.id] || 0);
    const bcRestant = (bc) => (bc.joursMax || 0) - bcConso(bc);
    const bcRef = (bcId) => bcs.find((b) => String(b.id) === String(bcId))?.reference || 'BC ?';

    const recap = useMemo(() => {
        let joursTravailles = 0;
        let totalJH = 0;
        let nbAbsences = 0;
        let nbFeries = 0;
        weekdays.forEach(({ dateStr }) => {
            if (feries[dateStr]) { nbFeries += 1; return; }
            if (absences[dateStr]) { nbAbsences += 1; return; }
            const duree = painted[dateStr]?.duree
                ?? (['EN_ATTENTE', 'VALIDE'].includes(saisies[dateStr]?.statut) ? saisies[dateStr].duree : 0);
            if (duree > 0) { joursTravailles += 1; totalJH += duree; }
        });
        return { joursTravailles, totalJH, nbAbsences, nbFeries };
    }, [weekdays, feries, absences, painted, saisies]);

    // ============================== ACTIONS ==============================

    const paintDay = (dateStr, prev) => {
        if (!selectedBcId) { notify('error', 'Sélectionnez d\'abord un bon de commande.'); return prev; }
        const bc = bcs.find((b) => String(b.id) === String(selectedBcId));
        const restant = bc ? bcRestant(bc) : 0;
        if (restant < 0.5) { notify('error', `Budget épuisé pour le BC ${bc?.reference || ''}.`); return prev; }
        return {
            ...prev,
            [dateStr]: { bcId: parseInt(selectedBcId, 10), duree: Math.min(1.0, restant), isNew: true },
        };
    };

    const handleDayClick = (dateStr) => {
        const state = getDayState(dateStr);

        if (uiMode === 'ABSENCE') {
            if (state.kind !== 'LIBRE') return;
            setAbsSelection((prev) => (prev.includes(dateStr)
                ? prev.filter((d) => d !== dateStr)
                : [...prev, dateStr]));
            return;
        }

        if (state.locked) return;
        setPainted((prev) => {
            const current = prev[dateStr];
            if (!current) return paintDay(dateStr, prev);
            // Cycle : 1.0 → 0.5 → retrait
            if (current.duree > 0.5) return { ...prev, [dateStr]: { ...current, duree: 0.5 } };
            const next = { ...prev };
            delete next[dateStr];
            return next;
        });
    };

    /** Remplissage rapide : peint 1 JH sur les jours libres passés en paramètre. */
    const fillDays = (dateStrs) => {
        if (!selectedBcId) { notify('error', 'Sélectionnez d\'abord un bon de commande.'); return; }
        const bc = bcs.find((b) => String(b.id) === String(selectedBcId));
        let restant = bc ? bcRestant(bc) : 0;
        const additions = {};
        let manqueBudget = false;
        dateStrs.forEach((ds) => {
            if (getDayState(ds).kind !== 'LIBRE') return;
            if (restant < 0.5) { manqueBudget = true; return; }
            const duree = Math.min(1.0, restant);
            additions[ds] = { bcId: parseInt(selectedBcId, 10), duree, isNew: true };
            restant -= duree;
        });
        if (!Object.keys(additions).length) {
            notify(manqueBudget ? 'error' : 'info',
                manqueBudget ? `Budget épuisé pour le BC ${bc?.reference || ''}.` : 'Aucun jour libre à remplir.');
            return;
        }
        setPainted((prev) => ({ ...prev, ...additions }));
        if (manqueBudget) notify('error', `Budget du BC ${bc?.reference || ''} insuffisant pour tout remplir.`);
    };

    const fillWeek = () => {
        const todayStr = iso(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const week = weeks.find((w) => w.includes(todayStr))
            || weeks.find((w) => w.some((ds) => getDayState(ds).kind === 'LIBRE'));
        if (week) fillDays(week);
    };

    /** Débloque la correction des jours rejetés : ils redeviennent des jours peints éditables. */
    const handleCorriger = () => {
        setPainted((prev) => {
            const next = { ...prev };
            rejectedDays.forEach(({ dateStr, saisie }) => {
                next[dateStr] = {
                    bcId: saisie.bonDeCommande?.id ?? saisie.bcId, duree: saisie.duree,
                    desc: saisie.descriptionTache, type: saisie.typePrestation, jira: saisie.ticketJira,
                    isNew: false,
                };
            });
            return next;
        });
        notify('info', 'Jours rejetés débloqués : corrigez-les puis soumettez à nouveau.');
    };

    // ============================== SAUVEGARDE ==============================

    const buildPayload = (statut) => Object.entries(painted).map(([dateStr, p]) => ({
        consultantId: parseInt(consultantId, 10),
        bcId: p.bcId,
        date: dateStr,
        duree: p.duree,
        mode: 'BC',
        statut,
        // Défauts fixes : la nature de la prestation est portée par le BC (backend/RA)
        descriptionTache: (p.isNew ? 'Prestation' : p.desc) || 'Prestation',
        typePrestation: p.isNew ? null : p.type ?? null,
        ticketJira: (p.isNew ? '' : p.jira) || '',
    }));

    /** Jours ouvrés non couverts (ni présence, ni absence, ni férié). */
    const uncoveredDays = () => weekdays
        .filter(({ dateStr }) => {
            if (feries[dateStr] || absences[dateStr] || painted[dateStr]) return false;
            const s = saisies[dateStr];
            return !(s && s.statut !== 'REJETE'); // un rejet non corrigé reste « manquant »
        })
        .map(({ day }) => day);

    const save = async (submit) => {
        setMissingDays([]);
        if (!consultantId) return;
        if (submit) {
            const missing = uncoveredDays();
            if (missing.length) {
                setMissingDays(missing);
                notify('error', 'Mois incomplet : des jours ouvrés ne sont pas renseignés.');
                return;
            }
        }
        const payload = buildPayload(submit ? 'EN_ATTENTE' : 'BROUILLON');
        if (!payload.length) {
            notify('info', 'Aucun jour de présence à enregistrer.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/dashboard/timesheet/bulk', payload);
            notify('success', submit
                ? 'Mois soumis pour validation.'
                : 'Brouillon enregistré.');
            setRefreshKey((k) => k + 1);
        } catch (err) {
            const data = err.response?.data;
            notify('error', (typeof data === 'string' ? data : data?.message) || 'Erreur technique lors de l\'enregistrement.');
        } finally {
            setSaving(false);
        }
    };

    const sendAbsenceRequest = async () => {
        if (!absSelection.length) return;
        setSaving(true);
        try {
            const runs = contiguousRuns(absSelection);
            for (const run of runs) {
                // eslint-disable-next-line no-await-in-loop
                await api.post('/dashboard/absences/demande', {
                    consultantId: parseInt(consultantId, 10),
                    dateDebut: run.debut,
                    dateFin: run.fin,
                    motif: absMotif,
                });
            }
            notify('success', `Demande d'absence envoyée (${runs.length} période${runs.length > 1 ? 's' : ''}).`);
            setAbsSelection([]);
            setUiMode('PRESENCE');
            setRefreshKey((k) => k + 1);
        } catch (err) {
            const data = err.response?.data;
            notify('error', (typeof data === 'string' ? data : data?.message) || 'Erreur lors de l\'envoi de la demande.');
        } finally {
            setSaving(false);
        }
    };

    const changeMonth = (delta) => {
        let m = mois + delta;
        let y = annee;
        if (m < 1) { m = 12; y -= 1; }
        if (m > 12) { m = 1; y += 1; }
        setMois(m); setAnnee(y);
    };

    // ============================== RENDU ==============================

    const renderTimeline = () => {
        const isRejected = monthStep === 'REJETE';
        const steps = [
            { key: 'BROUILLON', label: 'Brouillon' },
            { key: 'SOUMIS', label: 'Soumis' },
            isRejected ? { key: 'REJETE', label: 'Rejeté' } : { key: 'VALIDE', label: 'Validé' },
        ];
        const reachedIdx = { BROUILLON: 0, SOUMIS: 1, VALIDE: 2, REJETE: 2 }[monthStep];
        return (
            <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                        Statut du mois
                    </span>
                    <div className="flex items-center">
                        {steps.map((step, i) => {
                            const reached = i <= reachedIdx;
                            const isRed = step.key === 'REJETE';
                            const color = !reached ? '#cbd5e1' : isRed ? COLORS.red
                                : step.key === 'VALIDE' ? COLORS.green : COLORS.blue;
                            return (
                                <div key={step.key} className="flex items-center">
                                    {i > 0 && <div className="w-10 h-0.5 mx-1" style={{ backgroundColor: reached ? color : '#e2e8f0' }} />}
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center"
                                              style={{ backgroundColor: color }}>
                                            {isRed && reached
                                                ? <XCircle size={12} className="text-white" />
                                                : <CheckCircle2 size={12} className="text-white" />}
                                        </span>
                                        <span className="text-xs font-bold" style={{ color: reached ? color : '#94a3b8' }}>
                                            {step.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {isRejected && rejectedDays.length > 0 && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                        <div className="text-xs font-bold text-red-700 mb-2 flex items-center gap-2">
                            <AlertTriangle size={14} /> Jours rejetés à corriger :
                        </div>
                        <ul className="text-xs text-red-600 space-y-1 mb-3">
                            {rejectedDays.map(({ dateStr, saisie }) => (
                                <li key={dateStr}>
                                    <span className="font-bold">{new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR')}</span>
                                    {' — '}{saisie.motifRejet || 'Motif non précisé'}
                                </li>
                            ))}
                        </ul>
                        <Button variant="danger" onClick={handleCorriger}>
                            <Wrench size={14} /> Corriger
                        </Button>
                    </div>
                )}
            </Card>
        );
    };

    const renderDayCell = ({ day, dateStr }) => {
        const state = getDayState(dateStr);
        const p = painted[dateStr];
        const s = saisies[dateStr];
        const abs = absences[dateStr];
        const selectedForAbs = absSelection.includes(dateStr);

        let cls = 'bg-white hover:border-gray-400 cursor-pointer';
        let style = {};
        let title = '';
        let content = null;

        switch (state.kind) {
            case 'FERIE':
                cls = 'cursor-not-allowed';
                style = { backgroundColor: '#dbeafe', color: COLORS.blue };
                title = `Férié : ${feries[dateStr]}`;
                content = <span className="text-[10px] font-black flex items-center gap-0.5"><Palmtree size={10} /> JF</span>;
                break;
            case 'ABS_VALIDE':
                cls = 'cursor-not-allowed text-white';
                style = { backgroundColor: COLORS.red };
                title = `Absence validée : ${abs.motif || ''}`;
                content = <span className="text-[10px] font-black flex items-center gap-0.5"><Lock size={9} /> ABS</span>;
                break;
            case 'ABS_ATTENTE':
                cls = 'cursor-not-allowed';
                style = {
                    color: '#92400e',
                    background: 'repeating-linear-gradient(45deg, #fef3c7, #fef3c7 5px, #fde68a 5px, #fde68a 10px)',
                };
                title = `Demande d'absence en cours (${abs.motif || ''})`;
                content = <span className="text-[10px] font-black">ABS ?</span>;
                break;
            case 'SAISIE_VALIDE':
                cls = 'cursor-not-allowed';
                style = { backgroundColor: '#e2e8f0', color: '#475569' };
                title = `Validé — ${s.bonDeCommande?.reference || ''} (${s.duree} JH)`;
                content = (
                    <span className="text-[9px] font-bold flex items-center gap-0.5">
                        <Lock size={9} /> {s.duree} j
                    </span>
                );
                break;
            case 'SAISIE_ATTENTE':
                cls = 'cursor-not-allowed';
                style = { backgroundColor: '#dbeafe', color: '#1e40af' };
                title = `Soumis, en attente de validation — ${s.bonDeCommande?.reference || ''}`;
                content = (
                    <span className="text-[9px] font-bold flex items-center gap-0.5">
                        <Lock size={9} /> {s.duree} j
                    </span>
                );
                break;
            case 'REJETE':
                cls = 'cursor-not-allowed border-red-400 bg-red-50 text-red-600';
                title = `Rejeté : ${s.motifRejet || 'motif non précisé'} — cliquez sur « Corriger »`;
                content = <span className="text-[10px] font-black">Rejeté</span>;
                break;
            case 'PAINTED':
                cls = 'cursor-pointer text-white';
                style = { backgroundColor: COLORS.blue };
                title = `${bcRef(p.bcId)} — ${p.duree} JH (cliquer : 1 → 0.5 → retirer)`;
                content = (
                    <span className="text-[8px] font-bold leading-tight text-center">
                        {bcRef(p.bcId)}<br />{p.duree} j
                    </span>
                );
                break;
            default: // LIBRE
                if (uiMode === 'ABSENCE') {
                    cls = selectedForAbs
                        ? 'cursor-pointer border-2 border-dashed border-red-400 bg-red-100 text-red-700'
                        : 'bg-white hover:border-red-300 cursor-pointer';
                    if (selectedForAbs) content = <span className="text-[9px] font-black">ABS</span>;
                }
                break;
        }

        return (
            <div key={dateStr}
                 onClick={() => handleDayClick(dateStr)}
                 title={title}
                 className={`h-14 rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-0.5 transition-all select-none ${cls}`}
                 style={style}>
                <span className="text-xs font-black">{day}</span>
                {content}
            </div>
        );
    };

    const renderCalendar = () => {
        const nbJours = new Date(annee, mois, 0).getDate();
        const firstDow = new Date(annee, mois - 1, 1).getDay(); // 0 = dim
        const blanks = firstDow === 0 ? 6 : firstDow - 1;
        const weekdayByDay = Object.fromEntries(weekdays.map((wd) => [wd.day, wd]));
        return (
            <div className="grid grid-cols-7 gap-1.5">
                {JOURS_ENTETE.map((j) => (
                    <div key={j} className="text-center text-[10px] font-black uppercase text-gray-400 py-1">{j}</div>
                ))}
                {Array.from({ length: blanks }, (_, i) => <div key={`b-${i}`} className="h-14" />)}
                {Array.from({ length: nbJours }, (_, i) => {
                    const day = i + 1;
                    const wd = weekdayByDay[day];
                    if (!wd) {
                        return (
                            <div key={`we-${day}`} className="h-14 rounded-lg bg-gray-50 flex items-center justify-center">
                                <span className="text-xs font-bold text-gray-300">{day}</span>
                            </div>
                        );
                    }
                    return renderDayCell(wd);
                })}
            </div>
        );
    };

    const canSubmit = consultantId && prevMonthOk && monthStep !== 'VALIDE' && monthStep !== 'SOUMIS' && !saving;
    const canSaveDraft = consultantId && monthStep !== 'VALIDE' && !saving;

    return (
        <div className="mx-auto max-w-6xl p-4 space-y-5">
            <PageHeader
                icon={CalendarCheck}
                title="Ma Présence (RPI)"
                subtitle="Relevé de présence individuel : peignez vos jours sur un bon de commande, puis soumettez le mois."
                actions={(
                    <>
                        <Button variant="outline" disabled={!canSaveDraft} onClick={() => save(false)}>
                            <Save size={16} /> Enregistrer (brouillon)
                        </Button>
                        <Button variant="primary" disabled={!canSubmit} onClick={() => save(true)}>
                            <Send size={16} /> Soumettre le mois
                        </Button>
                    </>
                )}
            />

            {/* Sélection consultant + navigation mois */}
            <Card className="!p-4 flex flex-wrap items-center gap-4">
                {!isConsultant && (
                    <div className="flex items-center gap-2">
                        <Users size={16} style={{ color: COLORS.blue }} />
                        <select
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none cursor-pointer"
                            style={{ color: COLORS.blue }}
                            value={consultantId}
                            onChange={(e) => setConsultantId(e.target.value)}>
                            <option value="">-- Consultant --</option>
                            {consultants.map((c) => (
                                <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Mois précédent">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-black uppercase w-36 text-center" style={{ color: COLORS.blue }}>
                        {MOIS[mois - 1]} {annee}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Mois suivant">
                        <ChevronRight size={16} />
                    </button>
                </div>
                {loading && <span className="text-xs font-bold text-gray-400 animate-pulse">Chargement…</span>}
            </Card>

            {!consultantId ? (
                <Card className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Users size={40} className="mb-3 opacity-30" />
                    <p className="font-bold">Sélectionnez un consultant pour afficher sa présence.</p>
                </Card>
            ) : (
                <>
                    {renderTimeline()}

                    {/* --- Récapitulatif du mois --- */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="Jours travaillés" value={recap.joursTravailles} unit="j" />
                        <StatCard label="Absences" value={recap.nbAbsences} unit="j" accent={COLORS.red} />
                        <StatCard label="Fériés" value={recap.nbFeries} unit="j" accent={COLORS.gold} />
                        <StatCard label="Total JH mois" value={recap.totalJH} accent={COLORS.green} />
                    </div>

                    {!prevMonthOk && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-4 flex items-start gap-3">
                            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-amber-800">Mois précédent non validé</p>
                                <p className="text-xs text-amber-700">
                                    La soumission de {MOIS[mois - 1]} {annee} est bloquée tant que le mois précédent
                                    n'est pas entièrement validé. Vous pouvez toutefois enregistrer un brouillon.
                                </p>
                            </div>
                        </div>
                    )}

                    {missingDays.length > 0 && (
                        <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4 flex items-start gap-3">
                            <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-red-700">Impossible de soumettre : jours ouvrés non renseignés</p>
                                <p className="text-xs text-red-600">
                                    Chaque jour ouvré doit être couvert (présence, absence ou férié).
                                    Jours manquants : <span className="font-bold">{missingDays.join(', ')}</span>.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* ===== Colonne calendrier ===== */}
                        <Card className="lg:col-span-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                {/* Mode de saisie */}
                                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => setUiMode('PRESENCE')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${uiMode === 'PRESENCE' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                                        style={uiMode === 'PRESENCE' ? { color: COLORS.blue } : {}}>
                                        Présence
                                    </button>
                                    <button
                                        onClick={() => setUiMode('ABSENCE')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${uiMode === 'ABSENCE' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                                        style={uiMode === 'ABSENCE' ? { color: COLORS.red } : {}}>
                                        Absence
                                    </button>
                                </div>
                                {/* Remplissage rapide */}
                                {uiMode === 'PRESENCE' && (
                                    <div className="flex gap-2">
                                        <Button variant="secondary" className="!py-1.5 !px-3 !text-xs" onClick={fillWeek}>
                                            <Wand2 size={13} /> Remplir la semaine
                                        </Button>
                                        <Button variant="secondary" className="!py-1.5 !px-3 !text-xs"
                                                onClick={() => fillDays(weekdays.map((w) => w.dateStr))}>
                                            <CalendarRange size={13} /> Remplir le mois
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {renderCalendar()}

                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[10px] font-bold text-gray-500">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.blue }} /> Présence</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#dbeafe' }} /> Férié / Soumis</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.red }} /> Absence validée</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'repeating-linear-gradient(45deg,#fef3c7,#fef3c7 3px,#fde68a 3px,#fde68a 6px)' }} /> Absence en attente</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#e2e8f0' }} /> Validé</span>
                            </div>
                        </Card>

                        {/* ===== Colonne latérale ===== */}
                        <div className="space-y-5">
                            {uiMode === 'ABSENCE' ? (
                                /* --- Panneau demande d'absence --- */
                                <Card>
                                    <h3 className="text-sm font-black uppercase mb-3 flex items-center gap-2" style={{ color: COLORS.red }}>
                                        <Palmtree size={16} /> Demande d'absence
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Cliquez sur les jours libres du calendrier pour les sélectionner,
                                        puis envoyez votre demande. Elle sera soumise à validation.
                                    </p>
                                    <div className="mb-3">
                                        <label className="text-[10px] uppercase font-bold text-gray-400">Jours sélectionnés</label>
                                        {absSelection.length === 0 ? (
                                            <p className="text-xs text-gray-400 mt-1 italic">Aucun jour sélectionné.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {[...absSelection].sort().map((ds) => (
                                                    <span key={ds} className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                                        {new Date(`${ds}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-[10px] uppercase font-bold text-gray-400">Motif</label>
                                        <select
                                            className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                                            value={absMotif}
                                            onChange={(e) => setAbsMotif(e.target.value)}>
                                            {MOTIFS_ABSENCE.map((m) => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <Button variant="danger" className="w-full justify-center"
                                            disabled={!absSelection.length || saving}
                                            onClick={sendAbsenceRequest}>
                                        <Send size={14} /> Envoyer la demande
                                    </Button>
                                </Card>
                            ) : (
                                /* --- Sélecteur de BC --- */
                                <Card>
                                        <h3 className="text-sm font-black uppercase mb-3 flex items-center gap-2" style={{ color: COLORS.blue }}>
                                            <Briefcase size={16} /> Bon de commande actif
                                        </h3>
                                        {bcs.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">Aucun bon de commande affecté.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {bcs.map((bc) => {
                                                    const active = String(bc.id) === String(selectedBcId);
                                                    return (
                                                        <button key={bc.id}
                                                                onClick={() => setSelectedBcId(String(bc.id))}
                                                                className={`w-full text-left p-3 rounded-xl border transition-all ${active ? 'border-2 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                                                                style={active ? { borderColor: COLORS.green, backgroundColor: '#f0fdf4' } : {}}>
                                                            <BudgetGauge label={bc.reference} consomme={bcConso(bc)} max={bc.joursMax || 0} />
                                                            {bc.designation && (
                                                                <div className="text-[10px] text-gray-400 mt-1 truncate">{bc.designation}</div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </Card>
                            )}
                        </div>
                    </div>

                    {/* ===== Rapport d'Activité du mois (encart repliable) ===== */}
                    <Card>
                        <button
                            type="button"
                            onClick={() => setShowRa((v) => !v)}
                            className="w-full flex items-center justify-between gap-3 text-left"
                            aria-expanded={showRa}
                        >
                            <div>
                                <h3 className="text-sm font-black uppercase flex items-center gap-2" style={{ color: COLORS.blue }}>
                                    <FileText size={16} /> Rapport d'Activité du mois
                                </h3>
                                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                                    Décrivez vos réalisations du mois — les JH par BC proviennent de votre pointage validé
                                </p>
                            </div>
                            {showRa
                                ? <ChevronUp size={18} className="shrink-0 text-gray-400" />
                                : <ChevronDown size={18} className="shrink-0 text-gray-400" />}
                        </button>
                        {showRa && (
                            <div className="mt-4">
                                <RaSaisieSection consultantId={consultantId} annee={annee} mois={mois} compact />
                            </div>
                        )}
                    </Card>
                </>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-bold flex items-center gap-3 max-w-md ${
                    toast.type === 'success' ? 'bg-[#008858]' : toast.type === 'error' ? 'bg-red-600' : 'bg-[#003366]'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default TimesheetForm;
