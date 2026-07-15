import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import logoCdg from '../assets/logo_cdg.png';

const CDG_BLUE = '#003366';
const CDG_GREEN = '#008858';
const RED_ABS = '#ef4444';

const fmt = (n) => (n == null ? '0' : (Number.isInteger(n) ? String(n) : n.toFixed(1)));

/**
 * Génère le PDF d'un Rapport d'Activité (RA) mensuel.
 * @param {object} ra - la réponse de l'API (RapportActiviteDTO)
 */
export const generateRaPDF = (ra) => {
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
    doc.text('RAPPORT D\'ACTIVITÉ', 105, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(CDG_GREEN);
    doc.text((ra.moisLabel || '').toUpperCase(), 105, 26, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 38, 196, 38);

    // ---------- INFOS ----------
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.text('Consultant :', 14, 47);
    doc.setFont('helvetica', 'normal'); doc.text(ra.consultantNom || '—', 42, 47);

    doc.setFont('helvetica', 'bold'); doc.text('Bon de Commande :', 14, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`${ra.referenceBC || '—'}${ra.designationBC ? ' · ' + ra.designationBC : ''}`, 55, 54);

    // ---------- TOTAL JH (encadré vert, aligné à droite) ----------
    doc.setDrawColor(CDG_GREEN);
    doc.setFillColor(CDG_GREEN);
    doc.roundedRect(150, 43, 46, 12, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255);
    doc.text(`Total : ${fmt(ra.totalJH)} JH`, 173, 51, { align: 'center' });

    // ---------- GROUPES D'ACTIVITÉ ----------
    let y = 64;
    const groupes = ra.groupes || [];

    if (groupes.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(90);
        doc.text('Aucune activité validée.', 14, y);
        y += 10;
    } else {
        groupes.forEach((groupe) => {
            if (y > 250) { doc.addPage(); y = 20; }

            // Sous-titre du groupe
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(CDG_BLUE);
            doc.text(`${groupe.nature || '—'} — ${fmt(groupe.totalJH)} JH`, 14, y);

            const body = (groupe.lignes || []).map((l) => [
                l.description || '—',
                l.typePrestation || '—',
                l.ticketJira || '—',
                fmt(l.jh) + ' JH',
            ]);

            autoTable(doc, {
                startY: y + 3,
                head: [['Activité', 'Type', 'Ticket', 'JH']],
                body,
                theme: 'grid',
                headStyles: { fillColor: CDG_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
                styles: { fontSize: 9, halign: 'center', cellPadding: 2 },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 100 },
                    3: { fontStyle: 'bold', textColor: CDG_GREEN },
                },
                margin: { left: 14, right: 14 },
            });

            y = doc.lastAutoTable.finalY + 12;
            if (y > 250) { doc.addPage(); y = 20; }
        });
    }

    // ---------- SECTIONS NARRATIVES ----------
    const sections = [
        ['Synthèse du mois', ra.syntheseMois],
        ['Faits marquants', ra.faitsMarquants],
        ['Perspectives', ra.perspectives],
    ];

    sections.forEach(([titre, texte]) => {
        if (y > 250) { doc.addPage(); y = 20; }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(CDG_BLUE);
        doc.text(titre, 14, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0);
        const lines = doc.splitTextToSize(texte || '—', 180);
        lines.forEach((line) => {
            if (y > 275) { doc.addPage(); y = 20; }
            doc.text(line, 14, y);
            y += 6;
        });
        y += 6;
    });

    // ---------- SIGNATURES ----------
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
        doc.text(`ConsultTrack · Rapport d'Activité généré le ${new Date().toLocaleString()} · Page ${i}/${pageCount}`, 105, 290, { align: 'center' });
    }

    const safe = (s) => (s || '').replace(/\s+/g, '_');
    doc.save(`RA_${safe(ra.referenceBC)}_${safe(ra.moisLabel)}.pdf`);
};
