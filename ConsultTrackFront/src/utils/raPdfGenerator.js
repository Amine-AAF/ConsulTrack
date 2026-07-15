import jsPDF from 'jspdf';

const CDG_BLUE = '#003366';

const fmt = (n) => (n == null ? '0' : (Number.isInteger(n) ? String(n) : Number(n).toFixed(1)));

/**
 * Génère le PDF du Rapport d'Activité mensuel, fidèle au document réel.
 * @param {object} ra - réponse de GET /api/rapports/activite
 */
export const generateRaPDF = (ra) => {
    const doc = new jsPDF();
    let y = 20;
    const pageGuard = (limit = 270) => {
        if (y > limit) { doc.addPage(); y = 20; }
    };

    // ---------- TITRE (bleu, à gauche) ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(CDG_BLUE);
    doc.text("Rapport d'activité", 14, y);

    // ---------- BLOC DROIT : Cabinet / Fonction / Intervenant ----------
    doc.setFontSize(10);
    doc.setTextColor(0);
    let yr = 16;
    const rightLine = (label, value) => {
        doc.setFont('helvetica', 'bold');
        const text = `${label} : `;
        const val = String(value || '—');
        const wLabel = doc.getTextWidth(text);
        doc.setFont('helvetica', 'normal');
        const wVal = doc.getTextWidth(val);
        const x = 196 - wLabel - wVal;
        doc.setFont('helvetica', 'bold');
        doc.text(text, x, yr);
        doc.setFont('helvetica', 'normal');
        doc.text(val, x + wLabel, yr);
        yr += 6;
    };
    rightLine('Cabinet', ra.cabinetNom);
    rightLine('Fonction', ra.fonction);
    rightLine('Intervenant', ra.consultantNom);

    y = Math.max(y, yr) + 10;

    // ---------- PÉRIODE ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Période : ${ra.moisLabel || '—'}`, 14, y);
    y += 12;

    // ---------- BDC UTILISÉS ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(CDG_BLUE);
    doc.text('BDC Utilisés :', 14, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);
    const bdcs = ra.bdcUtilises || [];
    if (bdcs.length === 0) {
        doc.text('• —', 20, y);
        y += 6;
    } else {
        bdcs.forEach((b) => {
            pageGuard();
            doc.text(`• ${b.reference || '—'} : ${fmt(b.jours)} Jours`, 20, y);
            y += 6;
        });
    }
    y += 8;

    // ---------- TÂCHES RÉALISÉES ----------
    pageGuard(260);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(CDG_BLUE);
    doc.text('Tâches réalisées :', 14, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);
    const taches = (ra.tachesRealisees || '')
        .split('\n')
        .map((l) => l.trim().replace(/^•\s*/, ''))
        .filter(Boolean);
    if (taches.length === 0) {
        doc.text('• —', 20, y);
        y += 6;
    } else {
        taches.forEach((t) => {
            const lines = doc.splitTextToSize(`• ${t}`, 170);
            lines.forEach((line, li) => {
                pageGuard();
                doc.text(line, li === 0 ? 20 : 23, y);
                y += 6;
            });
        });
    }
    y += 16;

    // ---------- SIGNATURES ----------
    if (y > 240) { doc.addPage(); y = 30; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(CDG_BLUE);
    doc.text('Responsable', 40, y, { align: 'center' });
    doc.text('Consultant', 160, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(String(ra.consultantNom || ''), 160, y + 5, { align: 'center' });

    if (ra.signatureResponsable) {
        try { doc.addImage(ra.signatureResponsable, 'PNG', 20, y + 8, 40, 18); } catch (e) { /* signature illisible */ }
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
