import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import {
    Building2, Users, FileStack, ShieldCheck, Landmark,
    CalendarDays, Plus, Trash2, AlertCircle, KeyRound, Mail,
    Pencil, X, Save, Image as ImageIcon, UserX, RotateCcw, Search, Filter, ChevronDown,
} from 'lucide-react';
import {
    PageHeader, Button, Tabs, Card, BudgetGauge, COLORS,
} from './ui/index.jsx';
import BudgetManagement from './BudgetManagement.jsx';

/* ============================================================
   Console d'administration — Référentiel uniquement
   (Cabinets, Utilisateurs, Bons de Commande, Jours fériés)
   ============================================================ */

const ROLE_STYLES = {
    ADMIN: { bg: '#fee2e2', fg: COLORS.red, label: 'Superadmin' },
    RESPONSABLE: { bg: '#e0e7ff', fg: '#4338ca', label: 'Manager' },
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
    const canSeeBudgets = isAdmin || userRole === 'RESPONSABLE';
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('cabinets');
    const requestedTab = searchParams.get('tab');

    const [cabinets, setCabinets] = useState([]);
    const [consultants, setConsultants] = useState([]);
    const [bcs, setBcs] = useState([]);
    const [directions, setDirections] = useState([]);
    const [loading, setLoading] = useState(true);

    const tabs = [
        ...(canSeeBudgets ? [{ key: 'budgets', label: 'Budgets annuels' }] : []),
        { key: 'cabinets', label: 'Cabinets' },
        { key: 'users', label: 'Utilisateurs' },
        ...(isAdmin ? [{ key: 'directions', label: 'Directions' }] : []),
        { key: 'bcs', label: 'Bons de Commande' },
        ...(isAdmin ? [{ key: 'feries', label: 'Jours fériés' }] : []),
    ];

    useEffect(() => {
        const validTabs = tabs.map((tab) => tab.key);
        if (!requestedTab) setActiveTab('cabinets');
        else if (validTabs.includes(requestedTab)) setActiveTab(requestedTab);
        else {
            setActiveTab('cabinets');
            setSearchParams({}, { replace: true });
        }
    }, [requestedTab, isAdmin, canSeeBudgets, setSearchParams]);

    const changeTab = (key) => {
        setActiveTab(key);
        setSearchParams(key === 'cabinets' ? {} : { tab: key });
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [cabRes, consRes, bcRes, dirRes] = await Promise.all([
                api.get('/admin/cabinets'),
                api.get('/admin/consultants'),
                api.get('/admin/bcs'),
                isAdmin ? api.get('/admin/directions') : Promise.resolve({ data: [] }),
            ]);
            setCabinets(cabRes.data);
            setConsultants(consRes.data);
            setBcs(bcRes.data);
            setDirections(dirRes.data || []);
        } catch (err) {
            console.error('Erreur chargement référentiel', err);
        }
        setLoading(false);
    }, [isAdmin]);

    useEffect(() => { loadData(); }, [loadData]);

    return (
        <div className="mx-auto max-w-7xl p-4">
            {activeTab !== 'budgets' && <PageHeader
                icon={ShieldCheck}
                title={({ cabinets: 'Cabinets fournisseurs', users: 'Consultants et utilisateurs', bcs: 'Bons de commande', directions: 'Directions', feries: 'Jours fériés' })[activeTab] || 'Gestion'}
                subtitle={userRole === 'RESPONSABLE' ? 'Gestion limitée aux consultants et ressources de votre périmètre.' : 'Référentiels et ressources du Pôle IT.'}
            />}

            <Tabs tabs={tabs} active={activeTab} onChange={changeTab} />

            {loading ? (
                <div className="text-center p-20 font-bold animate-pulse" style={{ color: COLORS.blue }}>
                    Chargement des données...
                </div>
            ) : (
                <>
                    {activeTab === 'budgets' && canSeeBudgets && <BudgetManagement isAdmin={isAdmin} directions={directions} />}
                    {activeTab === 'cabinets' && <CabinetSection cabinets={cabinets} onRefresh={loadData} />}
                    {activeTab === 'users' && (
                        <UserSection consultants={consultants} cabinets={cabinets} directions={directions}
                                     onRefresh={loadData} isAdmin={isAdmin} />
                    )}
                    {activeTab === 'directions' && isAdmin && <DirectionSection directions={directions} onRefresh={loadData} />}
                    {activeTab === 'bcs' && <BCSection bcs={bcs} consultants={consultants} onRefresh={loadData} />}
                    {activeTab === 'feries' && isAdmin && <JoursFeriesSection />}
                </>
            )}
        </div>
    );
};

const DirectionSection = ({ directions, onRefresh }) => {
    const [nom, setNom] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const save = async (e) => {
        e.preventDefault(); setError(''); setBusy(true);
        try { await api.post('/admin/directions', { nom }); setNom(''); onRefresh(); }
        catch (err) { setError(getErr(err)); } finally { setBusy(false); }
    };
    return <div className="space-y-4"><Card><h3 className="font-black mb-3" style={{ color: COLORS.blue }}>Directions organisationnelles</h3><p className="text-sm text-gray-500 mb-4">Les managers et consultants sont rattachés à une direction. Le cabinet fournisseur reste distinct.</p><ErrorBanner message={error} /><form onSubmit={save} className="flex gap-2"><input className={inputCls} value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de la direction" required /><Button disabled={busy}><Plus size={15} /> Ajouter</Button></form></Card><Card>{directions.length ? directions.map(d => <div key={d.id} className="py-2 border-b last:border-0 font-bold">{d.nom}</div>) : <p className="text-sm text-gray-400">Aucune direction créée.</p>}</Card></div>;
};

/* ==========================================
   1. CABINETS
   ========================================== */

/** Logo du cabinet : aperçu + upload (image ≤ 400 Ko → data-URL → PUT). */
const CabinetLogoCell = ({ cabinetId, onError }) => {
    const [logo, setLogo] = useState(null);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        api.get(`/admin/cabinets/${cabinetId}/logo`)
            .then(r => { if (!cancelled) setLogo(r.data?.logoImage || null); })
            .catch(() => { /* pas de logo / erreur silencieuse */ });
        return () => { cancelled = true; };
    }, [cabinetId]);

    const onFile = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        onError('');
        if (!file.type || !file.type.startsWith('image/')) {
            onError('Le logo doit être un fichier image (PNG, JPEG…).');
            return;
        }
        if (file.size > 400 * 1024) {
            onError('Logo trop volumineux : 400 Ko maximum.');
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            const dataUrl = reader.result;
            setUploading(true);
            try {
                await api.put(`/admin/cabinets/${cabinetId}/logo`, { logoImage: dataUrl });
                setLogo(dataUrl);
            } catch (err) { onError(getErr(err)); }
            setUploading(false);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex items-center gap-2">
            {logo && (
                <img src={logo} alt="Logo cabinet"
                     className="h-8 w-14 object-contain rounded border border-gray-100 bg-white" />
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <Button variant="outline" disabled={uploading}
                    onClick={() => inputRef.current && inputRef.current.click()}>
                <ImageIcon size={14} /> {uploading ? 'Envoi…' : 'Logo'}
            </Button>
        </div>
    );
};

const CabinetSection = ({ cabinets, onRefresh }) => {
    const emptyForm = { nom: '', adresse: '', ice: '', identifiantFiscal: '', patente: '', rib: '' };
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const startEdit = (c) => {
        setEditingId(c.id);
        setForm({
            nom: c.nom || '', adresse: c.adresse || '', ice: c.ice || '',
            identifiantFiscal: c.identifiantFiscal || '', patente: c.patente || '', rib: c.rib || '',
        });
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => { setEditingId(null); setForm(emptyForm); setError(''); };

    const save = async () => {
        setError('');
        if (!form.nom.trim()) { setError('La raison sociale est obligatoire.'); return; }
        setSaving(true);
        try {
            if (editingId) await api.put(`/admin/cabinets/${editingId}`, form);
            else await api.post('/admin/cabinets', form);
            setForm(emptyForm);
            setEditingId(null);
            onRefresh();
        } catch (err) { setError(getErr(err)); }
        setSaving(false);
    };

    const remove = async (c) => {
        if (!window.confirm(`Supprimer le cabinet « ${c.nom} » ?`)) return;
        setError('');
        try {
            await api.delete(`/admin/cabinets/${c.id}`);
            if (editingId === c.id) cancelEdit();
            onRefresh();
        } catch (err) { setError(getErr(err)); }
    };

    return (
        <div className="space-y-6">
            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    <Landmark size={18} style={{ color: COLORS.green }} />
                    {editingId ? 'Modifier le cabinet' : 'Nouveau cabinet (ESN)'}
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
                <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={save} disabled={saving}>
                        {editingId ? <Save size={16} /> : <Plus size={16} />}
                        {editingId ? 'Enregistrer les modifications' : 'Enregistrer le cabinet'}
                    </Button>
                    {editingId && (
                        <Button variant="outline" onClick={cancelEdit}>
                            <X size={16} /> Annuler
                        </Button>
                    )}
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
                            <th className="p-3">Logo</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {cabinets.length === 0 ? (
                            <tr><td colSpan="8" className="p-6 text-center text-gray-400 italic">Aucun cabinet référencé.</td></tr>
                        ) : cabinets.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="p-3 font-bold" style={{ color: COLORS.blue }}>{c.nom}</td>
                                <td className="p-3 text-gray-500">{c.adresse || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.ice || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.identifiantFiscal || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.patente || '—'}</td>
                                <td className="p-3 text-gray-500 font-mono">{c.rib || '—'}</td>
                                <td className="p-3"><CabinetLogoCell cabinetId={c.id} onError={setError} /></td>
                                <td className="p-3">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => startEdit(c)}>
                                            <Pencil size={14} /> Modifier
                                        </Button>
                                        <Button variant="danger" onClick={() => remove(c)}>
                                            <Trash2 size={14} /> Supprimer
                                        </Button>
                                    </div>
                                </td>
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
   2. UTILISATEURS (ADMIN + RESPONSABLE)
   RESPONSABLE : rôle verrouillé CONSULTANT, cabinets limités
   à ses cabinets gérés (listes scopées côté serveur).
   ========================================== */
const UserSection = ({ consultants, cabinets, directions = [], onRefresh, isAdmin = true }) => {
    const emptyForm = { nom: '', prenom: '', email: '', password: '', role: 'CONSULTANT', cabinetId: '', directionId: '', managerId: '', cabinetsGeresIds: [] };
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    // En édition : n'écrase les cabinets gérés que si la sélection a été modifiée
    const [geresTouched, setGeresTouched] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const toggleCabinetGere = (id) => {
        setGeresTouched(true);
        setForm(f => ({
            ...f,
            cabinetsGeresIds: f.cabinetsGeresIds.includes(id)
                ? f.cabinetsGeresIds.filter(x => x !== id)
                : [...f.cabinetsGeresIds, id],
        }));
    };

    const startEdit = (c) => {
        setEditingId(c.id);
        setForm({
            nom: c.nom || '',
            prenom: c.prenom || '',
            email: c.email || '',
            password: '',
            role: isAdmin ? (c.role || 'CONSULTANT') : 'CONSULTANT',
            cabinetId: c.cabinet?.id != null ? String(c.cabinet.id) : '',
            directionId: c.directionId != null ? String(c.directionId) : '',
            managerId: c.managerId != null ? String(c.managerId) : '',
            cabinetsGeresIds: [],
        });
        setGeresTouched(false);
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setForm(emptyForm);
        setGeresTouched(false);
        setError('');
    };

    const save = async () => {
        setError('');
        if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim()) {
            setError('Nom, prénom et email sont obligatoires.');
            return;
        }
        if (!editingId && !form.password) {
            setError('Le mot de passe est obligatoire à la création.');
            return;
        }
        if (form.role === 'CONSULTANT' && !form.cabinetId) {
            setError('Le cabinet est obligatoire pour un consultant.');
            return;
        }
        if (isAdmin && form.role === 'RESPONSABLE' && !form.directionId) {
            setError('La direction est obligatoire pour un manager.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                nom: form.nom,
                prenom: form.prenom,
                email: form.email,
                // Un RESPONSABLE ne crée/modifie que des comptes CONSULTANT (imposé aussi côté serveur)
                role: isAdmin ? form.role : 'CONSULTANT',
                cabinet: form.cabinetId ? { id: parseInt(form.cabinetId, 10) } : null,
                ...(isAdmin && form.directionId ? { direction: { id: parseInt(form.directionId, 10) } } : {}),
                ...(isAdmin && form.role === 'CONSULTANT' && form.managerId ? { manager: { id: parseInt(form.managerId, 10) } } : {}),
            };
            if (form.password) payload.password = form.password; // vide en édition = conservé
            if (editingId) {
                if (isAdmin && form.role === 'RESPONSABLE' && geresTouched) {
                    payload.cabinetsGeresIds = form.cabinetsGeresIds;
                }
                await api.put(`/admin/consultants/${editingId}`, payload);
            } else {
                if (isAdmin) {
                    payload.cabinetsGeresIds = form.role === 'RESPONSABLE' ? form.cabinetsGeresIds : [];
                }
                await api.post('/admin/consultants', payload);
            }
            setForm(emptyForm);
            setEditingId(null);
            setGeresTouched(false);
            onRefresh();
        } catch (err) { setError(getErr(err)); }
        setSaving(false);
    };

    const remove = async (c) => {
        if (!window.confirm(`Supprimer l'utilisateur « ${c.nom} ${c.prenom || ''} » ?`)) return;
        setError('');
        try {
            await api.delete(`/admin/consultants/${c.id}`);
            if (editingId === c.id) cancelEdit();
            onRefresh();
        } catch (err) { setError(getErr(err)); }
    };

    /** Fin de mission : désactive le compte (la connexion est bloquée côté serveur). */
    const terminerMission = async (c) => {
        const today = new Date().toISOString().slice(0, 10);
        const dateFin = window.prompt(
            `Date de fin de mission de « ${c.nom} ${c.prenom || ''} » (AAAA-MM-JJ) :`, today);
        if (dateFin === null) return; // annulé
        setError('');
        try {
            await api.put(`/admin/consultants/${c.id}/terminer-mission`,
                { dateFin: dateFin.trim() || today });
            onRefresh();
        } catch (err) { setError(getErr(err)); }
    };

    const reactiver = async (c) => {
        if (!window.confirm(`Réactiver le compte de « ${c.nom} ${c.prenom || ''} » ?`)) return;
        setError('');
        try {
            await api.put(`/admin/consultants/${c.id}/reactiver`);
            onRefresh();
        } catch (err) { setError(getErr(err)); }
    };

    return (
        <div className="space-y-6">
            <Card>
                <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                    {editingId
                        ? <><Pencil size={18} style={{ color: COLORS.green }} /> Modifier l'utilisateur</>
                        : <><Plus size={18} style={{ color: COLORS.green }} /> Nouvel utilisateur</>}
                </h3>
                <ErrorBanner message={error} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className={inputCls} placeholder="Nom *" value={form.nom}
                           onChange={e => setForm({ ...form, nom: e.target.value })} />
                    <input className={inputCls} placeholder="Prénom *" value={form.prenom}
                           onChange={e => setForm({ ...form, prenom: e.target.value })} />
                    <input className={inputCls} type="email" placeholder="Email *" value={form.email}
                           onChange={e => setForm({ ...form, email: e.target.value })} />
                    <input className={inputCls} type="password"
                           placeholder={editingId ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe *'}
                           value={form.password}
                           onChange={e => setForm({ ...form, password: e.target.value })} />
                    {isAdmin ? (
                        <select className={inputCls} value={form.role}
                                onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="CONSULTANT">Consultant</option>
                            <option value="RESPONSABLE">Manager</option>
                            <option value="ADMIN">Superadmin</option>
                        </select>
                    ) : (
                        <div className={`${inputCls} flex items-center justify-between bg-gray-50 text-gray-500`}>
                            <span className="font-bold">Rôle : Consultant</span>
                            <RoleBadge role="CONSULTANT" />
                        </div>
                    )}
                    <select className={inputCls} value={form.cabinetId}
                            onChange={e => setForm({ ...form, cabinetId: e.target.value })}>
                        <option value="">
                            {form.role === 'CONSULTANT' ? 'Cabinet * (obligatoire)' : 'Cabinet (optionnel)'}
                        </option>
                        {cabinets.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                    {isAdmin && <select className={inputCls} required={form.role === 'RESPONSABLE'} value={form.directionId} onChange={e => setForm({ ...form, directionId: e.target.value })}><option value="">{form.role === 'RESPONSABLE' ? 'Direction *' : 'Direction (optionnelle)'}</option>{directions.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}</select>}
                    {isAdmin && form.role === 'CONSULTANT' && <select className={inputCls} value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}><option value="">Manager propriétaire (optionnel)</option>{consultants.filter(c => c.role === 'RESPONSABLE' && c.id !== editingId).map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select>}
                </div>

                {isAdmin && form.role === 'RESPONSABLE' && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="text-[11px] uppercase font-black tracking-wider text-gray-400 mb-3">
                            Cabinets gérés
                            {editingId && !geresTouched && (
                                <span className="normal-case font-bold text-gray-400 ml-2">
                                    (sélection inchangée = cabinets gérés actuels conservés)
                                </span>
                            )}
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

                <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={save} disabled={saving}>
                        {editingId ? <Save size={16} /> : <Plus size={16} />}
                        {editingId ? 'Enregistrer les modifications' : "Créer l'utilisateur"}
                    </Button>
                    {editingId && (
                        <Button variant="outline" onClick={cancelEdit}>
                            <X size={16} /> Annuler
                        </Button>
                    )}
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
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {consultants.length === 0 ? (
                            <tr><td colSpan="5" className="p-6 text-center text-gray-400 italic">Aucun utilisateur.</td></tr>
                        ) : consultants.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="p-3 font-bold" style={{ color: COLORS.blue }}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={c.actif === false ? 'opacity-60' : ''}>
                                            {c.nom} {c.prenom}
                                        </span>
                                        {c.actif === false && (
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
                                                  style={{ backgroundColor: '#fee2e2', color: COLORS.red }}>
                                                Mission terminée{c.dateFinMission
                                                    ? ` le ${new Date(c.dateFinMission).toLocaleDateString('fr-FR')}`
                                                    : ''}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 text-gray-500">
                                    <span className="flex items-center gap-1.5"><Mail size={13} /> {c.email || '—'}</span>
                                </td>
                                <td className="p-3"><RoleBadge role={c.role} /></td>
                                <td className="p-3 text-gray-500 font-bold">{c.cabinet?.nom || '—'}</td>
                                <td className="p-3">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => startEdit(c)}>
                                            <Pencil size={14} /> Modifier
                                        </Button>
                                        {c.actif === false ? (
                                            <Button variant="outline" onClick={() => reactiver(c)}>
                                                <RotateCcw size={14} /> Réactiver
                                            </Button>
                                        ) : (
                                            <Button variant="outline" onClick={() => terminerMission(c)}>
                                                <UserX size={14} /> Terminer la mission
                                            </Button>
                                        )}
                                        <Button variant="danger" onClick={() => remove(c)}>
                                            <Trash2 size={14} /> Supprimer
                                        </Button>
                                    </div>
                                </td>
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
const natureForBudgetType = (typeBudget) => typeBudget === 'OPEX' ? 'RUN' : typeBudget === 'CAPEX' ? 'PROJET' : null;

const NatureChip = ({ nature }) => {
    if (!nature) return <span className="text-[10px] font-bold text-gray-400">Nature non définie</span>;
    return (
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
              style={nature === 'RUN'
                  ? { backgroundColor: '#e0e7ff', color: '#4338ca' }
                  : { backgroundColor: '#dcfce7', color: '#15803d' }}>
            {nature}
        </span>
    );
};

const BCSection = ({ bcs, consultants, onRefresh }) => {
    const currentYear = new Date().getFullYear();
    const emptyForm = { reference: '', joursMax: '', tjm: '', codeBudget: '', anneeBudgetaire: String(currentYear), designation: '', consultantId: '' };
    const [form, setForm] = useState(emptyForm);
    const [budgets, setBudgets] = useState([]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [yearFilter, setYearFilter] = useState(String(currentYear));
    const [cabinetFilter, setCabinetFilter] = useState('');
    const [consultantFilter, setConsultantFilter] = useState('');
    const [search, setSearch] = useState('');
    const [visibleCabinetCount, setVisibleCabinetCount] = useState(6);

    useEffect(() => {
        api.get(`/admin/budgets?annee=${form.anneeBudgetaire || currentYear}`)
            .then((res) => setBudgets(res.data || []))
            .catch(() => setBudgets([]));
    }, [form.anneeBudgetaire, currentYear]);

    const selectedBudget = budgets.find((b) => b.codeBudget === form.codeBudget);

    useEffect(() => { setVisibleCabinetCount(6); }, [yearFilter, cabinetFilter, consultantFilter, search]);

    const save = async () => {
        setError('');
        if (!form.reference.trim() || !form.joursMax || !form.consultantId) {
            setError('Référence, jours max et consultant sont obligatoires.');
            return;
        }
        if (!form.codeBudget.trim()) {
            setError('Le code budgétaire est obligatoire.');
            return;
        }
        if (!selectedBudget) {
            setError('Sélectionne un budget existant pour rattacher correctement le BC.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/admin/bcs', {
                reference: form.reference,
                joursMax: parseFloat(form.joursMax),
                tjm: form.tjm ? parseFloat(form.tjm) : null,
                codeBudget: form.codeBudget,
                anneeBudgetaire: form.anneeBudgetaire ? parseInt(form.anneeBudgetaire, 10) : null,
                designation: form.designation,
                consultantId: parseInt(form.consultantId, 10),
            });
            setForm(emptyForm);
            onRefresh();
        } catch (err) { setError(getErr(err)); }
        setSaving(false);
    };

    // Report du reliquat sur l'année suivante (BC des années passées uniquement)
    const toggleReport = async (bc) => {
        setError('');
        try {
            await api.put(`/admin/bcs/${bc.id}/report-reliquat`, { autorise: !bc.reportReliquat });
            onRefresh();
        } catch (err) { setError(getErr(err)); }
    };

    const consultantsOnly = consultants.filter(c => !c.role || c.role === 'CONSULTANT');
    const consultantById = new Map(consultantsOnly.map(c => [String(c.id), c]));
    const bcYears = [...new Set([currentYear, ...bcs.map(bc => bc.anneeBudgetaire).filter(Number.isInteger)])].sort((a, b) => b - a);
    const cabinetNameFor = (bc) => consultantById.get(String(bc.consultantId ?? bc.consultant?.id))?.cabinet?.nom || 'Sans cabinet';
    const cabinetOptions = [...new Set([...consultantsOnly.map(c => c.cabinet?.nom).filter(Boolean), ...(bcs.some(bc => !consultantById.get(String(bc.consultantId ?? bc.consultant?.id))?.cabinet?.nom) ? ['Sans cabinet'] : [])])].sort((a, b) => a.localeCompare(b));
    const consultantOptions = consultantsOnly.filter(c => !cabinetFilter || c.cabinet?.nom === cabinetFilter);
    const filteredBcs = bcs.filter((bc) => {
        const matchesYear = yearFilter === 'ALL' || (yearFilter === 'UNKNOWN'
            ? bc.anneeBudgetaire == null : bc.anneeBudgetaire === Number(yearFilter));
        const consultant = consultantById.get(String(bc.consultantId ?? bc.consultant?.id));
        const name = consultant ? `${consultant.prenom || ''} ${consultant.nom || ''}`.trim() : 'Non affecté';
        const text = `${bc.reference || ''} ${bc.codeBudget || ''} ${bc.designation || ''} ${name}`.toLocaleLowerCase('fr');
        return matchesYear && (!cabinetFilter || cabinetNameFor(bc) === cabinetFilter)
            && (!consultantFilter || String(bc.consultantId ?? bc.consultant?.id) === consultantFilter)
            && (!search.trim() || text.includes(search.trim().toLocaleLowerCase('fr')));
    });
    const cabinetGroups = Object.values(filteredBcs.reduce((groups, bc) => {
        const cabinet = cabinetNameFor(bc);
        const consultantId = String(bc.consultantId ?? bc.consultant?.id ?? 'unassigned');
        groups[cabinet] ||= { name: cabinet, consultants: {} };
        groups[cabinet].consultants[consultantId] ||= {
            id: consultantId,
            name: consultantById.get(consultantId)
                ? `${consultantById.get(consultantId).prenom || ''} ${consultantById.get(consultantId).nom || ''}`.trim()
                : 'Non affecté',
            bcs: [],
        };
        groups[cabinet].consultants[consultantId].bcs.push(bc);
        return groups;
    }, {})).sort((a, b) => a.name.localeCompare(b.name));

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
                    <div className="flex items-center gap-2">
                        <select className={inputCls} required value={form.codeBudget}
                                onChange={e => setForm({ ...form, codeBudget: e.target.value })}>
                            <option value="">Budget associé *</option>
                            {budgets.map((b) => <option key={b.id} value={b.codeBudget}>{b.codeBudget} · {b.typeBudget || 'Type à préciser'} · {b.description || 'Sans description'}</option>)}
                        </select>
                        {selectedBudget && <div className="flex items-center gap-2 text-xs text-gray-600"><span>{selectedBudget.typeBudget}</span><span>→</span><NatureChip nature={natureForBudgetType(selectedBudget.typeBudget)} /><span>dans les RA</span></div>}
                    </div>
                    <label className="text-xs font-bold text-gray-600">Exercice de suivi
                        <input className={inputCls} type="number" placeholder="Ex. 2026" value={form.anneeBudgetaire}
                               onChange={e => setForm({ ...form, anneeBudgetaire: e.target.value, codeBudget: '' })} />
                        <span className="block mt-1 font-normal text-gray-500">Indépendant de l’année dans la référence : un BC /19/ peut porter un reliquat suivi en 2026.</span>
                    </label>
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

            <Card>
                <div className="mb-4 flex items-center gap-2 font-black" style={{ color: COLORS.blue }}><Filter size={17} style={{ color: COLORS.green }} /> Filtrer les bons de commande</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-bold text-gray-500">Année budgétaire<select className={inputCls} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                        <option value="ALL">Toutes les années</option>{bcYears.map(y => <option key={y} value={y}>{y}</option>)}{bcs.some(bc => bc.anneeBudgetaire == null) && <option value="UNKNOWN">Année non précisée</option>}
                    </select></label>
                    <label className="text-xs font-bold text-gray-500">Cabinet<select className={inputCls} value={cabinetFilter} onChange={e => { setCabinetFilter(e.target.value); setConsultantFilter(''); }}><option value="">Tous les cabinets</option>{cabinetOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
                    <label className="text-xs font-bold text-gray-500">Consultant<select className={inputCls} value={consultantFilter} onChange={e => setConsultantFilter(e.target.value)}><option value="">Tous les consultants</option>{consultantOptions.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select></label>
                    <label className="text-xs font-bold text-gray-500">Recherche<input className={inputCls} value={search} onChange={e => setSearch(e.target.value)} placeholder="Référence, code, désignation…" /></label>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="font-bold text-gray-500">{filteredBcs.length} BC affiché{filteredBcs.length !== 1 ? 's' : ''} sur {bcs.length}</span><Button variant="outline" onClick={() => { setYearFilter(String(currentYear)); setCabinetFilter(''); setConsultantFilter(''); setSearch(''); }}>Réinitialiser</Button></div>
            </Card>

            {cabinetGroups.length === 0 ? <Card className="py-10 text-center text-gray-500">Aucun BC ne correspond à ces filtres.</Card> : (
                <div className="space-y-5">{cabinetGroups.slice(0, visibleCabinetCount).map((cabinet) => {
                    const consultantGroups = Object.values(cabinet.consultants).sort((a, b) => a.name.localeCompare(b.name));
                    const cabinetBcCount = consultantGroups.reduce((sum, c) => sum + c.bcs.length, 0);
                    return <Card key={cabinet.name} className="!p-0 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-slate-50 px-5 py-4">
                            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#008858]"><Building2 size={19} /></span><div><h3 className="font-black text-[#003366]">{cabinet.name}</h3><p className="text-xs text-gray-500">{consultantGroups.length} consultant{consultantGroups.length !== 1 ? 's' : ''} · {cabinetBcCount} BC</p></div></div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-500">{yearFilter === 'ALL' ? 'Toutes années' : yearFilter === 'UNKNOWN' ? 'Année non précisée' : yearFilter}</span>
                        </div>
                        <div className="space-y-3 p-4 sm:p-5">{consultantGroups.map((group) => {
                            const totalMax = group.bcs.reduce((sum, bc) => sum + (bc.joursMax || 0), 0);
                            const totalConsumed = group.bcs.reduce((sum, bc) => sum + (bc.joursConsommes || 0), 0);
                            return <details key={group.id} className="group/consultant rounded-xl border border-gray-200 bg-white">
                                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 hover:bg-gray-50">
                                    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-[#003366]"><Users size={16} /></span><div><div className="font-black text-[#003366]">{group.name}</div><div className="text-xs text-gray-500">{group.bcs.length} bon{group.bcs.length !== 1 ? 's' : ''} de commande</div></div></div>
                                    <div className="flex items-center gap-4 text-xs"><span className="font-bold text-gray-500">{totalConsumed.toLocaleString('fr-FR')} / {totalMax.toLocaleString('fr-FR')} JH</span><ChevronDown size={16} className="text-gray-400 transition-transform group-open/consultant:rotate-180" /></div>
                                </summary>
                                <div className="grid grid-cols-1 gap-3 border-t border-gray-100 bg-slate-50/70 p-3 md:grid-cols-2">
                                    {[...group.bcs].sort((a, b) => String(a.reference || '').localeCompare(String(b.reference || ''))).map(bc => <div key={bc.id} className="rounded-xl border border-gray-100 bg-white p-4">
                                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2"><div><div className="font-black text-[#003366]">{bc.reference || 'BC sans référence'}</div><div className="mt-1 text-xs text-gray-500">{bc.codeBudget || 'Code non précisé'} · Exercice suivi {bc.anneeBudgetaire ?? 'non précisé'}</div></div><NatureChip nature={bc.nature} /></div>
                                        {bc.designation && <p className="mb-3 text-sm text-gray-600">{bc.designation}</p>}
                                        {bc.tjm != null && <p className="mb-2 text-xs font-bold text-gray-500">TJM : {Number(bc.tjm).toLocaleString('fr-FR')} MAD/J</p>}
                                        <BudgetGauge label="Consommation annuelle" consomme={bc.joursConsommes ?? 0} max={bc.joursMax ?? 0} />
                                        {bc.anneeBudgetaire != null && bc.anneeBudgetaire < currentYear && ((bc.joursMax ?? 0) - (bc.joursConsommes ?? 0)) > 0 && <button onClick={() => toggleReport(bc)} className="mt-3 w-full rounded-xl border px-3 py-2 text-xs font-black transition-all" style={bc.reportReliquat ? { backgroundColor: '#f0fdf4', borderColor: COLORS.green, color: COLORS.green } : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>{bc.reportReliquat ? `✓ Reliquat reporté sur ${bc.anneeBudgetaire + 1}` : `Autoriser le report sur ${bc.anneeBudgetaire + 1}`}</button>}
                                    </div>)}
                                </div>
                            </details>;
                        })}</div>
                    </Card>;
                })}
                    {cabinetGroups.length > visibleCabinetCount && <div className="flex justify-center pt-2"><Button variant="outline" onClick={() => setVisibleCabinetCount(count => count + 6)}>Afficher les {Math.min(6, cabinetGroups.length - visibleCabinetCount)} cabinets suivants ({cabinetGroups.length - visibleCabinetCount} restants)</Button></div>}
                    {visibleCabinetCount > 6 && <div className="flex justify-center"><Button variant="outline" onClick={() => { setVisibleCabinetCount(6); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Réduire la liste</Button></div>}
                </div>
            )}
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
