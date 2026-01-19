import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { generateTimesheetPDF } from '../utils/pdfGenerator';
import {
    CalendarCheck, ChevronLeft, ChevronRight, Save,
    UserCheck, Briefcase, Ticket, CalendarDays,
    Lock, AlertTriangle, History as HistoryIcon,
    CheckCircle2, Palmtree, Coffee, Printer, Plus, Users, Search,
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
    const [previousMonthValidated, setPreviousMonthValidated] = useState(true);

    // --- DONNÉES GRILLE ---
    const [selections, setSelections] = useState({});
    const [dayStatuses, setDayStatuses] = useState({});
    const [initialMonthLoad, setInitialMonthLoad] = useState({});

    // --- DONNÉES ACTIVITÉ (FORMULAIRE BAS) ---
    const [selectedBCId, setSelectedBCId] = useState("");
    const [weeksInMonth, setWeeksInMonth] = useState([]);
    const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

    const [taskType, setTaskType] = useState('PROJET');
    const [jiraTicket, setJiraTicket] = useState('');
    const [description, setDescription] = useState('');
    const [dailyInput, setDailyInput] = useState({ 0: '', 1: '', 2: '', 3: '', 4: '' });

    const [loadingPresence, setLoadingPresence] = useState(false);
    const [statusPresence, setStatusPresence] = useState(null);

    const moisNom = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const annees = Array.from({ length: 11 }, (_, i) => 2025 + i);
    const bcColors = ['#003366', '#C5A059', '#2D6A4F', '#7c3aed', '#db2777'];

    // --- CHARGEMENT INITIAL ---
    useEffect(() => {
        if (userRole === 'ADMIN') {
            api.get('/admin/consultants').then(res => setConsultants(res.data)).catch(console.error);
        } else { setSelectedConsultant(userId); }
    }, [userRole, userId]);

    useEffect(() => {
        if (!selectedConsultant) { setAvailableBCs([]); return; }
        loadBCs();
    }, [selectedConsultant]);

    const loadBCs = () => {
        api.get('/admin/bcs').then(res => {
            const filtered = res.data.filter(bc => (bc.consultantId === parseInt(selectedConsultant)) || (bc.consultant?.id === parseInt(selectedConsultant)));
            setAvailableBCs(filtered);
            if(filtered.length > 0) setSelectedBCId(String(filtered[0].id));
        });
    };

    // --- CALCULS STATS ---
    const getDynamicBCStats = (bc) => {
        const dbConsumed = bc.joursConsommes || 0;
        const loadedForThisMonth = initialMonthLoad[bc.id] || 0;
        const currentOnScreen = Object.values(selections)
            .filter(sel => sel.type === 'BC' && sel.bcId === bc.id)
            .reduce((acc, curr) => acc + (curr.val || 0), 0);
        const delta = currentOnScreen - loadedForThisMonth;
        const remaining = (bc.joursMax - dbConsumed) - delta;
        return { remaining: remaining < 0 ? 0 : remaining, realRemaining: remaining, isOverBudget: remaining < 0 };
    };

    const getMonthRecap = () => {
        let totalWorked = 0;
        let totalAbs = 0;
        let totalFerie = 0;
        const bcDetails = {};

        Object.values(selections).forEach(sel => {
            if (sel.type === 'BC') {
                totalWorked += sel.val;
                if (!bcDetails[sel.bcId]) bcDetails[sel.bcId] = 0;
                bcDetails[sel.bcId] += sel.val;
            } else if (sel.type === 'ABS' || sel.type === 'ABSENCE') {
                totalAbs += sel.val;
            } else if (sel.type === 'FERIE') {
                totalFerie += sel.val;
            }
        });

        return { totalWorked, totalAbs, totalFerie, bcDetails };
    };

    const recap = getMonthRecap();

    // --- CHARGEMENT DONNÉES DU MOIS ---
    useEffect(() => {
        setSelections({});
        setDayStatuses({});
        setInitialMonthLoad({});
        setMonthStatus('DRAFT');

        if (!selectedConsultant) return;
        setLoadingPresence(true);

        const loadData = async () => {
            try {
                await loadBCs();
                const [resTaches, resAbs] = await Promise.all([
                    api.get(`/dashboard/timesheet/${selectedConsultant}?annee=${currentYear}&mois=${currentMonth}`),
                    api.get(`/dashboard/absences/${selectedConsultant}?annee=${currentYear}&mois=${currentMonth}`)
                ]);

                const initialMap = {};
                const statusMap = {};
                const initialLoadCounts = {};

                let hasDraft = false;
                let hasPending = false;
                let allValidated = true;
                let itemCount = 0;
                let hasBC = false; // Pour vérifier si on a de vraies tâches BC

                resTaches.data.forEach(p => {
                    const day = new Date(p.date).getDate();
                    itemCount++;

                    if (p.statut === 'BROUILLON') hasDraft = true;
                    if (p.statut === 'EN_ATTENTE') hasPending = true;
                    if (p.statut !== 'VALIDE') allValidated = false;

                    // Vérifier si c'est une tâche de type BC (Travail)
                    if (p.modeSaisie === 'BC' || p.mode === 'BC') hasBC = true;

                    const bcId = p.bonDeCommande?.id || p.bcId;
                    initialMap[day] = {
                        type: p.modeSaisie || 'BC',
                        val: p.duree,
                        bcId: bcId,
                        desc: p.descriptionTache,
                        jira: p.ticketJira,
                        taskType: p.typePrestation,
                        date: p.date
                    };
                    statusMap[day] = p.statut;

                    if (p.modeSaisie === 'BC' || !p.modeSaisie) {
                        if (!initialLoadCounts[bcId]) initialLoadCounts[bcId] = 0;
                        initialLoadCounts[bcId] += p.duree;
                    }
                });

                resAbs.data.forEach(a => {
                    const day = new Date(a.date).getDate();
                    initialMap[day] = { type: 'ABS', val: 1.0, desc: a.motif, date: a.date };
                    statusMap[day] = a.statut;
                });

                setSelections(initialMap);
                setDayStatuses(statusMap);
                setInitialMonthLoad(initialLoadCounts);

                // --- CORRECTION LOGIQUE STATUT ---
                if (itemCount === 0) setMonthStatus('DRAFT');
                else if (hasDraft) setMonthStatus('DRAFT');
                else if (hasPending) setMonthStatus('EN_ATTENTE');
                else if (allValidated) {
                    // Si tout est validé, on ne verrouille QUE s'il y a des BC (travail) validés.
                    // Si on a que des absences validées, on reste en DRAFT pour permettre la saisie.
                    if (hasBC) setMonthStatus('VALIDE');
                    else setMonthStatus('DRAFT');
                }
                else setMonthStatus('DRAFT');

            } catch (err) { console.error(err); }
            finally { setLoadingPresence(false); }
        };
        loadData();
    }, [selectedConsultant, currentMonth, currentYear]);

    // --- GESTION DES SEMAINES ---
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

    // --- AJOUTER ACTIVITÉ ---
    const handleAddActivity = () => {
        if (!selectedBCId) return alert("Sélectionnez un BC.");
        if (!description) return alert("Description obligatoire.");

        const week = weeksInMonth[selectedWeekIndex];
        const newSelections = { ...selections };
        let hasChanges = false;

        let currentIterDate = new Date(week.start);
        const endDate = new Date(week.end);
        let inputIndex = 0;

        while (currentIterDate <= endDate) {
            const dayNum = currentIterDate.getDate();
            const val = parseFloat(dailyInput[inputIndex]);

            if (val > 0 && val <= 1) {
                // Bloquer uniquement si le jour est DÉJÀ validé (ex: Absence validée)
                if (dayStatuses[dayNum] === 'VALIDE') {
                    alert(`Le jour ${dayNum} est déjà validé (Absence/Férié) et ne peut être modifié.`);
                } else {
                    newSelections[dayNum] = {
                        type: 'BC',
                        val: val,
                        bcId: parseInt(selectedBCId),
                        desc: description,
                        jira: jiraTicket,
                        taskType: taskType,
                        date: new Date(currentYear, currentMonth - 1, dayNum).toISOString().split('T')[0]
                    };
                    hasChanges = true;
                }
            }
            currentIterDate.setDate(currentIterDate.getDate() + 1);
            if (currentIterDate.getDay() !== 0 && currentIterDate.getDay() !== 6) {
                inputIndex++;
            }
        }

        if (hasChanges) {
            setSelections(newSelections);
            setDailyInput({ 0: '', 1: '', 2: '', 3: '', 4: '' });
            alert("Activité ajoutée au calendrier ! N'oubliez pas d'ENREGISTRER.");
        }
    };

    // --- SAUVEGARDE ---
    const saveData = async (targetStatus) => {
        if (!selectedConsultant) return alert("Sélectionnez un consultant.");
        setLoadingPresence(true);
        try {
            const payload = Object.entries(selections).map(([day, data]) => {
                const dayStr = String(day).padStart(2, '0');
                const monthStr = String(currentMonth).padStart(2, '0');
                const dateIso = `${currentYear}-${monthStr}-${dayStr}`;

                return {
                    consultantId: parseInt(selectedConsultant),
                    bcId: data.type === 'BC' ? data.bcId : null,
                    date: dateIso,
                    duree: data.val,
                    mode: data.type,
                    statut: targetStatus === 'SUBMITTED' ? 'EN_ATTENTE' : 'BROUILLON',
                    descriptionTache: data.desc || "Saisie Calendrier",
                    typePrestation: data.taskType || "PROJET",
                    ticketJira: data.jira || ""
                };
            });

            if (payload.length === 0 && !confirm("Calendrier vide. Continuer ?")) {
                setLoadingPresence(false); return;
            }

            await api.post('/dashboard/timesheet/bulk', payload);
            setStatusPresence({ type: 'success', message: "Sauvegarde effectuée !" });
            if(targetStatus === 'SUBMITTED') setMonthStatus('EN_ATTENTE');

        } catch (err) {
            console.error(err);
            setStatusPresence({ type: 'error', message: "Erreur technique." });
        } finally {
            setLoadingPresence(false);
            setTimeout(() => setStatusPresence(null), 3000);
        }
    };

    // --- PDF ---
    const handleDownloadPDF = () => {
        let consultantInfo = { nom: "Consultant", prenom: "" };
        if (userRole === "ADMIN") {
            const c = consultants.find(c => c.id === parseInt(selectedConsultant));
            if (c) consultantInfo = c;
        } else {
            consultantInfo = { nom: "Utilisateur", prenom: "Connecté" };
        }

        const bcSummary = availableBCs
            .filter(bc => recap.bcDetails[bc.id])
            .map(bc => {
                const consoMois = recap.bcDetails[bc.id] || 0;
                const totalConsommeBDD = bc.joursConsommes || 0;
                const reliquatFin = (bc.joursMax || 0) - totalConsommeBDD;
                const soldeDebut = reliquatFin + consoMois;
                return {
                    reference: bc.reference,
                    budgetInitial: bc.joursMax,
                    soldeDebut: soldeDebut.toFixed(1),
                    consoMois: consoMois.toFixed(1),
                    reliquatFin: reliquatFin.toFixed(1)
                };
            });

        const activitiesList = Object.entries(selections)
            .map(([day, sel]) => {
                const dayNum = parseInt(day, 10);
                return {
                    date: sel.date || new Date(currentYear, currentMonth - 1, dayNum).toISOString().split("T")[0],
                    type: sel.type,
                    val: sel.val,
                    desc: sel.desc,
                    jira: sel.jira
                };
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        generateTimesheetPDF({
            consultantName: `${consultantInfo.nom} ${consultantInfo.prenom}`,
            cabinetName: consultantInfo.cabinet?.nom || "ESN",
            monthLabel: `${moisNom[currentMonth - 1]} ${currentYear}`,
            bcSummary: bcSummary,
            activities: activitiesList,
            year: currentYear,
            month: currentMonth
        });
    };

    // --- HISTORIQUE ---
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

    // --- RENDU ---
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

    const getStatusBadge = (status) => {
        switch(status) {
            case 'DRAFT': return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm">Brouillon</span>;
            case 'EN_ATTENTE': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm">En Validation</span>;
            case 'VALIDE': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm flex items-center gap-1"><CheckCircle2 size={12}/> Validé</span>;
            case 'REJETE': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm">Rejeté</span>;
            default: return null;
        }
    };

    const toggleDay = (dayNum) => {
        if (monthStatus === 'EN_ATTENTE' || monthStatus === 'VALIDE') return;
        if (dayStatuses[dayNum] === 'VALIDE') { alert("Ce jour est déjà validé."); return; }

        setSelections(prev => {
            const current = prev[dayNum];
            // Simple suppression au clic (Pour la saisie, on utilise le formulaire bas)
            if(current) {
                const n = {...prev}; delete n[dayNum]; return n;
            }
            return prev;
        });
    };

    return (
        <div className="mx-auto max-w-6xl p-4 space-y-6 font-sans text-slate-800">
            {/* Header, Recap et Grille restent identiques... */}
            {/* EN-TÊTE PRINCIPAL */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-[#003366] p-2 rounded-lg"><CalendarCheck className="text-white" size={24}/></div>
                    <div>
                        <h2 className="text-lg font-black text-[#003366] uppercase">Gestion des Temps</h2>
                        {userRole !== 'ADMIN' && (
                            <div className="text-xs text-gray-500 font-bold">{moisNom[currentMonth-1]} {currentYear} • Consultant</div>
                        )}
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
                    <button onClick={handleDownloadPDF} disabled={monthStatus !== 'VALIDE'} className={`px-4 py-2 border font-bold text-xs rounded-lg flex items-center gap-2 transition-all ${monthStatus === 'VALIDE' ? 'bg-[#C5A059] text-white border-[#C5A059] hover:bg-[#b08d4d] shadow-sm' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}><FileDown size={14}/> PDF</button>
                    <button onClick={() => saveData('DRAFT')} disabled={!selectedConsultant || monthStatus === 'VALIDE'} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"><Save size={14}/> SAUVEGARDER</button>
                    <button onClick={() => { if(confirm("Envoyer le mois ?")) saveData('SUBMITTED'); }} disabled={!selectedConsultant || monthStatus === 'VALIDE'} className="px-4 py-2 bg-[#2D6A4F] text-white font-bold text-xs rounded-lg hover:bg-[#1b4332] flex items-center gap-2 shadow-sm disabled:opacity-50"><CheckCircle2 size={14}/> ENVOYER</button>
                </div>
            </div>

            {/* CONTENU SI CONSULTANT SÉLECTIONNÉ */}
            {!selectedConsultant ? (
                <div className="flex flex-col items-center justify-center p-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-lg">Veuillez sélectionner un consultant</p>
                </div>
            ) : (
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
                        <div className="flex justify-between mb-4 items-center">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setCurrentMonth(m => m > 1 ? m-1 : 12)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16}/></button>
                                <h3 className="text-sm font-black text-[#003366] uppercase w-24 text-center">{moisNom[currentMonth-1]}</h3>
                                <button onClick={() => setCurrentMonth(m => m < 12 ? m+1 : 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={16}/></button>
                            </div>
                            <div className="flex gap-4 text-[10px] font-bold uppercase">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#003366] rounded-sm"></div> Travaillé</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Absence</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-600 rounded-sm"></div> Férié</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                            {['LUN','MAR','MER','JEU','VEN','SAM','DIM'].map(d => <div key={d} className="text-[10px] font-bold text-gray-400">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {[...Array(new Date(currentYear, currentMonth - 1, 1).getDay() === 0 ? 6 : new Date(currentYear, currentMonth - 1, 1).getDay() - 1)].map((_, i) => <div key={`e-${i}`} className="h-12 bg-gray-50 rounded-md"></div>)}
                            {[...Array(new Date(currentYear, currentMonth, 0).getDate())].map((_, i) => {
                                const day = i + 1;
                                const sel = selections[day];
                                const isWk = [0,6].includes(new Date(currentYear, currentMonth-1, day).getDay());
                                let bgColor = isWk ? 'bg-gray-50' : 'bg-white';
                                let textColor = 'text-gray-300';
                                if (sel) {
                                    if (sel.type === 'BC') { bgColor = 'bg-[#003366]'; textColor = 'text-white'; }
                                    else if (sel.type === 'ABS') { bgColor = 'bg-red-500'; textColor = 'text-white'; }
                                    else if (sel.type === 'FERIE') { bgColor = 'bg-green-600'; textColor = 'text-white'; }
                                }
                                return (
                                    <div key={day} className={`h-12 rounded-md border border-gray-100 flex flex-col items-center justify-center ${bgColor} cursor-pointer transition-transform hover:scale-105`} onClick={() => toggleDay(day)}>
                                        <span className={`text-xs font-black ${textColor}`}>{day}</span>
                                        {sel && <span className={`text-[9px] font-bold ${textColor}`}>{sel.val} j</span>}
                                        {dayStatuses[day] === 'VALIDE' && <Lock size={10} className="absolute top-1 right-1 opacity-50 text-white"/>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* FORMULAIRE SAISIE HEBDOMADAIRE */}
                    <div className="bg-[#f8fafc] rounded-2xl border border-gray-200 p-6 shadow-inner">
                        <h3 className="text-sm font-black text-[#003366] uppercase mb-6 flex items-center gap-2"><Briefcase size={18} className="text-[#C5A059]"/> Saisie Hebdomadaire</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-4 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Semaine</label>
                                    <div className="flex overflow-x-auto gap-2 pb-2 mt-1 scrollbar-hide">
                                        {weeksInMonth.map((w, i) => (
                                            <button key={i} onClick={() => { setSelectedWeekIndex(i); setDailyInput({0:'',1:'',2:'',3:'',4:''}); }} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${selectedWeekIndex === i ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-gray-500 border-gray-200'}`}>{w.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Bon de Commande</label>
                                    <select className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#003366] outline-none" value={selectedBCId} onChange={e => setSelectedBCId(e.target.value)}>
                                        {availableBCs.map(bc => <option key={bc.id} value={bc.id}>{bc.reference} (Reste: {getDynamicBCStats(bc).remaining}j)</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Type</label><select className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold" value={taskType} onChange={e => setTaskType(e.target.value)}><option value="PROJET">PROJET</option><option value="RUN">RUN</option><option value="AUTRE">AUTRE</option></select></div>
                                    <div><label className="text-[10px] font-bold text-gray-500 uppercase">Jira</label><input className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-lg text-xs font-bold" placeholder="ex: DSI-123" value={jiraTicket} onChange={e => setJiraTicket(e.target.value)} /></div>
                                </div>
                            </div>
                            <div className="lg:col-span-8 space-y-4">
                                <div><label className="text-[10px] font-bold text-gray-500 uppercase">Description de la tâche</label><input className="w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:border-[#C5A059] outline-none" placeholder="Décrivez ce que vous avez fait..." value={description} onChange={e => setDescription(e.target.value)} /></div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200"><label className="text-[10px] font-bold text-gray-500 uppercase mb-3 block">Répartition (Jours ouvrés)</label><div className="flex gap-2 overflow-x-auto">{renderDailyInputs()}</div></div>
                                <div className="flex justify-end pt-2"><button onClick={handleAddActivity} className="bg-[#003366] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-[#002244] transition-all flex items-center gap-2"><Plus size={16}/> Ajouter l'activité</button></div>
                            </div>
                        </div>
                    </div>

                    {/* HISTORIQUE DÉTAILLÉ */}
                    <div className="mt-8">
                        <h3 className="text-sm font-black text-[#003366] uppercase mb-4 flex items-center gap-2"><HistoryIcon size={18}/> Historique des activités saisies</h3>
                        {Object.keys(historyData).length === 0 ? <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs italic">Aucune activité saisie.</div> : (
                            <div className="space-y-6">
                                {Object.entries(historyData).map(([week, tasks]) => tasks.length > 0 && (
                                    <div key={week} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between"><span className="text-xs font-black text-[#003366] uppercase">{week}</span><span className="text-[10px] font-bold text-gray-500">Total: {tasks.reduce((acc, t) => acc + t.duration, 0)} JH</span></div>
                                        <table className="w-full text-left text-xs"><thead className="text-gray-400 border-b border-gray-50"><tr><th className="p-3 font-bold uppercase w-1/2">Tâche</th><th className="p-3 font-bold uppercase">Nature</th><th className="p-3 font-bold uppercase">Ticket</th><th className="p-3 font-bold uppercase text-right">Durée</th></tr></thead>
                                            <tbody className="divide-y divide-gray-50">{tasks.map((t, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="p-3 font-medium text-gray-700">{t.desc}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black text-white ${t.type === 'PROJET' ? 'bg-[#003366]' : 'bg-[#C5A059]'}`}>{t.type}</span></td><td className="p-3 font-mono text-gray-500">{t.jira || '-'}</td><td className="p-3 font-black text-[#003366] text-right">{t.duration} j</td></tr>))}</tbody></table>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
            {statusPresence && <div className={`fixed bottom-5 right-5 px-6 py-4 rounded-xl shadow-2xl text-white font-bold text-sm flex items-center gap-3 animate-slide-up z-50 ${statusPresence.type === 'success' ? 'bg-[#2D6A4F]' : 'bg-red-500'}`}>{statusPresence.type === 'success' ? <CheckCircle2/> : <AlertTriangle/>}{statusPresence.message}</div>}
        </div>
    );
};

export default TimesheetForm;