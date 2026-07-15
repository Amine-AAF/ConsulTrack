import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ClipboardCheck, CalendarDays, FileText, Check, X, User,
    ChevronDown, ChevronUp, CheckCircle, AlertCircle,
} from 'lucide-react';
import api from '../api/axiosConfig';
import { PageHeader, Tabs, Card, Button, StatusBadge, COLORS } from './ui';

/* ============================================================
   Validation Hub — centre unique de validation (ADMIN / RESPONSABLE)
   Onglets : Pointages (RPI) | Congés & Absences | Rapports d'Activité
   ============================================================ */

const TAB_POINTAGES = 'pointages';
const TAB_ABSENCES = 'absences';
const TAB_RAPPORTS = 'rapports';

const fmtJH = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString('fr-FR');
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR') : '—');

const MODE_LABELS = { BC: 'BC', ABSENCE: 'Absence', FERIE: 'Férié' };

/* ---------- Regroupement Pointages : consultant × mois ---------- */
const groupPointages = (taches) => {
    const groups = {};
    (taches || []).forEach((t) => {
        const [annee, mois] = (t.date || '').split('-');
        if (!annee || !mois || !t.consultant) return;
        const key = `${t.consultant.id}-${annee}-${mois}`;
        if (!groups[key]) {
            groups[key] = {
                key,
                consultantId: t.consultant.id,
                consultantNom: `${t.consultant.prenom || ''} ${t.consultant.nom || ''}`.trim(),
                annee: parseInt(annee, 10),
                mois: parseInt(mois, 10),
                moisLabel: `${mois}/${annee}`,
                lignes: [],
            };
        }
        groups[key].lignes.push(t);
    });
    return Object.values(groups)
        .map((g) => ({
            ...g,
            lignes: g.lignes.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')),
            nbJours: new Set(g.lignes.map((l) => l.date)).size,
            totalJH: g.lignes.reduce((s, l) => s + (l.duree || 0), 0),
        }))
        .sort((a, b) => a.consultantNom.localeCompare(b.consultantNom)
            || a.annee - b.annee || a.mois - b.mois);
};

/* ---------- Regroupement Absences : par demandeId ---------- */
const groupAbsences = (absences) => {
    const groups = {};
    (absences || []).forEach((a) => {
        const key = a.demandeId || `abs-${a.id}`;
        if (!groups[key]) {
            groups[key] = {
                key,
                demandeId: a.demandeId || null,
                consultantNom: a.consultant
                    ? `${a.consultant.prenom || ''} ${a.consultant.nom || ''}`.trim()
                    : '—',
                motif: a.motif || '—',
                lignes: [],
            };
        }
        groups[key].lignes.push(a);
    });
    return Object.values(groups)
        .map((g) => {
            const dates = g.lignes.map((l) => l.date).filter(Boolean).sort();
            return {
                ...g,
                dateDebut: dates[0],
                dateFin: dates[dates.length - 1],
                nbJours: g.lignes.length,
            };
        })
        .sort((a, b) => a.consultantNom.localeCompare(b.consultantNom)
            || (a.dateDebut || '').localeCompare(b.dateDebut || ''));
};

/* ---------- État vide ---------- */
const EmptyState = ({ icon: Icon, label }) => (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
        <Icon size={40} className="text-gray-300 mb-3" />
        <p className="text-sm font-bold text-gray-400">{label}</p>
    </Card>
);

const ValidationHub = () => {
    const [activeTab, setActiveTab] = useState(TAB_POINTAGES);
    const [counts, setCounts] = useState({ pointages: 0, absences: 0, rapports: 0, total: 0 });
    const [pointageGroups, setPointageGroups] = useState([]);
    const [absenceGroups, setAbsenceGroups] = useState([]);
    const [rapports, setRapports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
    const [expanded, setExpanded] = useState({}); // { [key]: bool }
    const msgTimer = useRef(null);

    const notify = (type, text) => {
        setMessage({ type, text });
        clearTimeout(msgTimer.current);
        msgTimer.current = setTimeout(() => setMessage(null), 5000);
    };

    useEffect(() => () => clearTimeout(msgTimer.current), []);

    const loadCounts = useCallback(async () => {
        try {
            const res = await api.get('/admin/validation/pending-counts');
            setCounts(res.data || {});
        } catch {
            /* les badges restent inchangés */
        }
    }, []);

    const loadTab = useCallback(async (tab) => {
        setLoading(true);
        try {
            if (tab === TAB_POINTAGES) {
                const res = await api.get('/admin/saisies/en-attente');
                setPointageGroups(groupPointages(res.data));
            } else if (tab === TAB_ABSENCES) {
                const res = await api.get('/admin/absences/pending');
                setAbsenceGroups(groupAbsences(res.data));
            } else {
                const res = await api.get('/admin/rapports/pending');
                setRapports(res.data || []);
            }
        } catch {
            notify('error', 'Erreur lors du chargement des données.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCounts(); }, [loadCounts]);
    useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

    const refresh = useCallback(async () => {
        await Promise.all([loadTab(activeTab), loadCounts()]);
    }, [activeTab, loadTab, loadCounts]);

    const runAction = async (fn, successText) => {
        try {
            await fn();
            notify('success', successText);
        } catch (err) {
            notify('error', err.response?.data?.message || "Erreur lors de l'opération.");
        } finally {
            await refresh();
        }
    };

    /* ---------- Actions Pointages ---------- */
    const validerMois = (g) => runAction(
        () => api.put('/admin/saisies/valider-mois', null, {
            params: { consultantId: g.consultantId, annee: g.annee, mois: g.mois },
        }),
        `Pointages de ${g.consultantNom} (${g.moisLabel}) validés.`,
    );

    const rejeterSaisie = (ligne) => {
        const motif = window.prompt('Motif du rejet :');
        if (!motif || !motif.trim()) return;
        runAction(
            () => api.put(`/admin/saisies/${ligne.id}/rejeter`, null, { params: { motif: motif.trim() } }),
            `Saisie du ${fmtDate(ligne.date)} rejetée.`,
        );
    };

    /* ---------- Actions Absences ---------- */
    const decideAbsence = (g, statut) => {
        const url = g.demandeId
            ? `/admin/absences/demande/${g.demandeId}/status`
            : `/admin/absences/${g.lignes[0].id}/status`;
        runAction(
            () => api.put(url, { statut }),
            statut === 'VALIDE'
                ? `Demande de ${g.consultantNom} validée.`
                : `Demande de ${g.consultantNom} rejetée.`,
        );
    };

    /* ---------- Actions Rapports ---------- */
    const validerRapport = (r) => runAction(
        () => api.put(`/admin/rapports/${r.id}/valider`),
        `Rapport de ${r.consultantNom} (${r.moisLabel}) validé.`,
    );

    const rejeterRapport = (r) => {
        const motif = window.prompt('Motif du rejet :');
        if (!motif || !motif.trim()) return;
        runAction(
            () => api.put(`/admin/rapports/${r.id}/rejeter`, null, { params: { motif: motif.trim() } }),
            `Rapport de ${r.consultantNom} (${r.moisLabel}) rejeté.`,
        );
    };

    const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

    /* ============================ RENDUS ============================ */

    const renderPointages = () => {
        if (pointageGroups.length === 0) {
            return <EmptyState icon={ClipboardCheck} label="Aucun pointage en attente de validation." />;
        }
        return (
            <div className="space-y-4">
                {pointageGroups.map((g) => (
                    <Card key={g.key}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                                onClick={() => toggleExpand(g.key)}
                                className="flex items-center gap-3 text-left group"
                            >
                                {expanded[g.key]
                                    ? <ChevronUp size={18} className="text-gray-400" />
                                    : <ChevronDown size={18} className="text-gray-400" />}
                                <div>
                                    <div className="font-black flex items-center gap-2" style={{ color: COLORS.blue }}>
                                        <User size={15} style={{ color: COLORS.green }} />
                                        {g.consultantNom}
                                    </div>
                                    <div className="text-xs text-gray-500 font-bold mt-0.5">
                                        Mois {g.moisLabel} · {g.nbJours} jour{g.nbJours > 1 ? 's' : ''} · {fmtJH(g.totalJH)} JH
                                    </div>
                                </div>
                            </button>
                            <div className="flex items-center gap-2">
                                <StatusBadge statut="EN_ATTENTE" />
                                <Button onClick={() => validerMois(g)} disabled={loading}>
                                    <Check size={15} /> Valider le mois
                                </Button>
                            </div>
                        </div>

                        {expanded[g.key] && (
                            <div className="mt-4 border-t border-gray-100 pt-3 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[10px] uppercase font-bold tracking-wider text-gray-400 text-left">
                                            <th className="py-2 pr-3">Date</th>
                                            <th className="py-2 pr-3">Mode</th>
                                            <th className="py-2 pr-3">BC</th>
                                            <th className="py-2 pr-3">Prestation</th>
                                            <th className="py-2 pr-3">Description</th>
                                            <th className="py-2 pr-3 text-right">Durée</th>
                                            <th className="py-2 pr-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {g.lignes.map((l) => (
                                            <tr key={l.id} className="border-t border-gray-50">
                                                <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap">{fmtDate(l.date)}</td>
                                                <td className="py-2 pr-3 text-gray-600">{MODE_LABELS[l.modeSaisie] || l.modeSaisie || '—'}</td>
                                                <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{l.bonDeCommande?.reference || '—'}</td>
                                                <td className="py-2 pr-3 text-gray-600">{l.typePrestation || '—'}</td>
                                                <td className="py-2 pr-3 text-gray-500 max-w-xs truncate" title={l.descriptionTache || ''}>
                                                    {l.descriptionTache || '—'}
                                                </td>
                                                <td className="py-2 pr-3 text-right font-black" style={{ color: COLORS.blue }}>
                                                    {fmtJH(l.duree)} j
                                                </td>
                                                <td className="py-2 text-right">
                                                    <button
                                                        onClick={() => rejeterSaisie(l)}
                                                        disabled={loading}
                                                        className="text-xs font-bold px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                        style={{ color: COLORS.red }}
                                                    >
                                                        Rejeter
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        );
    };

    const renderAbsences = () => {
        if (absenceGroups.length === 0) {
            return <EmptyState icon={CalendarDays} label="Aucune demande d'absence en attente." />;
        }
        return (
            <div className="space-y-4">
                {absenceGroups.map((g) => (
                    <Card key={g.key}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="font-black flex items-center gap-2" style={{ color: COLORS.blue }}>
                                    <User size={15} style={{ color: COLORS.green }} />
                                    {g.consultantNom}
                                </div>
                                <div className="text-xs text-gray-500 font-bold mt-0.5">
                                    {g.dateDebut === g.dateFin
                                        ? `Le ${fmtDate(g.dateDebut)}`
                                        : `Du ${fmtDate(g.dateDebut)} au ${fmtDate(g.dateFin)}`}
                                    {' '}· {g.nbJours} jour{g.nbJours > 1 ? 's' : ''}
                                </div>
                                <div className="text-sm text-gray-600 mt-1.5">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mr-2">Motif</span>
                                    {g.motif}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge statut="EN_ATTENTE" />
                                <Button variant="danger" onClick={() => decideAbsence(g, 'REJETE')} disabled={loading}>
                                    <X size={15} /> Rejeter
                                </Button>
                                <Button onClick={() => decideAbsence(g, 'VALIDE')} disabled={loading}>
                                    <Check size={15} /> Valider
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        );
    };

    const renderRapports = () => {
        if (rapports.length === 0) {
            return <EmptyState icon={FileText} label="Aucun rapport d'activité en attente." />;
        }
        return (
            <div className="space-y-4">
                {rapports.map((r) => {
                    const key = `rap-${r.id}`;
                    const taches = (r.tachesRealisees || '').split('\n').map((t) => t.trim()).filter(Boolean);
                    return (
                        <Card key={key}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <button
                                    onClick={() => toggleExpand(key)}
                                    className="flex items-center gap-3 text-left"
                                >
                                    {expanded[key]
                                        ? <ChevronUp size={18} className="text-gray-400" />
                                        : <ChevronDown size={18} className="text-gray-400" />}
                                    <div>
                                        <div className="font-black flex items-center gap-2" style={{ color: COLORS.blue }}>
                                            <User size={15} style={{ color: COLORS.green }} />
                                            {r.consultantNom}
                                        </div>
                                        <div className="text-xs text-gray-500 font-bold mt-0.5">
                                            {r.cabinetNom} · {r.moisLabel} · {fmtJH(r.totalJH)} JH
                                        </div>
                                    </div>
                                </button>
                                <div className="flex items-center gap-2">
                                    <StatusBadge statut={r.statut || 'EN_ATTENTE'} />
                                    <Button variant="danger" onClick={() => rejeterRapport(r)} disabled={loading}>
                                        <X size={15} /> Rejeter
                                    </Button>
                                    <Button onClick={() => validerRapport(r)} disabled={loading}>
                                        <Check size={15} /> Valider
                                    </Button>
                                </div>
                            </div>

                            {expanded[key] && (
                                <div className="mt-4 border-t border-gray-100 pt-3 grid gap-4 md:grid-cols-2">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">
                                            Bons de commande utilisés
                                        </div>
                                        {(r.bdcUtilises || []).length === 0 ? (
                                            <p className="text-sm text-gray-400">Aucun BC utilisé.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {r.bdcUtilises.map((bc, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                                                        <span className="font-bold text-gray-700">{bc.reference}</span>
                                                        <span className="font-black" style={{ color: COLORS.gold }}>
                                                            {fmtJH(bc.jours)} JH
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">
                                            Tâches réalisées
                                        </div>
                                        {taches.length === 0 ? (
                                            <p className="text-sm text-gray-400">Aucune tâche renseignée.</p>
                                        ) : (
                                            <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
                                                {taches.map((t, i) => <li key={i}>{t}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        );
    };

    return (
        <div>
            <PageHeader
                icon={ClipboardCheck}
                title="Validation"
                subtitle="Pointages, absences et rapports d'activité en attente"
            />

            <Tabs
                tabs={[
                    { key: TAB_POINTAGES, label: 'Pointages (RPI)', count: counts.pointages },
                    { key: TAB_ABSENCES, label: 'Congés & Absences', count: counts.absences },
                    { key: TAB_RAPPORTS, label: "Rapports d'Activité", count: counts.rapports },
                ]}
                active={activeTab}
                onChange={setActiveTab}
            />

            {message && (
                <div
                    className="flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3 mb-4 border"
                    style={message.type === 'success'
                        ? { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' }
                        : { backgroundColor: '#fee2e2', color: COLORS.red, borderColor: '#fecaca' }}
                >
                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                </div>
            )}

            {loading ? (
                <Card className="py-12 text-center text-sm font-bold text-gray-400">
                    Chargement…
                </Card>
            ) : (
                <>
                    {activeTab === TAB_POINTAGES && renderPointages()}
                    {activeTab === TAB_ABSENCES && renderAbsences()}
                    {activeTab === TAB_RAPPORTS && renderRapports()}
                </>
            )}
        </div>
    );
};

export default ValidationHub;
