import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { Check, X, Clock, User, Calendar, Coffee, Loader2 } from 'lucide-react';

const AbsenceValidation = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/absences/pending');
            setRequests(res.data);
        } catch (err) { console.error("Erreur chargement demandes", err); }
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleAction = async (id, status) => {
        try {
            // Met à jour le statut (VALIDE / REJETE)
            await api.put(`/admin/absences/${id}/status`, { statut: status });
            fetchRequests(); // Rafraîchir la liste
        } catch (err) { alert("Erreur lors de la validation"); }
    };

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-[#003366]" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-black text-[#003366] uppercase tracking-tighter flex items-center gap-3">
                    <Coffee color="#C5A059" /> Validation des Absences
                </h2>
                <span className="bg-amber-100 text-amber-700 px-4 py-1 rounded-full text-[10px] font-black uppercase">
                    {requests.length} en attente
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {requests.length === 0 ? (
                    <div className="text-center p-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 font-bold italic">
                        Aucune demande de congé en attente de validation.
                    </div>
                ) : requests.map((req) => (
                    <div key={req.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                        <div className="flex items-center gap-6">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <User size={24} color="#003366" />
                            </div>
                            <div>
                                <h4 className="font-black text-[#003366] uppercase text-sm">
                                    {req.consultant?.nom} {req.consultant?.prenom}
                                </h4>
                                <div className="flex items-center gap-4 mt-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(req.date).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1 text-[#C5A059]"><Clock size={12}/> {req.motif}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => handleAction(req.id, 'REJETE')}
                                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-100"
                                title="Rejeter"
                            >
                                <X size={20} />
                            </button>
                            <button
                                onClick={() => handleAction(req.id, 'VALIDE')}
                                className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all border border-green-100"
                                title="Valider"
                            >
                                <Check size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AbsenceValidation;