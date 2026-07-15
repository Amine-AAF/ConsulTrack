import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import TimesheetValidationCard from './TimesheetValidationCard';
import {
    Building2, Users, FileStack, ShieldCheck,
    Clock, Landmark, Receipt, Filter,
    Coffee, Check, X,
    ListChecks, Activity, Layers, Download, History,
    CheckCircle, FileText, AlertCircle
} from 'lucide-react';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('pointages'); // Par défaut sur les pointages

    // --- DONNÉES ---
    const [cabinets, setCabinets] = useState([]);
    const [consultants, setConsultants] = useState([]);
    const [bcs, setBcs] = useState([]);

    // Timesheets (Grille)
    const [pendingSaisies, setPendingSaisies] = useState([]);
    const [validatedSaisies, setValidatedSaisies] = useState([]);

    // Absences
    const [pendingAbsences, setPendingAbsences] = useState([]);
    const [historyAbsences, setHistoryAbsences] = useState([]);

    const [loading, setLoading] = useState(false);

    useEffect(() => { loadData(); }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Appels de base
            const promises = [
                api.get('/admin/cabinets'),
                api.get('/admin/consultants'),
                api.get('/admin/bcs'),
            ];

            // Chargement conditionnel selon l'onglet pour optimiser
            if (activeTab === 'pointages' || activeTab === 'rapports') {
                promises.push(api.get('/admin/saisies/en-attente'));
                promises.push(api.get('/admin/saisies/validees').catch(() => ({ data: [] })));
            }

            if (activeTab === 'absences') {
                promises.push(api.get('/admin/absences/pending'));
                promises.push(api.get('/admin/absences/history').catch(() => ({ data: [] })));
            }

            const results = await Promise.all(promises);

            // Assignation (Attention à l'ordre des index selon ce qu'on a push)
            setCabinets(results[0].data);
            setConsultants(results[1].data);
            setBcs(results[2].data);

            if (activeTab === 'pointages' || activeTab === 'rapports') {
                setPendingSaisies(results[3].data);
                setValidatedSaisies(results[4] ? results[4].data : []);
            }

            if (activeTab === 'absences') {
                // Si on est sur l'onglet absence, les index sont décalés car on n'a pas chargé les saisies
                // Mais pour simplifier ici, on suppose que loadData recharge tout ou on gère les index dynamiquement.
                // Pour la robustesse, je fais un appel séparé ici si besoin, ou je stocke tout.
                // RE-FETCH spécifique pour être sûr des index :
                const absPending = await api.get('/admin/absences/pending');
                const absHistory = await api.get('/admin/absences/history').catch(()=>({data:[]}));
                setPendingAbsences(absPending.data);
                setHistoryAbsences(absHistory.data);
            }

        } catch (err) { console.error("Erreur chargement admin", err); }
        setLoading(false);
    };

    const tabStyle = (id) => ({
        padding: '12px 18px',
        cursor: 'pointer',
        backgroundColor: activeTab === id ? '#ffffff' : 'transparent',
        color: activeTab === id ? '#003366' : '#ffffff',
        border: 'none',
        fontWeight: 'bold',
        borderRadius: '10px 10px 0 0',
        display: 'flex', alignItems: 'center', gap: '8px', transition: '0.3s', fontSize: '12px'
    });

    return (
        <div className="mx-auto max-w-7xl p-4">
            <div style={{ backgroundColor: '#003366', padding: '25px', borderRadius: '15px 15px 0 0', color: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                    <ShieldCheck size={32} color="#C5A059" />
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '-0.025em' }}>CONSOLE D'ADMINISTRATION</h1>
                </div>

                <div className="flex overflow-x-auto gap-1 pb-2 scrollbar-hide">
                    <button style={tabStyle('cabinets')} onClick={() => setActiveTab('cabinets')}><Building2 size={16} /> Cabinets</button>
                    <button style={tabStyle('consultants')} onClick={() => setActiveTab('consultants')}><Users size={16} /> Consultants</button>
                    <button style={tabStyle('bcs')} onClick={() => setActiveTab('bcs')}><FileStack size={16} /> BC</button>

                    <div className="w-[1px] bg-white/20 mx-2"></div>

                    <button style={tabStyle('pointages')} onClick={() => setActiveTab('pointages')}>
                        <Clock size={16} /> Pointages {pendingSaisies.length > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] ml-2">{pendingSaisies.length}</span>}
                    </button>

                    <button style={tabStyle('absences')} onClick={() => setActiveTab('absences')}>
                        <Coffee size={16} /> Absences {pendingAbsences.length > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] ml-2">{pendingAbsences.length}</span>}
                    </button>

                    <button style={tabStyle('rapports')} onClick={() => setActiveTab('rapports')}>
                        <FileText size={16} /> Rapports d'Activité
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-b-2xl shadow-xl min-h-[600px] border border-gray-200">
                {loading ? <div className="text-center p-20 text-[#003366] font-bold animate-pulse">Chargement des données...</div> : (
                    <>
                        {activeTab === 'cabinets' && <CabinetSection cabinets={cabinets} onRefresh={loadData} />}
                        {activeTab === 'consultants' && <ConsultantSection consultants={consultants} cabinets={cabinets} onRefresh={loadData} />}
                        {activeTab === 'bcs' && <BCSection bcs={bcs} consultants={consultants} cabinets={cabinets} onRefresh={loadData} />}

                        {/* 1. VALIDATION POINTAGES (GRILLE) */}
                        {activeTab === 'pointages' && (
                            <TimesheetSection
                                pendingItems={pendingSaisies}
                                validatedItems={validatedSaisies}
                                allBcs={bcs}
                                cabinets={cabinets}
                                consultants={consultants}
                                onRefresh={loadData}
                            />
                        )}

                        {/* 2. VALIDATION ABSENCES */}
                        {activeTab === 'absences' && (
                            <AbsenceSection
                                pendingItems={pendingAbsences}
                                historyItems={historyAbsences}
                                onRefresh={loadData}
                            />
                        )}

                        {/* 3. VALIDATION RAPPORTS D'ACTIVITÉ (TEXTE) */}
                        {activeTab === 'rapports' && (
                            <ActivityReportSection
                                pendingItems={pendingSaisies}
                                consultants={consultants}
                                onRefresh={loadData}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ==========================================
// 1. SECTION POINTAGES (GRILLE TIMESHEET)
// ==========================================
const TimesheetSection = ({ pendingItems, validatedItems, allBcs, cabinets, consultants, onRefresh }) => {
    const [subTab, setSubTab] = useState('pending'); // 'pending' | 'history'
    const [historyFilters, setHistoryFilters] = useState({ annee: new Date().getFullYear(), mois: '', cabinetId: '', consultantId: '' });

    // Regroupement par Consultant/Mois
    const processData = (itemsList) => {
        const grouped = itemsList.reduce((acc, item) => {
            const key = `${item.consultant.id}-${item.date.substring(0, 7)}`;
            let enrichedItem = { ...item };

            // Enrichir avec infos BC
            if (item.modeSaisie === 'BC' || item.mode === 'BC') {
                const bcId = item.bonDeCommande?.id || item.bcId;
                const fullBc = allBcs.find(b => b.id === bcId);
                if (fullBc) enrichedItem.bonDeCommande = fullBc;
                else if (!item.bonDeCommande && item.bcId) enrichedItem.bonDeCommande = { id: item.bcId, reference: 'BC Inconnu' };
            }
            if (!enrichedItem.mode && enrichedItem.modeSaisie) enrichedItem.mode = enrichedItem.modeSaisie;

            if (!acc[key]) {
                acc[key] = {
                    id: key,
                    consultantName: `${item.consultant.nom} ${item.consultant.prenom}`,
                    consultantId: item.consultant.id,
                    cabinetId: consultants.find(c => c.id === item.consultant.id)?.cabinet?.id,
                    period: item.date.substring(0, 7),
                    entries: []
                };
            }
            acc[key].entries.push(enrichedItem);
            return acc;
        }, {});
        return Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period));
    };

    const pendingGroups = processData(pendingItems);
    let historyGroups = processData(validatedItems);

    // Filtrage Historique
    if (subTab === 'history') {
        historyGroups = historyGroups.filter(g => {
            const [gYear, gMonth] = g.period.split('-');
            return (!historyFilters.annee || parseInt(gYear) === parseInt(historyFilters.annee)) &&
                (!historyFilters.mois || parseInt(gMonth) === parseInt(historyFilters.mois)) &&
                (!historyFilters.consultantId || g.consultantId === parseInt(historyFilters.consultantId)) &&
                (!historyFilters.cabinetId || g.cabinetId === parseInt(historyFilters.cabinetId));
        });
    }

    const handleAction = async (groupId, action) => {
        const group = pendingGroups.find(g => g.id === groupId);
        if(!group) return;

        try {
            if (action === 'valider') {
                if (!window.confirm(`Valider tout le mois ${group.period} pour ${group.consultantName} ?`)) return;
                // Endpoint atomique : 1 seul appel transactionnel côté back
                const [year, month] = group.period.split('-');
                await api.put(`/admin/saisies/valider-mois?consultantId=${group.consultantId}&annee=${year}&mois=${parseInt(month, 10)}`);
            } else {
                const motif = window.prompt(`Motif du rejet pour ${group.consultantName} (${group.period}) :`, '');
                if (motif === null || motif.trim() === '') return; // annulé
                await Promise.all(group.entries.map(item =>
                    api.put(`/admin/saisies/${item.id}/rejeter?motif=${encodeURIComponent(motif)}`)
                ));
            }
            onRefresh();
        } catch (err) {
            const msg = err.response?.data?.message || "Erreur opération";
            alert(msg);
        }
    };

    return (
        <div>
            {/* Header Onglets */}
            <div className="flex gap-6 mb-6 border-b border-gray-100 pb-2">
                <button onClick={() => setSubTab('pending')} className={`pb-2 text-sm font-bold flex items-center gap-2 ${subTab === 'pending' ? 'text-[#003366] border-b-2 border-[#003366]' : 'text-gray-400'}`}>
                    <Clock size={16}/> À VALIDER ({pendingGroups.length})
                </button>
                <button onClick={() => setSubTab('history')} className={`pb-2 text-sm font-bold flex items-center gap-2 ${subTab === 'history' ? 'text-[#003366] border-b-2 border-[#003366]' : 'text-gray-400'}`}>
                    <History size={16}/> HISTORIQUE VALIDÉ
                </button>
            </div>

            {/* Filtres Historique */}
            {subTab === 'history' && (
                <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-xl mb-6 items-center border border-gray-100">
                    <Filter size={14} className="text-gray-400"/>
                    <select className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-[#003366]" value={historyFilters.annee} onChange={e => setHistoryFilters({...historyFilters, annee: e.target.value})}>
                        <option value="">Année</option>{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-[#003366]" value={historyFilters.mois} onChange={e => setHistoryFilters({...historyFilters, mois: e.target.value})}>
                        <option value="">Mois</option>{[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                    </select>
                    <select className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-[#003366]" value={historyFilters.cabinetId} onChange={e => setHistoryFilters({...historyFilters, cabinetId: e.target.value})}>
                        <option value="">Tous Cabinets</option>{cabinets.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                    <select className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-[#003366]" value={historyFilters.consultantId} onChange={e => setHistoryFilters({...historyFilters, consultantId: e.target.value})}>
                        <option value="">Tous Consultants</option>{consultants.filter(c => !historyFilters.cabinetId || c.cabinet?.id === parseInt(historyFilters.cabinetId)).map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
                    </select>
                </div>
            )}

            {/* Contenu */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(subTab === 'pending' ? pendingGroups : historyGroups).map(ts => (
                    <TimesheetValidationCard
                        key={ts.id}
                        timesheet={ts}
                        onValidate={() => handleAction(ts.id, 'valider')}
                        onReject={() => handleAction(ts.id, 'rejeter')}
                        readOnly={subTab === 'history'}
                    />
                ))}
                {(subTab === 'pending' ? pendingGroups : historyGroups).length === 0 && (
                    <div className="col-span-full text-center p-10 text-gray-400 italic">Aucun élément à afficher.</div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// 2. SECTION ABSENCES (GROUPÉE ET OPTIMISÉE)
// ==========================================
const AbsenceSection = ({ pendingItems, historyItems, onRefresh }) => {
    const [subTab, setSubTab] = useState('pending');

    // --- LOGIQUE DE REGROUPEMENT ---
    const groupAbsences = (items) => {
        if (!items || items.length === 0) return [];

        // 1. Trier par Consultant, puis par Date
        const sorted = [...items].sort((a, b) => {
            if (a.consultant.id !== b.consultant.id) return a.consultant.id - b.consultant.id;
            return new Date(a.date) - new Date(b.date);
        });

        const groups = [];
        if (sorted.length === 0) return groups;

        // 2. Initialiser le premier groupe
        let currentGroup = {
            ...sorted[0],
            ids: [sorted[0].id], // On stocke tous les IDs du groupe
            startDate: sorted[0].date,
            endDate: sorted[0].date,
            count: 1
        };

        // 3. Parcourir pour regrouper les jours consécutifs (ou même motif proche)
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const prev = sorted[i - 1];

            // Vérifier si c'est le même groupe : Mêmes Consultant, Motif et Statut
            // Optionnel : On peut vérifier si les dates sont proches pour séparer deux demandes distinctes du même motif
            const isSameContext =
                current.consultant.id === prev.consultant.id &&
                current.motif === prev.motif &&
                current.statut === prev.statut;

            if (isSameContext) {
                currentGroup.ids.push(current.id);
                currentGroup.endDate = current.date; // Met à jour la date de fin
                currentGroup.count++;
            } else {
                groups.push(currentGroup);
                // Nouveau groupe
                currentGroup = {
                    ...current,
                    ids: [current.id],
                    startDate: current.date,
                    endDate: current.date,
                    count: 1
                };
            }
        }
        groups.push(currentGroup);
        return groups;
    };

    // --- ACTION DE VALIDATION DE MASSE ---
    const handleBulkAction = async (itemGroup, action) => {
        const actionLabel = action === 'VALIDE' ? 'VALIDER' : 'REJETER';
        if (!window.confirm(`Voulez-vous ${actionLabel} cette demande de ${itemGroup.count} jours pour ${itemGroup.consultant.prenom} ?`)) return;

        try {
            // On envoie une requête pour chaque jour du groupe (Promise.all pour la rapidité)
            await Promise.all(itemGroup.ids.map(id =>
                api.put(`/admin/absences/${id}/status`, { statut: action })
            ));
            onRefresh();
        } catch (err) {
            alert("Erreur lors de la mise à jour groupée");
            console.error(err);
        }
    };

    const groupedPending = groupAbsences(pendingItems);
    const groupedHistory = groupAbsences(historyItems);

    const renderList = (groups, isReadOnly) => (
        <div className="space-y-4">
            {groups.length === 0 ? (
                <div className="text-center p-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Aucune absence dans cette liste.
                </div>
            ) : (
                groups.map((group, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row justify-between items-center p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">

                        {/* INFO CONSULTANT & MOTIF */}
                        <div className="flex items-center gap-5 w-full md:w-auto mb-4 md:mb-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${group.statut === 'REJETE' ? 'bg-red-50 text-red-500' : 'bg-[#E0E7FF] text-[#4338CA]'}`}>
                                <Coffee size={24} />
                            </div>
                            <div>
                                <div className="font-black text-[#003366] text-sm uppercase tracking-wide">
                                    {group.consultant?.nom} {group.consultant?.prenom}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-[#C5A059] uppercase bg-[#C5A059]/10 px-2 py-0.5 rounded text-[10px]">
                                        {group.motif}
                                    </span>
                                    <span className="text-gray-400">|</span>
                                    {group.count > 1 ? (
                                        <span className="font-bold text-gray-700">
                                            Du {new Date(group.startDate).toLocaleDateString()} au {new Date(group.endDate).toLocaleDateString()}
                                        </span>
                                    ) : (
                                        <span className="font-bold text-gray-700">
                                            Le {new Date(group.startDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* INFO DURÉE & ACTIONS */}
                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">

                            {/* Compteur Jours */}
                            <div className="text-center px-4 border-r border-gray-100">
                                <div className="text-[10px] font-black text-gray-400 uppercase">Durée</div>
                                <div className="text-lg font-black text-[#003366]">{group.count} <span className="text-[10px]">Jours</span></div>
                            </div>

                            {!isReadOnly ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleBulkAction(group, 'REJETE')}
                                        className="flex items-center gap-2 px-4 py-2 border border-red-100 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                                    >
                                        <X size={16}/> REFUSER
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction(group, 'VALIDE')}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#2D6A4F] text-white rounded-lg text-xs font-bold hover:bg-[#1b4332] shadow-md hover:shadow-lg transition-all"
                                    >
                                        <Check size={16}/> VALIDER
                                    </button>
                                </div>
                            ) : (
                                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 ${group.statut === 'VALIDE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {group.statut === 'VALIDE' ? <CheckCircle size={14}/> : <X size={14}/>}
                                    {group.statut}
                                </span>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div>
            <div className="flex gap-6 mb-6 border-b border-gray-100 pb-2">
                <button onClick={() => setSubTab('pending')} className={`pb-2 text-sm font-bold flex items-center gap-2 transition-colors ${subTab === 'pending' ? 'text-[#003366] border-b-2 border-[#003366]' : 'text-gray-400 hover:text-[#003366]'}`}>
                    <AlertCircle size={16}/> DEMANDES EN COURS ({groupedPending.length})
                </button>
                <button onClick={() => setSubTab('history')} className={`pb-2 text-sm font-bold flex items-center gap-2 transition-colors ${subTab === 'history' ? 'text-[#003366] border-b-2 border-[#003366]' : 'text-gray-400 hover:text-[#003366]'}`}>
                    <History size={16}/> HISTORIQUE TRAITÉ
                </button>
            </div>
            {subTab === 'pending' ? renderList(groupedPending, false) : renderList(groupedHistory, true)}
        </div>
    );
};

// ==========================================
// 3. SECTION RAPPORTS D'ACTIVITÉ (TEXTE)
// ==========================================
const ActivityReportSection = ({ pendingItems, consultants, onRefresh }) => {
    const [subTab, setSubTab] = useState('pending'); // 'pending' | 'history'

    // --- PARTIE HISTORIQUE / RECHERCHE ---
    const [filters, setFilters] = useState({ annee: new Date().getFullYear(), mois: new Date().getMonth() + 1, consultantId: '' });
    const [historyActivities, setHistoryActivities] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (subTab === 'history') fetchHistory();
    }, [subTab, filters]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const params = new URLSearchParams();
            params.append('annee', filters.annee);
            if (filters.mois) params.append('mois', filters.mois);
            if (filters.consultantId) params.append('consultantId', filters.consultantId);
            const res = await api.get(`/admin/activities/search?${params.toString()}`);
            setHistoryActivities(res.data);
        } catch (err) { console.error(err); }
        setLoadingHistory(false);
    };

    // --- RENDU TABLEAU ---
    const renderTable = (items, isReadOnly) => (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase font-bold">
                <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Consultant</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Détails / Ticket</th>
                    <th className="p-4 text-center">Durée</th>
                    <th className="p-4 text-center">Statut / Action</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                {items.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic">Aucune activité.</td></tr> :
                    items.map(act => (
                        <tr key={act.id} className="hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-700">{new Date(act.date).toLocaleDateString()}</td>
                            <td className="p-4">
                                <div className="font-bold text-[#003366]">{act.consultant?.nom} {act.consultant?.prenom}</div>
                                <div className="text-[10px] text-gray-400">{act.bonDeCommande?.reference || 'N/A'}</div>
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold text-white ${act.typePrestation === 'PROJET' ? 'bg-[#003366]' : 'bg-[#C5A059]'}`}>
                                    {act.typePrestation || 'N/A'}
                                </span>
                            </td>
                            <td className="p-4 max-w-xs truncate" title={act.descriptionTache}>
                                <span className="font-bold text-gray-800">{act.ticketJira ? `[${act.ticketJira}] ` : ''}</span>
                                <span className="text-gray-500">{act.descriptionTache}</span>
                            </td>
                            <td className="p-4 text-center font-black text-[#003366]">{act.duree}</td>
                            <td className="p-4 text-center">
                                {!isReadOnly ? (
                                    <div className="flex justify-center gap-2">
                                        <button onClick={async () => { if(window.confirm('Rejeter ?')) { await api.put(`/admin/saisies/${act.id}/rejeter?motif=RejetActivité`); onRefresh(); } }} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><X size={16}/></button>
                                        <button onClick={async () => { if(window.confirm('Valider ?')) { await api.put(`/admin/saisies/${act.id}/valider`); onRefresh(); } }} className="p-1.5 bg-[#2D6A4F] text-white rounded hover:bg-[#1b4332]"><Check size={16}/></button>
                                    </div>
                                ) : (
                                    <span className={`px-2 py-1 rounded-full text-[9px] font-black ${act.statut === 'VALIDE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{act.statut}</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div>
            <div className="flex gap-6 mb-6 border-b border-gray-100 pb-2">
                <button onClick={() => setSubTab('pending')} className={`pb-2 text-sm font-bold flex items-center gap-2 ${subTab === 'pending' ? 'text-[#003366] border-b-2 border-[#003366]' : 'text-gray-400'}`}>
                    <ListChecks size={16}/> LIGNES À VALIDER ({pendingItems.length})
                </button>
                <button onClick={() => setSubTab('history')} className={`pb-2 text-sm font-bold flex items-center gap-2 ${subTab === 'history' ? 'text-[#003366] border-b-2 border-[#003366]' : 'text-gray-400'}`}>
                    <Activity size={16}/> RECHERCHE & HISTORIQUE
                </button>
            </div>

            {subTab === 'history' && (
                <div className="flex gap-3 p-4 bg-gray-50 rounded-xl mb-6 items-center border border-gray-100">
                    <select className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-[#003366]" value={filters.annee} onChange={e => setFilters({...filters, annee: e.target.value})}>
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-[#003366]" value={filters.mois} onChange={e => setFilters({...filters, mois: e.target.value})}>
                        <option value="">Tous les Mois</option>{[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                    </select>
                    <select className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-[#003366] flex-1" value={filters.consultantId} onChange={e => setFilters({...filters, consultantId: e.target.value})}>
                        <option value="">-- Tous les Consultants --</option>{consultants.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
                    </select>
                    {filters.consultantId && historyActivities.length > 0 && (
                        <button className="bg-[#003366] text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                            <Download size={14}/> PDF
                        </button>
                    )}
                </div>
            )}

            {subTab === 'pending' ? renderTable(pendingItems, false) : (loadingHistory ? <div className="text-center p-10">Chargement...</div> : renderTable(historyActivities, true))}
        </div>
    );
};

// --- COMPOSANTS AUXILIAIRES DE GESTION ADMINISTRATIVE (CRUD) ---
// (CabinetSection, ConsultantSection, BCSection restent identiques à vos versions précédentes)
const CabinetSection = ({ cabinets, onRefresh }) => {
    const [form, setForm] = useState({ nom: '', adresse: '', ice: '', identifiantFiscal: '', patente: '', rib: '' });
    const save = async () => { if(!form.nom) return alert("Nom obligatoire"); await api.post('/admin/cabinets', form); setForm({ nom: '', adresse: '', ice: '', identifiantFiscal: '', patente: '', rib: '' }); onRefresh(); };
    const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' };
    return (
        <div style={{ color: '#111827' }}>
            <h3 style={{ borderBottom: '2px solid #f3f4f6', paddingBottom: '10px', color: '#003366', display: 'flex', alignItems: 'center', gap: '10px' }}><Landmark size={20}/> Identification des ESN</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', margin: '20px 0', backgroundColor: '#f9fafb', padding: '20px', borderRadius: '12px' }}>
                <input placeholder="Raison Sociale" style={inputStyle} value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} />
                <input placeholder="ICE" style={inputStyle} value={form.ice} onChange={e => setForm({...form, ice: e.target.value})} />
                <input placeholder="IF" style={inputStyle} value={form.identifiantFiscal} onChange={e => setForm({...form, identifiantFiscal: e.target.value})} />
                <input placeholder="Patente" style={inputStyle} value={form.patente} onChange={e => setForm({...form, patente: e.target.value})} />
                <input placeholder="RIB" style={{ ...inputStyle, gridColumn: 'span 2' }} value={form.rib} onChange={e => setForm({...form, rib: e.target.value})} />
                <button onClick={save} style={{ gridColumn: 'span 2', backgroundColor: '#2D6A4F', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>Enregistrer Cabinet</button>
            </div>
            <table style={{ width: '100%', fontSize: '13px' }}>
                <thead><tr style={{ textAlign: 'left', backgroundColor: '#f9fafb' }}><th className="p-3">Cabinet</th><th className="p-3">ICE</th></tr></thead>
                <tbody>{cabinets.map(c => <tr key={c.id} className="border-b"><td className="p-3 font-bold">{c.nom}</td><td className="p-3">{c.ice}</td></tr>)}</tbody>
            </table>
        </div>
    );
};

const ConsultantSection = ({ consultants, cabinets, onRefresh }) => {
    const [form, setForm] = useState({ nom: '', prenom: '', email: '', cabinetId: '' });
    const save = async () => { if(!form.cabinetId) return alert("Cabinet requis"); await api.post('/admin/consultants', { ...form, cabinet: { id: form.cabinetId } }); setForm({ nom: '', prenom: '', email: '', cabinetId: '' }); onRefresh(); };
    return (
        <div>
            <h3 className="text-[#003366] font-bold mb-4">Effectifs Consultants</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
                <input placeholder="Nom" className="p-2 border rounded" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} />
                <input placeholder="Prénom" className="p-2 border rounded" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} />
                <select className="p-2 border rounded" value={form.cabinetId} onChange={e => setForm({...form, cabinetId: e.target.value})}><option value="">Cabinet</option>{cabinets.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
                <button onClick={save} className="bg-[#003366] text-white rounded font-bold">Ajouter</button>
            </div>
            <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left"><th className="p-3">Nom</th><th className="p-3">Cabinet</th></tr></thead><tbody>{consultants.map(c => <tr key={c.id} className="border-b"><td className="p-3">{c.nom} {c.prenom}</td><td className="p-3">{c.cabinet?.nom}</td></tr>)}</tbody></table>
        </div>
    );
};

const BCSection = ({ bcs, consultants, cabinets, onRefresh }) => {
    const [form, setForm] = useState({ reference: '', joursMax: '', codeBudget: '', consultantId: '', tjm: '' });
    const save = async () => { if(!form.reference) return; await api.post('/admin/bcs', { reference: form.reference, joursMax: parseFloat(form.joursMax), codeBudget: form.codeBudget, consultantId: parseInt(form.consultantId), tjm: parseFloat(form.tjm) }); onRefresh(); };
    return (
        <div>
            <h3 className="text-[#003366] font-bold mb-4 flex items-center gap-2"><Receipt size={20}/> Gestion des BC</h3>
            <div className="grid grid-cols-5 gap-4 mb-6 bg-gray-50 p-4 rounded-xl">
                <input placeholder="Référence BC" className="p-2 border rounded col-span-2" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} />
                <input placeholder="Jours Max" type="number" className="p-2 border rounded" value={form.joursMax} onChange={e => setForm({...form, joursMax: e.target.value})} />
                <input placeholder="Code Budget" className="p-2 border rounded" value={form.codeBudget} onChange={e => setForm({...form, codeBudget: e.target.value})} />
                <input placeholder="TJM" type="number" className="p-2 border rounded" value={form.tjm} onChange={e => setForm({...form, tjm: e.target.value})} />
                <select className="p-2 border rounded col-span-5" value={form.consultantId} onChange={e => setForm({...form, consultantId: e.target.value})}><option value="">Consultant</option>{consultants.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}</select>
                <button onClick={save} className="bg-[#C5A059] text-white p-2 rounded font-bold col-span-5">Créer BC</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bcs.map(bc => (
                    <div key={bc.id} className="p-4 border rounded-xl shadow-sm bg-white">
                        <div className="font-bold text-[#003366] text-lg">{bc.reference}</div>
                        <div className="text-xs text-gray-500 mb-2">{bc.codeBudget}</div>
                        <div className="flex justify-between items-center text-sm font-bold"><span className="text-[#C5A059]">{bc.consultant?.nom}</span><span>{bc.joursConsommes} / {bc.joursMax} JH</span></div>
                        <div className="w-full bg-gray-100 h-2 rounded-full mt-2"><div className="bg-[#2D6A4F] h-2 rounded-full" style={{width: `${(bc.joursConsommes/bc.joursMax)*100}%`}}></div></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminPanel;