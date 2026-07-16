import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { Receipt, FileDown, AlertCircle, Building2 } from 'lucide-react';
import { PageHeader, Card, Button, COLORS } from './ui/index.jsx';
import { generatePrefacturePDF } from '../utils/facturePdfGenerator';

/* ============================================================
   Facturation mensuelle — pré-factures de réconciliation :
   agrégat des saisies VALIDÉES (mode BC) par cabinet /
   consultant / BC, à rapprocher des factures des cabinets.
   ============================================================ */

const MOIS_LABELS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const inputCls = 'p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#008858] bg-white font-bold';

const fmtJH = (n) => {
    const v = Number(n || 0);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
const fmtMAD = (n) => Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const NatureChip = ({ nature }) => {
    if (!nature) return <span className="text-gray-300">—</span>;
    return (
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
              style={nature === 'RUN'
                  ? { backgroundColor: '#e0e7ff', color: '#4338ca' }
                  : { backgroundColor: '#dcfce7', color: '#15803d' }}>
            {nature}
        </span>
    );
};

const Facturation = () => {
    const now = new Date();
    // Par défaut : mois précédent (facturation d'un mois clôturé)
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [annee, setAnnee] = useState(prev.getFullYear());
    const [mois, setMois] = useState(prev.getMonth() + 1);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const currentYear = now.getFullYear();
    const annees = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/admin/facturation?annee=${annee}&mois=${mois}`);
            setData(res.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors du chargement de la facturation.');
            setData([]);
        }
        setLoading(false);
    }, [annee, mois]);

    useEffect(() => { load(); }, [load]);

    const periodeLabel = `${MOIS_LABELS[mois - 1]} ${annee}`;

    return (
        <div className="mx-auto max-w-7xl p-4">
            <PageHeader
                icon={Receipt}
                title="Facturation"
                subtitle="Pré-factures mensuelles (saisies validées) — contrôle interne à rapprocher des factures des cabinets"
                actions={(
                    <div className="flex items-center gap-2">
                        <select className={inputCls} value={mois}
                                onChange={e => setMois(parseInt(e.target.value, 10))}>
                            {MOIS_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select className={inputCls} value={annee}
                                onChange={e => setAnnee(parseInt(e.target.value, 10))}>
                            {annees.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                )}
            />

            {error && (
                <div className="flex items-center gap-2 text-sm font-bold p-3 rounded-xl mb-4"
                     style={{ backgroundColor: '#fee2e2', color: COLORS.red }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {loading ? (
                <div className="text-center p-20 font-bold animate-pulse" style={{ color: COLORS.blue }}>
                    Chargement de la facturation...
                </div>
            ) : data.length === 0 ? (
                <Card className="text-center text-gray-400 italic p-10">
                    Aucune consommation validée pour {periodeLabel}.
                </Card>
            ) : (
                <div className="space-y-6">
                    {data.map(cab => (
                        <Card key={cab.cabinetId ?? 'sans-cabinet'}>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                         style={{ backgroundColor: '#eef4ff', color: COLORS.blue }}>
                                        <Building2 size={18} />
                                    </div>
                                    <div>
                                        <div className="font-black text-lg" style={{ color: COLORS.blue }}>
                                            {cab.cabinetNom}
                                        </div>
                                        <div className="text-xs font-bold text-gray-400">
                                            {periodeLabel} · {fmtJH(cab.totalJH)} JH ·{' '}
                                            <span style={{ color: COLORS.green }}>{fmtMAD(cab.totalMontant)} MAD</span>
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={() => generatePrefacturePDF(cab, periodeLabel)}>
                                    <FileDown size={16} /> Facture cabinet (PDF)
                                </Button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-left text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
                                        <th className="p-3">Consultant / Référence BC</th>
                                        <th className="p-3">Code budgétaire</th>
                                        <th className="p-3">Nature</th>
                                        <th className="p-3 text-right">JH</th>
                                        <th className="p-3 text-right">TJM (MAD)</th>
                                        <th className="p-3 text-right">Montant (MAD)</th>
                                        <th className="p-3 text-right">PDF</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                    {(cab.consultants || []).map(cons => (
                                        <React.Fragment key={cons.consultantId}>
                                            {(cons.lignes || []).map((l, i) => (
                                                <tr key={`${cons.consultantId}-${l.bcReference}-${i}`} className="hover:bg-gray-50">
                                                    <td className="p-3">
                                                        {i === 0 && (
                                                            <span className="font-black" style={{ color: COLORS.blue }}>
                                                                {cons.consultantNom}
                                                            </span>
                                                        )}
                                                        <span className={`font-mono text-gray-500 ${i === 0 ? 'ml-3' : ''}`}>
                                                            {l.bcReference || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-gray-500 font-mono">{l.codeBudget || '—'}</td>
                                                    <td className="p-3"><NatureChip nature={l.nature} /></td>
                                                    <td className="p-3 text-right font-bold">{fmtJH(l.jh)}</td>
                                                    <td className="p-3 text-right text-gray-500">{fmtMAD(l.tjm)}</td>
                                                    <td className="p-3 text-right font-bold">{fmtMAD(l.montant)}</td>
                                                    <td className="p-3"></td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50/70">
                                                <td className="p-3 font-black" style={{ color: COLORS.blue }} colSpan="3">
                                                    Sous-total {cons.consultantNom}
                                                </td>
                                                <td className="p-3 text-right font-black" style={{ color: COLORS.blue }}>
                                                    {fmtJH(cons.totalJH)}
                                                </td>
                                                <td className="p-3"></td>
                                                <td className="p-3 text-right font-black" style={{ color: COLORS.blue }}>
                                                    {fmtMAD(cons.totalMontant)}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex justify-end">
                                                        <Button variant="outline" className="!px-2.5 !py-1.5 text-xs"
                                                                title={`Pré-facture PDF — ${cons.consultantNom}`}
                                                                onClick={() => generatePrefacturePDF(cab, periodeLabel, cons)}>
                                                            <FileDown size={13} /> PDF
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                    <tr>
                                        <td className="p-3 font-black uppercase" style={{ color: COLORS.green }} colSpan="3">
                                            Total {cab.cabinetNom}
                                        </td>
                                        <td className="p-3 text-right font-black" style={{ color: COLORS.green }}>
                                            {fmtJH(cab.totalJH)}
                                        </td>
                                        <td className="p-3"></td>
                                        <td className="p-3 text-right font-black" style={{ color: COLORS.green }}>
                                            {fmtMAD(cab.totalMontant)}
                                        </td>
                                        <td className="p-3"></td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ))}

                    <p className="text-xs text-gray-400 italic text-center">
                        Document de contrôle interne — à rapprocher de la facture du cabinet.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Facturation;
