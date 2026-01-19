import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { generateCRAPDF } from '../utils/pdfGenerator';
// CORRECTION ICI : Ajout de Loader2
import { X, Calendar, ChevronDown, ChevronRight, Layers, Tag, Ticket, Clock, Download, FileText, Loader2 } from 'lucide-react';

const ActivityHistory = ({ userId, onClose }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [activities, setActivities] = useState([]);
    const [consultantInfo, setConsultantInfo] = useState({ nom: '', prenom: '' });
    const [loading, setLoading] = useState(false);
    const [expandedWeeks, setExpandedWeeks] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true });

    const moisNom = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/dashboard/timesheet/${userId}?annee=${year}&mois=${month}`);
                setActivities(res.data);
                if (res.data.length > 0) {
                    const c = res.data[0].consultant;
                    setConsultantInfo({ nom: c.nom, prenom: c.prenom });
                }
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        if (userId) fetchHistory();
    }, [year, month, userId]);

    const groupedByWeek = activities.reduce((acc, item) => {
        const date = new Date(item.date);
        const weekIndex = Math.ceil(date.getDate() / 7);
        if (!acc[weekIndex]) acc[weekIndex] = [];
        acc[weekIndex].push(item);
        return acc;
    }, {});

    const toggleWeek = (idx) => setExpandedWeeks(prev => ({ ...prev, [idx]: !prev[idx] }));

    const handleDownloadPDF = () => {
        const monthLabel = `${moisNom[month-1]} ${year}`;
        const name = `${consultantInfo.nom} ${consultantInfo.prenom}`;
        generateCRAPDF(name, monthLabel, activities);
    };

    const isMonthValidated = activities.length > 0 && activities.every(a => a.statut === 'VALIDE');

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end transition-opacity backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="bg-[#003366] p-6 text-white sticky top-0 z-20 flex justify-between items-center shadow-md">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                            <Clock color="#C5A059" size={20} /> Historique d'Activité
                        </h2>
                        <p className="text-[10px] opacity-80 uppercase font-bold mt-1">Vos déclarations validées & en attente</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 bg-white border-b border-gray-100 sticky top-[80px] z-10 space-y-4 shadow-sm">
                    <div className="flex gap-3">
                        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-[#003366] text-sm outline-none focus:border-[#C5A059]">
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="flex-[2] p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-[#003366] text-sm outline-none focus:border-[#C5A059]">
                            {moisNom.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                        </select>
                    </div>
                    <button onClick={handleDownloadPDF} disabled={!isMonthValidated} className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${isMonthValidated ? 'bg-[#C5A059] text-white hover:bg-[#b08d45] shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}>
                        <FileText size={16} /> {isMonthValidated ? "Télécharger le CRA Signé (PDF)" : "Validation DSI en attente..."}
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {loading ? <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin"/> Chargement...</div> :
                        activities.length === 0 ? <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-300">Aucune activité trouvée.</div> :
                            Object.keys(groupedByWeek).map(weekIdx => {
                                const weekData = groupedByWeek[weekIdx];
                                const totalJH = weekData.reduce((acc, curr) => acc + curr.duree, 0);
                                const isOpen = expandedWeeks[weekIdx];
                                return (
                                    <div key={weekIdx} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                        <div onClick={() => toggleWeek(weekIdx)} className="bg-gray-50 p-3 px-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 border-b border-gray-100">
                                            <span className="font-bold text-[#003366] text-xs uppercase tracking-wider">Semaine {weekIdx}</span>
                                            <div className="flex items-center gap-3"><span className="text-[10px] font-black text-[#003366] bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">{totalJH} JH</span>{isOpen ? <ChevronDown size={14} color="#9ca3af"/> : <ChevronRight size={14} color="#9ca3af"/>}</div>
                                        </div>
                                        {isOpen && (
                                            <div className="p-4 space-y-4">
                                                {weekData.sort((a,b) => new Date(a.date) - new Date(b.date)).map((task, idx) => (
                                                    <div key={idx} className="flex gap-4 items-start relative pb-4 last:pb-0 border-l-2 border-gray-100 pl-4 ml-2">
                                                        <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-[#C5A059] rounded-full"></div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-1"><div className="text-xs font-black text-[#003366]">{new Date(task.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</div><span className="text-xs font-black text-[#C5A059]">{task.duree} JH</span></div>
                                                            <div className="flex flex-wrap gap-2 mb-2 mt-1">
                                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded text-white ${task.typePrestation === 'PROJET' ? 'bg-[#003366]' : 'bg-[#C5A059]'}`}>{task.typePrestation}</span>
                                                                <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{task.sousType}</span>
                                                                {task.descriptionTache.includes('[') && <span className="text-[9px] font-bold text-[#003366] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1"><Ticket size={8}/> {task.descriptionTache.match(/\[(.*?)\]/)?.[1]}</span>}
                                                            </div>
                                                            <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">{task.descriptionTache.replace(/\[.*?\]/, '').trim()}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                </div>
            </div>
        </div>
    );
};
export default ActivityHistory;