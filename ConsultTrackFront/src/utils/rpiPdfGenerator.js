import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import logoCdg from '../assets/logo_cdg.png';

const CDG_BLUE = '#003366';
const CDG_GREEN = '#008858';
const RED_ABS = '#ef4444';
const GREEN_FERIE = '#16a34a';

const fmt = (n) => (n == null ? '0' : (Number.isInteger(n) ? String(n) : n.toFixed(1)));

/** Contenu affiché dans une case jour du tableau hebdomadaire. */
const celluleJour = (jour) => {
    if (!jour) return '';
    switch (jour.type) {
        case 'PRESENCE': return fmt(jour.valeur);
        case 'ABSENCE': return 'Abs';
        case 'FERIE': return 'Fér';
        case 'AUTRE_BC': return '( )';
        default: return '–'; // WEEKEND / VIDE
    }
};

/**
 * Génère le PDF d'un Relevé de Prestation Individuel (RPI) mensuel.
 * @param {object} rpi - la réponse de GET /api/reports/rpi (RpiMoisDTO)
 */
export const generateRpiPDF = (rpi) => {
    const doc = new jsPDF();

    // ---------- EN-TÊTE ----------
    try {
        doc.addImage(logoCdg, 'PNG', 14, 10, 24, 24);
    } catch (e) {
        doc.setFillColor(CDG_BLUE); doc.rect(14, 10, 24, 24, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(CDG_BLUE);
    doc.text('RELEVÉ DE PRESTATION INDIVIDUEL', 105, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(CDG_GREEN);
    doc.text((rpi.moisLabel || '').toUpperCase(), 105, 26, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 38, 196, 38);

    // ---------- INFOS ----------
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.text('Consultant :', 14, 47);
    doc.setFont('helvetica', 'normal'); doc.text(rpi.consultantNom || '—', 42, 47);

    doc.setFont('helvetica', 'bold'); doc.text('Bon de Commande :', 14, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`${rpi.referenceBC || '—'}${rpi.designationBC ? ' · ' + rpi.designationBC : ''}`, 55, 54);

    // ---------- ÉTAT DU BC ----------
    autoTable(doc, {
        startY: 60,
        head: [['Budget BC', 'Cumul avant mois', 'Consommé mois', 'Cumul après mois', 'Reliquat']],
        body: [[
            fmt(rpi.jhBudgetBC) + ' JH',
            fmt(rpi.jhAvantMois) + ' JH',
            fmt(rpi.consommeMois) + ' JH',
            fmt(rpi.jhApresMois) + ' JH',
            fmt(rpi.jhRestant) + ' JH',
        ]],
        theme: 'grid',
        headStyles: { fillColor: CDG_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
        styles: { fontSize: 10, halign: 'center', cellPadding: 3, fontStyle: 'bold' },
        columnStyles: { 2: { textColor: CDG_GREEN } },
        margin: { left: 14, right: 14 },
    });

    // ---------- GRILLE HEBDOMADAIRE ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(CDG_BLUE);
    doc.text('Détail hebdomadaire (présence par BC)', 14, doc.lastAutoTable.finalY + 12);

    const head = [['Semaine', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Total sem.', 'Cumul mois', 'Cumul BC']];
    const body = (rpi.semaines || []).map((s) => {
        const jw = (s.jours || []).slice(0, 5); // Lun → Ven
        return [
            s.periode,
            celluleJour(jw[0]),
            celluleJour(jw[1]),
            celluleJour(jw[2]),
            celluleJour(jw[3]),
            celluleJour(jw[4]),
            fmt(s.totalSemaine) + ' JH',
            fmt(s.totalMtd) + ' JH',
            fmt(s.totalStd) + ' JH',
        ];
    });

    autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 16,
        head,
        body,
        theme: 'grid',
        headStyles: { fillColor: CDG_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
        styles: { fontSize: 9, halign: 'center', cellPadding: 2 },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
            6: { fontStyle: 'bold' },
            7: { textColor: CDG_GREEN },
            8: { fontStyle: 'bold', textColor: CDG_BLUE },
        },
        // Colore les cases Absence / Férié
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index >= 1 && data.column.index <= 5) {
                if (data.cell.raw === 'Abs') { data.cell.styles.textColor = RED_ABS; data.cell.styles.fontStyle = 'bold'; }
                if (data.cell.raw === 'Fér') { data.cell.styles.textColor = GREEN_FERIE; data.cell.styles.fontStyle = 'bold'; }
            }
        },
        margin: { left: 14, right: 14 },
    });

    // ---------- LÉGENDE ----------
    let y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    doc.text('Légende :  chiffre = JH présence sur ce BC   ·   Abs = absence   ·   Fér = férié   ·   – = week-end / non travaillé', 14, y);

    // ---------- SIGNATURES ----------
    y += 12;
    if (y > 250) { doc.addPage(); y = 30; }
    doc.setDrawColor(150);
    doc.rect(14, y, 80, 30);
    doc.rect(110, y, 80, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(CDG_BLUE);
    doc.text('Signature du Consultant', 18, y + 7);
    doc.text('Validation CDG Capital', 114, y + 7);

    // ---------- PIED DE PAGE ----------
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`ConsultTrack · RPI généré le ${new Date().toLocaleString()} · Page ${i}/${pageCount}`, 105, 290, { align: 'center' });
    }

    const safe = (s) => (s || '').replace(/\s+/g, '_');
    doc.save(`RPI_${safe(rpi.referenceBC)}_${safe(rpi.moisLabel)}.pdf`);
};
