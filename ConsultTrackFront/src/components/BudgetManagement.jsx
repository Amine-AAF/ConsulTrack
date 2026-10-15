import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axiosConfig';
import { AlertCircle, FileUp, Landmark, Pencil, Plus, RefreshCw, Save, Link2 } from 'lucide-react';
import { Button, Card, PageHeader, StatCard, COLORS } from './ui/index.jsx';

const inputCls = 'p-2.5 border border-gray-200 rounded-xl text-sm w-full outline-none focus:border-[#008858] bg-white';
const emptyBudget = (year) => ({ annee: year, codeBudget: '', typeBudget: '', description: '', budgetTotal: '', reporteAnterieur: '', engageActif: '', realise: '', disponible: '', consomme: '', reste2025: '', sectionAnalytique: '', notes: '' });
const emptyDa = { referenceExterne: '', responsable: '', consultantId: '', nomConsultant: '', projet: '', tjm: '', jours: '', montant: '', statutExterne: 'Validée en externe' };
const money = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const cleanHeader = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const numberValue = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (v == null || String(v).trim() === '') return null;
    const firstLine = String(v).trim().split(/[\r\n]+/)[0];
    const match = firstLine.replace(/\s/g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
};
const rowsWithHeaders = (sheet) => {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    if (!rows.length) return [];
    const headers = rows[0].map(cleanHeader);
    return rows.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
};
const get = (row, ...names) => {
    for (const name of names) {
        const value = row[cleanHeader(name)];
        if (value != null && value !== '') return value;
    }
    return null;
};

const parseWorkbook = async (file, year) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const budgetsSheet = workbook.Sheets.Budgets;
    const daSheet = workbook.Sheets['DA v2'] || workbook.Sheets['DA Consultants'];
    if (!budgetsSheet) throw new Error('Feuille « Budgets » introuvable.');
    if (!daSheet) throw new Error('Feuille « DA v2 » ou « DA Consultants » introuvable.');

    const budgetRows = rowsWithHeaders(budgetsSheet);
    const budgetsByCode = new Map();
    for (const row of budgetRows) {
        const code = String(get(row, 'Code BudgétaireAscending', 'Code Budgétaire', 'Code Budget') ?? '').trim();
        const amount = numberValue(get(row, 'Budget avec Transfert et Rallonge', 'Budget total'));
        // Les lignes secondaires répètent parfois le code pour porter une estimation en formule.
        if (!code || amount == null) continue;
        const normalizedCode = code.toUpperCase();
        if (budgetsByCode.has(normalizedCode)) continue;
        budgetsByCode.set(normalizedCode, {
            annee: year,
            codeBudget: code,
            typeBudget: get(row, 'Type de Budget'),
            description: get(row, 'Description du code Budgétaire'),
            budgetTotal: amount,
            reporteAnterieur: numberValue(get(row, 'Report Engagé Ex. Ant')),
            engageActif: numberValue(get(row, 'Engagé Actif')),
            realise: numberValue(get(row, 'Réalisé')),
            disponible: numberValue(get(row, 'Disponible')),
            sectionAnalytique: get(row, 'Section Analytique'),
            consomme: numberValue(get(row, 'Consommé')),
            reste2025: get(row, 'Reste 2025'),
            notes: get(row, 'Notes', 'Remarques'),
        });
    }

    const demandeRows = rowsWithHeaders(daSheet);
    const demandes = demandeRows.flatMap((row, rowIndex) => {
        const budgetCode = String(get(row, 'Budget') ?? '').trim();
        if (!budgetCode || !budgetsByCode.has(budgetCode.toUpperCase())) return [];
        const tjm = numberValue(get(row, 'TJM'));
        const jours = numberValue(get(row, 'JH'));
        return [{
            annee: year,
            rowNumber: rowIndex + 2,
            budgetCode,
            referenceExterne: get(row, 'DA'),
            responsable: get(row, 'Responsable'),
            nomConsultant: get(row, 'Consultant'),
            tjm,
            jours,
            montant: numberValue(get(row, 'Total MAD')) ?? (tjm != null && jours != null ? tjm * jours : null),
            projet: get(row, 'Projet') || budgetsByCode.get(budgetCode.toUpperCase())?.description,
            statutExterne: get(row, '') || 'Validée en externe',
        }];
    });
    return { budgets: [...budgetsByCode.values()], demandes };
};

export default function BudgetManagement({ isAdmin = false, directions = [] }) {
    const yearNow = new Date().getFullYear();
    const [year, setYear] = useState(yearNow);
    const [budgets, setBudgets] = useState([]);
    const [consultants, setConsultants] = useState([]);
    const [bcs, setBcs] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [demandes, setDemandes] = useState([]);
    const [budgetForm, setBudgetForm] = useState(null);
    const [daForm, setDaForm] = useState(null);
    const [bcForm, setBcForm] = useState(null);
    const [pendingImport, setPendingImport] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const fileRef = useRef(null);
    const selected = budgets.find((b) => b.id === selectedId) || null;
    const demandesActives = demandes.filter((d) => !d.bcReference);
    const bcIssusDesDa = demandes.filter((d) => Boolean(d.bcReference));
    const selectedBcs = selected ? bcs.filter((bc) =>
        String(bc.codeBudget || '').trim().toUpperCase() === String(selected.codeBudget || '').trim().toUpperCase()
        && Number(bc.anneeBudgetaire) === Number(selected.annee)) : [];

    const load = useCallback(async () => {
        setBusy(true); setError('');
        try {
            const [budgetRes, consultantRes, bcRes] = await Promise.all([
                api.get(`/admin/budgets?annee=${year}`), api.get('/admin/consultants'), api.get('/admin/bcs'),
            ]);
            setBudgets(budgetRes.data || []);
            setConsultants(consultantRes.data || []);
            setBcs(bcRes.data || []);
            if (selectedId && !(budgetRes.data || []).some((b) => b.id === selectedId)) setSelectedId(null);
        } catch (err) { setError(err.response?.data?.message || 'Impossible de charger les budgets.'); }
        finally { setBusy(false); }
    }, [year, selectedId]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!selectedId) { setDemandes([]); return; }
        api.get(`/admin/budgets/${selectedId}/demandes`).then((r) => setDemandes(r.data || []))
            .catch((err) => setError(err.response?.data?.message || 'Impossible de charger les DA.'));
    }, [selectedId]);

    const saveBudget = async (event) => {
        event.preventDefault(); setError('');
        const payload = Object.fromEntries(Object.entries(budgetForm).map(([k, v]) => [k,
            ['annee', 'budgetTotal', 'reporteAnterieur', 'engageActif', 'realise', 'disponible', 'consomme'].includes(k)
                ? (v === '' || v == null ? null : Number(v)) : v,
        ]));
        try {
            const res = budgetForm.id ? await api.put(`/admin/budgets/${budgetForm.id}`, payload)
                : await api.post('/admin/budgets', payload);
            setNotice('Budget enregistré.'); setBudgetForm(null); await load(); setSelectedId(res.data.id);
        } catch (err) { setError(err.response?.data?.message || 'Enregistrement du budget impossible.'); }
    };
    const saveDa = async (event) => {
        event.preventDefault(); setError('');
        const consultant = consultants.find((c) => String(c.id) === String(daForm.consultantId));
        const payload = { ...daForm, budgetId: selectedId, consultantId: consultant?.id || null,
            nomConsultant: consultant ? `${consultant.prenom} ${consultant.nom}` : daForm.nomConsultant,
            tjm: numberValue(daForm.tjm), jours: numberValue(daForm.jours), montant: numberValue(daForm.montant) };
        try {
            if (daForm.id) await api.put(`/admin/budgets/demandes/${daForm.id}`, payload);
            else await api.post(`/admin/budgets/${selectedId}/demandes`, payload);
            setDaForm(null); setNotice('DA enregistrée.'); await loadDemandes();
        } catch (err) { setError(err.response?.data?.message || 'Enregistrement de la DA impossible.'); }
    };
    const loadDemandes = async () => {
        if (!selectedId) return;
        const res = await api.get(`/admin/budgets/${selectedId}/demandes`); setDemandes(res.data || []); await load();
    };
    const importFile = async (file) => {
        setError(''); setNotice('');
        if (!isAdmin) return;
        try { setPendingImport(await parseWorkbook(file, year)); }
        catch (err) { setError(err.message || 'Lecture du classeur impossible.'); setPendingImport(null); }
    };
    const confirmImport = async () => {
        if (!pendingImport) return;
        setBusy(true); setError('');
        try {
            const result = await api.post('/admin/budgets/import', pendingImport);
            setPendingImport(null); setNotice(`${result.data.budgets} budgets et ${result.data.demandes} DA importés ou mis à jour.`);
            await load();
        } catch (err) { setError(err.response?.data?.message || 'Import impossible.'); }
        finally { setBusy(false); }
    };
    const createBc = async (event) => {
        event.preventDefault(); setError('');
        try {
            await api.post(`/admin/budgets/demandes/${bcForm.id}/bc`, {
                reference: bcForm.reference, consultantId: bcForm.consultantId ? Number(bcForm.consultantId) : null,
            });
            setBcForm(null); setNotice('BC enregistré dans ConsulTrack et associé à la DA.'); await loadDemandes();
        } catch (err) { setError(err.response?.data?.message || 'Création du BC impossible.'); }
    };

    return (
        <div className="mx-auto max-w-7xl p-4">
            <PageHeader icon={Landmark} title="Gestion des budgets" subtitle="Budgets annuels, DA validées à l’extérieur et BC émis"
                actions={<div className="flex gap-2 items-center">
                    <select className={inputCls} value={year} onChange={(e) => { setYear(Number(e.target.value)); setSelectedId(null); }}>
                        {[yearNow - 2, yearNow - 1, yearNow, yearNow + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {isAdmin && <><Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp size={16} /> Import Excel</Button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); e.target.value = ''; }} /></>}
                </div>} />

            {error && <div className="mb-4 p-3 rounded-xl flex gap-2 items-center text-sm font-bold" style={{ background: '#fee2e2', color: COLORS.red }}><AlertCircle size={16} />{error}</div>}
            {notice && <div className="mb-4 p-3 rounded-xl text-sm font-bold bg-green-50 text-green-800">{notice}</div>}

            {pendingImport && <Card className="mb-5 border-green-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><div className="font-black" style={{ color: COLORS.blue }}>Import prêt pour {year}</div>
                        <p className="text-sm text-gray-500 mt-1">{pendingImport.budgets.length} budgets (feuille Budgets), {pendingImport.demandes.length} lignes DA (feuille DA v2). Les BC des autres feuilles ne sont pas importés automatiquement.</p>
                    </div><div className="flex gap-2"><Button variant="outline" onClick={() => setPendingImport(null)}>Annuler</Button><Button disabled={busy} onClick={confirmImport}><FileUp size={16} /> Importer</Button></div>
                </div>
            </Card>}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                <StatCard label="Budgets" value={budgets.length} unit="" />
                <StatCard label="Enveloppe totale" value={money(budgets.reduce((s, b) => s + (b.budgetTotal || 0), 0))} unit="MAD" />
                <StatCard label="Disponible importé" value={money(budgets.reduce((s, b) => s + (b.disponible || 0), 0))} unit="MAD" />
                <StatCard label="DA enregistrées" value={budgets.reduce((s, b) => s + (b.nombreDemandes || 0), 0)} unit="" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
                <Card className="lg:col-span-2 p-0 overflow-hidden">
                    <div className="p-4 flex items-center justify-between border-b"><h2 className="font-black" style={{ color: COLORS.blue }}>Budgets {year}</h2>
                        <div className="flex gap-2"><Button variant="outline" onClick={load} title="Actualiser"><RefreshCw size={15} /></Button><Button onClick={() => setBudgetForm({ ...emptyBudget(year), scope: isAdmin ? 'POLE' : 'DIRECTION' })}><Plus size={15} /> Budget direction</Button></div>
                    </div>
                    {busy && budgets.length === 0 ? <p className="p-6 text-sm text-gray-400">Chargement…</p> : budgets.length === 0 ? <p className="p-6 text-sm text-gray-400">Aucun budget pour {year}.</p> :
                        <div className="max-h-[620px] overflow-auto divide-y">{budgets.map((b) => <button key={b.id} onClick={() => { setSelectedId(b.id); setBudgetForm(null); }} className={`w-full text-left p-4 hover:bg-gray-50 ${b.id === selectedId ? 'bg-green-50' : 'bg-white'}`}>
                            <div className="flex justify-between gap-2"><span className="font-black font-mono" style={{ color: COLORS.blue }}>{b.codeBudget}</span><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.typeBudget === 'OPEX' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>{b.typeBudget || 'Type à préciser'}{b.typeBudget ? ` · ${b.typeBudget === 'OPEX' ? 'RUN' : 'PROJET'}` : ''}</span></div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{b.description || 'Sans description'}</p>
                            <div className="flex justify-between mt-2 text-xs"><span>{money(b.disponible)} MAD disponible</span><span>{b.nombreDemandes} DA · {b.nombreBC} BC</span></div>
                        </button>)}</div>}
                </Card>

                <div className="lg:col-span-3 space-y-5">
                    {budgetForm && <Card><h2 className="font-black mb-4" style={{ color: COLORS.blue }}>{budgetForm.id ? 'Modifier le budget' : 'Nouveau budget'}</h2>
                        {!isAdmin && <p className="text-sm text-gray-500 mb-3">Ce budget sera rattaché à votre direction. L’enveloppe Pôle reste consultable en lecture seule.</p>}
                        <form onSubmit={saveBudget} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {isAdmin && <label className="text-xs font-bold text-gray-600">Périmètre<select className={inputCls} value={budgetForm.scope || 'POLE'} onChange={(e) => setBudgetForm({ ...budgetForm, scope: e.target.value, directionId: e.target.value === 'POLE' ? null : budgetForm.directionId })}><option value="POLE">Budget partagé Pôle</option><option value="DIRECTION">Budget de direction</option></select></label>}
                            {isAdmin && budgetForm.scope === 'DIRECTION' && <label className="text-xs font-bold text-gray-600">Direction<select className={inputCls} required value={budgetForm.directionId || ''} onChange={(e) => setBudgetForm({ ...budgetForm, directionId: Number(e.target.value) || null })}><option value="">Choisir…</option>{directions.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</select></label>}
                            <Field label="Année" type="number" value={budgetForm.annee} onChange={(v) => setBudgetForm({ ...budgetForm, annee: v })} required />
                            <Field label="Code budgétaire" value={budgetForm.codeBudget} onChange={(v) => setBudgetForm({ ...budgetForm, codeBudget: v })} required />
                            <label className="text-xs font-bold text-gray-600">Type de budget
                                <select className={inputCls} required value={budgetForm.typeBudget || ''} onChange={(e) => setBudgetForm({ ...budgetForm, typeBudget: e.target.value })}>
                                    <option value="">Choisir un type…</option><option value="OPEX">OPEX</option><option value="CAPEX">CAPEX</option>
                                </select>
                                <span className="block mt-1 text-[11px] font-normal text-gray-500">OPEX alimente la nature RUN des RA ; CAPEX alimente PROJET. Le type budgétaire reste une information distincte.</span>
                            </label>
                            <Field label="Section analytique" value={budgetForm.sectionAnalytique || ''} onChange={(v) => setBudgetForm({ ...budgetForm, sectionAnalytique: v })} />
                            <Field label="Description" value={budgetForm.description || ''} onChange={(v) => setBudgetForm({ ...budgetForm, description: v })} wide />
                            <Field label="Budget avec transferts (MAD)" type="number" value={budgetForm.budgetTotal} onChange={(v) => setBudgetForm({ ...budgetForm, budgetTotal: v })} />
                            <Field label="Report engagé antérieur (MAD)" type="number" value={budgetForm.reporteAnterieur} onChange={(v) => setBudgetForm({ ...budgetForm, reporteAnterieur: v })} />
                            <Field label="Engagé actif (MAD)" type="number" value={budgetForm.engageActif} onChange={(v) => setBudgetForm({ ...budgetForm, engageActif: v })} />
                            <Field label="Réalisé (MAD)" type="number" value={budgetForm.realise} onChange={(v) => setBudgetForm({ ...budgetForm, realise: v })} />
                            <Field label="Disponible (MAD)" type="number" value={budgetForm.disponible} onChange={(v) => setBudgetForm({ ...budgetForm, disponible: v })} />
                            <Field label="Consommé (MAD)" type="number" value={budgetForm.consomme} onChange={(v) => setBudgetForm({ ...budgetForm, consomme: v })} />
                            <Field label="Reste 2025" value={budgetForm.reste2025 || ''} onChange={(v) => setBudgetForm({ ...budgetForm, reste2025: v })} />
                            <div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setBudgetForm(null)}>Annuler</Button><Button type="submit"><Save size={15} /> Enregistrer</Button></div>
                        </form>
                    </Card>}

                    {selected ? <>
                        <Card>
                            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black" style={{ color: COLORS.blue }}>{selected.codeBudget} · {selected.annee}</h2><p className="text-sm text-gray-500 mt-1">{selected.scope === 'POLE' ? 'Budget partagé Pôle' : `Budget ${selected.directionNom || 'direction'}`} · {selected.description} · {selected.typeBudget || 'Type non précisé'}{selected.typeBudget ? ` → ${selected.typeBudget === 'OPEX' ? 'RUN' : 'PROJET'} dans les RA` : ''} · {selected.sectionAnalytique || 'Sans section analytique'}</p></div>{selected.canEdit && <Button variant="outline" onClick={() => setBudgetForm({ ...selected })}>Modifier</Button>}</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                                <Metric label="Enveloppe" value={selected.budgetTotal} /><Metric label="Report antérieur" value={selected.reporteAnterieur} /><Metric label="Engagé actif" value={selected.engageActif} /><Metric label="Réalisé" value={selected.realise} /><Metric label="Disponible" value={selected.disponible} />
                            </div>
                            {selected.dateMiseAJour && <p className="text-xs text-gray-400 mt-3">État saisi/importé le {new Date(selected.dateMiseAJour).toLocaleString('fr-FR')}</p>}
                            {selected.notes && <p className="text-xs text-gray-500 mt-3">{selected.notes}</p>}
                        </Card>
                        <Card className="p-0 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                                <div><h2 className="font-black" style={{ color: COLORS.blue }}>BC liés à {selected.codeBudget}</h2>
                                    <p className="mt-1 text-xs text-gray-500">BC de l’exercice {selected.annee}, reliquats inclus lorsqu’ils portent ce code budget.</p></div>
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-800">{selectedBcs.length} BC</span>
                            </div>
                            {selectedBcs.length === 0 ? <p className="p-5 text-sm text-gray-400">Aucun BC lié à ce budget pour cet exercice.</p> :
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead><tr className="border-b bg-gray-50 text-left text-[10px] uppercase text-gray-400"><th className="p-3">Référence BC</th><th className="p-3">Consultant</th><th className="p-3">Désignation</th><th className="p-3">Statut</th><th className="p-3 text-right">Consommé / engagé / max</th></tr></thead>
                                        <tbody className="divide-y">{selectedBcs.map((bc) => <tr key={bc.id}>
                                            <td className="p-3 font-mono font-bold text-[#003366]">{bc.reference || 'Sans référence'}</td>
                                            <td className="p-3 text-gray-600">{bc.consultant ? `${bc.consultant.prenom || ''} ${bc.consultant.nom || ''}`.trim() : 'Non affecté'}</td>
                                            <td className="max-w-[220px] p-3 text-gray-600">{bc.designation || '—'}</td>
                                            <td className="p-3">{bc.statut || 'Non renseigné'}</td>
                                            <td className="whitespace-nowrap p-3 text-right font-bold">{Number(bc.joursConsommes || 0).toLocaleString('fr-FR')} / {Number(bc.joursEngages || 0).toLocaleString('fr-FR')} / {Number(bc.joursMax || 0).toLocaleString('fr-FR')} JH</td>
                                        </tr>)}</tbody>
                                    </table>
                                </div>}
                        </Card>
                        <Card className="p-0 overflow-hidden">
                            <div className="p-4 flex items-center justify-between border-b"><div><h2 className="font-black" style={{ color: COLORS.blue }}>DA validées à l’extérieur · à convertir</h2><p className="text-xs text-gray-500">Après émission du BC, la ligne passe dans les BC établis ci-dessous.</p></div><Button onClick={() => setDaForm({ ...emptyDa })}><Plus size={15} /> Ajouter une DA</Button></div>
                            {daForm && <form onSubmit={saveDa} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 border-b">
                                <Field label="Référence DA" value={daForm.referenceExterne || ''} onChange={(v) => setDaForm({ ...daForm, referenceExterne: v })} />
                                <Field label="Responsable" value={daForm.responsable || ''} onChange={(v) => setDaForm({ ...daForm, responsable: v })} />
                                <label className="text-xs font-bold text-gray-600">Consultant<select className={inputCls} value={daForm.consultantId || ''} onChange={(e) => setDaForm({ ...daForm, consultantId: e.target.value })}><option value="">Non associé</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select></label>
                                <Field label="Consultant (si non référencé)" value={daForm.nomConsultant || ''} onChange={(v) => setDaForm({ ...daForm, nomConsultant: v })} />
                                <Field label="TJM (MAD)" type="number" value={daForm.tjm || ''} onChange={(v) => setDaForm({ ...daForm, tjm: v })} />
                                <Field label="Jours" type="number" value={daForm.jours || ''} onChange={(v) => setDaForm({ ...daForm, jours: v })} />
                                <Field label="Montant (laisser vide pour TJM × jours)" type="number" value={daForm.montant || ''} onChange={(v) => setDaForm({ ...daForm, montant: v })} />
                                <Field label="Statut externe" value={daForm.statutExterne || ''} onChange={(v) => setDaForm({ ...daForm, statutExterne: v })} />
                                <Field label="Projet / objet de la DA" value={daForm.projet || ''} onChange={(v) => setDaForm({ ...daForm, projet: v })} wide />
                                <div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDaForm(null)}>Annuler</Button><Button type="submit"><Save size={15} /> Enregistrer la DA</Button></div>
                            </form>}
                            {demandesActives.length === 0 ? <p className="p-6 text-sm text-gray-400">Aucune DA en attente de BC pour ce budget.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[10px] uppercase text-gray-400 border-b"><th className="p-3">DA / Consultant</th><th className="p-3">Projet</th><th className="p-3 text-right">JH</th><th className="p-3 text-right">Montant</th><th className="p-3">Validation externe</th><th className="p-3">Action</th><th className="p-3" /></tr></thead><tbody className="divide-y">{demandesActives.map((d) => <tr key={d.id}><td className="p-3"><div className="font-bold">{d.referenceExterne || 'DA sans référence'}</div><div className="text-xs text-gray-500">{d.nomConsultant || 'Consultant non renseigné'} · {d.responsable || '—'}</div></td><td className="p-3 text-gray-600 max-w-[220px]">{d.projet || '—'}</td><td className="p-3 text-right">{d.jours ?? '—'}</td><td className="p-3 text-right font-bold">{money(d.montant)} MAD</td><td className="p-3 text-xs">{d.statutExterne || 'Validée en externe'}</td><td className="p-3"><Button variant="outline" className="px-2 py-1.5" onClick={() => setBcForm({ id: d.id, reference: '', consultantId: d.consultantId || '' })}><Link2 size={14} /> Établir le BC</Button></td><td className="p-3"><button title="Modifier la DA" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setDaForm({ ...d, montant: d.montant ?? '', tjm: d.tjm ?? '', jours: d.jours ?? '', consultantId: d.consultantId || '' })}><Pencil size={15} /></button></td></tr>)}</tbody></table></div>}
                            {bcIssusDesDa.length > 0 && <div className="border-t"><div className="p-4"><h3 className="font-black" style={{ color: COLORS.blue }}>BC établis à partir des DA</h3><p className="text-xs text-gray-500">Ces dossiers sont maintenant suivis comme des BC, la DA n’est plus présentée comme une étape active.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[10px] uppercase text-gray-400 border-b"><th className="p-3">Référence BC / Consultant</th><th className="p-3">Projet</th><th className="p-3 text-right">JH</th><th className="p-3 text-right">Montant</th><th className="p-3">État</th></tr></thead><tbody className="divide-y">{bcIssusDesDa.map((d) => <tr key={d.id}><td className="p-3"><div className="font-mono font-bold text-green-700">{d.bcReference}</div><div className="text-xs text-gray-500">{d.nomConsultant || 'Consultant non renseigné'}</div></td><td className="p-3 text-gray-600">{d.projet || '—'}</td><td className="p-3 text-right">{d.jours ?? '—'}</td><td className="p-3 text-right font-bold">{money(d.montant)} MAD</td><td className="p-3 text-xs">BC établi</td></tr>)}</tbody></table></div></div>}
                        </Card>
                    </> : <Card className="text-center text-gray-400 p-10">Sélectionne un budget pour consulter ses DA et BC associés.</Card>}
                </div>
            </div>

            {bcForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><Card className="w-full max-w-lg"><h2 className="font-black text-lg mb-4" style={{ color: COLORS.blue }}>Enregistrer le BC émis</h2><form onSubmit={createBc} className="space-y-3">
                <Field label="Référence du BC" value={bcForm.reference} onChange={(v) => setBcForm({ ...bcForm, reference: v })} required />
                <label className="text-xs font-bold text-gray-600">Consultant<select className={inputCls} required value={bcForm.consultantId} onChange={(e) => setBcForm({ ...bcForm, consultantId: e.target.value })}><option value="">Choisir…</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select></label>
                <p className="text-xs text-gray-500">Saisis la référence du BC obtenu à l’extérieur. ConsulTrack l’enregistre avec le code budgétaire, le TJM et les jours de la DA.</p>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setBcForm(null)}>Annuler</Button><Button type="submit"><Link2 size={15} /> Enregistrer et associer</Button></div>
            </form></Card></div>}
        </div>
    );
}

function Field({ label, value, onChange, type = 'text', required = false, wide = false }) {
    return <label className={`text-xs font-bold text-gray-600 ${wide ? 'md:col-span-2' : ''}`}>{label}<input className={inputCls} type={type} required={required} step={type === 'number' ? 'any' : undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></label>;
}
function Metric({ label, value }) { return <div className="p-3 rounded-xl bg-gray-50"><div className="text-[10px] uppercase text-gray-400 font-bold">{label}</div><div className="font-black mt-1" style={{ color: COLORS.blue }}>{money(value)} MAD</div></div>; }
