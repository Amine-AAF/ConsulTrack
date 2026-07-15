import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { generateRpiPDF } from '../utils/rpiPdfGenerator';
import { FileText, Download, Calendar, AlertCircle, Loader2 } from 'lucide-react';

const CDG_BLUE = '#003366';
const CDG_GREEN = '#008858';

// Couleur d'une case selon son type
const couleurJour = (type) => {
    switch (type) {
        case 'PRESENCE': return { bg: CDG_BLUE, fg: '#fff' };
        case 'ABSENCE': return { bg: '#fee2e2', fg: '#b91c1c' };
        case 'FERIE': return { bg: '#dcfce7', fg: '#15803d' };
        case 'AUTRE_BC': return { bg: '#fef9c3', fg: '#854d0e' };
        case 'WEEKEND': return { bg: '#e2e8f0', fg: '#94a3b8' };
        default: return { bg: '#f8fafc', fg: '#cbd5e1' }; // VIDE
    }
};

const contenuJour = (j) => {
    switch (j.type) {
        case 'PRESENCE': return `${j.valeur}`;
        case 'ABSENCE': return 'Abs';
        case 'FERIE': return 'Fér';
        case 'AUTRE_BC': return j.referenceBcSaisi || 'BC';
        default: return '';
    }
};

const StatCard = ({ label, value, unit = 'JH', accent }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{label}</div>
        <div className="text-2xl font-black mt-1" style={{ color: accent || CDG_BLUE }}>
            {value ?? '0'} <span className="text-sm font-bold text-gray-400">{unit}</span>
        </div>
    </div>
);

const Rpi = ({ userRole, userId }) => {
    const isAdmin = userRole === 'ADMIN';
    const currentYear = new Date().getFullYear();

    const [annee, setAnnee] = useState(currentYear);
    const [consultants, setConsultants] = useState([]);
    const [consultantId, setConsultantId] = useState(isAdmin ? '' : userId);

    const [disponibles, setDisponibles] = useState([]);
    const [selection, setSelection] = useState(null); // { bcId, mois }
    const [rpi, setRpi] = useState(null);

    const [loadingList, setLoadingList] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState('');

    // Charger la liste des consultants (admin uniquement)
    useEffect(() => {
        if (!isAdmin) return;
        api.get('/admin/consultants')
            .then((res) => setConsultants(res.data || []))
            .catch(() => setError("Impossible de charger la liste des consultants."));
    }, [isAdmin]);

    // Charger les RPI disponibles (BC × mois avec présence validée)
    const loadDisponibles = useCallback(() => {
        if (!consultantId) { setDisponibles([]); return; }
        setLoadingList(true);
        setError('');
        api.get('/reports/rpi/disponibles', { params: { consultantId, annee } })
            .then((res) => setDisponibles(res.data || []))
            .catch(() => setError("Erreur lors du chargement des RPI disponibles."))
            .finally(() => setLoadingList(false));
    }, [consultantId, annee]);

    useEffect(() => {
        setSelection(null);
        setRpi(null);
        loadDisponibles();
    }, [loadDisponibles]);

    // Charger le détail d'un RPI sélectionné
    useEffect(() => {
        if (!selection || !consultantId) { setRpi(null); return; }
        setLoadingDetail(true);
        setError('');
        api.get('/reports/rpi', {
            params: { consultantId, bcId: selection.bcId, annee, mois: selection.mois },
        })
            .then((res) => setRpi(res.data))
            .catch(() => setError("Erreur lors de la génération du RPI."))
            .finally(() => setLoadingDetail(false));
    }, [selection, consultantId, annee]);

    const annees = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-black flex items-center gap-3" style={{ color: CDG_BLUE }}>
                    <FileText size={26} style={{ color: CDG_GREEN }} />
                    Relevés de Prestation Individuels (RPI)
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Générés à partir des saisies <b>validées</b>, par Bon de Commande et par mois.
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Liste des RPI disponibles */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <h2 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-3">
                            RPI disponibles {loadingList && <Loader2 className="inline animate-spin" size={12} />}
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

                {/* Détail du RPI */}
                <div className="lg:col-span-2">
                    {loadingDetail ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                            <Loader2 className="animate-spin mx-auto mb-2" /> Génération du RPI…
                        </div>
                    ) : !rpi ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                            <FileText size={40} className="mx-auto mb-3 opacity-30" />
                            Sélectionnez un RPI dans la liste pour l'afficher.
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* En-tête RPI */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <div className="text-lg font-black" style={{ color: CDG_BLUE }}>
                                        {rpi.moisLabel}
                                    </div>
                                    <div className="text-sm text-gray-500 font-semibold">
                                        {rpi.consultantNom} · BC {rpi.referenceBC}
                                        {rpi.designationBC ? ` — ${rpi.designationBC}` : ''}
                                    </div>
                                </div>
                                <button
                                    onClick={() => generateRpiPDF(rpi)}
                                    className="flex items-center gap-2 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md hover:opacity-90 transition-all"
                                    style={{ backgroundColor: CDG_GREEN }}
                                >
                                    <Download size={16} /> Exporter en PDF
                                </button>
                            </div>

                            {/* Stats cumuls */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <StatCard label="Budget BC" value={rpi.jhBudgetBC} />
                                <StatCard label="Avant mois" value={rpi.jhAvantMois} />
                                <StatCard label="Consommé mois" value={rpi.consommeMois} accent={CDG_GREEN} />
                                <StatCard label="Cumul après" value={rpi.jhApresMois} />
                                <StatCard label="Reliquat" value={rpi.jhRestant} accent="#b91c1c" />
                            </div>

                            {/* Grille hebdomadaire */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="text-left text-[10px] uppercase font-black text-gray-400 py-2 px-2">Semaine</th>
                                            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((j) => (
                                                <th key={j} className="text-[10px] uppercase font-black text-gray-400 py-2 px-1 text-center">{j}</th>
                                            ))}
                                            <th className="text-[10px] uppercase font-black text-gray-400 py-2 px-2 text-right">Sem.</th>
                                            <th className="text-[10px] uppercase font-black text-gray-400 py-2 px-2 text-right">Mois</th>
                                            <th className="text-[10px] uppercase font-black py-2 px-2 text-right" style={{ color: CDG_BLUE }}>Cumul BC</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(rpi.semaines || []).map((s, idx) => (
                                            <tr key={idx} className="border-t border-gray-50">
                                                <td className="py-2 px-2 font-bold text-gray-600 whitespace-nowrap">{s.periode}</td>
                                                {(s.jours || []).slice(0, 5).map((j, i) => {
                                                    const c = couleurJour(j.type);
                                                    return (
                                                        <td key={i} className="py-1 px-1 text-center">
                                                            <div className="mx-auto rounded-md text-xs font-bold flex flex-col items-center justify-center"
                                                                 style={{ backgroundColor: c.bg, color: c.fg, width: '38px', height: '38px' }}
                                                                 title={`${j.jourSemaine} ${j.numeroJour}${j.typePrestation ? ' · ' + j.typePrestation : ''}`}>
                                                                <span className="text-[9px] opacity-70 leading-none">{j.numeroJour}</span>
                                                                <span className="leading-tight">{contenuJour(j)}</span>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-2 px-2 text-right font-bold">{s.totalSemaine} JH</td>
                                                <td className="py-2 px-2 text-right font-semibold" style={{ color: CDG_GREEN }}>{s.totalMtd} JH</td>
                                                <td className="py-2 px-2 text-right font-black" style={{ color: CDG_BLUE }}>{s.totalStd} JH</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Légende */}
                                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50 text-[11px] text-gray-500">
                                    <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: CDG_BLUE }} /> Présence</span>
                                    <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#fee2e2' }} /> Absence</span>
                                    <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#dcfce7' }} /> Férié</span>
                                    <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#fef9c3' }} /> Autre BC</span>
                                    <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#e2e8f0' }} /> Week-end</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Rpi;
