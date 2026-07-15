import React from 'react';

/* ============================================================
   Design-system ConsulTrack — source unique de vérité.
   Couleurs : bleu #003366 (structure), vert #008858 (action/primaire),
   gold #C5A059 (accents data uniquement). Radius: rounded-xl/2xl.
   ============================================================ */

export const COLORS = {
    blue: '#003366',
    green: '#008858',
    gold: '#C5A059',
    red: '#dc2626',
    amber: '#d97706',
};

/** En-tête de page standard : icône + titre + sous-titre + zone d'actions. */
export const PageHeader = ({ icon: Icon, title, subtitle, actions }) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 className="text-2xl font-black flex items-center gap-3" style={{ color: COLORS.blue }}>
                {Icon && <Icon size={26} style={{ color: COLORS.green }} />}
                {title}
            </h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
);

/** Carte de statistique. */
export const StatCard = ({ label, value, unit = 'JH', accent, alert }) => (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${alert ? 'border-red-300 bg-red-50' : 'border-gray-100'}`}>
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{label}</div>
        <div className="text-2xl font-black mt-1" style={{ color: alert ? COLORS.red : (accent || COLORS.blue) }}>
            {value ?? '0'} {unit && <span className="text-sm font-bold text-gray-400">{unit}</span>}
        </div>
    </div>
);

/** Bouton : variant primary (vert) | secondary | danger. */
export const Button = ({ variant = 'primary', children, className = '', ...props }) => {
    const styles = {
        primary: { backgroundColor: COLORS.green, color: '#fff' },
        secondary: { backgroundColor: '#f1f5f9', color: COLORS.blue },
        danger: { backgroundColor: '#fee2e2', color: COLORS.red },
        outline: { backgroundColor: '#fff', color: COLORS.blue, border: '1px solid #e2e8f0' },
    };
    return (
        <button
            className={`flex items-center gap-2 font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            style={styles[variant]}
            {...props}
        >
            {children}
        </button>
    );
};

/** Onglets horizontaux. tabs = [{key, label, count?}] */
export const Tabs = ({ tabs, active, onChange }) => (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit flex-wrap">
        {tabs.map((t) => (
            <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    active === t.key ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
                style={active === t.key ? { color: COLORS.blue } : {}}
            >
                {t.label}
                {t.count > 0 && (
                    <span className="ml-2 text-[10px] font-black text-white rounded-full px-1.5 py-0.5"
                          style={{ backgroundColor: COLORS.red }}>
                        {t.count}
                    </span>
                )}
            </button>
        ))}
    </div>
);

/** Badge de statut standard. */
export const StatusBadge = ({ statut }) => {
    const map = {
        NOUVEAU: { bg: '#f1f5f9', fg: '#64748b', label: 'Nouveau' },
        BROUILLON: { bg: '#f1f5f9', fg: '#64748b', label: 'Brouillon' },
        EN_ATTENTE: { bg: '#fef3c7', fg: COLORS.amber, label: 'En attente' },
        VALIDE: { bg: '#dcfce7', fg: '#15803d', label: 'Validé' },
        REJETE: { bg: '#fee2e2', fg: COLORS.red, label: 'Rejeté' },
        MIXTE: { bg: '#e0e7ff', fg: '#4338ca', label: 'Mixte' },
        VIDE: { bg: '#f1f5f9', fg: '#94a3b8', label: 'Vide' },
    };
    const s = map[statut] || map.NOUVEAU;
    return (
        <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full"
              style={{ backgroundColor: s.bg, color: s.fg }}>
            {s.label}
        </span>
    );
};

/** Carte conteneur standard. */
export const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 ${className}`}>
        {children}
    </div>
);

/** Jauge de consommation BC avec alerte ≥ 80 %. */
export const BudgetGauge = ({ label, consomme, max }) => {
    const pct = max > 0 ? Math.min(100, Math.round((consomme / max) * 100)) : 0;
    const color = pct >= 90 ? COLORS.red : pct >= 80 ? COLORS.amber : COLORS.green;
    return (
        <div>
            <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-gray-600">{label}</span>
                <span style={{ color }}>{consomme}/{max} JH ({pct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
};
