import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { generateRaPDF } from '../utils/raPdfGenerator';
import {
    ClipboardList,
    Download,
    Calendar,
    AlertCircle,
    Loader2,
    Save,
    Send,
    CheckCircle2,
} from 'lucide-react';

const CDG_BLUE = '#003366';
const CDG_GREEN = '#008858';

// Style d'un badge selon le statut du rapport
const styleStatut = (statut) => {
    switch (statut) {
        case 'VALIDE':
            return { bg: '#dcfce7', fg: '#15803d', label: 'Validé' };
        case 'REJETE':
            return { bg: '#fee2e2', fg: '#b91c1c', label: 'Rejeté' };
        case 'EN_ATTENTE':
            return { bg: '#fef9c3', fg: '#854d0e', label: 'En attente' };
        case 'BROUILLON':
            return { bg: '#e2e8f0', fg: '#475569', label: 'Brouillon' };
        default:
            return { bg: '#f1f5f9', fg: '#64748b', label: 'Nouveau' };
    }
};

const RapportActivite = ({ userRole, userId }) => {
    const isAdmin = userRole === 'ADMIN';
    const currentYear = new Date().getFullYear();

    const [annee, setAnnee] = useState(currentYear);
    const [consultants, setConsultants] = useState([]);
    const [consultantId, setConsultantId] = useState(isAdmin ? '' : userId);

    const [disponibles, setDisponibles] = useState([]);
    const [selection, setSelection] = useState(null); // { bcId, mois }
    const [ra, setRa] = useState(null);

    // État local éditable de la partie narrative
    const [syntheseMois, setSyntheseMois] = useState('');
    const [faitsMarquants, setFaitsMarquants] = useState('');
    const [perspectives, setPerspectives] = useState('');

    const [loadingList, setLoadingList] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const readOnly = ra?.statut === 'VALIDE';

    // Charger la liste des consultants (admin uniquement)
    useEffect(() => {
        if (!isAdmin) return;
        api.get('/admin/consultants')
            .then((res) => setConsultants(res.data || []))
            .catch(() => setError("Impossible de charger la liste des consultants."));
    }, [isAdmin]);

    // Charger les RA disponibles (BC × mois avec présence validée)
    const loadDisponibles = useCallback(() => {
        if (!consultantId) { setDisponibles([]); return; }
        setLoadingList(true);
        setError('');
        api.get('/reports/rpi/disponibles', { params: { consultantId, annee } })
            .then((res) => setDisponibles(res.data || []))
            .catch(() => setError("Erreur lors du chargement des rapports disponibles."))
            .finally(() => setLoadingList(false));
    }, [consultantId, annee]);

    useEffect(() => {
        setSelection(null);
        setRa(null);
        loadDisponibles();
    }, [loadDisponibles]);

    // Charger le détail d'un RA sélectionné
    const loadDetail = useCallback(() => {
        if (!selection || !consultantId) { setRa(null); return; }
        setLoadingDetail(true);
        setError('');
        api.get('/rapports/activite', {
            params: { consultantId, bcId: selection.bcId, annee, mois: selection.mois },
        })
            .then((res) => {
                const dto = res.data;
                setRa(dto);
                setSyntheseMois(dto?.syntheseMois || '');
                setFaitsMarquants(dto?.faitsMarquants || '');
                setPerspectives(dto?.perspectives || '');
            })
            .catch(() => setError("Erreur lors de la génération du rapport d'activité."))
            .finally(() => setLoadingDetail(false));
    }, [selection, consultantId, annee]);

    useEffect(() => {
        setSuccess('');
        loadDetail();
    }, [loadDetail]);

    // Enregistrer / soumettre le rapport
    const enregistrer = (statut) => {
        if (!ra || !selection || !consultantId) return;
        if (statut === 'SOUMIS' && !window.confirm(
            "Confirmez-vous la soumission de ce rapport d'activité pour validation ?"
        )) return;

        setSaving(true);
        setError('');
        setSuccess('');
        api.post('/rapports/activite', {
            consultantId,
            bcId: selection.bcId,
            annee,
            mois: selection.mois,
            syntheseMois,
            faitsMarquants,
            perspectives,
            statut,
        })
            .then(() => {
                setSuccess(statut === 'SOUMIS'
                    ? 'Rapport soumis avec succès.'
                    : 'Brouillon enregistré avec succès.');
                loadDetail();
                loadDisponibles();
            })
            .catch(() => setError("Erreur lors de l'enregistrement du rapport."))
            .finally(() => setSaving(false));
    };

    const exporterPDF = () => {
        if (!ra) return;
        generateRaPDF({ ...ra, syntheseMois, faitsMarquants, perspectives });
    };

    const annees = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-black flex items-center gap-3" style={{ color: CDG_BLUE }}>
                    <ClipboardList size={26} style={{ color: CDG_GREEN }} />
                    Rapports d'Activité
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Généré depuis vos saisies validées, cohérent avec le RPI (même total JH).
                </p>
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-end gap-4">
                {isAdmin && (
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Consultant</label>
                        <select
                            value={consultantId}
                            onChange={(e) => setConsultantId(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold min-w-[220px]"
                        >
                            <option value="">— Sélectionner —</option>
                            {consultants.map((c) => (
                                <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Année</label>
                    <select
                        value={annee}
                        onChange={(e) => setAnnee(parseInt(e.target.value, 10))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold"
                    >
                        {annees.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
            </div>

            {error && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {success && (
                <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-semibold">
                    <CheckCircle2 size={16} /> {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Liste des RA disponibles */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <h2 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-3">
                            Rapports disponibles {loadingList && <Loader2 className="inline animate-spin" size={12} />}
                        </h2>
                        {(!consultantId) ? (
                            <p className="text-sm text-gray-400 py-6 text-center">Sélectionnez un consultant.</p>
                        ) : disponibles.length === 0 && !loadingList ? (
                            <p className="text-sm text-gray-400 py-6 text-center">
                                Aucune présence validée pour {annee}.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {disponibles.map((d) => {
                                    const active = selection && selection.bcId === d.bcId && selection.mois === d.mois;
                                    return (
                                        <button
                                            key={`${d.bcId}-${d.mois}`}
                                            onClick={() => setSelection({ bcId: d.bcId, mois: d.mois })}
                                            className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                                                active
                                                    ? 'border-transparent text-white shadow-md'
                                                    : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                                            }`}
                                            style={active ? { backgroundColor: CDG_BLUE } : {}}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-sm flex items-center gap-2">
                                                    <Calendar size={14} /> {d.moisLabel}
                                                </span>
                                                <span className={`text-xs font-black ${active ? 'text-white' : ''}`}
                                                      style={active ? {} : { color: CDG_GREEN }}>
                                                    {d.consommeMois} JH
                                                </span>
                                            </div>
                                            <div className={`text-[11px] mt-0.5 ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                                                BC {d.referenceBC}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Détail du RA */}
                <div className="lg:col-span-2">
                    {loadingDetail ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                            <Loader2 className="animate-spin mx-auto mb-2" /> Génération du rapport…
                        </div>
                    ) : !ra ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
                            Sélectionnez un rapport dans la liste pour l'afficher.
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* En-tête RA */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <div className="text-lg font-black" style={{ color: CDG_BLUE }}>
                                        {ra.moisLabel}
                                    </div>
                                    <div className="text-sm text-gray-500 font-semibold">
                                        {ra.consultantNom} · BC {ra.referenceBC}
                                        {ra.designationBC ? ` — ${ra.designationBC}` : ''}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(() => {
                                        const s = styleStatut(ra.statut);
                                        return (
                                            <span className="text-xs font-black px-3 py-1.5 rounded-lg"
                                                  style={{ backgroundColor: s.bg, color: s.fg }}>
                                                {s.label}
                                            </span>
                                        );
                                    })()}
                                    <span className="text-xs font-black px-3 py-1.5 rounded-lg"
                                          style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                                        Total {ra.totalJH} JH · cohérent RPI ✓
                                    </span>
                                </div>
                            </div>

                            {/* Alerte de rejet */}
                            {ra.statut === 'REJETE' && ra.motifRejet && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-black">Motif du rejet : </span>
                                        {ra.motifRejet}
                                    </div>
                                </div>
                            )}

                            {/* Activités (lecture seule) */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                                <h3 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-4">
                                    Activités validées
                                </h3>
                                {(!ra.groupes || ra.groupes.length === 0) ? (
                                    <p className="text-sm text-gray-400 py-4 text-center">
                                        Aucune activité validée pour ce mois/BC.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {ra.groupes.map((g, gi) => (
                                            <div key={gi} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="font-black text-sm" style={{ color: CDG_BLUE }}>
                                                        {g.nature}
                                                    </span>
                                                    <span className="text-xs font-black" style={{ color: CDG_GREEN }}>
                                                        {g.totalJH} JH
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm border-collapse">
                                                        <thead>
                                                            <tr>
                                                                <th className="text-left text-[10px] uppercase font-black text-gray-400 py-1.5 px-2">Description</th>
                                                                <th className="text-left text-[10px] uppercase font-black text-gray-400 py-1.5 px-2">Type</th>
                                                                <th className="text-left text-[10px] uppercase font-black text-gray-400 py-1.5 px-2">Ticket Jira</th>
                                                                <th className="text-right text-[10px] uppercase font-black text-gray-400 py-1.5 px-2">JH</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(g.lignes || []).map((l, li) => (
                                                                <tr key={li} className="border-t border-gray-100">
                                                                    <td className="py-2 px-2 font-semibold text-gray-700">{l.description}</td>
                                                                    <td className="py-2 px-2 text-gray-500">{l.typePrestation || '—'}</td>
                                                                    <td className="py-2 px-2 text-gray-500">{l.ticketJira || '—'}</td>
                                                                    <td className="py-2 px-2 text-right font-black" style={{ color: CDG_BLUE }}>{l.jh}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Narratif éditable */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs uppercase font-black text-gray-400 tracking-wider">
                                        Commentaires
                                    </h3>
                                    {readOnly && (
                                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Rapport validé — lecture seule
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Synthèse du mois</label>
                                    <textarea
                                        value={syntheseMois}
                                        onChange={(e) => setSyntheseMois(e.target.value)}
                                        disabled={readOnly}
                                        rows={4}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Résumé des activités réalisées durant le mois…"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Faits marquants</label>
                                    <textarea
                                        value={faitsMarquants}
                                        onChange={(e) => setFaitsMarquants(e.target.value)}
                                        disabled={readOnly}
                                        rows={3}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Points saillants, réalisations, incidents notables…"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Perspectives</label>
                                    <textarea
                                        value={perspectives}
                                        onChange={(e) => setPerspectives(e.target.value)}
                                        disabled={readOnly}
                                        rows={3}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                                        placeholder="Actions prévues pour la période suivante…"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                    <button
                                        onClick={() => enregistrer('BROUILLON')}
                                        disabled={readOnly || saving}
                                        className="flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Enregistrer le brouillon
                                    </button>
                                    <button
                                        onClick={() => enregistrer('SOUMIS')}
                                        disabled={readOnly || saving}
                                        className="flex items-center gap-2 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ backgroundColor: CDG_BLUE }}
                                    >
                                        <Send size={16} /> Soumettre
                                    </button>
                                    <button
                                        onClick={exporterPDF}
                                        className="flex items-center gap-2 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md hover:opacity-90 transition-all ml-auto"
                                        style={{ backgroundColor: CDG_GREEN }}
                                    >
                                        <Download size={16} /> Exporter en PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RapportActivite;
