import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { generateTimesheetPDF } from '../utils/pdfGenerator';
import {
    CalendarCheck, ChevronLeft, ChevronRight, Save,
    Users, Briefcase, Ticket, CalendarDays,
    Lock, AlertTriangle, History as HistoryIcon,
    CheckCircle2, Palmtree, Coffee, Printer, Plus, Search,
    PieChart, Activity, FileDown
} from 'lucide-react';

const TimesheetForm = ({ userRole = 'ADMIN', userId = null }) => {
    // --- ETATS ---
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    // Filtres Admin
    const [consultants, setConsultants] = useState([]);
    const [selectedConsultant, setSelectedConsultant] = useState(userRole === 'ADMIN' ? "" : userId);

    const [availableBCs, setAvailableBCs] = useState([]);

    // --- LOGIQUE MÉTIER ---
    const [monthStatus, setMonthStatus] = useState('DRAFT');
    const [isSequentialLocked, setIsSequentialLocked] = useState(false);

    // --- DONNÉES GRILLE ---
    const [selections, setSelections] = useState({});
    const [dayStatuses, setDayStatuses] = useState({});
    const [initialMonthLoad, setInitialMonthLoad] = useState({});

    // --- DONNÉES ACTIVITÉ (FORMULAIRE BAS) ---
    const [selectedBCId, setSelectedBCId] = useState("");
    const [weeksInMonth, setWeeksInMonth] = useState([]);
    const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

    // Mode de saisie grille
    const [inputMode, setInputMode] = useState('BC');

    const [taskType, setTaskType] = useState('PROJET');
    const [jiraTicket, setJiraTicket] = useState('');
    const [description, setDescription] = useState('');
    const [dailyInput, setDailyInput] = useState({ 0: '', 1: '', 2: '', 3: '', 4: '' });

    const [loadingPresence, setLoadingPresence] = useState(false);
    const [statusPresence, setStatusPresence] = useState(null);
    const [yearHistory, setYearHistory] = useState([]);

    const moisNom = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const annees = Array.from({ length: 11 }, (_, i) => 2025 + i);

    const formatDateForAPI = (year, month, day) => {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    // --- 1. CHARGEMENT LISTE CONSULTANTS (ADMIN) ---
    useEffect(() => {
        if (userRole === 'ADMIN') {
            api.get('/admin/consultants').then(res => setConsultants(res.data)).catch(console.error);
        } else {
            setSelectedConsultant(userId);
        }
    }, [userRole, userId]);

    // --- 2. CHARGEMENT DES BC ---
    const loadBCs = async (consultantIdToLoad) => {
        if (!consultantIdToLoad) return [];
        try {
            const res = await api.get('/admin/bcs');
            const targetId = parseInt(consultantIdToLoad);

            const filtered = res.data.filter(bc =>
                (bc.consultantId === targetId) ||
                (bc.consultant?.id === targetId)
            );

            setAvailableBCs(filtered);

            if (filtered.length > 0) {
                setSelectedBCId(prev => {
                    const exists = filtered.find(b => String(b.id) === String(prev));
                    return exists ? String(exists.id) : String(filtered[0].id);
                });
            } else {
                setSelectedBCId("");
            }
            return filtered;
        } catch (err) {
            console.error("Erreur chargement BC:", err);
            setAvailableBCs([]);
            return [];
        }
    };

    // --- CHARGEMENT PRINCIPAL ---
    useEffect(() => {
        setSelections({});
        setDayStatuses({});
        setInitialMonthLoad({});
        setMonthStatus('DRAFT');
        setIsSequentialLocked(false);
        setAvailableBCs([]);

        if (!selectedConsultant) return;

        const loadData = async () => {
            setLoadingPresence(true);
            try {
                await loadBCs(selectedConsultant);

                if (currentYear >= 2026 && !(currentYear === 2026 && currentMonth === 1)) {
                    let prevM = currentMonth - 1, prevY = currentYear;
                    if (prevM === 0) { prevM = 12; prevY -= 1; }
                    try {
                        const resPrev = await api.get(`/dashboard/timesheet/${selectedConsultant}?annee=${prevY}&mois=${prevM}`);
                        // Cohérence avec backend (DashboardService.isMoisPrecedentValide) :
                        // seul VALIDE débloque le mois suivant.
                        if (!resPrev.data || resPrev.data.length === 0 || resPrev.data.some(t => t.statut !== 'VALIDE')) {
                            setIsSequentialLocked(true);
                        }
                    } catch (e) { console.warn("Pas d'historique mois précédent"); }
                }

                const [resTaches, resAbs] = await Promise.all([
                    api.get(`/dashboard/timesheet/${selectedConsultant}?annee=${currentYear}&mois=${currentMonth}`),
                    api.get(`/dashboard/absences/${selectedConsultant}?annee=${currentYear}&mois=${currentMonth}`)
                ]);

                const initialMap = {};
                const statusMap = {};
                const initialLoadCounts = {};
                let hasDraft = false, hasPending = false, allValidated = true, itemCount = 0;
                let hasBC = false;

                resTaches.data.forEach(p => {
                    let dayNum;
                    if (p.date && p.date.includes('T')) dayNum = parseInt(p.date.split('T')[0].split('-')[2], 10);
                    else dayNum = new Date(p.date).getDate();

                    itemCount++;
                    if (p.statut === 'BROUILLON') hasDraft = true;
                    if (p.statut === 'EN_ATTENTE') hasPending = true;
                    if (p.statut !== 'VALIDE') allValidated = false;
                    if (p.modeSaisie === 'BC' || p.mode === 'BC') hasBC = true;

                    const bcId = p.bonDeCommande?.id || p.bcId;
                    initialMap[dayNum] = {
                        type: p.modeSaisie || 'BC', val: p.duree, bcId: bcId,
                        desc: p.descriptionTache, jira: p.ticketJira, taskType: p.typePrestation,
                        date: p.date.split('T')[0],
                        bonDeCommande: p.bonDeCommande
                    };
                    statusMap[dayNum] = p.statut;

                    if (p.modeSaisie === 'BC' || !p.modeSaisie) {
                        if (!initialLoadCounts[bcId]) initialLoadCounts[bcId] = 0;
                        initialLoadCounts[bcId] += p.duree;
                    }
                });

                resAbs.data.forEach(a => {
                    let dayNum;
                    if (a.date && a.date.includes('T')) dayNum = parseInt(a.date.split('T')[0].split('-')[2], 10);
                    else dayNum = new Date(a.date).getDate();

                    initialMap[dayNum] = { type: 'ABS', val: 1.0, desc: a.motif, date: a.date.split('T')[0] };
                    statusMap[dayNum] = a.statut;
                });

                setSelections(initialMap);
                setDayStatuses(statusMap);
                setInitialMonthLoad(initialLoadCounts);

                if (itemCount === 0) setMonthStatus('DRAFT');
                else if (hasDraft) setMonthStatus('DRAFT');
                else if (hasPending) setMonthStatus('EN_ATTENTE');
                else if (allValidated) {
                    if (hasBC) setMonthStatus('VALIDE');
                    else setMonthStatus('DRAFT');
                }
                else setMonthStatus('DRAFT');

                fetchFullYearHistory();

            } catch (err) { console.error("Erreur chargement:", err); }
            finally { setLoadingPresence(false); }
        };
        loadData();
    }, [selectedConsultant, currentMonth, currentYear]);

    const fetchFullYearHistory = async () => {
        if(!selectedConsultant) return;
        const promises = Array.from({length: 12}, (_, i) => i + 1).map(m =>
            api.get(`/dashboard/timesheet/${selectedConsultant}?annee=${currentYear}&mois=${m}`)
                .then(res => ({ month: m, data: res.data })).catch(() => ({ month: m, data: [] }))
        );
        const results = await Promise.all(promises);
        const history = [];
        results.forEach(({ month, data }) => {
            if (data && data.length > 0) {
                const isValide = data.every(t => t.statut === 'VALIDE');
                const hasBC = data.some(t => t.modeSaisie === 'BC' || t.mode === 'BC');
                if (isValide && hasBC) {
                    history.push({ month, year: currentYear, label: `${moisNom[month-1]} ${currentYear}`, status: 'VALIDE' });
                }
            }
        });
        setYearHistory(history);
    };

    // --- CALCULS ---
    const getDynamicBCStats = (bc) => {
        const dbConsumed = bc.joursConsommes || 0;
        const loadedForThisMonth = initialMonthLoad[bc.id] || 0;
        const currentOnScreen = Object.values(selections)
            .filter(sel => sel.type === 'BC' && String(sel.bcId) === String(bc.id))
            .reduce((acc, curr) => acc + (curr.val || 0), 0);
        const remaining = bc.joursMax - (dbConsumed - loadedForThisMonth + currentOnScreen);
        return { remaining: remaining < 0 ? 0 : remaining, realRemaining: remaining, isOverBudget: remaining < 0 };
    };

    const getMonthRecap = () => {
        let totalWorked = 0, totalAbs = 0, totalFerie = 0;
        const bcDetails = {};
        Object.values(selections).forEach(sel => {
            if (sel.type === 'BC') {
                totalWorked += sel.val;
                if (!bcDetails[sel.bcId]) bcDetails[sel.bcId] = 0;
                bcDetails[sel.bcId] += sel.val;
            } else if (sel.type === 'ABS' || sel.type === 'ABSENCE') totalAbs += sel.val;
            else if (sel.type === 'FERIE') totalFerie += sel.val;
        });
        return { totalWorked, totalAbs, totalFerie, bcDetails };
    };
    const recap = getMonthRecap();

    // --- GESTION SEMAINES ---
    useEffect(() => {
        const getWeeks = (year, month) => {
            const weeks = [];
            let date = new Date(year, month - 1, 1);
            const endMonth = new Date(year, month, 0);
            while (date <= endMonth) {
                const start = new Date(date);
                let end = new Date(date);
                while(end.getDay() !== 5 && end < endMonth) end.setDate(end.getDate() + 1);
                weeks.push({ start: new Date(start), end: new Date(end), label: `SEMAINE ${weeks.length + 1}` });
                date = new Date(end);
                date.setDate(date.getDate() + (date.getDay() === 5 ? 3 : 1));
            }
            return weeks;
        };
        setWeeksInMonth(getWeeks(currentYear, currentMonth));
        setSelectedWeekIndex(0);
        setDailyInput({ 0: '', 1: '', 2: '', 3: '', 4: '' });
    }, [currentYear, currentMonth]);

    const getHistoryByWeek = () => {
        const history = {};
        weeksInMonth.forEach(week => {
            history[week.label] = [];
            let currentIterDate = new Date(week.start);
            const endDate = new Date(week.end);
            while (currentIterDate <= endDate) {
                const dayNum = currentIterDate.getDate();
                const sel = selections[dayNum];
                if (sel && sel.type === 'BC') {
                    const existingTask = history[week.label].find(t => t.desc === sel.desc && t.jira === sel.jira && t.type === sel.taskType);
                    if (existingTask) { existingTask.duration += sel.val; }
                    else {
                        history[week.label].push({
                            desc: sel.desc, jira: sel.jira, type: sel.taskType, duration: sel.val, bcId: sel.bcId
                        });
                    }
                }
                currentIterDate.setDate(currentIterDate.getDate() + 1);
            }
        });
        return history;
    };
    const historyData = getHistoryByWeek();

    // --- TOGGLE GRILLE ---
    const toggleDay = (dayNum) => {
        const dateObj = new Date(currentYear, currentMonth - 1, dayNum);
        if ([0,6].includes(dateObj.getDay())) return; // Ignore WE

        if (monthStatus === 'EN_ATTENTE' || monthStatus === 'VALIDE') return;
        if (dayStatuses[dayNum] === 'VALIDE') { alert("Ce jour est déjà validé."); return; }
        if (isSequentialLocked && userRole !== 'ADMIN') { alert("Veuillez valider le mois précédent d'abord."); return; }

        setSelections(prev => {
            const current = prev[dayNum];
            if (current) {
                // Si on reclique avec le même mode, on efface
                const isSameMode =
                    (inputMode === 'BC' && current.type === 'BC' && String(current.bcId) === String(selectedBCId)) ||
                    (inputMode !== 'BC' && (current.type === inputMode || (inputMode === 'ABSENCE' && current.type === 'ABS')));
                if (isSameMode) { const n = {...prev}; delete n[dayNum]; return n; }
            }

            const dateStr = formatDateForAPI(currentYear, currentMonth, dayNum);

            // Cas Travaillé (BC)
            if (inputMode === 'BC') {
                let targetBCId = selectedBCId;
                // Si pas de BC sélectionné, on tente de prendre le premier dispo
                if (!targetBCId && availableBCs.length > 0) {
                    targetBCId = String(availableBCs[0].id);
                    setSelectedBCId(targetBCId);
                }

                if (!targetBCId) { alert("Veuillez sélectionner un BC dans la liste en bas."); return prev; }

                const targetBC = availableBCs.find(b => String(b.id) === String(targetBCId));
                if (targetBC) {
                    const stats = getDynamicBCStats(targetBC);
                    if (stats.realRemaining <= 0) { alert(`Budget épuisé pour ce BC.`); return prev; }
                    // Si reste < 1 jour, on met 0.5 par défaut
                    if (stats.realRemaining < 1.0) {
                        return { ...prev, [dayNum]: { type: 'BC', val: 0.5, bcId: parseInt(targetBCId), desc: "Saisie Rapide", jira: "", taskType: "PROJET", date: dateStr }};
                    }
                }
                return { ...prev, [dayNum]: { type: 'BC', val: 1.0, bcId: parseInt(targetBCId), desc: "Saisie Rapide", jira: "", taskType: "PROJET", date: dateStr }};
            }
            // Cas Absence
            else if (inputMode === 'ABSENCE') {
                return { ...prev, [dayNum]: { type: 'ABS', val: 1.0, desc: 'Congé', date: dateStr } };
            }
            // Cas Férié
            else if (inputMode === 'FERIE') {
                return { ...prev, [dayNum]: { type: 'FERIE', val: 1.0, desc: 'Férié', date: dateStr } };
            }
            return prev;
        });
    };

    // --- AJOUT VIA FORMULAIRE BAS ---
    const handleAddActivity = () => {
        if (!selectedBCId) return alert("Sélectionnez un BC.");
        if (isSequentialLocked && userRole !== 'ADMIN') return alert("Mois précédent non validé.");

        const week = weeksInMonth[selectedWeekIndex];
        const newSelections = { ...selections };
        let hasChanges = false;
        let currentIterDate = new Date(week.start);
        const endDate = new Date(week.end);
        let inputIndex = 0;

        const targetBC = availableBCs.find(b => String(b.id) === String(selectedBCId));
        const stats = targetBC ? getDynamicBCStats(targetBC) : { realRemaining: 0 };
        let budgetBuffer = stats.realRemaining;

        while (currentIterDate <= endDate) {
            const dayNum = currentIterDate.getDate();
            const dayOfWeek = currentIterDate.getDay();

            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                const val = parseFloat(dailyInput[inputIndex]);
                if (val > 0 && val <= 1) {
                    if (dayStatuses[dayNum] === 'VALIDE') {
                        alert(`Le jour ${dayNum} est déjà validé.`);
                    } else {
                        if (budgetBuffer - val < 0) {
                            alert(`Budget insuffisant le ${dayNum}.`);
                        } else {
                            newSelections[dayNum] = {
                                type: 'BC', val: val, bcId: parseInt(selectedBCId),
                                description, jira: jiraTicket, taskType: taskType,
                                date: formatDateForAPI(currentYear, currentMonth, dayNum)
                            };
                            hasChanges = true;
                            budgetBuffer -= val;
                        }
                    }
                }
                inputIndex++;
            }
            currentIterDate.setDate(currentIterDate.getDate() + 1);
        }

        if (hasChanges) {
            setSelections(newSelections);
            setDailyInput({ 0: '', 1: '', 2: '', 3: '', 4: '' });
            alert("Activités ajoutées au calendrier !");
        }
    };

    // --- SAUVEGARDE ---
    const saveData = async (targetStatus) => {
        if (!selectedConsultant) return alert("Sélectionnez un consultant.");

        if (targetStatus === 'SUBMITTED') {
            const daysInM = new Date(currentYear, currentMonth, 0).getDate();
            const missing = [];
            for(let d=1; d<=daysInM; d++) {
                const checkDate = new Date(currentYear, currentMonth-1, d);
                // Vérifier jours ouvrés sans saisie
                if(checkDate.getDay() !== 0 && checkDate.getDay() !== 6 && !selections[d]) {
                    missing.push(d);
                }
            }
            if (missing.length > 0) return alert(`Jours manquants (ni travaillés ni absents) : ${missing.join(', ')}`);
        }

        setLoadingPresence(true);
        try {
            const payload = Object.values(selections).map(s => ({
                consultantId: parseInt(selectedConsultant),
                bcId: s.type==='BC' ? s.bcId : null,
                date: s.date,
                duree: s.val,
                mode: s.type,
                statut: targetStatus === 'SUBMITTED' ? 'EN_ATTENTE' : 'BROUILLON',
                descriptionTache: s.desc || "Saisie",
                typePrestation: s.taskType || "PROJET",
                ticketJira: s.jira || ""
            }));

            if (!payload.length && !confirm("Le calendrier est vide. Continuer ?")) {
                setLoadingPresence(false); return;
            }

            await api.post('/dashboard/timesheet/bulk', payload);
            setStatusPresence({ type: 'success', message: targetStatus==='SUBMITTED'?"Envoyé !":"Sauvegardé." });
            // Le useEffect rechargera les données si besoin au prochain render

        } catch(e) { console.error(e); setStatusPresence({ type: 'error', message: "Erreur technique." }); }
        finally { setLoadingPresence(false); setTimeout(() => setStatusPresence(null), 3000); }
    };

    // --- PDF ---
    const handleDownloadPDF = async (histYear, histMonth) => {
        const y = (typeof histYear === 'number') ? histYear : currentYear;
        const m = (typeof histMonth === 'number') ? histMonth : currentMonth;
        let acts = [];
        try {
            const [resT, resA] = await Promise.all([
                api.get(`/dashboard/timesheet/${selectedConsultant}?annee=${y}&mois=${m}`),
                api.get(`/dashboard/absences/${selectedConsultant}?annee=${y}&mois=${m}`)
            ]);

            acts = [
                ...resT.data.map(t => ({
                    date: t.date, val: t.duree, type: 'BC',
                    typePrestation: t.typePrestation||'PROJET',
                    descriptionTache: t.descriptionTache,
                    bonDeCommande: t.bonDeCommande || { reference: 'N/A' },
                    bcId: t.bonDeCommande?.id || t.bcId,
                    type: 'BC', statut: t.statut
                })),
                ...resA.data.map(a => ({
                    date: a.date, val: 1.0, type: 'ABS',
                    descriptionTache: a.motif, bonDeCommande: { reference: '-' },
                    type: 'ABSENCE', statut: a.statut
                }))
            ].sort((a,b) => new Date(a.date)-new Date(b.date));

            const bcStatsMap = {};
            acts.forEach(a => {
                if(a.type === 'BC' && a.bonDeCommande) {
                    const ref = a.bonDeCommande.reference;
                    // On essaie de retrouver les infos complètes du BC si on les a en local
                    let budget = "N/A";
                    const knownBC = availableBCs.find(b => b.id === a.bcId);
                    if(knownBC) budget = knownBC.joursMax;

                    if(!bcStatsMap[ref]) bcStatsMap[ref] = { reference: ref, budgetInitial: budget, soldeDebut: "N/A", consoMois: 0, reliquatFin: "N/A" };
                    bcStatsMap[ref].consoMois += a.val;
                }
            });
            const bcSummary = Object.values(bcStatsMap);

            const consultantInfo = consultants.find(c => c.id === parseInt(selectedConsultant)) || { nom: "Consultant", prenom: "" };

            generateTimesheetPDF({
                consultantName: `${consultantInfo.nom} ${consultantInfo.prenom}`,
                cabinetName: consultantInfo.cabinet?.nom || "ESN",
                monthLabel: `${moisNom[m-1]} ${y}`,
                bcSummary: bcSummary,
                activities: acts,
                year: y,
                month: m
            });

        } catch(e) { console.error(e); alert("Erreur PDF"); }
    };

    const getStatusBadge = (s) => {
        if(s === 'DRAFT') return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black uppercase">Brouillon</span>;
        if(s === 'EN_ATTENTE') return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black uppercase">En Validation</span>;
        if(s === 'VALIDE') return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1"><CheckCircle2 size={12}/> Validé</span>;
        return null;
    };

    const renderDailyInputs = () => {
        if (!weeksInMonth[selectedWeekIndex]) return null;
        const inputs = [];
        let date = new Date(weeksInMonth[selectedWeekIndex].start);
        const endDate = new Date(weeksInMonth[selectedWeekIndex].end);
        let idx = 0;
        while (date <= endDate) {
            const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
            const dayNum = date.getDate();
            const currentIdx = idx;
            inputs.push(
                <div key={dayNum} className="flex-1 min-w-[60px]">
                    <div className="text-[10px] text-center font-bold text-gray-400 uppercase mb-1">{dayName} {dayNum}</div>
                    <input
                        type="number" step="0.5" min="0" max="1"
                        className="w-full h-10 text-center font-bold border border-gray-200 rounded-lg focus:border-[#003366] outline-none text-[#003366]"
                        placeholder="-"
                        value={dailyInput[currentIdx] || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= 1)) {
                                setDailyInput(prev => ({ ...prev, [currentIdx]: val }));
                            }
                        }}
                    />
                </div>
            );
            date.setDate(date.getDate() + 1);
            if (date.getDay() !== 0 && date.getDay() !== 6) idx++;
        }
        return inputs;
    };

    return (
        <div className="mx-auto max-w-6xl p-4 space-y-6 font-sans text-slate-800">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-[#003366] p-2 rounded-lg"><CalendarCheck className="text-white" size={24}/></div>
                    <div>
                        <h2 className="text-lg font-black text-[#003366] uppercase">Gestion des Temps</h2>
                        {userRole !== 'ADMIN' && <div className="text-xs text-gray-500 font-bold">{moisNom[currentMonth-1]} {currentYear} • Consultant</div>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                    {userRole === 'ADMIN' && (
                        <div className="flex items-center gap-2 bg-blue-50 p-1.5 rounded-lg border border-blue-100">
                            <Users size={16} className="text-[#003366] ml-2"/>
                            <select className="bg-transparent text-sm font-bold text-[#003366] outline-none cursor-pointer p-1 min-w-[150px]" value={selectedConsultant} onChange={e => setSelectedConsultant(e.target.value)}>
                                <option value="">-- Consultant --</option>
                                {consultants.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
                            </select>
                        </div>
                    )}
                    <select className="bg-gray-50 border border-gray-200 text-[#003366] font-bold p-2.5 rounded-lg outline-none cursor-pointer text-sm" value={currentYear} onChange={e => setCurrentYear(parseInt(e.target.value))}>
                        {annees.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden md:block"></div>
                    <button onClick={() => handleDownloadPDF(currentYear, currentMonth)} disabled={!(monthStatus === 'VALIDE' || (userRole === 'ADMIN' && monthStatus === 'EN_ATTENTE'))} className={`px-4 py-2 border font-bold text-xs rounded-lg flex items-center gap-2 ${monthStatus === 'VALIDE' || (userRole === 'ADMIN' && monthStatus === 'EN_ATTENTE') ? 'bg-[#C5A059] text-white border-[#C5A059] hover:bg-[#b08d4d]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}><FileDown size={14}/> PDF</button>
                    <button onClick={() => saveData('DRAFT')} disabled={!selectedConsultant || monthStatus === 'VALIDE'} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"><Save size={14}/> SAUVEGARDER</button>
                    <button onClick={() => { if(confirm("Envoyer le mois ?")) saveData('SUBMITTED'); }} disabled={!selectedConsultant || monthStatus === 'VALIDE'} className="px-4 py-2 bg-[#2D6A4F] text-white font-bold text-xs rounded-lg hover:bg-[#1b4332] flex items-center gap-2 shadow-sm disabled:opacity-50"><CheckCircle2 size={14}/> ENVOYER</button>
                </div>
            </div>

            {isSequentialLocked && userRole !== 'ADMIN' && <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg flex"><AlertTriangle className="h-5 w-5 text-red-500" /><div className="ml-3"><p className="text-sm text-red-700 font-bold">Mois précédent non envoyé</p><p className="text-xs text-red-600">Veuillez envoyer/valider le mois précédent.</p></div></div>}

            {!selectedConsultant ? <div className="flex flex-col items-center justify-center p-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400"><Search size={48} className="mb-4 opacity-20" /><p className="font-bold text-lg">Sélectionnez un consultant</p></div> : (
                <>
                    {/* RÉCAPITULATIF DU MOIS */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-gray-50 p-3 rounded-full border border-gray-100"><Activity size={24} className="text-[#C5A059]"/></div>
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut du mois</div>
                                <div className="mt-1">{getStatusBadge(monthStatus)}</div>
                            </div>
                        </div>
                        <div className="flex-1 w-full md:w-auto grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                <div className="text-[9px] font-bold text-blue-400 uppercase">Total Travaillé</div>
                                <div className="text-xl font-black text-[#003366]">{recap.totalWorked} <span className="text-[10px]">JH</span></div>
                            </div>
                            <div className="bg-red-50/50 p-3 rounded-xl border border-red-100">
                                <div className="text-[9px] font-bold text-red-400 uppercase">Absences</div>
                                <div className="text-xl font-black text-red-600">{recap.totalAbs} <span className="text-[10px]">JH</span></div>
                            </div>
                            <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                                <div className="text-[9px] font-bold text-green-600 uppercase">Fériés</div>
                                <div className="text-xl font-black text-green-700">{recap.totalFerie} <span className="text-[10px]">JH</span></div>
                            </div>
                            {Object.keys(recap.bcDetails).length > 0 && (
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 overflow-y-auto max-h-[60px]">
                                    <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Détail BC</div>
                                    {availableBCs.filter(bc => recap.bcDetails[bc.id]).map(bc => (
                                        <div key={bc.id} className="text-[10px] font-bold text-gray-600 flex justify-between">
                                            <span className="truncate w-16">{bc.reference}</span>
                                            <span>{recap.bcDetails[bc.id]}j</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* GRILLE APERÇU MOIS (Lecture Seule / Suppression simple) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex justify-between mb-4 items-center flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setCurrentMonth(m => m > 1 ? m-1 : 12)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16}/></button>
                                <h3 className="text-sm font-black text-[#003366] uppercase w-24 text-center">{moisNom[currentMonth-1]}</h3>
                                <button onClick={() => setCurrentMonth(m => m < 12 ? m+1 : 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={16}/></button>
                            </div>

                            <div className="flex gap-4 items-center">
                                {/* ✅ AJOUT DU SÉLECTEUR DE BC POUR LA GRILLE */}
                                {inputMode === 'BC' && (
                                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 animate-in fade-in zoom-in">
                                        <span className="text-[10px] font-bold text-[#003366] uppercase">BC Actif:</span>
                                        <select className="bg-transparent text-xs font-bold text-[#003366] outline-none cursor-pointer min-w-[100px]" value={selectedBCId} onChange={e => setSelectedBCId(e.target.value)}>
                                            {availableBCs.length === 0 && <option value="">Aucun BC</option>}
                                            {availableBCs.map(bc => <option key={bc.id} value={bc.id}>{bc.reference}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button onClick={() => setInputMode('BC')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${inputMode === 'BC' ? 'bg-[#003366] text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200'}`}>Travaillé</button>
                                    <button onClick={() => setInputMode('ABSENCE')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${inputMode === 'ABSENCE' ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200'}`}>Absence</button>
                                    <button onClick={() => setInputMode('FERIE')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${inputMode === 'FERIE' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200'}`}>Férié</button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">{[...Array(new Date(currentYear, currentMonth - 1, 1).getDay() === 0 ? 6 : new Date(currentYear, currentMonth - 1, 1).getDay() - 1)].map((_, i) => <div key={`e-${i}`} className="h-12 bg-gray-50 rounded-md"></div>)}{[...Array(new Date(currentYear, currentMonth, 0).getDate())].map((_, i) => { const day = i + 1; const sel = selections[day]; const isWk = [0,6].includes(new Date(currentYear, currentMonth-1, day).getDay()); let bgColor = isWk ? 'bg-gray-50' : 'bg-white'; let textColor = 'text-gray-300'; if (sel) { if (sel.type === 'BC') { bgColor = 'bg-[#003366]'; textColor = 'text-white'; } else if (sel.type === 'ABS' || sel.type === 'ABSENCE') { bgColor = 'bg-red-500'; textColor = 'text-white'; } else if (sel.type === 'FERIE') { bgColor = 'bg-green-600'; textColor = 'text-white'; } } const isLocked = monthStatus === 'VALIDE' || dayStatuses[day] === 'VALIDE' || (isSequentialLocked && userRole !== 'ADMIN'); return (<div key={day} className={`h-12 rounded-md border border-gray-100 flex flex-col items-center justify-center ${bgColor} relative ${!isLocked && !isWk ? 'cursor-pointer hover:border-[#003366]' : 'cursor-not-allowed opacity-80'}`} onClick={() => !isLocked && toggleDay(day)}><span className={`text-xs font-black ${textColor}`}>{day}</span>{sel && <span className={`text-[9px] font-bold ${textColor}`}>{sel.val} j</span>}{isLocked && <Lock size={10} className="absolute top-1 right-1 opacity-50 text-gray-400"/>}</div>) })}</div>
                    </div>

                    {/* FORMULAIRE BAS */}
                    <div className="bg-[#f8fafc] rounded-2xl border border-gray-200 p-6 shadow-inner">
                        <h3 className="text-sm font-black text-[#003366] uppercase mb-6 flex items-center gap-2"><Briefcase size={18} className="text-[#C5A059]"/> Saisie Hebdomadaire</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-4 space-y-4"><div><label className="text-[10px] font-bold text-gray-500 uppercase">Semaine</label><div className="flex overflow-x-auto gap-2 pb-2 mt-1 scrollbar-hide">{weeksInMonth.map((w, i) => (<button key={i} onClick={() => { setSelectedWeekIndex(i); setDailyInput({0:'',1:'',2:'',3:'',4:''}); }} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${selectedWeekIndex === i ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-gray-500 border-gray-200'}`}>{w.label}</button>))}</div></div><div><label className="text-[10px] font-bold text-gray-500 uppercase">Bon de Commande</label><select className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#003366]" value={selectedBCId} onChange={e => setSelectedBCId(e.target.value)}>{availableBCs.map(bc => <option key={bc.id} value={bc.id}>{bc.reference} (Reste: {getDynamicBCStats(bc).remaining}j)</option>)}</select></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-gray-500 uppercase">Type</label><select className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold" value={taskType} onChange={e => setTaskType(e.target.value)}><option value="PROJET">PROJET</option><option value="RUN">RUN</option><option value="AUTRE">AUTRE</option></select></div><div><label className="text-[10px] font-bold text-gray-500 uppercase">Jira</label><input className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold" value={jiraTicket} onChange={e => setJiraTicket(e.target.value)} /></div></div></div>
                            <div className="lg:col-span-8 space-y-4"><div><label className="text-[10px] font-bold text-gray-500 uppercase">Description</label><input className="w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:border-[#C5A059] outline-none" value={description} onChange={e => setDescription(e.target.value)} /></div><div className="bg-white p-4 rounded-xl border border-gray-200"><label className="text-[10px] font-bold text-gray-500 uppercase mb-3 block">Répartition</label><div className="flex gap-2 overflow-x-auto">{renderDailyInputs()}</div></div><div className="flex justify-end pt-2"><button onClick={handleAddActivity} className="bg-[#003366] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-[#002244]"><Plus size={16}/> Ajouter</button></div></div>
                        </div>
                    </div>

                    {yearHistory.length > 0 && <div className="mt-8 mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200"><h3 className="text-sm font-black text-[#003366] uppercase mb-4 flex items-center gap-2"><CheckCircle2 size={18}/> Historique Validé</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{yearHistory.map((h, idx) => (<div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center"><div><div className="text-xs font-bold text-gray-500 uppercase">{h.label}</div><div className="text-[#2D6A4F] text-xs font-black uppercase mt-1">Validé</div></div><button onClick={() => handleDownloadPDF(h.year, h.month)} className="px-3 py-2 bg-[#C5A059] text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#b08d4d]"><FileDown size={14}/> PDF</button></div>))}</div></div>}

                    <div className="mt-8"><h3 className="text-sm font-black text-[#003366] uppercase mb-4 flex items-center gap-2"><HistoryIcon size={18}/> Détail Saisies</h3>{Object.keys(historyData).length > 0 && <div className="space-y-6">{Object.entries(historyData).map(([week, tasks]) => tasks.length > 0 && (<div key={week} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"><div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between"><span className="text-xs font-black text-[#003366] uppercase">{week}</span><span className="text-[10px] font-bold text-gray-500">Total: {tasks.reduce((acc, t) => acc + t.duration, 0)} JH</span></div><table className="w-full text-left text-xs"><tbody className="divide-y divide-gray-50">{tasks.map((t, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="p-3 font-medium text-gray-700">{t.desc}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black text-white ${t.type === 'PROJET' ? 'bg-[#003366]' : 'bg-[#C5A059]'}`}>{t.type}</span></td><td className="p-3 font-mono text-gray-500">{t.jira || '-'}</td><td className="p-3 font-black text-[#003366] text-right">{t.duration} j</td></tr>))}</tbody></table></div>))}</div>}</div>
                </>
            )}
            {statusPresence && <div className={`fixed bottom-5 right-5 px-6 py-4 rounded-xl shadow-2xl text-white font-bold text-sm flex items-center gap-3 animate-slide-up z-50 ${statusPresence.type === 'success' ? 'bg-[#2D6A4F]' : 'bg-red-500'}`}>{statusPresence.type === 'success' ? <CheckCircle2/> : <AlertTriangle/>}{statusPresence.message}</div>}
        </div>
    );
};



export default TimesheetForm;