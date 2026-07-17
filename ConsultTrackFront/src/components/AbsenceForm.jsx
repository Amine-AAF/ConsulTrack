import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import {
    Coffee, Send, Calendar as CalendarIcon,
    CheckCircle, AlertCircle, Clock, FileText,
    ArrowRight, Calculator, AlertTriangle, UserCheck
} from 'lucide-react';

const AbsenceForm = ({ userRole = 'CONSULTANT', userId = null }) => {
    // Saisie déléguée : ADMIN (tous) ou RESPONSABLE (consultants de ses cabinets, liste scopée serveur)
    const isDelegue = userRole === 'ADMIN' || userRole === 'RESPONSABLE';
    // États pour la logique Admin/Responsable/Consultant
    const [consultants, setConsultants] = useState([]);
    const [targetConsultantId, setTargetConsultantId] = useState(isDelegue ? '' : userId);

    // États du formulaire
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [motif, setMotif] = useState('Congé Annuel');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState(0);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    // 1. Initialisation : Si Admin/Responsable, charger la liste. Si Consultant, figer l'ID.
    useEffect(() => {
        if (isDelegue) {
            const fetchConsultants = async () => {
                try {
                    const res = await api.get('/admin/consultants');
                    // Comptes inactifs (mission terminée) exclus de la saisie déléguée
                    setConsultants((res.data || []).filter(c => c.actif !== false));
                } catch (err) { console.error("Erreur chargement consultants", err); }
            };
            fetchConsultants();
        } else {
            setTargetConsultantId(userId); // Verrouillage sur l'utilisateur connecté
        }
    }, [isDelegue, userId]);

    // 2. Utilitaires dates (Week-end)
    const isWeekend = (dateStr) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        return day === 0 || day === 6;
    };

    // 3. Calcul de durée intelligent (Hors Sam/Dim)
    useEffect(() => {
        if (startDate) {
            let count = 0;
            let current = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date(startDate);

            while (current <= end) {
                if (current.getDay() !== 0 && current.getDay() !== 6) {
                    count++;
                }
                current.setDate(current.getDate() + 1);
            }
            setDuration(count);
        } else {
            setDuration(0);
        }
    }, [startDate, endDate]);

    // 4. Soumission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation Admin/Responsable : il faut choisir un consultant
        if (isDelegue && !targetConsultantId) {
            setStatus({ type: 'error', message: "Veuillez sélectionner un consultant dans la liste." });
            return;
        }

        if (!startDate) return;

        const finalEndDate = endDate || startDate;
        if (new Date(startDate) > new Date(finalEndDate)) {
            setStatus({ type: 'error', message: 'La date de début doit être avant la date de fin.' });
            return;
        }

        if (duration === 0) {
            setStatus({ type: 'error', message: 'La période choisie ne contient aucun jour ouvrable.' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const datesToSubmit = [];
            let current = new Date(startDate);
            const end = new Date(finalEndDate);

            while (current <= end) {
                if (current.getDay() !== 0 && current.getDay() !== 6) {
                    datesToSubmit.push(new Date(current).toISOString().split('T')[0]);
                }
                current.setDate(current.getDate() + 1);
            }

            // Envoi de la demande (l'API utilisera targetConsultantId)
            await Promise.all(datesToSubmit.map(date =>
                api.post('/dashboard/absences/demande', {
                    consultantId: targetConsultantId,
                    date: date,
                    motif: `${motif} ${description ? '- ' + description : ''}`
                })
            ));

            setStatus({ type: 'success', message: `Demande enregistrée avec succès pour ${datesToSubmit.length} jour(s).` });

            // Reset formulaire (sauf le consultant sélectionné)
            setStartDate('');
            setEndDate('');
            setDescription('');
            setDuration(0);

        } catch (err) {
            setStatus({ type: 'error', message: 'Erreur lors de l\'envoi de la demande.' });
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
                {/* Header Visuel */}
                <div style={{ height: '8px', background: 'linear-gradient(90deg, #003366 0%, #C5A059 100%)' }}></div>

                <div className="p-8 pb-4">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-[#003366] uppercase tracking-tighter flex items-center gap-3">
                                <Coffee size={28} color="#C5A059" />
                                Demande d'Absence
                            </h2>
                            {isDelegue ? (
                                <p className="text-xs font-bold text-amber-600 mt-1 uppercase tracking-widest bg-amber-50 inline-block px-2 py-1 rounded">
                                    {userRole === 'ADMIN' ? 'Mode Administrateur' : 'Mode Responsable'}
                                </p>
                            ) : (
                                <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Espace Consultant</p>
                            )}
                        </div>
                        <div className="bg-blue-50 text-[#003366] px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border border-blue-100">
                            <Clock size={16} /> En attente validation
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* --- ZONE DYNAMIQUE : SÉLECTION DU CONSULTANT --- */}
                        {isDelegue && (
                            <div className="bg-[#f8fafc] p-5 rounded-2xl border border-dashed border-gray-300">
                                <label className="text-[11px] font-black text-[#003366] uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <UserCheck size={16} color="#C5A059"/> Saisir pour le compte de :
                                </label>
                                <select
                                    className="w-full p-4 bg-white border border-gray-200 rounded-xl font-bold text-[#003366] outline-none focus:ring-2 focus:ring-[#C5A059] shadow-sm cursor-pointer"
                                    value={targetConsultantId}
                                    onChange={(e) => setTargetConsultantId(e.target.value)}
                                >
                                    <option value="">-- Sélectionner un collaborateur dans la liste --</option>
                                    {consultants.map(c => (
                                        <option key={c.id} value={c.id}>{c.nom} {c.prenom} - {c.cabinet?.nom}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* DATES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <CalendarIcon size={14} color="#003366"/> Du (Inclus)
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-[#003366] focus:ring-2 focus:ring-[#C5A059] outline-none shadow-sm"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <ArrowRight size={14} color="#003366"/> Au (Inclus)
                                </label>
                                <input
                                    type="date"
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-[#003366] focus:ring-2 focus:ring-[#C5A059] outline-none shadow-sm"
                                    value={endDate}
                                    min={startDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* MOTIF (Boutons avec styles forcés) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Motif</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {['Congé Annuel', 'Maladie', 'Récupération', 'Sans Solde'].map((type) => {
                                    const isActive = motif === type;
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setMotif(type)}
                                            style={{
                                                backgroundColor: isActive ? '#003366' : 'white',
                                                color: isActive ? 'white' : '#6b7280',
                                                border: isActive ? '2px solid #003366' : '1px solid #e5e7eb',
                                                padding: '12px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: isActive ? '0 4px 6px rgba(0, 51, 102, 0.2)' : 'none'
                                            }}
                                        >
                                            {type}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* DESCRIPTION */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14} /> Description (Optionnel)
                            </label>
                            <textarea
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-[#003366] focus:ring-2 focus:ring-[#C5A059] outline-none min-h-[80px]"
                                placeholder="Commentaire..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* RÉSUMÉ & VALIDATION */}
                        <div className="pt-4 border-t border-gray-100">
                            {/* Carte résumé calculée */}
                            <div className="mb-6 flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex items-center gap-3">
                                    <div style={{ backgroundColor: '#003366', color: 'white', padding: '10px', borderRadius: '10px' }}>
                                        <Calculator size={20} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-blue-800 uppercase">Durée (Ouvrable)</div>
                                        <div className="text-xl font-black text-[#003366]">
                                            {duration} Jour{duration > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-gray-500">Retour prévu le</div>
                                    <div className="text-sm font-bold text-[#003366]">
                                        {endDate || startDate ? new Date(new Date(endDate || startDate).getTime() + 86400000).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            </div>

                            {status && (
                                <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 text-xs font-bold animate-pulse ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                    {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                    {status.message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !startDate || duration === 0}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#003366',
                                    color: 'white',
                                    padding: '16px',
                                    borderRadius: '16px',
                                    fontWeight: '900',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    cursor: (loading || !startDate || duration === 0) ? 'not-allowed' : 'pointer',
                                    opacity: (loading || !startDate || duration === 0) ? 0.5 : 1,
                                    border: 'none',
                                    boxShadow: '0 4px 14px 0 rgba(0,51,102,0.39)'
                                }}
                            >
                                {loading ? "Envoi en cours..." : <><Send size={18} /> CONFIRMER LA DEMANDE ({duration}j)</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AbsenceForm;