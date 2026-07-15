import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { ClipboardCheck, Check, X, ChevronDown, ChevronUp, Loader2, Inbox } from 'lucide-react';

const CDG_BLUE = '#003366';
const CDG_GREEN = '#008858';

const RapportActiviteValidation = () => {
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(null); // clé id ouverte
    const [busyId, setBusyId] = useState(null);
    const [message, setMessage] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        api.get('/admin/rapports/pending')
            .then((res) => setPending(res.data || []))
            .catch(() => setMessage({ type: 'error', text: 'Erreur de chargement des rapports.' }))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const valider = (ra) => {
        setBusyId(ra.id);
        api.put(`/admin/rapports/${ra.id}/valider`)
            .then(() => { setMessage({ type: 'success', text: `RA de ${ra.consultantNom} (${ra.moisLabel}) validé.` }); load(); })
            .catch(() => setMessage({ type: 'error', text: 'Échec de la validation.' }))
            .finally(() => setBusyId(null));
    };

    const rejeter = (ra) => {
        const motif = window.prompt('Motif du rejet :', '');
        if (motif === null) return;
        setBusyId(ra.id);
        api.put(`/admin/rapports/${ra.id}/rejeter`, null, { params: { motif } })
            .then(() => { setMessage({ type: 'success', text: `RA de ${ra.consultantNom} rejeté.` }); load(); })
            .catch(() => setMessage({ type: 'error', text: 'Échec du rejet.' }))
            .finally(() => setBusyId(null));
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-black flex items-center gap-3" style={{ color: CDG_BLUE }}>
                    <ClipboardCheck size={26} style={{ color: CDG_GREEN }} />
                    Validation des Rapports d'Activité
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Rapports soumis par les consultants, en attente de validation.
                </p>
            </div>

            {message && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${
                    message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                    <Loader2 className="animate-spin mx-auto mb-2" /> Chargement…
                </div>
            ) : pending.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                    <Inbox size={40} className="mx-auto mb-3 opacity-30" />
                    Aucun rapport d'activité en attente.
                </div>
            ) : (
                <div className="space-y-3">
                    {pending.map((ra) => {
                        const open = expanded === ra.id;
                        return (
                            <div key={ra.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="flex items-center justify-between gap-4 p-4">
                                    <button
                                        onClick={() => setExpanded(open ? null : ra.id)}
                                        className="flex items-center gap-3 text-left flex-1 bg-transparent border-none cursor-pointer"
                                    >
                                        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        <div>
                                            <div className="font-black text-sm" style={{ color: CDG_BLUE }}>
                                                {ra.consultantNom} · {ra.moisLabel}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                BC {ra.referenceBC} · <span style={{ color: CDG_GREEN }} className="font-bold">{ra.totalJH} JH</span>
                                            </div>
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => valider(ra)}
                                            disabled={busyId === ra.id}
                                            className="flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                                            style={{ backgroundColor: CDG_GREEN }}
                                        >
                                            <Check size={14} /> Valider
                                        </button>
                                        <button
                                            onClick={() => rejeter(ra)}
                                            disabled={busyId === ra.id}
                                            className="flex items-center gap-1.5 text-red-600 border border-red-200 bg-red-50 text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                        >
                                            <X size={14} /> Rejeter
                                        </button>
                                    </div>
                                </div>

                                {open && (
                                    <div className="border-t border-gray-50 p-5 bg-gray-50/50 space-y-4">
                                        {/* Activités */}
                                        {(ra.groupes || []).length === 0 ? (
                                            <p className="text-sm text-gray-400">Aucune activité validée.</p>
                                        ) : (
                                            (ra.groupes || []).map((g, gi) => (
                                                <div key={gi} className="bg-white rounded-xl border border-gray-100 p-3">
                                                    <div className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: CDG_BLUE }}>
                                                        {g.nature} — {g.totalJH} JH
                                                    </div>
                                                    <table className="w-full text-xs">
                                                        <tbody>
                                                            {(g.lignes || []).map((l, li) => (
                                                                <tr key={li} className="border-t border-gray-50">
                                                                    <td className="py-1.5 pr-2">{l.description}</td>
                                                                    <td className="py-1.5 px-2 text-gray-400">{l.ticketJira || ''}</td>
                                                                    <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">{l.jh} JH</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))
                                        )}

                                        {/* Narratif */}
                                        {[['Synthèse du mois', ra.syntheseMois],
                                          ['Faits marquants', ra.faitsMarquants],
                                          ['Perspectives', ra.perspectives]].map(([label, val]) => (
                                            <div key={label}>
                                                <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">{label}</div>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{val || <span className="text-gray-300">—</span>}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RapportActiviteValidation;
