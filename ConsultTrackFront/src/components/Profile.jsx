import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { PageHeader, Card, Button, COLORS } from './ui';
import { UserCircle, PenLine, Trash2, CheckCircle2 } from 'lucide-react';

/**
 * Profil de l'utilisateur connecté : identité + signature manuscrite.
 * La signature (image) est embarquée dans les PDF RPI/RA une fois validés.
 */
const Profile = () => {
    const [me, setMe] = useState(null);
    const [message, setMessage] = useState(null);
    const [saving, setSaving] = useState(false);

    const load = () => api.get('/me').then((r) => setMe(r.data)).catch(() => {});
    useEffect(() => { load(); }, []);

    const onFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Choisissez une image (PNG/JPG).' });
            return;
        }
        if (file.size > 400_000) {
            setMessage({ type: 'error', text: 'Image trop lourde (max 400 Ko).' });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => saveSignature(reader.result);
        reader.readAsDataURL(file);
    };

    const saveSignature = (dataUrl) => {
        setSaving(true);
        api.put('/me/signature', { signatureImage: dataUrl })
            .then(() => { setMessage({ type: 'success', text: 'Signature enregistrée.' }); load(); })
            .catch((err) => setMessage({ type: 'error', text: err.response?.data?.message || 'Erreur.' }))
            .finally(() => setSaving(false));
    };

    if (!me) return null;

    return (
        <div>
            <PageHeader icon={UserCircle} title="Mon Profil"
                        subtitle="Identité et signature utilisée sur les documents validés (RPI, RA)." />

            {message && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${
                    message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h2 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-4">Identité</h2>
                    {[['Nom', `${me.prenom} ${me.nom}`], ['Email', me.email],
                      ['Rôle', me.role], ['Cabinet', me.cabinet || '—']].map(([k, v]) => (
                        <div key={k} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                            <span className="text-gray-400 font-semibold">{k}</span>
                            <span className="font-bold" style={{ color: COLORS.blue }}>{v}</span>
                        </div>
                    ))}
                </Card>

                <Card>
                    <h2 className="text-xs uppercase font-black text-gray-400 tracking-wider mb-4 flex items-center gap-2">
                        <PenLine size={14} /> Ma signature
                    </h2>
                    {me.signatureImage ? (
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center justify-center mb-4">
                            <img src={me.signatureImage} alt="Signature" style={{ maxHeight: '90px' }} />
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 mb-4">
                            Aucune signature enregistrée. Elle apparaîtra sur vos RPI et Rapports d'Activité validés.
                        </p>
                    )}
                    <div className="flex gap-2">
                        <label className="cursor-pointer">
                            <span className="flex items-center gap-2 font-bold text-sm px-4 py-2.5 rounded-xl text-white"
                                  style={{ backgroundColor: COLORS.green }}>
                                <CheckCircle2 size={16} /> {saving ? 'Enregistrement…' : 'Importer une image'}
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={saving} />
                        </label>
                        {me.signatureImage && (
                            <Button variant="danger" onClick={() => saveSignature(null)} disabled={saving}>
                                <Trash2 size={16} /> Supprimer
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Profile;
