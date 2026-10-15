import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axiosConfig';
import * as XLSX from 'xlsx';
import {
    LayoutDashboard, Users, Building2, Filter, Download,
    AlertTriangle, RefreshCw, AlertCircle, Search, Wallet, Calendar,
    ChevronDown, CircleDollarSign,
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
const pctColor = (pct) => pct >= 90 ? COLORS.red : pct >= 80 ? COLORS.amber : COLORS.green;
const formatMAD = (value) => Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
const isBcForBudget = (bc, budget, allBudgets) => {
    const sameCode = String(budget.codeBudget || '').trim().toLowerCase()
        === String(bc.codeBudget || '').trim().toLowerCase();
    if (!sameCode) return false;
    if (bc.anneeBudgetaire != null) return bc.anneeBudgetaire === budget.annee;
    // Les BC historiques sans année ne sont rapprochés que si le code n'existe
    // que dans un seul budget annuel ; sinon l'association serait ambiguë.
    return allBudgets.filter((b) => String(b.codeBudget || '').trim().toLowerCase()
        === String(bc.codeBudget || '').trim().toLowerCase()).length === 1;
};
const budgetState = (budget) => {
    if (budget.budgetTotal == null || budget.disponible == null) return 'INCOMPLET';
    if (budget.disponible <= 0) return 'EPUISE';
    if (budget.budgetTotal > 0 && budget.disponible / budget.budgetTotal <= 0.1) return 'CRITIQUE';
    if ((budget.engageActif || 0) > 0 || (budget.realise || 0) > 0 || (budget.consomme || 0) > 0) return 'EN_COURS';
    return 'DISPONIBLE';
};
const bcCapacityWarning = (bc) => {
    if (!(bc.joursMax > 0)) return '';
    const ratio = (bc.joursEngages ?? bc.joursConsommes ?? 0) / bc.joursMax;
    if (ratio >= 1) return 'Capacité engagée';
    if (ratio >= 0.8) return 'Engagement ≥80%';
    return '';
};

const BUDGET_STATE_STYLE = {
    INCOMPLET: { label: 'À compléter', bg: '#f1f5f9', fg: '#64748b' },
    EPUISE: { label: 'Épuisé', bg: '#fee2e2', fg: '#b91c1c' },
    CRITIQUE: { label: 'Solde critique', bg: '#ffedd5', fg: '#c2410c' },
    EN_COURS: { label: 'En cours', bg: '#dbeafe', fg: '#1d4ed8' },
    DISPONIBLE: { label: 'Disponible', bg: '#dcfce7', fg: '#15803d' },
};

const BudgetStateBadge = ({ state }) => {
    const style = BUDGET_STATE_STYLE[state] || BUDGET_STATE_STYLE.INCOMPLET;
    return <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase"
        title={state === 'CRITIQUE' ? 'Le disponible représente au plus 10 % de l’enveloppe.' : undefined}
        style={{ backgroundColor: style.bg, color: style.fg }}>{style.label}</span>;
};

/** Titre de section discret (majuscules, 11px, gris). */
const SectionTitle = ({ children }) => (
    <h2 className="text-[11px] uppercase font-black tracking-wider text-gray-400 mb-3">{children}</h2>
);

/** Badge « Reliquat 2025 » sur les lignes issues d'un report d'année précédente. */
const ReliquatBadge = ({ row }) => row.reliquatAnneePrecedente ? (
    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ backgroundColor: '#fdf6e9', color: COLORS.gold }}>
        Reliquat {row.anneeOrigine}
    </span>
) : null;

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
            (r.descriptionCodeBudgetaire || '') + (r.reliquatAnneePrecedente ? ` (Reliquat ${r.anneeOrigine})` : ''),
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
    const [dashboardError, setDashboardError] = useState('');
    const [dashboardWarning, setDashboardWarning] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [cabinets, setCabinets] = useState([]);  // filtre ADMIN/RESPONSABLE (liste scopée serveur)
    const [scopeUsers, setScopeUsers] = useState([]);
    const [directions, setDirections] = useState([]);
    const [currentProfile, setCurrentProfile] = useState(null);
    const [filterDirection, setFilterDirection] = useState('');
    const [filterManager, setFilterManager] = useState('');
    const [filterCabinet, setFilterCabinet] = useState('');
    const [filterConsultant, setFilterConsultant] = useState('');
    const [filterCode, setFilterCode] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [budgetRows, setBudgetRows] = useState([]);
    const [budgetBcRows, setBudgetBcRows] = useState([]);
    const [budgetLoading, setBudgetLoading] = useState(false);
    const [budgetError, setBudgetError] = useState('');
    const [budgetSearch, setBudgetSearch] = useState('');
    const [budgetStateFilter, setBudgetStateFilter] = useState('');
    const [showAllAlerts, setShowAllAlerts] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchAll = async () => {
            setLoading(true);
            setDashboardError('');
            setDashboardWarning('');
            try {
                // /dashboard/report et /admin/cabinets sont scopés côté serveur :
                // un RESPONSABLE ne reçoit que ses cabinets gérés.
                const promises = [api.get(`/dashboard/report?annee=${year}`)];
                if (isAdmin || isResponsable) promises.push(api.get('/admin/cabinets'));
                const results = await Promise.allSettled(promises);
                if (results[0].status === 'rejected') throw results[0].reason;

                let reportData = results[0].value.data || [];

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
                if (isAdmin || isResponsable) {
                    if (results[1].status === 'fulfilled') setCabinets(results[1].value.data || []);
                    else setDashboardWarning('Le rapport est chargé, mais la liste des cabinets est indisponible.');
                }
            } catch (error) {
                console.error('Erreur dashboard', error);
                if (isMounted) {
                    setData([]);
                    setDashboardError(error.response?.data?.message || 'Impossible de charger les données du pilotage.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchAll();
        return () => { isMounted = false; };
    }, [year, userId, userRole]); // eslint-disable-line react-hooks/exhaustive-deps

    // Métadonnées nécessaires aux filtres globaux. Les endpoints restent scopés
    // côté serveur pour un RESPONSABLE ; l'ADMIN reçoit le référentiel complet.
    useEffect(() => {
        if (!isAdmin && !isResponsable) return undefined;
        let isMounted = true;
        const requests = [api.get('/admin/consultants')];
        requests.push(isAdmin ? api.get('/admin/directions') : api.get('/me'));
        Promise.allSettled(requests).then(([usersResult, scopeResult]) => {
            if (!isMounted) return;
            if (usersResult.status === 'fulfilled') setScopeUsers(usersResult.value.data || []);
            if (scopeResult.status === 'fulfilled') {
                if (isAdmin) setDirections(scopeResult.value.data || []);
                else setCurrentProfile(scopeResult.value.data || null);
            }
        });
        return () => { isMounted = false; };
    }, [isAdmin, isResponsable]);

    // Les managers voient les enveloppes globales et leurs propres DA/BC (réponse serveur scopée).
    // Leur échec de chargement ne bloque pas le tableau de consommation des CRA.
    useEffect(() => {
        if (!isAdmin && !isResponsable) return undefined;
        let isMounted = true;
        setBudgetLoading(true);
        setBudgetError('');
        setBudgetRows([]);
        Promise.allSettled([
            api.get('/admin/budgets'),
            api.get('/admin/bcs'),
        ]).then(([budgetResult, bcResult]) => {
            if (!isMounted) return;
            const errors = [];
            if (budgetResult.status === 'fulfilled') setBudgetRows(budgetResult.value.data || []);
            else errors.push('budgets');
            if (bcResult.status === 'fulfilled') setBudgetBcRows(bcResult.value.data || []);
            else errors.push('bons de commande');
            if (errors.length) setBudgetError(`Chargement incomplet : ${errors.join(' et ')}.`);
        }).finally(() => { if (isMounted) setBudgetLoading(false); });
        return () => { isMounted = false; };
    }, [isAdmin, isResponsable]);

    const directionOptions = useMemo(() => {
        if (isAdmin) return [...directions].sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || '')));
        const ownDirection = currentProfile?.directionId && currentProfile?.directionNom
            ? [{ id: currentProfile.directionId, nom: currentProfile.directionNom }]
            : [...new Map(scopeUsers.filter((c) => c.directionId && c.directionNom)
                .map((c) => [c.directionId, { id: c.directionId, nom: c.directionNom }])).values()];
        return ownDirection;
    }, [isAdmin, directions, currentProfile, scopeUsers]);

    const managerOptions = useMemo(() => {
        if (isAdmin) return scopeUsers.filter((u) => u.role === 'RESPONSABLE')
            .map((u) => ({ id: u.id, label: `${u.prenom || ''} ${u.nom || ''}`.trim(), directionId: u.directionId }))
            .sort((a, b) => a.label.localeCompare(b.label));
        if (isResponsable && currentProfile?.id) return [{
            id: currentProfile.id,
            label: `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim(),
            directionId: currentProfile.directionId,
        }];
        return [];
    }, [isAdmin, isResponsable, scopeUsers, currentProfile]);

    const scopedConsultantIds = useMemo(() => new Set(scopeUsers
        .filter((c) => c.role === 'CONSULTANT')
        .filter((c) => !filterDirection || String(c.directionId || '') === filterDirection)
        .filter((c) => !filterManager || String(c.managerId || '') === filterManager)
        .map((c) => Number(c.id))), [scopeUsers, filterDirection, filterManager]);

    const scopedBudgetBcRows = useMemo(() => {
        if (!filterDirection && !filterManager) return budgetBcRows;
        return budgetBcRows.filter((bc) => bc.consultantId != null && scopedConsultantIds.has(Number(bc.consultantId)));
    }, [budgetBcRows, filterDirection, filterManager, scopedConsultantIds]);

    const selectedBudgetDirection = filterDirection || managerOptions
        .find((manager) => String(manager.id) === filterManager)?.directionId?.toString() || '';
    const annualBudgets = useMemo(() => budgetRows.filter((b) => b.annee === year)
        .filter((b) => !selectedBudgetDirection || b.scope === 'POLE' || String(b.directionId || '') === selectedBudgetDirection),
    [budgetRows, year, selectedBudgetDirection]);
    const budgetNameByCode = useMemo(() => {
        const names = new Map();
        [...annualBudgets, ...[...budgetRows].sort((a, b) => (b.annee || 0) - (a.annee || 0))].forEach((budget) => {
            const code = String(budget.codeBudget || '').trim().toUpperCase();
            const name = String(budget.description || '').trim();
            if (code && name && !names.has(code)) names.set(code, name);
        });
        return names;
    }, [annualBudgets, budgetRows]);

    const displayedBudgets = useMemo(() => {
        const query = budgetSearch.trim().toLocaleLowerCase('fr');
        return annualBudgets.filter((b) => {
            const state = budgetState(b);
            const matchesState = !budgetStateFilter || state === budgetStateFilter;
            const matchesText = !query || [b.codeBudget, b.description, b.typeBudget, b.sectionAnalytique]
                .some((value) => String(value || '').toLocaleLowerCase('fr').includes(query));
            return matchesState && matchesText;
        }).sort((a, b) => String(a.codeBudget || '').localeCompare(String(b.codeBudget || '')));
    }, [annualBudgets, budgetSearch, budgetStateFilter]);

    const budgetTotals = useMemo(() => {
        const summaryBudgets = isResponsable ? annualBudgets.filter((b) => b.scope !== 'DIRECTION') : annualBudgets;
        return {
        envelope: summaryBudgets.reduce((sum, b) => sum + (b.budgetTotal || 0), 0),
        available: summaryBudgets.reduce((sum, b) => sum + (b.disponible || 0), 0),
        relatedBcs: scopedBudgetBcRows.filter((bc) => annualBudgets.some((b) => isBcForBudget(bc, b, budgetRows))).length,
        alerts: annualBudgets.filter((b) => ['CRITIQUE', 'EPUISE', 'INCOMPLET'].includes(budgetState(b))).length,
    }; }, [annualBudgets, budgetRows, scopedBudgetBcRows, isResponsable]);

    // --- Lignes visibles selon les filtres (ADMIN + RESPONSABLE) ---
    const scopedRows = useMemo(() => {
        let rows = data;
        if (!isConsultant && filterDirection) {
            rows = rows.filter((r) => String(r.directionId || '') === filterDirection);
        }
        if (!isConsultant && filterManager) {
            rows = rows.filter((r) => String(r.managerId || '') === filterManager);
        }
        if (!isConsultant && filterCabinet) {
            rows = rows.filter(r => r.nomCabinet === filterCabinet);
        }
        if (!isConsultant && filterConsultant) {
            rows = rows.filter(r => r.nomConsultant === filterConsultant);
        }
        if (!isConsultant && filterCode) {
            rows = rows.filter(r => r.descriptionCodeBudgetaire === filterCode);
        }
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            rows = rows.filter(r =>
                (r.nomConsultant?.toLowerCase() || '').includes(q) ||
                (r.referenceBC?.toLowerCase() || '').includes(q));
        }
        return rows;
    }, [data, filterDirection, filterManager, filterCabinet, filterConsultant, filterCode, searchTerm, isConsultant]);

    // Options du filtre consultant (ADMIN/RESPONSABLE) : noms dédupliqués issus du rapport
    const consultantOptions = useMemo(() =>
        [...new Set(data.map(r => r.nomConsultant).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b)),
    [data]);

    // Options du filtre code budgétaire (ADMIN/RESPONSABLE) : codes dédupliqués issus du rapport
    const codeOptions = useMemo(() =>
        [...new Set(data.map(r => r.descriptionCodeBudgetaire).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b)),
    [data]);

    // Synthèse du budget sélectionné (ADMIN/RESPONSABLE)
    const budgetSummary = useMemo(() => {
        if (!filterCode) return null;
        return {
            jh: scopedRows.reduce((s, r) => s + (r.joursConsommesYTD || 0), 0),
            montant: scopedRows.reduce((s, r) => s + (r.montantConsommeYTD || 0), 0),
        };
    }, [filterCode, scopedRows]);

    // --- KPI ---
    const kpi = useMemo(() => {
        const consultants = new Set(scopedRows.map(r => r.nomConsultant)).size;
        const totalJH = scopedRows.reduce((s, r) => s + (r.joursConsommesYTD || 0), 0);
        const montant = scopedRows.reduce((s, r) => s + (r.montantConsommeYTD || 0), 0);
        const alertes = scopedRows.filter(r => pctBC(r) >= 80).length;
        const totalBudget = scopedRows.reduce((s, r) => s + (r.totalJoursBC || 0), 0);
        return { consultants, totalJH, montant, alertes, totalBudget };
    }, [scopedRows]);

    const alertRows = useMemo(() => scopedRows.filter(r => pctBC(r) >= 80)
        .sort((a, b) => pctBC(b) - pctBC(a)), [scopedRows]);
    const visibleAlertRows = showAllAlerts ? alertRows : alertRows.slice(0, 6);

    // --- Groupement par cabinet (RESPONSABLE / ADMIN) ---
    const byCabinet = useMemo(() => {
        const groups = scopedRows.reduce((acc, r) => {
            const key = r.nomCabinet || 'Sans cabinet';
            (acc[key] = acc[key] || []).push(r);
            return acc;
        }, {});
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [scopedRows]);

    // --- Activité réalisée (ADMIN/RESPONSABLE) : lignes groupées par consultant ---
    const activiteParConsultant = useMemo(() => {
        const groups = scopedRows.reduce((acc, r) => {
            const key = r.nomConsultant || 'Inconnu';
            (acc[key] = acc[key] || []).push(r);
            return acc;
        }, {});
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [scopedRows]);

    const yearOptions = useMemo(() => [...new Set([
        ...Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 2 + i),
        ...budgetRows.map((b) => b.annee).filter(Number.isInteger),
        ...budgetBcRows.map((bc) => bc.anneeBudgetaire).filter(Number.isInteger),
    ])].sort((a, b) => a - b), [budgetRows, budgetBcRows]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]" style={{ color: COLORS.blue }}>
                <RefreshCw className="animate-spin mb-4" size={40} />
                <h2 className="font-black text-xl tracking-tight">Chargement des données...</h2>
            </div>
        );
    }

    const emptyState = (
        <Card className={`text-center py-12 ${dashboardError ? '!border-red-200' : 'text-gray-400'}`}>
            <AlertCircle size={36} className="mx-auto mb-3 opacity-60" style={{ color: dashboardError ? COLORS.red : undefined }} />
            <p className={`font-bold ${dashboardError ? 'text-red-700' : ''}`}>{dashboardError || `Aucune activité de consultant pour ces critères en ${year}.`}</p>
            {dashboardError && <p className="text-xs text-gray-500 mt-2">Réessaie après avoir vérifié la connexion au serveur.</p>}
        </Card>
    );

    /* ================= VUE CONSULTANT (inchangée) ================= */
    if (isConsultant) {
        return (
            <div className="mx-auto max-w-7xl p-4">
                <PageHeader
                    icon={LayoutDashboard}
                    title="Mon tableau de bord"
                    subtitle={`Suivi de mes bons de commande — ${year}`}
                    actions={
                        <select
                            className="p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white outline-none cursor-pointer"
                            style={{ color: COLORS.blue }}
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value, 10))}
                        >
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    }
                />

                {/* KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Mes BC actifs" value={scopedRows.length} unit="" />
                    <StatCard label={`Enveloppe ${year}`} value={kpi.totalBudget.toLocaleString('fr-FR')} />
                    <StatCard label="JH consommés" value={kpi.totalJH.toLocaleString('fr-FR')} accent={COLORS.gold} />
                    <StatCard label="BC en alerte (≥80%)" value={kpi.alertes} unit="" alert={kpi.alertes > 0} />
                </div>

                {scopedRows.length === 0 ? emptyState : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {scopedRows.map((bc, idx) => (
                            <Card key={`${bc.bcId}-${idx}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <div className="font-black text-lg flex items-center gap-2" style={{ color: COLORS.blue }}>
                                            {bc.referenceBC} <ReliquatBadge row={bc} />
                                        </div>
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
                )}
            </div>
        );
    }

    /* ============ VUE ADMIN / RESPONSABLE : « Pilotage Global » ============ */
    return (
        <div className="mx-auto max-w-7xl p-4">
            <PageHeader
                icon={LayoutDashboard}
                title="Pilotage global"
                subtitle={`Budgets annuels, BC et consommation des prestations — ${year}`}
                actions={
                    <Button
                        variant="secondary"
                        onClick={() => exportFicheSuiviExcel(scopedRows, year)}
                        disabled={scopedRows.length === 0}
                    >
                        <Download size={16} /> Exporter Fiche de suivi (Excel)
                    </Button>
                }
            />

            <div className="space-y-6">
                {/* ---- Filtres de pilotage ---- */}
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                            <Building2 size={16} style={{ color: COLORS.blue }} />
                            <select aria-label="Filtrer par direction"
                                className="bg-transparent outline-none text-sm font-bold cursor-pointer"
                                style={{ color: COLORS.blue }} value={filterDirection}
                                onChange={(e) => setFilterDirection(e.target.value)}>
                                <option value="">Toutes les directions</option>
                                {directionOptions.map((direction) => <option key={direction.id} value={direction.id}>{direction.nom}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                            <Users size={16} style={{ color: COLORS.blue }} />
                            <select aria-label="Filtrer par manager"
                                className="bg-transparent outline-none text-sm font-bold cursor-pointer"
                                style={{ color: COLORS.blue }} value={filterManager}
                                onChange={(e) => setFilterManager(e.target.value)}>
                                <option value="">Tous les managers</option>
                                {managerOptions.map((manager) => <option key={manager.id} value={manager.id}>{manager.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                            <Calendar size={16} style={{ color: COLORS.blue }} />
                            <select
                                className="bg-transparent outline-none text-sm font-bold cursor-pointer"
                                style={{ color: COLORS.blue }}
                                value={year}
                                onChange={e => setYear(parseInt(e.target.value, 10))}
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
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
                        <div className="flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                            <Wallet size={16} style={{ color: COLORS.blue }} />
                            <select
                                className="bg-transparent outline-none text-sm font-bold cursor-pointer"
                                style={{ color: COLORS.blue }}
                                value={filterCode}
                                onChange={e => setFilterCode(e.target.value)}
                            >
                                <option value="">Tous les codes budgétaires</option>
                                {codeOptions.map(code => <option key={code} value={code}>{code}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white p-2.5 px-4 rounded-xl border border-gray-200">
                            <Search size={16} className="text-gray-400" />
                            <input
                                className="w-full bg-transparent outline-none text-sm font-bold text-gray-700 placeholder:text-gray-300"
                                placeholder="Rechercher un consultant ou un BC..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {(filterDirection || filterManager) && <Button variant="outline" onClick={() => { setFilterDirection(''); setFilterManager(''); }}>Effacer les filtres</Button>}
                    </div>

                    {/* Synthèse du budget sélectionné */}
                    {budgetSummary && (
                        <div className="flex items-center gap-2 mt-3 text-sm font-bold px-4 py-2.5 rounded-xl border"
                             style={{ backgroundColor: '#eef4ff', borderColor: '#dbeafe', color: COLORS.blue }}>
                            <Wallet size={15} />
                            <span>
                                Budget {filterCode} : {budgetSummary.jh.toLocaleString('fr-FR')} JH consommés
                                {' · '}{budgetSummary.montant.toLocaleString('fr-FR')} MAD
                            </span>
                        </div>
                    )}
                </div>

                {/* ---- KPI ---- */}
                {dashboardWarning && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800"><AlertCircle size={16} />{dashboardWarning}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Consultants" value={kpi.consultants} unit="" />
                    <StatCard label="JH consommés" value={kpi.totalJH.toLocaleString('fr-FR')} accent={COLORS.gold} />
                    <StatCard label="Montant facturable" value={kpi.montant.toLocaleString('fr-FR')} unit="MAD" accent={COLORS.green} />
                    <StatCard label="BC en alerte (≥80%)" value={kpi.alertes} unit="" alert={kpi.alertes > 0} />
                </div>

                {(isAdmin || isResponsable) && (
                    <section aria-labelledby="annual-budget-heading" className="space-y-3">
                        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
                            <div>
                                <SectionTitle>Enveloppes annuelles</SectionTitle>
                                <h2 id="annual-budget-heading" className="text-xl font-black flex items-center gap-2" style={{ color: COLORS.blue }}>
                                    <CircleDollarSign size={21} style={{ color: COLORS.green }} /> Budgets et BC liés
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">{annualBudgets.length} budgets · {budgetTotals.relatedBcs} BC rapprochés · montants = dernière saisie/import, consommations = CRA.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                                <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 min-w-[220px]">
                                    <Search size={15} className="text-gray-400" />
                                    <input aria-label="Rechercher un budget" className="w-full outline-none text-sm" placeholder="Code, description, section…"
                                        value={budgetSearch} onChange={(e) => setBudgetSearch(e.target.value)} />
                                </label>
                                <select aria-label="Filtrer par état budgétaire" className="bg-white px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold"
                                    value={budgetStateFilter} onChange={(e) => setBudgetStateFilter(e.target.value)}>
                                    <option value="">Tous les états</option>
                                    {Object.entries(BUDGET_STATE_STYLE).map(([key, state]) => <option key={key} value={key}>{state.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {budgetError && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800"><AlertCircle size={16} />{budgetError}</div>}

                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                            <StatCard label={`Budgets ${year}`} value={annualBudgets.length} unit="" />
                            <StatCard label={isResponsable ? 'Enveloppe globale Pôle' : 'Enveloppe budgétaire'} value={formatMAD(budgetTotals.envelope)} unit="MAD" />
                            <StatCard label={isResponsable ? 'Disponible Pôle' : 'Disponible déclaré'} value={formatMAD(budgetTotals.available)} unit="MAD" accent={COLORS.green} />
                            <StatCard label="Budgets à surveiller" value={budgetTotals.alerts} unit="" alert={budgetTotals.alerts > 0} />
                        </div>

                        {budgetLoading ? (
                            <Card className="py-8 text-center text-sm font-bold text-gray-400">Chargement des budgets et des BC…</Card>
                        ) : annualBudgets.length === 0 ? (
                            <Card className="py-8 text-center">
                                <CircleDollarSign size={28} className="mx-auto mb-2 text-gray-300" />
                                <p className="font-bold text-gray-600">Aucun budget enregistré pour {year}.</p>
                                <p className="text-xs text-gray-400 mt-1">Les budgets peuvent être saisis ou importés dans Administration → Budgets annuels. Un solde ≤10 % est signalé comme critique.</p>
                            </Card>
                        ) : displayedBudgets.length === 0 ? (
                            <Card className="py-7 text-center text-sm text-gray-400">Aucun budget ne correspond à cette recherche.</Card>
                        ) : (
                            <div className="space-y-2">
                                {displayedBudgets.map((budget) => {
                                    const state = budgetState(budget);
                                    const matchingBcs = scopedBudgetBcRows.filter((bc) => isBcForBudget(bc, budget, budgetRows));
                                    const availablePct = budget.budgetTotal > 0 && budget.disponible != null
                                        ? Math.max(0, Math.min(100, budget.disponible / budget.budgetTotal * 100)) : null;
                                    return (
                                        <details key={budget.id} className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                                            <summary className="grid cursor-pointer list-none grid-cols-1 gap-3 p-4 hover:bg-gray-50 md:grid-cols-[minmax(190px,1.4fr)_auto_repeat(3,minmax(115px,0.7fr))_auto] md:items-center">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2"><span className="font-black font-mono" style={{ color: COLORS.blue }}>{budget.codeBudget}</span><BudgetStateBadge state={state} /></div>
                                                    <div className="mt-1 truncate text-xs text-gray-500">{budget.description || 'Description non renseignée'}</div>
                                                </div>
                                                <div className="text-xs text-gray-500 md:text-center">{budget.typeBudget || '—'}{budget.typeBudget ? <div className="mt-0.5 text-[10px] text-gray-400">RA : {budget.typeBudget === 'OPEX' ? 'RUN' : 'PROJET'}</div> : null}</div>
                                                <div><div className="text-[10px] font-bold uppercase text-gray-400">Enveloppe</div><div className="text-sm font-black text-gray-700">{formatMAD(budget.budgetTotal)} MAD</div></div>
                                                <div><div className="text-[10px] font-bold uppercase text-gray-400">Disponible</div><div className="text-sm font-black" style={{ color: state === 'CRITIQUE' || state === 'EPUISE' ? COLORS.red : COLORS.green }}>{formatMAD(budget.disponible)} MAD</div>{availablePct != null && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${availablePct}%`, backgroundColor: state === 'CRITIQUE' ? COLORS.amber : state === 'EPUISE' ? COLORS.red : COLORS.green }} /></div>}</div>
                                                <div><div className="text-[10px] font-bold uppercase text-gray-400">Engagé / réalisé</div><div className="text-sm font-bold text-gray-700">{formatMAD(budget.engageActif)} / {formatMAD(budget.realise)} MAD</div></div>
                                                <div className="flex items-center justify-between gap-3 text-xs font-bold text-gray-500 md:justify-end"><span>{budget.nombreDemandes || 0} DA · {matchingBcs.length} BC</span><ChevronDown size={16} className="transition-transform group-open:rotate-180" /></div>
                                            </summary>
                                            <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-3">
                                                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                                                    {budget.reporteAnterieur != null && <span>Report engagé antérieur : <b>{formatMAD(budget.reporteAnterieur)} MAD</b></span>}
                                                    {budget.consomme != null && <span>Consommé : <b>{formatMAD(budget.consomme)} MAD</b></span>}
                                                    {budget.sectionAnalytique && <span>Section analytique : <b>{budget.sectionAnalytique}</b></span>}
                                                    {budget.reste2025 && <span>Reste 2025 : <b>{budget.reste2025}</b></span>}
                                                    {budget.dateMiseAJour && <span>État mis à jour le <b>{new Date(budget.dateMiseAJour).toLocaleDateString('fr-FR')}</b></span>}
                                                </div>
                                                {matchingBcs.length === 0 ? (
                                                    <p className="rounded-xl bg-white p-3 text-xs text-gray-400">Aucun BC rattaché par code budgétaire pour cette année.</p>
                                                ) : (
                                                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                                                        <table className="w-full min-w-[650px] text-xs">
                                                            <thead><tr className="border-b text-left uppercase text-[10px] text-gray-400"><th className="p-2.5">Référence BC</th><th className="p-2.5">Consultant</th><th className="p-2.5">Statut</th><th className="p-2.5 text-right">JH consommés / engagés / max</th><th className="p-2.5 text-right">Montant consommé</th></tr></thead>
                                                            <tbody className="divide-y divide-gray-50">{matchingBcs.map((bc) => <tr key={bc.id}>
                                                                <td className="p-2.5 font-mono font-bold" style={{ color: COLORS.blue }}>{bc.reference || '—'}{bc.anneeBudgetaire == null && <span className="ml-1 text-[9px] font-sans font-normal text-amber-700">année non précisée</span>}</td>
                                                                <td className="p-2.5 text-gray-600">{bc.consultant ? `${bc.consultant.prenom || ''} ${bc.consultant.nom || ''}`.trim() : 'Non affecté'}</td>
                                                                <td className="p-2.5"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${bc.statut === 'ACTIF' ? 'bg-green-50 text-green-700' : bc.statut === 'EPUISE' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{bc.statut || 'Non renseigné'}</span>{bcCapacityWarning(bc) && <div className="mt-1 text-[9px] font-bold text-amber-700">{bcCapacityWarning(bc)}</div>}</td>
                                                                <td className="p-2.5 text-right font-bold">{Number(bc.joursConsommes || 0).toLocaleString('fr-FR')} / {Number(bc.joursEngages || 0).toLocaleString('fr-FR')} / {Number(bc.joursMax || 0).toLocaleString('fr-FR')} JH</td>
                                                                <td className="p-2.5 text-right">{formatMAD(bc.montantConsomme)} MAD</td>
                                                            </tr>)}</tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {scopedRows.length === 0 ? emptyState : (
                    <>
                        {/* ---- Suivi par cabinet (compact) ---- */}
                        <section>
                            <SectionTitle>Suivi par cabinet</SectionTitle>
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

                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                {consultantsCab.sort((a, b) => a.localeCompare(b)).map(nomConsultant => {
                                                    const bcRows = rows.filter(r => r.nomConsultant === nomConsultant);
                                                    const jhConsultant = +bcRows.reduce((s, r) => s + (r.joursConsommesYTD || 0), 0).toFixed(1);
                                                    const maxConsultant = +bcRows.reduce((s, r) => s + (r.totalJoursBC || 0), 0).toFixed(1);
                                                    return (
                                                        <div key={nomConsultant} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                            <div className="flex justify-between items-baseline gap-2 mb-3">
                                                                <div className="font-black text-sm uppercase truncate" style={{ color: COLORS.blue }}>
                                                                    {nomConsultant}
                                                                </div>
                                                                <div className="text-[11px] font-bold text-gray-400 whitespace-nowrap">
                                                                    {bcRows.length} BC · <span style={{ color: COLORS.gold }}>{jhConsultant.toLocaleString('fr-FR')} JH</span>
                                                                </div>
                                                            </div>
                                                            <BudgetGauge label="Consommation globale" consomme={jhConsultant} max={maxConsultant} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>

                        {/* ---- Suivi annuel par consultant ---- */}
                        {activiteParConsultant.length > 0 && (
                            <section>
                                <SectionTitle>Consommation annuelle par consultant — {year}</SectionTitle>
                                <p className="mb-4 text-sm text-gray-500">Une ligne par BC, avec son code budgétaire, le détail des douze mois et le reste disponible à date.</p>
                                <Card className="!p-0 overflow-hidden">
                                    <div className="w-full">
                                        <table className="w-full table-fixed border-collapse text-[11px] leading-tight">
                                            <colgroup>
                                                <col style={{ width: '14%' }} /><col style={{ width: '10%' }} />
                                                {MOIS_COURTS.map(month => <col key={month} style={{ width: '3.5%' }} />)}
                                                <col style={{ width: '9%' }} /><col style={{ width: '8%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} />
                                            </colgroup>
                                            <thead><tr className="bg-slate-100 text-[10px] font-black uppercase tracking-tight text-gray-500">
                                                <th className="break-words bg-slate-100 px-2 py-2 text-left">Consultant / BC</th>
                                                <th className="break-words px-1 py-2 text-left">Code budgétaire</th>
                                                {MOIS_COURTS.map(month => <th key={month} className="px-0.5 py-2 text-right">{month}</th>)}
                                                <th className="bg-blue-50 px-1 py-2 text-right text-[#003366]">Consommé<br />à date</th>
                                                <th className="bg-green-50 px-1 py-2 text-right text-[#008858]">Reste<br />à date</th>
                                                <th className="px-1 py-2 text-right">Capacité<br />BC</th>
                                                <th className="px-1 py-2 text-right">Conso.</th>
                                            </tr></thead>
                                            <tbody>
                                                {activiteParConsultant.map(([nomConsultant, bcRows]) => {
                                                    const monthlyTotals = MOIS_COURTS.map((_, month) => bcRows.reduce((sum, row) => sum + (row.mensuel?.[month] || 0), 0));
                                                    const totalConsumed = bcRows.reduce((sum, row) => sum + (row.joursConsommesYTD || 0), 0);
                                                    const totalCapacity = bcRows.reduce((sum, row) => sum + (row.totalJoursBC || 0), 0);
                                                    const totalRemaining = Math.max(0, totalCapacity - totalConsumed);
                                                    const totalPct = totalCapacity > 0 ? totalConsumed / totalCapacity * 100 : 0;
                                                    return <React.Fragment key={nomConsultant}>
                                                        <tr className="border-t-2 border-slate-200 bg-slate-50">
                                                            <td colSpan={18} className="bg-slate-50 px-2 py-2 text-xs font-black text-[#003366]">{nomConsultant}<span className="ml-2 text-[10px] font-bold text-gray-400">{bcRows.length} BC</span></td>
                                                        </tr>
                                                        {bcRows.map((row, index) => {
                                                            const consumed = row.joursConsommesYTD || 0;
                                                            const capacity = row.totalJoursBC || 0;
                                                            const remaining = Math.max(0, capacity - consumed);
                                                            const percentage = pctBC(row);
                                                            return <tr key={`${row.bcId}-${index}`} className="border-t border-gray-100 hover:bg-blue-50/40">
                                                                <td className="break-words px-2 py-2"><div className="flex flex-wrap items-center gap-1 font-bold text-[#003366]"><span>{row.referenceBC || 'BC sans référence'}</span><ReliquatBadge row={row} /></div></td>
                                                                <td className="break-all px-1 py-2 font-mono text-[10px] text-gray-600">
                                                                    {row.descriptionCodeBudgetaire ? <span
                                                                        className="cursor-help underline decoration-dotted underline-offset-2"
                                                                        title={budgetNameByCode.get(String(row.descriptionCodeBudgetaire).trim().toUpperCase()) || 'Nom du budget non renseigné'}
                                                                        aria-label={`${row.descriptionCodeBudgetaire} — ${budgetNameByCode.get(String(row.descriptionCodeBudgetaire).trim().toUpperCase()) || 'Nom du budget non renseigné'}`}
                                                                    >{row.descriptionCodeBudgetaire}</span> : '—'}
                                                                </td>
                                                                {MOIS_COURTS.map((month, monthIndex) => <td key={month} className="px-0.5 py-2 text-right tabular-nums text-gray-600">{row.mensuel?.[monthIndex] ? row.mensuel[monthIndex].toLocaleString('fr-FR') : '—'}</td>)}
                                                                <td className="bg-blue-50/50 px-1 py-2 text-right font-black tabular-nums text-[#003366]">{consumed.toLocaleString('fr-FR')}</td>
                                                                <td className="bg-green-50/50 px-1 py-2 text-right font-black tabular-nums text-[#008858]">{remaining.toLocaleString('fr-FR')}</td>
                                                                <td className="px-1 py-2 text-right font-bold tabular-nums text-gray-600">{capacity.toLocaleString('fr-FR')}</td>
                                                                <td className="px-1 py-2 text-right font-black tabular-nums" style={{ color: pctColor(percentage) }}>{Math.round(percentage)} %</td>
                                                            </tr>;
                                                        })}
                                                        <tr className="border-t border-gray-200 bg-slate-50/70 text-xs font-black text-[#003366]">
                                                            <td className="px-2 py-2 font-bold">Total consultant</td><td className="px-1 py-2 text-gray-400">—</td>
                                                            {monthlyTotals.map((total, month) => <td key={month} className="px-0.5 py-2 text-right tabular-nums">{total ? total.toLocaleString('fr-FR') : '—'}</td>)}
                                                            <td className="bg-blue-50 px-1 py-2 text-right tabular-nums">{totalConsumed.toLocaleString('fr-FR')}</td><td className="bg-green-50 px-1 py-2 text-right tabular-nums">{totalRemaining.toLocaleString('fr-FR')}</td><td className="px-1 py-2 text-right tabular-nums">{totalCapacity.toLocaleString('fr-FR')}</td><td className="px-1 py-2 text-right tabular-nums" style={{ color: pctColor(totalPct) }}>{Math.round(totalPct)} %</td>
                                                        </tr>
                                                    </React.Fragment>;
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </section>
                        )}

                        {/* ---- BC à surveiller ---- */}
                        {alertRows.length > 0 && (
                            <section>
                                <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><SectionTitle>À traiter en priorité</SectionTitle><h2 className="flex items-center gap-2 text-lg font-black text-[#003366]"><AlertTriangle size={19} className="text-amber-500" /> Bons de commande à surveiller</h2><p className="mt-1 text-xs text-gray-500">{alertRows.length} BC ont atteint au moins 80 % de leur capacité annuelle.</p></div>{alertRows.length > 6 && <Button variant="outline" onClick={() => setShowAllAlerts(v => !v)}>{showAllAlerts ? 'Afficher les 6 premiers' : `Voir les ${alertRows.length} BC`}</Button>}</div>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {visibleAlertRows.map((r, i) => {
                                        const pct = pctBC(r);
                                        const exhausted = pct >= 100;
                                        const severityColor = exhausted ? COLORS.red : pct >= 90 ? '#c2410c' : '#a16207';
                                        const severityBg = exhausted ? '#fee2e2' : pct >= 90 ? '#ffedd5' : '#fef3c7';
                                        const remaining = Math.max(0, (r.totalJoursBC || 0) - (r.joursConsommesYTD || 0));
                                        return <Card key={`${r.bcId}-${i}`} className="!p-0 overflow-hidden">
                                            <div className="flex items-start gap-3 p-4 sm:p-5">
                                                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: severityBg, color: severityColor }}><AlertTriangle size={19} /></span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-[#003366]">{r.referenceBC || 'BC sans référence'}{r.reliquatAnneePrecedente && <span className="ml-2 align-middle"><ReliquatBadge row={r} /></span>}</h3><span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ backgroundColor: severityBg, color: severityColor }}>{exhausted ? 'Capacité atteinte' : pct >= 90 ? 'Critique' : 'À surveiller'}</span></div>
                                                    <p className="mt-1 truncate text-sm font-bold text-gray-700">{r.nomConsultant || 'Consultant non renseigné'}</p><p className="text-xs text-gray-500">{r.nomCabinet || 'Sans cabinet'}</p>
                                                    <div className="mt-4 flex items-baseline justify-between gap-3"><span className="text-xs font-bold text-gray-500">{(r.joursConsommesYTD || 0).toLocaleString('fr-FR')} consommés sur {(r.totalJoursBC || 0).toLocaleString('fr-FR')} JH</span><span className="text-sm font-black" style={{ color: severityColor }}>{Math.round(pct)} %</span></div>
                                                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: severityColor }} /></div>
                                                    <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><span className="text-gray-500">Reliquat disponible</span><span className="font-black text-[#003366]">{remaining.toLocaleString('fr-FR')} JH</span></div>
                                                </div>
                                            </div>
                                        </Card>;
                                    })}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
