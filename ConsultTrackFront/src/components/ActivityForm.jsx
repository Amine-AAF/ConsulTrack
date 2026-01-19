import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import {
    Briefcase, CheckCircle, Clock, User,
    FileText, Send, Loader2, CalendarDays, ChevronRight, ChevronLeft,
    Layers, Tag, Ticket, History, AlertCircle
} from 'lucide-react';
import ActivityHistory from './ActivityHistory';

const ActivityForm = ({ userRole = 'CONSULTANT', userId = null }) => {
    // --- ETATS ---
    const [consultants, setConsultants] = useState([]);
    const [selectedConsultant, setSelectedConsultant] = useState(userRole === 'ADMIN' ? '' : userId);
    const [showHistory, setShowHistory] = useState(false);

    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [weeksInMonth, setWeeksInMonth] = useState([]);
    const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

    const [bcs, setBcs] = useState([]);
    const [selectedBc, setSelectedBc] = useState('');

    const [taskType, setTaskType] = useState('PROJET');
    const [subType, setSubType] = useState('');
    const [jiraTicket, setJiraTicket] = useState('');

    const [weeklyData, setWeeklyData] = useState({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    const [description, setDescription] = useState('');
    const [totalWeek, setTotalWeek] = useState(0);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const moisNom = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

    const taskCategories = {
        'PROJET': ['CONCEPTION', 'DEV', 'RECETTE', 'DEPLOY', 'REUNION'],
        'RUN': ['MCO', 'INCIDENT', 'SUPPORT', 'MONITORING'],
        'AUTRE': ['ADMIN', 'FORMATION', 'INTERNE']
    };

    // --- LOGIQUE METIER ---
    useEffect(() => {
        const getWeeks = (year, month) => {
            const weeks = [];
            let date = new Date(year, month - 1, 1);
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            date.setDate(diff);
            const endMonth = new Date(year, month, 0);

            while (date <= endMonth) {
                const start = new Date(date);
                const end = new Date(date);
                end.setDate(end.getDate() + 4);
                weeks.push({
                    start: new Date(start),
                    end: new Date(end),
                    label: `Semaine ${weeks.length + 1}`
                });
                date.setDate(date.getDate() + 7);
            }
            return weeks;
        };
        const generatedWeeks = getWeeks(currentYear, currentMonth);
        setWeeksInMonth(generatedWeeks);
        setSelectedWeekIndex(0);
        setWeeklyData({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    }, [currentYear, currentMonth]);

    useEffect(() => {
        const total = Object.values(weeklyData).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
        setTotalWeek(total);
    }, [weeklyData]);

    useEffect(() => {
        const loadResources = async () => {
            try {
                const bcsRes = await api.get('/admin/bcs');
                setBcs(bcsRes.data);
                if (userRole === 'ADMIN') {
                    const consRes = await api.get('/admin/consultants');
                    setConsultants(consRes.data);
                } else {
                    setSelectedConsultant(userId);
                }
            } catch (err) { console.error(err); }
        };
        loadResources();
    }, [userRole, userId]);

    useEffect(() => {
        if (taskCategories[taskType]) {
            setSubType(taskCategories[taskType][0]);
        }
    }, [taskType]);

    const filteredBcs = bcs.filter(b => {
        if (!selectedConsultant) return false;
        const bcConsultantId = b.consultantId || b.consultant?.id;
        return parseInt(bcConsultantId) === parseInt(selectedConsultant);
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedConsultant || !selectedBc || totalWeek === 0) {
            setStatus({ type: 'error', message: "Veuillez remplir les jours et choisir un BC." });
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            const payload = [];
            const weekStart = weeksInMonth[selectedWeekIndex].start;
            Object.entries(weeklyData).forEach(([dayIndex, duration]) => {
                if (parseFloat(duration) > 0) {
                    const currentDay = new Date(weekStart);
                    currentDay.setDate(weekStart.getDate() + parseInt(dayIndex));
                    if (currentDay.getMonth() + 1 === currentMonth) {
                        payload.push({
                            consultantId: parseInt(selectedConsultant),
                            bcId: parseInt(selectedBc),
                            date: currentDay.toISOString().split('T')[0],
                            duree: parseFloat(duration),
                            descriptionTache: jiraTicket ? `[${jiraTicket}] ${description}` : description,
                            typePrestation: taskType,
                            sousType: subType,
                            statut: 'EN_ATTENTE'
                        });
                    }
                }
            });
            if (payload.length > 0) {
                await api.post('/dashboard/timesheet/bulk', payload);
                setStatus({ type: 'success', message: "Activité enregistrée avec succès !" });
                setWeeklyData({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
                setDescription('');
                setJiraTicket('');
            } else {
                setStatus({ type: 'error', message: "Aucun jour valide sur ce mois." });
            }
        } catch (err) {
            setStatus({ type: 'error', message: "Erreur technique." });
        }
        setLoading(false);
    };

    return (
        <div className="max-w-5xl mx-auto p-4">
            {showHistory && <ActivityHistory userId={selectedConsultant || userId} onClose={() => setShowHistory(false)} />}

            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Header Visuel */}
                <div className="bg-[#003366] p-8 flex justify-between items-center text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Briefcase className="text-[#C5A059]" size={28} /> Saisie d'Activité
                        </h2>
                        <p className="text-xs text-blue-200 mt-1 font-medium tracking-widest uppercase">Déclaration analytique des tâches</p>
                    </div>
                    {/* Bouton Historique */}
                    <button
                        onClick={() => setShowHistory(true)}
                        className="relative z-10 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-white/20 backdrop-blur-sm"
                    >
                        <History size={16} /> Historique
                    </button>
                    {/* Formes décoratives */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059] opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                </div>

                <div className="p-8 space-y-8">

                    {/* 1. SELECTION DU TEMPS & ACTEUR */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Période</label>
                            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                                <button type="button" onClick={() => setCurrentMonth(m => m > 1 ? m-1 : 12)} className="hover:bg-gray-100 p-2 rounded-lg transition-colors"><ChevronLeft size={18} color="#003366"/></button>
                                <span className="flex-1 text-center font-black text-[#003366] uppercase text-sm">{moisNom[currentMonth - 1]} {currentYear}</span>
                                <button type="button" onClick={() => setCurrentMonth(m => m < 12 ? m+1 : 1)} className="hover:bg-gray-100 p-2 rounded-lg transition-colors"><ChevronRight size={18} color="#003366"/></button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Consultant</label>
                            {userRole === 'ADMIN' ? (
                                <select
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-[#003366] outline-none focus:ring-2 focus:ring-[#C5A059]"
                                    value={selectedConsultant}
                                    onChange={(e) => { setSelectedConsultant(e.target.value); setSelectedBc(''); }}
                                >
                                    <option value="">-- Sélectionner --</option>
                                    {consultants.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
                                </select>
                            ) : (
                                <div className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-500 flex items-center gap-2 shadow-sm">
                                    <User size={16} className="text-[#C5A059]"/> Compte connecté
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. SEMAINE ET BC */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Choisir la semaine</label>
                        <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                            {weeksInMonth.map((week, idx) => {
                                const isSelected = selectedWeekIndex === idx;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => { setSelectedWeekIndex(idx); setWeeklyData({0:0,1:0,2:0,3:0,4:0}); }}
                                        className={`flex-1 min-w-[140px] p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                                            isSelected
                                                ? 'bg-[#003366] border-[#003366] text-white shadow-lg transform scale-105'
                                                : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="text-[10px] font-black uppercase tracking-wider mb-1">{week.label}</div>
                                        <div className={`text-[10px] font-bold ${isSelected ? 'text-blue-200' : 'text-gray-300'}`}>
                                            {week.start.getDate()} - {week.end.getDate()} {moisNom[currentMonth-1].substring(0,3)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <select
                            className="w-full p-4 bg-white border-2 border-gray-100 rounded-xl font-bold text-[#003366] text-sm focus:border-[#C5A059] outline-none transition-colors"
                            value={selectedBc}
                            onChange={(e)=>setSelectedBc(e.target.value)}
                            disabled={!selectedConsultant}
                        >
                            <option value="">-- Sélectionner le Bon de Commande (BC) --</option>
                            {filteredBcs.map(b => (
                                <option key={b.id} value={b.id}>{b.reference} (Solde: {(b.joursMax - b.joursConsommes).toFixed(1)}j)</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. DÉTAILS DE LA TÂCHE */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-[#C5A059] rounded-full"></div>
                            <h3 className="text-sm font-black text-[#003366] uppercase tracking-wide">Détails de la prestation</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Type */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Nature</label>
                                <div className="flex bg-gray-50 p-1 rounded-xl">
                                    {['PROJET', 'RUN', 'AUTRE'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setTaskType(type)}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${
                                                taskType === type
                                                    ? 'bg-white text-[#003366] shadow-sm border border-gray-100'
                                                    : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Catégorie */}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Sous-Catégorie</label>
                                <div className="flex flex-wrap gap-2">
                                    {taskCategories[taskType]?.map(sub => (
                                        <button
                                            key={sub}
                                            type="button"
                                            onClick={() => setSubType(sub)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                                                subType === sub
                                                    ? 'bg-[#003366] text-white border-[#003366]'
                                                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            {sub}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Ticket & Description */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Ref. Ticket (Jira)</label>
                                <div className="relative">
                                    <Ticket size={14} className="absolute left-3 top-3.5 text-gray-400"/>
                                    <input
                                        className="w-full pl-9 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#003366] focus:bg-white focus:border-[#C5A059] outline-none transition-colors"
                                        placeholder="ex: DSI-1234"
                                        value={jiraTicket}
                                        onChange={(e) => setJiraTicket(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Description des livrables</label>
                                <input
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-[#003366] focus:bg-white focus:border-[#C5A059] outline-none transition-colors"
                                    placeholder="Décrivez la tâche effectuée..."
                                    value={description}
                                    onChange={(e)=>setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 4. GRILLE JOURNALIÈRE */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2">
                                <CalendarDays size={16} className="text-[#C5A059]"/>
                                <h3 className="text-sm font-black text-[#003366] uppercase tracking-wide">Ventilation Hebdomadaire</h3>
                            </div>
                            <span className="text-xs font-bold bg-[#003366] text-white px-3 py-1 rounded-lg">Total: {totalWeek} JH</span>
                        </div>

                        <div className="grid grid-cols-5 gap-3">
                            {weeksInMonth[selectedWeekIndex] && days.map((day, index) => {
                                const weekStart = new Date(weeksInMonth[selectedWeekIndex].start);
                                const currentDayDate = new Date(weekStart);
                                currentDayDate.setDate(weekStart.getDate() + index);
                                const isInMonth = currentDayDate.getMonth() + 1 === currentMonth;

                                return (
                                    <div key={day} className={`relative flex flex-col ${!isInMonth ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                                        <div className="bg-gray-100 rounded-t-xl py-2 text-center border-x border-t border-gray-200">
                                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{day.substring(0,3)}</div>
                                            <div className="text-[10px] font-bold text-[#003366]">{currentDayDate.getDate()}</div>
                                        </div>
                                        <input
                                            type="number" step="0.5" min="0" max="1"
                                            className={`w-full h-12 text-center font-black text-lg outline-none border-x border-b border-gray-200 rounded-b-xl transition-all ${
                                                weeklyData[index] > 0
                                                    ? 'bg-[#003366] text-white border-[#003366]'
                                                    : 'bg-white text-gray-300 focus:bg-gray-50 focus:text-[#003366] focus:border-[#C5A059]'
                                            }`}
                                            value={weeklyData[index] || ''}
                                            placeholder="-"
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setWeeklyData(prev => ({ ...prev, [index]: val >= 0 && val <= 1 ? val : 0 }));
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="pt-4 border-t border-gray-100">
                        {status && (
                            <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 text-xs font-bold animate-pulse ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                {status.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading || !selectedBc || totalWeek === 0}
                            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 ${
                                loading || !selectedBc || totalWeek === 0
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-[#003366] text-white hover:bg-[#002244]'
                            }`}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> CONFIRMER LA SAISIE</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityForm;