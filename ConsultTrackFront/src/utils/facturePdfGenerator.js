import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ================================================================
   Pré-facture mensuelle (document de contrôle interne) :
   récapitulatif Consultant × BC (JH validés, TJM, montants) d'un
   cabinet, à rapprocher de la facture réellement émise par celui-ci.
   ================================================================ */

const CDG_BLUE = '#003366';
const CDG_GREEN = '#008858';
const GREY_LIGHT = '#f1f5f9';

const fmtJH = (n) => {
    const v = Number(n || 0);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/** « 12 345,00 » — espaces normaux (les fontes standard jsPDF ne gèrent pas U+202F). */
const fmtMAD = (n) => {
    const v = Number(n || 0);
    return v.toFixed(2).replace(/\B(?=(\d{3})+(?=\.))/g, ' ').replace('.', ',');
};

/**
 * Génère le PDF de pré-facture d'un cabinet pour un mois.
 * @param {object} cabinet - élément de GET /api/admin/facturation (FacturationCabinetDTO)
 * @param {string} periodeLabel - ex. « Janvier 2026 »
 * @param {object} [consultantSeul] - si fourni, document restreint à ce consultant
 */
export const generatePrefacturePDF = (cabinet, periodeLabel, consultantSeul = null) => {
    const doc = new jsPDF();

    const consultants = consultantSeul ? [consultantSeul] : (cabinet.consultants || []);
    const totalJH = consultantSeul ? consultantSeul.totalJH : cabinet.totalJH;
    const totalMontant = consultantSeul ? consultantSeul.totalMontant : cabinet.totalMontant;

    // ---------- TITRE ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(CDG_BLUE);
    doc.text(`PRÉ-FACTURE MENSUELLE — ${cabinet.cabinetNom || '—'} — ${periodeLabel}`,
        105, 18, { align: 'center' });

    let y = 28;
    doc.setFontSize(10);
    doc.setTextColor(0);
    if (consultantSeul) {
        doc.text(`Consultant : ${consultantSeul.consultantNom || '—'}`, 14, y);
        y += 6;
    }
    doc.setFont('helvetica', 'normal');
    doc.text(`Période : ${periodeLabel}   ·   Saisies validées uniquement (mode BC)`, 14, y);
    y += 4;

    // ---------- TABLEAU CONSULTANT × BC ----------
    const body = [];
    const boldRows = new Set();
    consultants.forEach((c) => {
        (c.lignes || []).forEach((l, i) => {
            body.push([
                i === 0 ? (c.consultantNom || '—') : '',
                l.bcReference || '—',
                l.codeBudget || '—',
                l.nature || '—',
                fmtJH(l.jh),
                fmtMAD(l.tjm),
                fmtMAD(l.montant),
            ]);
        });
        boldRows.add(body.length);
        body.push([
            `Sous-total ${c.consultantNom || ''}`, '', '', '',
            fmtJH(c.totalJH), '', fmtMAD(c.totalMontant),
        ]);
    });
    const totalRowIdx = body.length;
    body.push([
        consultantSeul ? 'TOTAL' : `TOTAL ${cabinet.cabinetNom || ''}`, '', '', '',
        fmtJH(totalJH), '', fmtMAD(totalMontant),
    ]);

    autoTable(doc, {
        startY: y + 2,
        head: [['Consultant', 'Référence BC', 'Code budgétaire', 'Nature', 'JH', 'TJM (MAD)', 'Montant (MAD)']],
        body,
        theme: 'grid',
        headStyles: { fillColor: CDG_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
        styles: { fontSize: 8.5, cellPadding: 2, halign: 'center' },
        columnStyles: {
            0: { halign: 'left', cellWidth: 42 },
            1: { halign: 'left' },
            4: { cellWidth: 14 },
            5: { halign: 'right', cellWidth: 24 },
            6: { halign: 'right', cellWidth: 30 },
        },
        didParseCell: (data) => {
            if (data.section !== 'body') return;
            if (boldRows.has(data.row.index)) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = GREY_LIGHT;
            }
            if (data.row.index === totalRowIdx) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = CDG_GREEN;
                data.cell.styles.textColor = 255;
            }
        },
        margin: { left: 14, right: 14 },
    });

    // ---------- PIED DE PAGE ----------
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text('Document de contrôle interne — à rapprocher de la facture du cabinet',
            105, 284, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(`ConsultTrack · Pré-facture générée le ${new Date().toLocaleString()} · Page ${i}/${pageCount}`,
            105, 290, { align: 'center' });
    }

    const safe = (s) => (s || '').replace(/\s+/g, '_');
    const suffix = consultantSeul ? `_${safe(consultantSeul.consultantNom)}` : '';
    doc.save(`PreFacture_${safe(cabinet.cabinetNom)}${suffix}_${safe(periodeLabel)}.pdf`);
};
