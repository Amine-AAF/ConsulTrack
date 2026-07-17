import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { generateRpiPDF } from '../utils/rpiPdfGenerator';
import RaSaisieSection from './RaSaisieSection.jsx';
import {
    FileText,
    Download,
    Calendar,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import {
    PageHeader,
    StatCard,
    Button,
    Tabs,
    StatusBadge,
    Card,
    COLORS,
} from './ui/index.jsx';

const fmt = (n) => (n == null ? '0' : (Number.isInteger(n) ? String(n) : Number(n).toFixed(1)));
const dayNum = (dateStr) => (dateStr ? parseInt(dateStr.slice(8, 10), 10) : '');

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Style d'une case jour de la grille hebdomadaire. */
const styleJour = (type) => {
    switch (type) {
        case 'PRESENCE': return { backgroundColor: COLORS.blue, color: '#fff' };
        case 'ABSENCE': return { backgroundColor: '#fee2e2', color: COLORS.red };
        case 'FERIE': return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
        case 'WEEKEND': return { backgroundColor: '#e2e8f0', color: '#94a3b8' };
        case 'HORS_MOIS': return { backgroundColor: '#f8fafc', color: '#cbd5e1' };
        default: return { backgroundColor: '#fff', color: '#94a3b8' }; // VIDE
    }
};

const contenuJour = (j) => {
    switch (j?.type) {
        case 'PRESENCE': return fmt(j.valeur);
        case 'ABSENCE': return 'ABS';
        case 'FERIE': return 'JF';
        default: return '';
    }
};

const Documents = ({ userRole, userId }) => {
    const isConsultant = userRole === 'CONSULTANT';
    const currentYear = new Date().getFullYear();

    // ---- Filtres ----
    const [annee, setAnnee] = useState(currentYear);
    const [consultants, setConsultants] = useState([]);
    const [consultantId, setConsultantId] = useState(isConsultant ? userId : '');

    // ---- Liste des mois disponibles ----
    const [mois, setMois] = useState([]); // [{mois, moisLabel, totalJH, nbBcs, statutMois}]
    const [selectedMois, setSelectedMois] = useState(null);

    // ---- Onglets & détails ----
    const [tab, setTab] = useState('rpi');
    const [rpi, setRpi] = useState(null);

    // ---- États UI ----
    const [loadingList, setLoadingList] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState('');

    // Liste des consultants (ADMIN / RESPONSABLE)
    useEffect(() => {
        if (isConsultant) return;
        api.get('/admin/consultants')
            // Comptes inactifs (mission terminée) exclus du sélecteur
            .then((res) => setConsultants((res.data || []).filter((c) => c.actif !== false)))
            .catch(() => setError('Impossible de charger la liste des consultants.'));
    }, [isConsultant]);

    // Mois disponibles
    const loadMois = useCallback(() => {
        if (!consultantId) { setMois([]); return; }
        setLoadingList(true);
        setError('');
        api.get('/reports/rpi/disponibles', { params: { consultantId, annee } })
            .then((res) => setMois(res.data || []))
            .catch(() => setError('Erreur lors du chargement des mois disponibles.'))
            .finally(() => setLoadingList(false));
    }, [consultantId, annee]);

    useEffect(() => {
        setSelectedMois(null);
        setRpi(null);
        loadMois();
    }, [loadMois]);

    // Détail RPI
    const loadRpi = useCallback(() => {
        if (!selectedMois || !consultantId) { setRpi(null); return; }
        setLoadingDetail(true);
        setError('');
        api.get('/reports/rpi-mensuel', { params: { consultantId, annee, mois: selectedMois } })
            .then((res) => setRpi(res.data))
            .catch(() => setError('Erreur lors de la génération du RPI.'))
            .finally(() => setLoadingDetail(false));
    }, [selectedMois, consultantId, annee]);

    useEffect(() => {
        if (tab === 'rpi') loadRpi();
    }, [tab, loadRpi]);

    const annees = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

    // ================================================================
    // Rendu de l'onglet RPI
    // ================================================================
    const renderRpi = () => {
        if (!rpi) return null;
        const totaux = rpi.totauxAnnuels;
        return (
            <div className="space-y-5">
                {/* En-tête */}
                <Card className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="text-lg font-black flex items-center gap-3" style={{ color: COLORS.blue }}>
                            {rpi.moisLabel} <StatusBadge statut={rpi.statutMois} />
                        </div>
                        <div className="text-sm text-gray-500 font-semibold mt-1">
                            {rpi.consultantNom} · {rpi.cabinetNom}
                            {rpi.mission ? ` — ${rpi.mission}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 font-semibold mt-0.5">
                            Période : du {rpi.periodeDu} au {rpi.periodeAu}
                        </div>
                    </div>
                    <Button onClick={() => generateRpiPDF(rpi)}>
                        <Download size={16} /> Exporter PDF
                    </Button>
                </Card>

                {/* Totaux */}
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Total JH (Mtd)" value={fmt(rpi.totalMtd)} accent={COLORS.green} />
                    <StatCard label="Total JH (Std)" value={fmt(rpi.totalStd)} />
                </div>

                {/* Bons de commande */}
                <Card>
                    <h3 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-3">
                        Bons de commande
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left text-[10px] uppercase font-black text-gray-400 py-2 px-2">Référence</th>
                                    <th className="text-right text-[10px] uppercase font-black text-gray-400 py-2 px-2">JH</th>
                                    <th className="text-right text-[10px] uppercase font-black text-gray-400 py-2 px-2">Reliquat</th>
                                    <th className="text-right text-[10px] uppercase font-black text-gray-400 py-2 px-2">Consommé</th>
                                    <th className="text-right text-[10px] uppercase font-black text-gray-400 py-2 px-2">JH Restant</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(rpi.bcs || []).map((b) => (
                                    <tr key={b.bcId} className="border-t border-gray-50">
                                        <td className="py-2 px-2 font-bold" style={{ color: COLORS.blue }}>{b.reference}</td>
                                        <td className="py-2 px-2 text-right font-semibold">{fmt(b.jhBudget)}</td>
                                        <td className="py-2 px-2 text-right font-black" style={{ color: COLORS.green }}>{fmt(b.reliquatAvant)}</td>
                                        <td className="py-2 px-2 text-right font-semibold">{fmt(b.consommeMois)}</td>
                                        <td className="py-2 px-2 text-right font-black" style={{ color: COLORS.red }}>{fmt(b.jhRestant)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Grilles hebdomadaires */}
                <Card>
                    <h3 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-4">
                        Détail hebdomadaire
                    </h3>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {(rpi.semaines || []).map((s, si) => (
                            <div key={si} className="border border-gray-100 rounded-xl p-3">
                                <div className="text-xs font-black mb-2" style={{ color: COLORS.blue }}>
                                    Semaine du {s.du} au {s.au}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr>
                                                {(s.jours || []).map((j, ji) => (
                                                    <th key={ji} className="text-center text-[10px] font-black text-gray-400 py-1 px-1">
                                                        {DAY_LABELS[ji] || ''}
                                                        <span className="block text-[9px] font-bold text-gray-300">{dayNum(j.date)}</span>
                                                    </th>
                                                ))}
                                                <th className="text-center text-[10px] font-black text-gray-400 py-1 px-1">Total</th>
                                                <th className="text-center text-[10px] font-black py-1 px-1" style={{ color: COLORS.green }}>Total (Mtd)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                {(s.jours || []).map((j, ji) => (
                                                    <td key={ji} className="py-1 px-0.5 text-center">
                                                        <div
                                                            className="mx-auto rounded-md font-bold flex items-center justify-center border border-gray-100"
                                                            style={{ ...styleJour(j.type), width: '32px', height: '32px' }}
                                                            title={`${j.jourSemaine || ''} ${j.date || ''}${j.bcReference ? ' · ' + j.bcReference : ''}`}
                                                        >
                                                            {contenuJour(j)}
                                                        </div>
                                                    </td>
                                                ))}
                                                <td className="py-1 px-1 text-center font-black">{fmt(s.totalSemaine)}</td>
                                                <td className="py-1 px-1 text-center font-black" style={{ color: COLORS.green }}>{fmt(s.totalMtd)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Légende */}
                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: COLORS.blue }} /> Présence</span>
                        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#fee2e2' }} /> Absence</span>
                        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#dbeafe' }} /> Jour férié</span>
                        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#e2e8f0' }} /> Week-end</span>
                        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded border border-gray-200" style={{ background: '#fff' }} /> Non saisi</span>
                        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded" style={{ background: '#f8fafc' }} /> Hors mois</span>
                    </div>
                </Card>

                {/* Historique annuel */}
                <Card>
                    <h3 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-3">
                        Historique des relevés de l'année {rpi.annee}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left text-[10px] uppercase font-black text-gray-400 py-2 px-2">BDC</th>
                                    <th className="text-right text-[10px] uppercase font-black text-gray-400 py-2 px-2">Jours BDC</th>
                                    <th className="text-right text-[10px] uppercase font-black text-gray-400 py-2 px-2">Consommé</th>
                                    <th className="text-right text-[10px] uppercase font-black text-gray-400 py-2 px-2">Restants</th>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <th key={i} className="text-center text-[10px] font-black py-2 px-1" style={{ color: COLORS.red }}>{i + 1}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(rpi.historiqueAnnuel || []).map((h, hi) => (
                                    <tr key={hi} className="border-t border-gray-50">
                                        <td className="py-2 px-2 font-bold" style={{ color: COLORS.blue }}>{h.reference}</td>
                                        <td className="py-2 px-2 text-right font-semibold">{fmt(h.joursBdc)}</td>
                                        <td className="py-2 px-2 text-right font-semibold">{fmt(h.totalConsomme)}</td>
                                        <td className="py-2 px-2 text-right font-black" style={{ color: COLORS.red }}>{fmt(h.joursRestants)}</td>
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const v = (h.parMois || [])[i];
                                            return (
                                                <td key={i} className="py-2 px-1 text-center text-gray-600">
                                                    {v ? fmt(v) : ''}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {totaux && (
                                    <tr className="border-t-2 border-gray-200 font-black" style={{ color: COLORS.blue }}>
                                        <td className="py-2 px-2">Totaux</td>
                                        <td className="py-2 px-2 text-right">{fmt(totaux.joursBdc)}</td>
                                        <td className="py-2 px-2 text-right">{fmt(totaux.totalConsomme)}</td>
                                        <td className="py-2 px-2 text-right" style={{ color: COLORS.red }}>{fmt(totaux.joursRestants)}</td>
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const v = (totaux.parMois || [])[i];
                                            return (
                                                <td key={i} className="py-2 px-1 text-center">
                                                    {v ? fmt(v) : ''}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    };

    // ================================================================
    return (
        <div>
            <PageHeader
                icon={FileText}
                title="Documents (RPI & Rapports d'Activité)"
                subtitle="Relevés Périodiques d'Intervention et Rapports d'Activité générés depuis les saisies validées."
            />

            {/* Filtres */}
            <Card className="mb-6 flex flex-wrap items-end gap-4 !p-4">
                {!isConsultant && (
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
            </Card>

            {error && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Liste des mois */}
                <div className="lg:col-span-1">
                    <Card className="!p-4">
                        <h2 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-3">
                            Mois disponibles {loadingList && <Loader2 className="inline animate-spin" size={12} />}
                        </h2>
                        {(!consultantId) ? (
                            <p className="text-sm text-gray-400 py-6 text-center">Sélectionnez un consultant.</p>
                        ) : mois.length === 0 && !loadingList ? (
                            <p className="text-sm text-gray-400 py-6 text-center">
                                Aucune saisie validée pour {annee}.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {mois.map((m) => {
                                    const active = selectedMois === m.mois;
                                    return (
                                        <button
                                            key={m.mois}
                                            onClick={() => setSelectedMois(m.mois)}
                                            className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                                                active
                                                    ? 'border-transparent text-white shadow-md'
                                                    : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                                            }`}
                                            style={active ? { backgroundColor: COLORS.blue } : {}}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-sm flex items-center gap-2">
                                                    <Calendar size={14} /> {m.moisLabel}
                                                </span>
                                                <StatusBadge statut={m.statutMois} />
                                            </div>
                                            <div className={`text-[11px] mt-1 font-semibold ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                                                {fmt(m.totalJH)} JH · {m.nbBcs} BC
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Détail du mois sélectionné */}
                <div className="lg:col-span-2">
                    {!selectedMois ? (
                        <Card className="!p-12 text-center text-gray-400">
                            <FileText size={40} className="mx-auto mb-3 opacity-30" />
                            Sélectionnez un mois dans la liste pour afficher ses documents.
                        </Card>
                    ) : (
                        <div>
                            <Tabs
                                tabs={[
                                    { key: 'rpi', label: 'RPI' },
                                    { key: 'ra', label: "Rapport d'Activité" },
                                ]}
                                active={tab}
                                onChange={setTab}
                            />
                            {tab === 'rpi' ? (
                                loadingDetail ? (
                                    <Card className="!p-12 text-center text-gray-400">
                                        <Loader2 className="animate-spin mx-auto mb-2" /> Chargement du document…
                                    </Card>
                                ) : renderRpi()
                            ) : (
                                <RaSaisieSection
                                    consultantId={consultantId}
                                    annee={annee}
                                    mois={selectedMois}
                                    onSaved={loadMois}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Documents;
