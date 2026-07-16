import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CDG_BLUE = '#003366';
const CDG_GREEN = '#008858';
const RED = '#c00000';
const RED_TEXT = '#dc2626';
const GREY_WEEKEND = '#d9d9d9';
const GREY_LIGHT = '#f1f5f9';

const fmt = (n) => (n == null ? '0' : (Number.isInteger(n) ? String(n) : Number(n).toFixed(1)));
const dayNum = (dateStr) => (dateStr ? String(parseInt(dateStr.slice(8, 10), 10)) : '');

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Format jsPDF déduit d'une data-URL image (PNG par défaut). */
export const imageFormatFromDataUrl = (dataUrl) => {
    const m = /^data:image\/(\w+)/.exec(dataUrl || '');
    const fmtImg = (m ? m[1] : 'png').toUpperCase();
    return fmtImg === 'JPG' ? 'JPEG' : fmtImg;
};

/** Contenu d'une case jour du tableau hebdomadaire. */
const celluleJour = (jour) => {
    if (!jour) return '';
    switch (jour.type) {
        case 'PRESENCE': return fmt(jour.valeur);
        case 'ABSENCE': return 'ABS';
        case 'FERIE': return 'JF';
        default: return ''; // WEEKEND / VIDE / HORS_MOIS
    }
};

/**
 * Génère le PDF du Relevé Périodique d'Intervention mensuel,
 * fidèle au document réel.
 * @param {object} rpi - réponse de GET /api/reports/rpi-mensuel (RpiMoisDTO)
 */
export const generateRpiPDF = (rpi) => {
    const doc = new jsPDF();
    const pageGuard = (yy, limit = 250) => {
        if (yy > limit) { doc.addPage(); return 20; }
        return yy;
    };

    // ---------- LOGO CABINET (coin supérieur gauche) ----------
    if (rpi.logoCabinet) {
        try {
            doc.addImage(rpi.logoCabinet, imageFormatFromDataUrl(rpi.logoCabinet), 14, 8, 24, 14);
        } catch (e) { /* logo illisible : on imprime sans */ }
    }

    // ---------- TITRE ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0);
    doc.text("Relevé Périodique d'Intervention", 105, 18, { align: 'center' });

    // ---------- BLOC GAUCHE : Consultant / Société / Mission ----------
    let y = 30;
    doc.setFontSize(10);
    const infoLine = (label, value) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label} :`, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || '—'), 40, y);
        y += 6;
    };
    infoLine('Consultant', rpi.consultantNom);
    infoLine('Société', rpi.cabinetNom);
    infoLine('Mission', rpi.mission);

    // ---------- TABLEAU DES BONS DE COMMANDE ----------
    autoTable(doc, {
        startY: y + 2,
        head: [['Référence BC', 'JH', 'Reliquat', 'Consommé', 'JH Restant']],
        body: (rpi.bcs || []).map((b) => [
            b.reference || '—',
            fmt(b.jhBudget),
            fmt(b.reliquatAvant),
            fmt(b.consommeMois),
            fmt(b.jhRestant),
        ]),
        theme: 'grid',
        headStyles: { fillColor: CDG_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
        styles: { fontSize: 9, halign: 'center', cellPadding: 2, fontStyle: 'bold' },
        columnStyles: {
            0: { halign: 'left' },
            2: { textColor: CDG_GREEN },
            4: { textColor: RED_TEXT },
        },
        margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ---------- PÉRIODE & TOTAUX ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Période : du ${rpi.periodeDu || '—'} au ${rpi.periodeAu || '—'}`, 14, y);
    y += 6;
    doc.text(`Total JH (mtd) : ${fmt(rpi.totalMtd)}   /   Total JH (std) : ${fmt(rpi.totalStd)}`, 14, y);
    y += 6;

    // ---------- UN TABLEAU PAR SEMAINE ----------
    (rpi.semaines || []).forEach((s) => {
        y = pageGuard(y, 240);
        const jours = s.jours || [];
        const totalIdx = 2 + jours.length;

        const head = [
            [{
                content: `Semaine du ${s.du || ''} au ${s.au || ''}`,
                colSpan: totalIdx + 2,
                styles: { halign: 'left', fillColor: '#e2e8f0', textColor: CDG_BLUE, fontStyle: 'bold', fontSize: 8 },
            }],
            [
                'Consultant',
                'Mission',
                ...jours.map((j, i) => `${DAY_LABELS[i] || ''} ${dayNum(j.date)}`),
                'Total',
                'Total (Mtd)',
            ],
        ];
        const body = [[
            rpi.consultantNom || '—',
            rpi.mission || '—',
            ...jours.map(celluleJour),
            fmt(s.totalSemaine),
            fmt(s.totalMtd),
        ]];

        autoTable(doc, {
            startY: y,
            head,
            body,
            theme: 'grid',
            headStyles: { fillColor: '#000000', textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 },
            styles: { fontSize: 7, halign: 'center', cellPadding: 1.5 },
            columnStyles: {
                0: { cellWidth: 28, halign: 'left' },
                1: { cellWidth: 30, halign: 'left' },
                [totalIdx]: { cellWidth: 14 },
                [totalIdx + 1]: { cellWidth: 18 },
            },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                const ci = data.column.index;
                // Cases jours
                if (ci >= 2 && ci < totalIdx) {
                    const j = jours[ci - 2];
                    switch (j?.type) {
                        case 'PRESENCE':
                            data.cell.styles.fillColor = CDG_BLUE;
                            data.cell.styles.textColor = 255;
                            data.cell.styles.fontStyle = 'bold';
                            break;
                        case 'ABSENCE':
                            data.cell.styles.textColor = RED_TEXT;
                            data.cell.styles.fontStyle = 'bold';
                            break;
                        case 'FERIE':
                            data.cell.styles.textColor = '#1d4ed8';
                            data.cell.styles.fontStyle = 'bold';
                            break;
                        case 'WEEKEND':
                            data.cell.styles.fillColor = GREY_WEEKEND;
                            break;
                        case 'HORS_MOIS':
                            data.cell.styles.fillColor = GREY_LIGHT;
                            break;
                        default:
                            break; // VIDE : blanc
                    }
                }
                // Cases Total / Total (Mtd) : fond rouge, texte blanc
                if (ci === totalIdx || ci === totalIdx + 1) {
                    data.cell.styles.fillColor = RED;
                    data.cell.styles.textColor = 255;
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 4;
    });

    // ---------- LÉGENDE ----------
    y = pageGuard(y + 4, 265);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text('Mtd : Month to date (cumul du mois)   /   Std : Start to date (cumul depuis le début du bon de commande)', 14, y);
    y += 12;

    // ---------- SIGNATURES ----------
    y = pageGuard(y, 235);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(CDG_BLUE);
    doc.text('Responsable', 40, y, { align: 'center' });
    doc.text('Consultant', 160, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(String(rpi.consultantNom || ''), 160, y + 5, { align: 'center' });

    if (rpi.signatureResponsable) {
        try { doc.addImage(rpi.signatureResponsable, 'PNG', 20, y + 8, 40, 18); } catch (e) { /* signature illisible */ }
    }
    if (rpi.signatureConsultant) {
        try { doc.addImage(rpi.signatureConsultant, 'PNG', 140, y + 8, 40, 18); } catch (e) { /* signature illisible */ }
    }
    y += 34;

    // ---------- HISTORIQUE ANNUEL ----------
    y = pageGuard(y, 220);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(CDG_BLUE);
    doc.text(`Historique des relevés périodiques d'intervention de l'année ${rpi.annee || ''}`, 14, y);

    const histo = rpi.historiqueAnnuel || [];
    const totaux = rpi.totauxAnnuels;
    const moisValue = (arr, i) => {
        const v = (arr || [])[i];
        return v ? fmt(v) : '';
    };
    const histoBody = histo.map((h) => [
        h.reference || '—',
        fmt(h.joursBdc),
        fmt(h.totalConsomme),
        fmt(h.joursRestants),
        ...Array.from({ length: 12 }, (_, i) => moisValue(h.parMois, i)),
    ]);
    if (totaux) {
        histoBody.push([
            'Totaux',
            fmt(totaux.joursBdc),
            fmt(totaux.totalConsomme),
            fmt(totaux.joursRestants),
            ...Array.from({ length: 12 }, (_, i) => moisValue(totaux.parMois, i)),
        ]);
    }

    autoTable(doc, {
        startY: y + 3,
        head: [[
            'BDC', 'Jours BDC', 'Total Consommé', 'Jours Restants',
            ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
        ]],
        body: histoBody,
        theme: 'grid',
        headStyles: { fillColor: CDG_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 },
        styles: { fontSize: 7, halign: 'center', cellPadding: 1.5 },
        columnStyles: { 0: { halign: 'left', cellWidth: 26 } },
        didParseCell: (data) => {
            // Colonnes mois (1..12) : fond rouge en en-tête
            if (data.section === 'head' && data.column.index >= 4) {
                data.cell.styles.fillColor = RED;
            }
            // Ligne des totaux en gras
            if (data.section === 'body' && totaux && data.row.index === histoBody.length - 1) {
                data.cell.styles.fontStyle = 'bold';
            }
        },
        margin: { left: 14, right: 14 },
    });

    // ---------- PIED DE PAGE ----------
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`ConsultTrack · RPI généré le ${new Date().toLocaleString()} · Page ${i}/${pageCount}`, 105, 290, { align: 'center' });
    }

    const safe = (s) => (s || '').replace(/\s+/g, '_');
    doc.save(`RPI_${safe(rpi.consultantNom)}_${safe(rpi.moisLabel)}.pdf`);
};
