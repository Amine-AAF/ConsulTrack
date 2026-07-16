import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { generateRaPDF } from '../utils/raPdfGenerator';
import {
    FileText,
    Download,
    AlertCircle,
    Loader2,
    Save,
    Send,
    CheckCircle2,
    Sparkles,
} from 'lucide-react';
import { Button, StatusBadge, Card, COLORS } from './ui/index.jsx';

const fmt = (n) => (n == null ? '0' : (Number.isInteger(n) ? String(n) : Number(n).toFixed(1)));

/* ================================================================
   Sérialisation des sections du Rapport d'Activité (une par BC).
   Format stocké (un seul champ TEXT côté entité) :
       @@BC:{reference}@@\n{texte de la section}
   sections non vides jointes par '\n'.
   Convention dans une section : ligne sans '-' initial = THÈME,
   ligne commençant par '- ' = tâche du thème.
   ================================================================ */
const GENERAL_KEY = '__GENERAL__';
const BC_MARKER_RE = /@@BC:(.+?)@@/;

/** Découpe le texte stocké en { reference → texte de section }. */
const parseSectionsRa = (texte, bdcs) => {
    const map = {};
    (bdcs || []).forEach((b) => { map[b.reference] = ''; });
    const txt = texte || '';
    if (!txt.trim()) {
        if (!bdcs || bdcs.length === 0) map[GENERAL_KEY] = '';
        return map;
    }
    if (!BC_MARKER_RE.test(txt)) {
        // Texte legacy sans marqueurs : 1er BC (ou section « Général »)
        if (bdcs && bdcs.length > 0) map[bdcs[0].reference] = txt.trim();
        else map[GENERAL_KEY] = txt.trim();
        return map;
    }
    const parts = txt.split(/@@BC:(.+?)@@/); // [avant, ref1, txt1, ref2, txt2, ...]
    for (let i = 1; i < parts.length; i += 2) {
        const ref = parts[i];
        const body = (parts[i + 1] || '').replace(/^\n/, '').replace(/\s+$/, '');
        map[ref] = body;
    }
    if ((!bdcs || bdcs.length === 0) && Object.keys(map).length === 0) map[GENERAL_KEY] = '';
    return map;
};

/** Reconstruit le champ TEXT à partir des sections non vides. */
const serializeSectionsRa = (sections) =>
    Object.entries(sections || {})
        .filter(([, txt]) => txt && txt.trim())
        .map(([ref, txt]) => (ref === GENERAL_KEY
            ? txt.trim() // pas de BC : texte brut (compatible legacy)
            : `@@BC:${ref}@@\n${txt.trim()}`))
        .join('\n');

/* ================================================================
   Saisie du Rapport d'Activité d'un mois (composant partagé).
   Autonome : charge ses données dès que consultantId / annee / mois
   changent. `onSaved` (optionnel) est appelé après un enregistrement
   réussi. `compact` resserre l'espacement pour un usage encart.
   ================================================================ */
const RaSaisieSection = ({ consultantId, annee, mois, compact = false, onSaved }) => {
    const [ra, setRa] = useState(null);
    const [raSections, setRaSections] = useState({}); // { reference BC → texte de section }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const raReadOnly = ra?.statut === 'VALIDE';

    const loadRa = useCallback(() => {
        if (!consultantId || !annee || !mois) { setRa(null); setRaSections({}); return; }
        setLoading(true);
        setError('');
        api.get('/rapports/activite', { params: { consultantId, annee, mois } })
            .then((res) => {
                setRa(res.data);
                setRaSections(parseSectionsRa(res.data?.tachesRealisees, res.data?.bdcUtilises));
            })
            .catch(() => setError("Erreur lors du chargement du rapport d'activité."))
            .finally(() => setLoading(false));
    }, [consultantId, annee, mois]);

    useEffect(() => {
        setSuccess('');
        loadRa();
    }, [loadRa]);

    // Suggestion des tâches depuis les saisies (ajoutées à la 1re section)
    const suggererTaches = () => {
        const suggestions = (ra?.tachesSuggerees || []).map((t) => `- ${t}`);
        if (suggestions.length === 0) return;
        setRaSections((prev) => {
            const firstKey = (ra?.bdcUtilises?.[0]?.reference) || Object.keys(prev)[0] || GENERAL_KEY;
            const cur = prev[firstKey] || '';
            return { ...prev, [firstKey]: (cur ? cur.trimEnd() + '\n' : '') + suggestions.join('\n') };
        });
    };

    // Enregistrer / soumettre le RA
    const enregistrerRa = (statut) => {
        if (!mois || !consultantId) return;
        if (statut === 'SOUMIS' && !window.confirm(
            "Confirmez-vous la soumission de ce rapport d'activité pour validation ?"
        )) return;

        setSaving(true);
        setError('');
        setSuccess('');
        api.post('/rapports/activite', {
            consultantId,
            annee,
            mois,
            tachesRealisees: serializeSectionsRa(raSections),
            statut,
        })
            .then(() => {
                setSuccess(statut === 'SOUMIS'
                    ? 'Rapport soumis avec succès.'
                    : 'Brouillon enregistré avec succès.');
                loadRa();
                if (onSaved) onSaved();
            })
            .catch(() => setError("Erreur lors de l'enregistrement du rapport."))
            .finally(() => setSaving(false));
    };

    // ================================================================

    if (!consultantId) {
        return (
            <Card className="!p-8 text-center text-gray-400">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">
                    Sélectionnez un consultant pour saisir son rapport d'activité.
                </p>
            </Card>
        );
    }

    if (loading) {
        return (
            <Card className="!p-12 text-center text-gray-400">
                <Loader2 className="animate-spin mx-auto mb-2" /> Chargement du rapport d'activité…
            </Card>
        );
    }

    if (!ra) {
        return error ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">
                <AlertCircle size={16} /> {error}
            </div>
        ) : null;
    }

    // Groupes RUN / PROJET (par nature du BC ; nature inconnue → PROJET)
    const bdcs = ra.bdcUtilises || [];
    const groupesBdc = [
        { titre: 'RUN', items: bdcs.filter((b) => b.nature === 'RUN') },
        { titre: 'PROJET', items: bdcs.filter((b) => b.nature !== 'RUN') },
    ].filter((g) => g.items.length > 0);

    const renderSectionTextarea = (refKey) => (
        <textarea
            value={raSections[refKey] || ''}
            onChange={(e) => setRaSections((prev) => ({ ...prev, [refKey]: e.target.value }))}
            disabled={raReadOnly}
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
            placeholder={'Ligne sans tiret = thème, ligne "- " = tâche du thème, ex. :\nMEGARA\n- Développement du module de facturation\n- Correction des anomalies de pointage'}
        />
    );

    return (
        <div className={compact ? 'space-y-4' : 'space-y-5'}>
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">
                    <AlertCircle size={16} /> {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-semibold">
                    <CheckCircle2 size={16} /> {success}
                </div>
            )}

            {/* En-tête */}
            <Card className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="text-lg font-black flex items-center gap-3" style={{ color: COLORS.blue }}>
                        {ra.moisLabel} <StatusBadge statut={ra.statut} />
                    </div>
                    <div className="text-sm text-gray-500 font-semibold mt-1">
                        {ra.consultantNom} · {ra.cabinetNom}
                        {ra.fonction ? ` — ${ra.fonction}` : ''}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black px-3 py-1.5 rounded-lg"
                          style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                        Total JH : {fmt(ra.totalJH)} — cohérent RPI ✓
                    </span>
                    <Button onClick={() => generateRaPDF({ ...ra, tachesRealisees: serializeSectionsRa(raSections) })}>
                        <Download size={16} /> Exporter PDF
                    </Button>
                </div>
            </Card>

            {/* Alerte de rejet */}
            {ra.statut === 'REJETE' && ra.motifRejet && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                        <span className="font-black">Motif du rejet : </span>
                        {ra.motifRejet}
                    </div>
                </div>
            )}

            {/* Tâches réalisées — une section par BC, groupées RUN / PROJET */}
            <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs uppercase font-black text-gray-400 tracking-wider">
                        Tâches réalisées
                    </h3>
                    {raReadOnly ? (
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                            <CheckCircle2 size={13} /> Rapport validé — lecture seule
                        </span>
                    ) : (
                        <Button variant="outline" onClick={suggererTaches}
                                disabled={!ra.tachesSuggerees || ra.tachesSuggerees.length === 0}>
                            <Sparkles size={14} /> Suggérer depuis les saisies
                        </Button>
                    )}
                </div>

                {/* Bandeau total JH (issu du pointage validé) */}
                <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black"
                     style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                    <CheckCircle2 size={15} /> Total JH : {fmt(ra.totalJH)} — cohérent RPI ✓
                </div>

                {groupesBdc.length === 0 ? (
                    <div className="space-y-2">
                        <div className="font-black text-sm" style={{ color: COLORS.blue }}>Général</div>
                        {renderSectionTextarea(GENERAL_KEY)}
                    </div>
                ) : groupesBdc.map((g) => (
                    <div key={g.titre} className="space-y-3">
                        <h4 className="text-xs uppercase font-black tracking-wider border-b border-gray-100 pb-1"
                            style={{ color: COLORS.blue }}>
                            {g.titre}
                        </h4>
                        {g.items.map((b) => (
                            <div key={b.reference} className="border border-gray-100 rounded-xl p-4 space-y-2 bg-gray-50/50">
                                <div className="font-black text-sm" style={{ color: COLORS.blue }}>
                                    BC {b.reference} : {b.designation || '—'}{' '}
                                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full align-middle"
                                          style={{ backgroundColor: '#fef9c3', color: '#a16207' }}>
                                        {fmt(b.jours)} JH
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-400 font-semibold">
                                    JH issus du pointage validé (cohérent RPI)
                                </p>
                                {renderSectionTextarea(b.reference)}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    {!raReadOnly && (
                        <>
                            <Button variant="outline" onClick={() => enregistrerRa('BROUILLON')} disabled={saving}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Enregistrer brouillon
                            </Button>
                            <Button variant="secondary" onClick={() => enregistrerRa('SOUMIS')} disabled={saving}>
                                <Send size={16} /> Soumettre
                            </Button>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default RaSaisieSection;
