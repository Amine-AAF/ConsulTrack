import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axiosConfig';
import * as XLSX from 'xlsx';
import {
    LayoutDashboard, Users, Building2, Filter, Download,
    AlertTriangle, RefreshCw, AlertCircle, Search,
} from 'lucide-react';
import {
    PageHeader, StatCard, Card, BudgetGauge, Button, COLORS,
} from './ui/index.jsx';

/* ============================================================
   Tableau de bord — vue rôle-dépendante
   CONSULTANT : ses BC. RESPONSABLE : ses cabinets gérés.
   ADMIN : tous les cabinets + filtre.
   ============================================================ */

const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const pctBC = (row) => row.totalJoursBC > 0 ? (row.joursConsommesYTD / row.totalJoursBC) * 100 : 0;

/* --- Export Excel « Fiche de suivi BC » : une feuille par consultant --- */
const exportFicheSuiviExcel = (rows, annee) => {
    const byConsultant = rows.reduce((acc, r) => {
        const key = r.nomConsultant || 'Inconnu';
        (acc[key] = acc[key] || []).push(r);
        return acc;
    }, {});

    const wb = XLSX.utils.book_new();
    const usedNames = new Set();

    Object.entries(byConsultant).forEach(([consultant, bcRows]) => {
        const header = ['Réf BC', 'Description', 'Jours BDC', 'Total consommé', 'Jrs restants',
            ...Array.from({ length: 12 }, (_, i) => i + 1)];

        const dataRows = bcRows.map(r => [
            r.referenceBC,
            r.descriptionCodeBudgetaire || '',
            r.totalJoursBC ?? 0,
            r.joursConsommesYTD ?? 0,
            r.joursRestants ?? 0,
            ...Array.from({ length: 12 }, (_, m) => (r.mensuel?.[m] ?? 0)),
        ]);

        const totaux = ['Totaux', '',
            bcRows.reduce((s, r) => s + (r.totalJoursBC || 0), 0),
            bcRows.reduce((s, r) => s + (r.joursConsommesYTD || 0), 0),
            bcRows.reduce((s, r) => s + (r.joursRestants || 0), 0),
            ...Array.from({ length: 12 }, (_, m) =>
                bcRows.reduce((s, r) => s + (r.mensuel?.[m] || 0), 0)),
        ];

        const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows, totaux]);
        ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
            ...Array.from({ length: 12 }, () => ({ wch: 5 }))];

        // Nom de feuille : max 31 caractères, caractères interdits retirés, dédupliqué
        let name = consultant.replace(/[\\/?*[\]:]/g, ' ').trim().substring(0, 31) || 'Consultant';
        let base = name, i = 2;
        while (usedNames.has(name)) {
            const suffix = ` (${i++})`;
            name = base.substring(0, 31 - suffix.length) + suffix;
        }
        usedNames.add(name);
        XLSX.utils.book_append_sheet(wb, ws, name);
    });

    XLSX.writeFile(wb, `Fiche_suivi_BC_${annee}.xlsx`);
};

const Dashboard = ({ userRole = 'CONSULTANT', userId }) => {
    const isConsultant = userRole === 'CONSULTANT' || userRole === 'USER';
    const isAdmin = userRole === 'ADMIN';
    const isResponsable = userRole === 'RESPONSABLE';

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());
    const [me, setMe] = useState(null);            // pour RESPONSABLE (cabinetsGeres)
    const [cabinets, setCabinets] = useState([]);  // pour filtre ADMIN
    const [filterCabinet, setFilterCabinet] = useState('');
    const [filterConsultant, setFilterConsultant] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        let isMounted = true;
        const fetchAll = async () => {
            setLoading(true);
            try {
                const promises = [api.get(`/dashboard/report?annee=${year}`)];
                if (isResponsable) promises.push(api.get('/me'));
                if (isAdmin) promises.push(api.get('/admin/cabinets'));
                const results = await Promise.all(promises);

                let reportData = results[0].data || [];

                // 🔒 Filtrage consultant (conservé) : par consultantId si le DTO le fournit
                if (isConsultant) {
                    if (reportData.length > 0 && Object.prototype.hasOwnProperty.call(reportData[0], 'consultantId')) {
                        reportData = reportData.filter(d => d.consultantId === parseInt(userId));
                    } else {
                        console.warn("Attention: Filtrage par ID impossible, affichage complet par défaut (Risque sécurité)");
                    }
                }

                if (!isMounted) return;
                setData(reportData);
                if (isResponsable) setMe(results[1].data);
                if (isAdmin) setCabinets(results[1].data || []);
            } catch (error) {
                console.error('Erreur dashboard', error);
                if (isMounted) setData([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchAll();
        return () => { isMounted = false; };
    }, [year, userId, userRole]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Lignes visibles selon le rôle ---
    const scopedRows = useMemo(() => {
        let rows = data;
        if (isResponsable && me) {
            const noms = new Set((me.cabinetsGeres || []).map(c => c.nom));
            rows = rows.filter(r => noms.has(r.nomCabinet));
        }
        if (isAdmin && filterCabinet) {
            rows = rows.filter(r => r.nomCabinet === filterCabinet);
        }
        if (isAdmin && filterConsultant) {
            rows = rows.filter(r => r.nomConsultant === filterConsultant);
        }
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            rows = rows.filter(r =>
                (r.nomConsultant?.toLowerCase() || '').includes(q) ||
                (r.referenceBC?.toLowerCase() || '').includes(q));
        }
        return rows;
    }, [data, me, filterCabinet, filterConsultant, searchTerm, isResponsable, isAdmin]);

    // Options du filtre consultant (ADMIN) : noms dédupliqués issus du rapport
    const consultantOptions = useMemo(() =>
        [...new Set(data.map(r => r.nomConsultant).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b)),
    [data]);

    // --- KPI ---
    const kpi = useMemo(() => {
        const consultants = new Set(scopedRows.map(r => r.nomConsultant)).size;
        const totalJH = scopedRows.reduce((s, r) => s + (r.joursConsommesYTD || 0), 0);
        const montant = scopedRows.reduce((s, r) => s + (r.montantConsommeYTD || 0), 0);
        const alertes = scopedRows.filter(r => pctBC(r) >= 80).length;
        const totalBudget = scopedRows.reduce((s, r) => s + (r.totalJoursBC || 0), 0);
        return { consultants, totalJH, montant, alertes, totalBudget };
    }, [scopedRows]);

    const alertRows = useMemo(() => scopedRows.filter(r => pctBC(r) >= 80), [scopedRows]);

    // --- Groupement par cabinet (RESPONSABLE / ADMIN) ---
    const byCabinet = useMemo(() => {
        const groups = scopedRows.reduce((acc, r) => {
            const key = r.nomCabinet || 'Sans cabinet';
            (acc[key] = acc[key] || []).push(r);
            return acc;
        }, {});
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [scopedRows]);

    const yearOptions = [];
    for (let y = new Date().getFullYear() - 2; y <= new Date().getFullYear() + 1; y++) yearOptions.push(y);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]" style={{ color: COLORS.blue }}>
                <RefreshCw className="animate-spin mb-4" size={40} />
                <h2 className="font-black text-xl tracking-tight">Chargement des données...</h2>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl p-4">
            <PageHeader
                icon={LayoutDashboard}
                title={isConsultant ? 'Mon tableau de bord' : 'Pilotage des prestations'}
                subtitle={isConsultant
                    ? `Suivi de mes bons de commande — ${year}`
                    : `Consommation, facturation et alertes budgétaires — ${year}`}
                actions={
                    <>
                        {!isConsultant && (
                            <Button
                                variant="secondary"
                                onClick={() => exportFicheSuiviExcel(scopedRows, year)}
                                disabled={scopedRows.length === 0}
                            >
                                <Download size={16} /> Exporter Fiche de suivi (Excel)
                            </Button>
                        )}
                        <select
                            className="p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white outline-none cursor-pointer"
                            style={{ color: COLORS.blue }}
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value, 10))}
                        >
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </>
                }
            />

            {/* KPI */}
            {isConsultant ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Mes BC actifs" value={scopedRows.length} unit="" />
                    <StatCard label={`Enveloppe ${year}`} value={kpi.totalBudget.toLocaleString('fr-FR')} />
                    <StatCard label="JH consommés" value={kpi.totalJH.toLocaleString('fr-FR')} accent={COLORS.gold} />
                    <StatCard label="BC en alerte (≥80%)" value={kpi.alertes} unit="" alert={kpi.alertes > 0} />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Consultants" value={kpi.consultants} unit="" />
                    <StatCard label="JH consommés" value={kpi.totalJH.toLocaleString('fr-FR')} accent={COLORS.gold} />
                    <StatCard label="Montant facturable" value={kpi.montant.toLocaleString('fr-FR')} unit="MAD" accent={COLORS.green} />
                    <StatCard label="BC en alerte (≥80%)" value={kpi.alertes} unit="" alert={kpi.alertes > 0} />
                </div>
            )}

            {/* Filtres (ADMIN : cabinet + recherche ; RESPONSABLE : recherche) */}
            {!isConsultant && (
                <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <div className="flex-1 flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                        <Search size={16} className="text-gray-400" />
                        <input
                            className="w-full bg-transparent outline-none text-sm font-bold text-gray-700 placeholder:text-gray-300"
                            placeholder="Rechercher un consultant ou un BC..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {isAdmin && (
                        <>
                            <div className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                                <Filter size={16} style={{ color: COLORS.blue }} />
                                <select
                                    className="bg-transparent outline-none text-sm font-bold cursor-pointer"
                                    style={{ color: COLORS.blue }}
                                    value={filterCabinet}
                                    onChange={e => setFilterCabinet(e.target.value)}
                                >
                                    <option value="">Tous les cabinets</option>
                                    {cabinets.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                                <Users size={16} style={{ color: COLORS.blue }} />
                                <select
                                    className="bg-transparent outline-none text-sm font-bold cursor-pointer"
                                    style={{ color: COLORS.blue }}
                                    value={filterConsultant}
                                    onChange={e => setFilterConsultant(e.target.value)}
                                >
                                    <option value="">Tous les consultants</option>
                                    {consultantOptions.map(nom => <option key={nom} value={nom}>{nom}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Alerte : BC proches de l'épuisement */}
            {alertRows.length > 0 && (
                <Card className="mb-6 !border-red-200" >
                    <h3 className="font-black flex items-center gap-2 mb-3" style={{ color: COLORS.red }}>
                        <AlertTriangle size={18} /> BC proches de l'épuisement (≥ 80 %)
                    </h3>
                    <div className="space-y-3">
                        {alertRows.map((r, i) => (
                            <div key={`${r.bcId}-${i}`} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                                <div className="md:w-64 shrink-0">
                                    <span className="font-bold text-sm" style={{ color: COLORS.blue }}>{r.nomConsultant}</span>
                                    <span className="text-xs text-gray-400 font-bold ml-2">{r.nomCabinet}</span>
                                </div>
                                <div className="flex-1">
                                    <BudgetGauge label={r.referenceBC} consomme={r.joursConsommesYTD} max={r.totalJoursBC} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {scopedRows.length === 0 ? (
                <Card className="text-center py-16 text-gray-400">
                    <AlertCircle size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="font-bold">Aucune donnée pour ces critères sur {year}.</p>
                </Card>
            ) : isConsultant ? (
                /* ================= VUE CONSULTANT ================= */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {scopedRows.map((bc, idx) => (
                        <Card key={`${bc.bcId}-${idx}`}>
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <div className="font-black text-lg" style={{ color: COLORS.blue }}>{bc.referenceBC}</div>
                                    <div className="text-xs text-gray-400 font-bold">{bc.descriptionCodeBudgetaire || '—'}</div>
                                </div>
                                <span className={`text-xs font-black px-2 py-1 rounded-full ${pctBC(bc) >= 80 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                    {bc.joursRestants?.toFixed(1)} JH restants
                                </span>
                            </div>
                            <div className="my-4">
                                <BudgetGauge label="Consommation" consomme={bc.joursConsommesYTD} max={bc.totalJoursBC} />
                            </div>
                            <div className="grid grid-cols-6 gap-1">
                                {(bc.mensuel || []).map((v, m) => (
                                    <div key={m} className="text-center bg-gray-50 rounded-lg py-1.5">
                                        <div className="text-[9px] font-black text-gray-400 uppercase">{MOIS_COURTS[m]}</div>
                                        <div className="text-xs font-black" style={{ color: v > 0 ? COLORS.blue : '#d1d5db' }}>
                                            {v > 0 ? v : '·'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                /* ============ VUE RESPONSABLE / ADMIN : par cabinet ============ */
                <div className="space-y-6">
                    {byCabinet.map(([nomCabinet, rows]) => {
                        const consultantsCab = [...new Set(rows.map(r => r.nomConsultant))];
                        const jhCab = rows.reduce((s, r) => s + (r.joursConsommesYTD || 0), 0);
                        const montantCab = rows.reduce((s, r) => s + (r.montantConsommeYTD || 0), 0);
                        return (
                            <Card key={nomCabinet}>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
                                    <h3 className="font-black text-lg flex items-center gap-2" style={{ color: COLORS.blue }}>
                                        <Building2 size={20} style={{ color: COLORS.green }} /> {nomCabinet}
                                    </h3>
                                    <div className="flex items-center gap-5 text-sm">
                                        <span className="flex items-center gap-1.5 font-bold text-gray-500">
                                            <Users size={15} /> {consultantsCab.length} consultant{consultantsCab.length > 1 ? 's' : ''}
                                        </span>
                                        <span className="font-black" style={{ color: COLORS.gold }}>
                                            {jhCab.toLocaleString('fr-FR')} JH
                                        </span>
                                        <span className="font-black" style={{ color: COLORS.green }}>
                                            {montantCab.toLocaleString('fr-FR')} MAD
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {consultantsCab.map(nomConsultant => {
                                        const bcRows = rows.filter(r => r.nomConsultant === nomConsultant);
                                        const montantConsultant = bcRows.reduce((s, r) => s + (r.montantConsommeYTD || 0), 0);
                                        return (
                                            <div key={nomConsultant} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <div className="flex flex-wrap justify-between items-center mb-3">
                                                    <div className="font-black text-sm uppercase" style={{ color: COLORS.blue }}>
                                                        {nomConsultant}
                                                    </div>
                                                    <div className="text-xs font-bold text-gray-400">
                                                        Facturable : <span style={{ color: COLORS.green }}>{montantConsultant.toLocaleString('fr-FR')} MAD</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    {bcRows.map((r, i) => (
                                                        <BudgetGauge
                                                            key={`${r.bcId}-${i}`}
                                                            label={`${r.referenceBC}${r.descriptionCodeBudgetaire ? ' — ' + r.descriptionCodeBudgetaire : ''}`}
                                                            consomme={r.joursConsommesYTD}
                                                            max={r.totalJoursBC}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
