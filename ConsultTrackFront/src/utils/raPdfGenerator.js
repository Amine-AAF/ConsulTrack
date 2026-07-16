import jsPDF from 'jspdf';
import { imageFormatFromDataUrl } from './rpiPdfGenerator';

/* ================================================================
   Rapport d'Activité — format pilote (Jamoure 2026).

   Structure du champ ra.tachesRealisees (un seul champ TEXT) :
       @@BC:{reference}@@\n{texte de la section}   (sections jointes par '\n')
   Dans une section : ligne sans '-' initial = THÈME (puce '•'),
   ligne commençant par '- ' = tâche du thème (sous-puce 'o').
   Texte legacy sans marqueurs → puces simples sous une section unique.
   ================================================================ */

const CDG_BLUE = '#003366';
const MARGIN_L = 14;
const MARGIN_R = 196;
const PAGE_W = 210;

const fmt = (n) => (n == null ? '0' : (Number.isInteger(n) ? String(n) : Number(n).toFixed(1)));

const BC_MARKER_RE = /@@BC:(.+?)@@/;

/** Découpe le texte stocké en { reference → texte de section }. */
const parseSections = (texte) => {
    const map = {};
    const txt = texte || '';
    if (!txt.trim() || !BC_MARKER_RE.test(txt)) return map; // legacy géré à part
    const parts = txt.split(/@@BC:(.+?)@@/); // [avant, ref1, txt1, ref2, txt2, ...]
    for (let i = 1; i < parts.length; i += 2) {
        map[parts[i]] = (parts[i + 1] || '').replace(/^\n/, '').replace(/\s+$/, '');
    }
    return map;
};

/** Période « 01/{mois}/{annee} au {dernier jour}/{mois}/{annee} ». */
const buildPeriode = (ra) => {
    if (ra.mois && ra.annee) {
        const mm = String(ra.mois).padStart(2, '0');
        const last = new Date(ra.annee, ra.mois, 0).getDate();
        return `01/${mm}/${ra.annee} au ${String(last).padStart(2, '0')}/${mm}/${ra.annee}`;
    }
    return ra.moisLabel || '—';
};

/**
 * Génère le PDF du Rapport d'Activité mensuel (format pilote Jamoure 2026).
 * @param {object} ra - réponse de GET /api/rapports/activite
 */
export const generateRaPDF = (ra) => {
    const doc = new jsPDF();
    let y = 20;

    const pageGuard = (limit = 275) => {
        if (y > limit) { doc.addPage(); y = 20; }
    };

    /** Titre de groupe / texte souligné. */
    const underlinedText = (text, x, size = 12, color = CDG_BLUE) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size);
        doc.setTextColor(color);
        doc.text(text, x, y);
        const w = doc.getTextWidth(text);
        doc.setDrawColor(color);
        doc.setLineWidth(0.4);
        doc.line(x, y + 1, x + w, y + 1);
    };

    // ---------- LOGO CABINET (coin supérieur gauche) ----------
    if (ra.logoCabinet) {
        try {
            doc.addImage(ra.logoCabinet, imageFormatFromDataUrl(ra.logoCabinet), MARGIN_L, 6, 24, 14);
            y = Math.max(y, 26); // le bloc titre passe sous le logo si nécessaire
        } catch (e) { /* logo illisible : on imprime sans */ }
    }

    // ---------- TITRE : centré, gras, souligné ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(CDG_BLUE);
    const title = "Rapport d'activité";
    doc.text(title, PAGE_W / 2, y, { align: 'center' });
    const wTitle = doc.getTextWidth(title);
    doc.setDrawColor(CDG_BLUE);
    doc.setLineWidth(0.5);
    doc.line(PAGE_W / 2 - wTitle / 2, y + 1.5, PAGE_W / 2 + wTitle / 2, y + 1.5);
    y += 14;

    // ---------- BLOC MÉTA (à gauche) ----------
    doc.setFontSize(11);
    doc.setTextColor(0);
    const metaLine = (label, value, boldValue = false) => {
        doc.setFont('helvetica', 'bold');
        const lbl = `${label} : `;
        doc.text(lbl, MARGIN_L, y);
        doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
        doc.text(String(value || '—'), MARGIN_L + doc.getTextWidth(lbl), y);
        y += 6.5;
    };
    metaLine('Consultant', ra.consultantNom);
    metaLine('Société', ra.cabinetNom);
    metaLine('Période', buildPeriode(ra));
    metaLine('Total JH', fmt(ra.totalJH), true);
    y += 6;

    // ---------- SECTIONS PAR BC (groupes RUN / PROJET) ----------
    const bdcs = ra.bdcUtilises || [];
    const sections = parseSections(ra.tachesRealisees);
    const isLegacy = !!(ra.tachesRealisees || '').trim() && !BC_MARKER_RE.test(ra.tachesRealisees || '');
    if (isLegacy && bdcs.length > 0) {
        // Texte legacy sans marqueurs : rattaché à la 1re section BC
        sections[bdcs[0].reference] = (ra.tachesRealisees || '').trim();
    }

    /** Contenu d'une section : thème = '•', tâche ('- ') = 'o' indenté. */
    const renderSectionBody = (texte) => {
        doc.setFontSize(10);
        doc.setTextColor(0);
        const lignes = (texte || '').split('\n').map((l) => l.trim()).filter(Boolean);
        if (lignes.length === 0) {
            doc.setFont('helvetica', 'normal');
            pageGuard();
            doc.text('• —', MARGIN_L + 6, y);
            y += 5.5;
            return;
        }
        lignes.forEach((ligne) => {
            const isTask = /^-\s*/.test(ligne);
            const contenu = ligne.replace(/^-\s*/, '').replace(/^[•o]\s*/, '');
            const bullet = isTask ? 'o' : '•';
            const x = isTask ? MARGIN_L + 12 : MARGIN_L + 6;
            doc.setFont('helvetica', isTask ? 'normal' : 'bold');
            const wrapped = doc.splitTextToSize(`${bullet}  ${contenu}`, MARGIN_R - x);
            wrapped.forEach((line, li) => {
                pageGuard();
                doc.text(line, li === 0 ? x : x + 4, y);
                y += 5.5;
            });
        });
    };

    /** Ligne de titre d'un BC : « BC {ref} : {designation} ({jours} JH) », JH surligné. */
    const renderBcHeader = (b) => {
        pageGuard(265);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(0);
        const jh = `(${fmt(b.jours)} JH)`;
        const wJh = doc.getTextWidth(jh);
        const prefix = `BC ${b.reference || '—'} : ${b.designation || '—'} `;
        const wrapped = doc.splitTextToSize(prefix, MARGIN_R - MARGIN_L - wJh - 4);
        wrapped.forEach((line, li) => {
            pageGuard(265);
            doc.text(line, MARGIN_L, y);
            if (li === wrapped.length - 1) {
                // « (x JH) » en surbrillance jaune à la suite de la dernière ligne
                const xJh = MARGIN_L + doc.getTextWidth(line) + 1.5;
                doc.setFillColor(255, 240, 130);
                doc.rect(xJh - 1, y - 3.8, wJh + 2, 5.4, 'F');
                doc.text(jh, xJh, y);
            }
            y += 6;
        });
        y += 1;
    };

    const renderGroupe = (titre, items) => {
        if (items.length === 0) return;
        pageGuard(260);
        underlinedText(`${titre} :`, MARGIN_L);
        y += 8;
        items.forEach((b) => {
            renderBcHeader(b);
            renderSectionBody(sections[b.reference]);
            y += 4;
        });
        y += 2;
    };

    if (bdcs.length > 0) {
        renderGroupe('RUN', bdcs.filter((b) => b.nature === 'RUN'));
        renderGroupe('PROJET', bdcs.filter((b) => b.nature !== 'RUN'));
    } else {
        // Aucun BC : section unique (texte legacy ou sections orphelines)
        pageGuard(260);
        underlinedText('Tâches réalisées :', MARGIN_L);
        y += 8;
        const texte = isLegacy
            ? (ra.tachesRealisees || '').trim()
            : Object.values(sections).join('\n');
        renderSectionBody(texte);
        y += 4;
    }

    // ---------- SIGNATURES ----------
    y += 10;
    if (y > 240) { doc.addPage(); y = 30; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(CDG_BLUE);
    doc.text('Responsable', 45, y, { align: 'center' });
    doc.text('Consultant', 160, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text('Ahmed Amine FARIZ', 45, y + 5, { align: 'center' });
    doc.text(String(ra.consultantNom || ''), 160, y + 5, { align: 'center' });

    if (ra.signatureResponsable) {
        try { doc.addImage(ra.signatureResponsable, 'PNG', 25, y + 8, 40, 18); } catch (e) { /* signature illisible */ }
    }
    if (ra.signatureConsultant) {
        try { doc.addImage(ra.signatureConsultant, 'PNG', 140, y + 8, 40, 18); } catch (e) { /* signature illisible */ }
    }

    // ---------- PIED DE PAGE ----------
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`ConsultTrack · Rapport d'Activité généré le ${new Date().toLocaleString()} · Page ${i}/${pageCount}`, 105, 290, { align: 'center' });
    }

    const safe = (s) => (s || '').replace(/\s+/g, '_');
    doc.save(`RA_${safe(ra.consultantNom)}_${safe(ra.moisLabel)}.pdf`);
};
