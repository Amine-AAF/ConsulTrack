import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import {
    Building2, Users, FileStack, ShieldCheck, Landmark,
    CalendarDays, Plus, Trash2, AlertCircle, KeyRound, Mail,
} from 'lucide-react';
import {
    PageHeader, Button, Tabs, Card, BudgetGauge, COLORS,
} from './ui/index.jsx';

/* ============================================================
   Console d'administration — Référentiel uniquement
   (Cabinets, Utilisateurs, Bons de Commande, Jours fériés)
   ============================================================ */

const ROLE_STYLES = {
    ADMIN: { bg: '#fee2e2', fg: COLORS.red, label: 'Admin' },
    RESPONSABLE: { bg: '#e0e7ff', fg: '#4338ca', label: 'Responsable' },
    CONSULTANT: { bg: '#dcfce7', fg: '#15803d', label: 'Consultant' },
};

const RoleBadge = ({ role }) => {
    const s = ROLE_STYLES[role] || { bg: '#f1f5f9', fg: '#64748b', label: role || '—' };
    return (
        <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full"
              style={{ backgroundColor: s.bg, color: s.fg }}>
            {s.label}
        </span>
    );
};

const inputCls = 'p-2.5 border border-gray-200 rounded-xl text-sm w-full outline-none focus:border-[#008858] bg-white';

const ErrorBanner = ({ message }) => message ? (
    <div className="flex items-center gap-2 text-sm font-bold p-3 rounded-xl mb-4"
         style={{ backgroundColor: '#fee2e2', color: COLORS.red }}>
        <AlertCircle size={16} /> {message}
    </div>
) : null;

const getErr = (err) => err.response?.data?.message || 'Une erreur est survenue.';

const AdminPanel = ({ userRole }) => {
    const isAdmin = userRole === 'ADMIN';
    const [activeTab, setActiveTab] = useState('cabinets');

    const [cabinets, setCabinets] = useState([]);
    const [consultants, setConsultants] = useState([]);
    const [bcs, setBcs] = useState([]);
    const [loading, setLoading] = useState(true);

    const tabs = [
        { key: 'cabinets', label: 'Cabinets' },
        ...(isAdmin ? [{ key: 'users', label: 'Utilisateurs' }] : []),
        { key: 'bcs', label: 'Bons de Commande' },
        ...(isAdmin ? [{ key: 'feries', label: 'Jours fériés' }] : []),
    ];

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [cabRes, consRes, bcRes] = await Promise.all([
                api.get('/admin/cabinets'),
                api.get('/admin/consultants'),
                api.get('/admin/bcs'),
            ]);
            setCabinets(cabRes.data);
            setConsultants(consRes.data);
            setBcs(bcRes.data);
        } catch (err) {
            console.error('Erreur chargement référentiel', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    return (
        <div className="mx-auto max-w-7xl p-4">
            <PageHeader
                icon={ShieldCheck}
                title="Administration"
                subtitle="Référentiel : cabinets, utilisateurs, bons de commande et jours fériés"
            />

            <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

            {loading ? (
                <div className="text-center p-20 font-bold animate-pulse" style={{ color: COLORS.blue }}>
                    Chargement des données...
                </div>
            ) : (
                <>
                    {activeTab === 'cabinets' && <CabinetSection cabinets={cabinets} onRefresh={loadData} />}
                    {activeTab === 'users' && isAdmin && (
                        <UserSection consultants={consultants} cabinets={cabinets} onRefresh={loadData} />
                    )}
                    {activeTab === 'bcs' && <BCSection bcs={bcs} consultants={consultants} onRefresh={loadData} />}
                    {activeTab === 'feries' && isAdmin && <JoursFeriesSection />}
                </>
            )}
        </div>
    );
};

/* ==========================================
   1. CABINETS
   ========================================== */
const CabinetSection = ({ cabinets, onRefresh }) => {
    const emptyForm = { nom: '', adresse: '', ice: '', identifiantFiscal: '', patente: '', rib: '' };
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setError('');
        if (!form.nom.trim()) { setError('La raison sociale est obligatoire.'); return; }
        setSaving(true);
        try {
            await api.post('/admin/cabinets', form);
            setForm(emptyForm);
            onRefresh();
        } catch (err) { setError(getErr(err)); }
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    <Landmark size={18} style={{ color: COLORS.green }} /> Nouveau cabinet (ESN)
                </h3>
                <ErrorBanner message={error} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className={inputCls} placeholder="Raison sociale *" value={form.nom}
                           onChange={e => setForm({ ...form, nom: e.target.value })} />
                    <input className={inputCls} placeholder="Adresse" value={form.adresse}
                           onChange={e => setForm({ ...form, adresse: e.target.value })} />
                    <input className={inputCls} placeholder="ICE" value={form.ice}
                           onChange={e => setForm({ ...form, ice: e.target.value })} />
                    <input className={inputCls} placeholder="Identifiant fiscal (IF)" value={form.identifiantFiscal}
                           onChange={e => setForm({ ...form, identifiantFiscal: e.target.value })} />
                    <input className={inputCls} placeholder="Patente" value={form.patente}
                           onChange={e => setForm({ ...form, patente: e.target.value })} />
                    <input className={inputCls} placeholder="RIB" value={form.rib}
                           onChange={e => setForm({ ...form, rib: e.target.value })} />
                </div>
                <div className="mt-4">
                    <Button onClick={save} disabled={saving}>
                        <Plus size={16} /> Enregistrer le cabinet
                    </Button>
                </div>
            </Card>

            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    <Building2 size={18} style={{ color: COLORS.green }} /> Cabinets référencés ({cabinets.length})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
                            <th className="p-3">Cabinet</th>
                            <th className="p-3">Adresse</th>
                            <th className="p-3">ICE</th>
                            <th className="p-3">IF</th>
                            <th className="p-3">Patente</th>
                            <th className="p-3">RIB</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {cabinets.length === 0 ? (
                            <tr><td colSpan="6" className="p-6 text-center text-gray-400 italic">Aucun cabinet référencé.</td></tr>
                        ) : cabinets.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="p-3 font-bold" style={{ color: COLORS.blue }}>{c.nom}</td>
                                <td className="p-3 text-gray-500">{c.adresse || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.ice || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.identifiantFiscal || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.patente || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.rib || '—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

/* ==========================================
   2. UTILISATEURS (ADMIN uniquement)
   ========================================== */
const UserSection = ({ consultants, cabinets, onRefresh }) => {
    const emptyForm = { nom: '', prenom: '', email: '', password: '', role: 'CONSULTANT', cabinetId: '', cabinetsGeresIds: [] };
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const toggleCabinetGere = (id) => {
        setForm(f => ({
            ...f,
            cabinetsGeresIds: f.cabinetsGeresIds.includes(id)
                ? f.cabinetsGeresIds.filter(x => x !== id)
                : [...f.cabinetsGeresIds, id],
        }));
    };

    const save = async () => {
        setError('');
        if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim() || !form.password) {
            setError('Nom, prénom, email et mot de passe sont obligatoires.');
            return;
        }
        if (form.role === 'CONSULTANT' && !form.cabinetId) {
            setError('Le cabinet est obligatoire pour un consultant.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/admin/consultants', {
                nom: form.nom,
                prenom: form.prenom,
                email: form.email,
                password: form.password,
                role: form.role,
                cabinet: form.cabinetId ? { id: parseInt(form.cabinetId, 10) } : null,
                cabinetsGeresIds: form.role === 'RESPONSABLE' ? form.cabinetsGeresIds : [],
            });
            setForm(emptyForm);
            onRefresh();
        } catch (err) { setError(getErr(err)); }
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    <Plus size={18} style={{ color: COLORS.green }} /> Nouvel utilisateur
                </h3>
                <ErrorBanner message={error} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className={inputCls} placeholder="Nom *" value={form.nom}
                           onChange={e => setForm({ ...form, nom: e.target.value })} />
                    <input className={inputCls} placeholder="Prénom *" value={form.prenom}
                           onChange={e => setForm({ ...form, prenom: e.target.value })} />
                    <input className={inputCls} type="email" placeholder="Email *" value={form.email}
                           onChange={e => setForm({ ...form, email: e.target.value })} />
                    <input className={inputCls} type="password" placeholder="Mot de passe *" value={form.password}
                           onChange={e => setForm({ ...form, password: e.target.value })} />
                    <select className={inputCls} value={form.role}
                            onChange={e => setForm({ ...form, role: e.target.value })}>
                        <option value="CONSULTANT">Consultant</option>
                        <option value="RESPONSABLE">Responsable</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    <select className={inputCls} value={form.cabinetId}
                            onChange={e => setForm({ ...form, cabinetId: e.target.value })}>
                        <option value="">
                            {form.role === 'CONSULTANT' ? 'Cabinet * (obligatoire)' : 'Cabinet (optionnel)'}
                        </option>
                        {cabinets.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                </div>

                {form.role === 'RESPONSABLE' && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="text-[11px] uppercase font-black tracking-wider text-gray-400 mb-3">
                            Cabinets gérés
                        </div>
                        {cabinets.length === 0 ? (
                            <div className="text-sm text-gray-400 italic">Aucun cabinet disponible.</div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {cabinets.map(c => (
                                    <label key={c.id}
                                           className="flex items-center gap-2 text-sm font-bold cursor-pointer bg-white px-3 py-2 rounded-xl border border-gray-200"
                                           style={{ color: COLORS.blue }}>
                                        <input
                                            type="checkbox"
                                            checked={form.cabinetsGeresIds.includes(c.id)}
                                            onChange={() => toggleCabinetGere(c.id)}
                                        />
                                        {c.nom}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-4">
                    <Button onClick={save} disabled={saving}>
                        <Plus size={16} /> Créer l'utilisateur
                    </Button>
                </div>
            </Card>

            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    <Users size={18} style={{ color: COLORS.green }} /> Utilisateurs ({consultants.length})
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
                            <th className="p-3">Utilisateur</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Rôle</th>
                            <th className="p-3">Cabinet</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {consultants.length === 0 ? (
                            <tr><td colSpan="4" className="p-6 text-center text-gray-400 italic">Aucun utilisateur.</td></tr>
                        ) : consultants.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="p-3 font-bold" style={{ color: COLORS.blue }}>
                                    {c.nom} {c.prenom}
                                </td>
                                <td className="p-3 text-gray-500">
                                    <span className="flex items-center gap-1.5"><Mail size={13} /> {c.email || '—'}</span>
                                </td>
                                <td className="p-3"><RoleBadge role={c.role} /></td>
                                <td className="p-3 text-gray-500 font-bold">{c.cabinet?.nom || '—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

/* ==========================================
   3. BONS DE COMMANDE
   ========================================== */
const BCSection = ({ bcs, consultants, onRefresh }) => {
    const emptyForm = { reference: '', joursMax: '', tjm: '', codeBudget: '', designation: '', consultantId: '' };
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setError('');
        if (!form.reference.trim() || !form.joursMax || !form.consultantId) {
            setError('Référence, jours max et consultant sont obligatoires.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/admin/bcs', {
                reference: form.reference,
                joursMax: parseFloat(form.joursMax),
                tjm: form.tjm ? parseFloat(form.tjm) : null,
                codeBudget: form.codeBudget,
                designation: form.designation,
                consultantId: parseInt(form.consultantId, 10),
            });
            setForm(emptyForm);
            onRefresh();
        } catch (err) { setError(getErr(err)); }
        setSaving(false);
    };

    const consultantsOnly = consultants.filter(c => !c.role || c.role === 'CONSULTANT');

    return (
        <div className="space-y-6">
            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    <FileStack size={18} style={{ color: COLORS.green }} /> Nouveau bon de commande
                </h3>
                <ErrorBanner message={error} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input className={inputCls} placeholder="Référence BC *" value={form.reference}
                           onChange={e => setForm({ ...form, reference: e.target.value })} />
                    <input className={inputCls} type="number" min="0" placeholder="Jours max (JH) *" value={form.joursMax}
                           onChange={e => setForm({ ...form, joursMax: e.target.value })} />
                    <input className={inputCls} type="number" min="0" placeholder="TJM (MAD)" value={form.tjm}
                           onChange={e => setForm({ ...form, tjm: e.target.value })} />
                    <input className={inputCls} placeholder="Code budgétaire" value={form.codeBudget}
                           onChange={e => setForm({ ...form, codeBudget: e.target.value })} />
                    <input className={inputCls} placeholder="Désignation" value={form.designation}
                           onChange={e => setForm({ ...form, designation: e.target.value })} />
                    <select className={inputCls} value={form.consultantId}
                            onChange={e => setForm({ ...form, consultantId: e.target.value })}>
                        <option value="">Consultant *</option>
                        {consultantsOnly.map(c => <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>)}
                    </select>
                </div>
                <div className="mt-4">
                    <Button onClick={save} disabled={saving}>
                        <Plus size={16} /> Créer le BC
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bcs.length === 0 ? (
                    <Card className="col-span-full text-center text-gray-400 italic">Aucun bon de commande.</Card>
                ) : bcs.map(bc => (
                    <Card key={bc.id}>
                        <div className="flex justify-between items-start mb-1">
                            <div className="font-black text-lg" style={{ color: COLORS.blue }}>{bc.reference}</div>
                            {bc.tjm != null && (
                                <span className="text-[11px] font-black px-2 py-1 rounded-full"
                                      style={{ backgroundColor: '#fdf6e9', color: COLORS.gold }}>
                                    {Number(bc.tjm).toLocaleString('fr-FR')} MAD/J
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-400 font-bold mb-1">{bc.codeBudget || '—'}</div>
                        {bc.designation && <div className="text-xs text-gray-500 mb-2">{bc.designation}</div>}
                        <div className="text-sm font-bold mb-3" style={{ color: COLORS.gold }}>
                            {bc.consultant ? `${bc.consultant.nom} ${bc.consultant.prenom || ''}` : 'Non affecté'}
                        </div>
                        <BudgetGauge label="Consommation" consomme={bc.joursConsommes ?? 0} max={bc.joursMax ?? 0} />
                    </Card>
                ))}
            </div>
        </div>
    );
};

/* ==========================================
   4. JOURS FÉRIÉS (ADMIN uniquement)
   ========================================== */
const JoursFeriesSection = () => {
    const currentYear = new Date().getFullYear();
    const [annee, setAnnee] = useState(currentYear);
    const [feries, setFeries] = useState([]);
    const [form, setForm] = useState({ date: '', libelle: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const load = useCallback(async (year) => {
        setLoading(true);
        try {
            const res = await api.get(`/jours-feries?annee=${year}`);
            setFeries(res.data);
        } catch (err) {
            console.error('Erreur chargement jours fériés', err);
            setFeries([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(annee); }, [annee, load]);

    const add = async () => {
        setError('');
        if (!form.date || !form.libelle.trim()) {
            setError('La date et le libellé sont obligatoires.');
            return;
        }
        try {
            await api.post('/admin/jours-feries', form);
            setForm({ date: '', libelle: '' });
            load(annee);
        } catch (err) { setError(getErr(err)); }
    };

    const remove = async (id) => {
        if (!window.confirm('Supprimer ce jour férié ?')) return;
        setError('');
        try {
            await api.delete(`/admin/jours-feries/${id}`);
            load(annee);
        } catch (err) { setError(getErr(err)); }
    };

    return (
        <div className="space-y-6">
            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    <Plus size={18} style={{ color: COLORS.green }} /> Ajouter un jour férié
                </h3>
                <ErrorBanner message={error} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <input className={inputCls} type="date" value={form.date}
                           onChange={e => setForm({ ...form, date: e.target.value })} />
                    <input className={inputCls} placeholder="Libellé (ex : Aïd Al Fitr) *" value={form.libelle}
                           onChange={e => setForm({ ...form, libelle: e.target.value })} />
                    <Button onClick={add}><Plus size={16} /> Ajouter</Button>
                </div>
            </Card>

            <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="font-black flex items-center gap-2" style={{ color: COLORS.blue }}>
                        <CalendarDays size={18} style={{ color: COLORS.green }} /> Jours fériés {annee}
                    </h3>
                    <select className={`${inputCls} !w-auto font-bold`} value={annee}
                            onChange={e => setAnnee(parseInt(e.target.value, 10))}>
                        {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="p-10 text-center font-bold animate-pulse" style={{ color: COLORS.blue }}>Chargement...</div>
                ) : feries.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 italic">Aucun jour férié enregistré pour {annee}.</div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {feries.map(f => (
                            <div key={f.id} className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                         style={{ backgroundColor: '#eef4ff', color: COLORS.blue }}>
                                        <CalendarDays size={18} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm" style={{ color: COLORS.blue }}>{f.libelle}</div>
                                        <div className="text-xs text-gray-400 font-bold">
                                            {new Date(f.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                    </div>
                                </div>
                                <Button variant="danger" onClick={() => remove(f.id)}>
                                    <Trash2 size={14} /> Supprimer
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default AdminPanel;
