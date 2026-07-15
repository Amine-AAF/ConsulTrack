import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- IMPORT DES ASSETS ---
// Assurez-vous que ces chemins sont corrects
import logoCdg from '../assets/logo_cdg.png';
import logoCabinetPlaceholder from '../assets/logo_cabinet_placeholder.png';

export const generateTimesheetPDF = (data) => {
    const doc = new jsPDF();
    const {
        consultantName,
        cabinetName,
        monthLabel,
        bcSummary,
        activities,
        year,
        month // 1 = Janvier, 2 = Février...
    } = data;

    // --- SÉCURITÉ DATES ---
    const safeYear = parseInt(year, 10) || new Date().getFullYear();
    const safeMonth = parseInt(month, 10) || (new Date().getMonth() + 1);

    // --- COULEURS ---
    const CDG_BLUE = '#003366';
    const CDG_GOLD = '#C5A059';
    const GRAY_BG = '#f8fafc';        // Gris clair (cases vides)
    const WEEKEND_BG = '#e2e8f0';     // Gris plus foncé (week-ends)
    const RED_ABS = '#ef4444';
    const GREEN_FERIE = '#16a34a';

    // --- CALCUL DU TOTAL À FACTURER UNIQUEMENT ---
    const totalPrestation = activities
        .filter(a => a.type === 'BC')
        .reduce((acc, curr) => acc + curr.val, 0);

    // ==========================================
    // 1. EN-TÊTE
    // ==========================================
    try {
        doc.addImage(logoCdg, 'PNG', 14, 10, 25, 25);
    } catch (e) {
        doc.setFillColor(CDG_BLUE); doc.rect(14, 10, 25, 25, 'F');
    }

    try {
        doc.addImage(logoCabinetPlaceholder, 'PNG', 170, 10, 25, 25);
    } catch (e) {
        doc.setFontSize(10); doc.setTextColor(100);
        doc.text(cabinetName || "Cabinet Externe", 195, 20, { align: 'right' });
    }

    // Titre
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(CDG_BLUE);
    doc.text("FEUILLE DE TEMPS", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(CDG_GOLD);
    doc.text(monthLabel ? monthLabel.toUpperCase() : "MOIS INCONNU", 105, 28, { align: 'center' });

    // --- ENCART TOTAL À FACTURER (SIMPLIFIÉ) ---
    doc.setDrawColor(CDG_GOLD);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(80, 33, 50, 12, 2, 2, 'S');

    doc.setFontSize(9);
    doc.setTextColor(CDG_BLUE);
    doc.text("TOTAL À FACTURER", 105, 38, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`${totalPrestation} JH`, 105, 43, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 52, 196, 52);

    // ==========================================
    // 2. INFOS GÉNÉRALES
    // ==========================================
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Consultant :", 14, 60);
    doc.setFont("helvetica", "normal");
    doc.text(consultantName, 40, 60);

    doc.setFont("helvetica", "bold");
    doc.text("Cabinet :", 120, 60);
    doc.setFont("helvetica", "normal");
    doc.text(cabinetName || "N/A", 140, 60);

    // ==========================================
    // 3. TABLEAU BC
    // ==========================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(CDG_BLUE);
    doc.text("1. État des Bons de Commande", 14, 70);

    const bcRows = bcSummary.map(bc => [
        bc.reference,
        bc.budgetInitial + " JH",
        bc.soldeDebut + " JH",
        bc.consoMois + " JH",
        bc.reliquatFin + " JH"
    ]);

    autoTable(doc, {
        startY: 74,
        head: [['Référence BC', 'Budget Initial', 'Solde Début', 'Conso. Mois', 'Reliquat Fin']],
        body: bcRows,
        theme: 'grid',
        headStyles: { fillColor: CDG_BLUE, textColor: 255, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, halign: 'center', cellPadding: 2 },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 } },
        margin: { left: 14, right: 14 }
    });

    // ==========================================
    // 4. CALENDRIER 7 JOURS (CORRIGÉ & HACHURÉ)
    // ==========================================
    let calendarStartY = doc.lastAutoTable.finalY + 15;
    if (calendarStartY > 200) { doc.addPage(); calendarStartY = 20; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(CDG_BLUE);
    doc.text("2. Calendrier d'Activité", 14, calendarStartY);

    // Légende
    const legendY = calendarStartY - 4;
    doc.setFontSize(7);

    // Légende BC (Uni)
    doc.setFillColor(CDG_BLUE); doc.rect(130, legendY, 3, 3, 'F');
    doc.setTextColor(0); doc.text("Travaillé", 135, legendY+2);

    // Légende Abs (Diagonales)
    doc.setFillColor(RED_ABS); doc.rect(155, legendY, 3, 3, 'F');
    doc.setDrawColor(255,255,255); doc.setLineWidth(0.1);
    doc.line(155, legendY+3, 158, legendY);
    doc.setTextColor(0); doc.text("Absence", 160, legendY+2);

    // Légende Férié (Verticales)
    doc.setFillColor(GREEN_FERIE); doc.rect(175, legendY, 3, 3, 'F');
    doc.line(176.5, legendY, 176.5, legendY+3);
    doc.setTextColor(0); doc.text("Férié", 180, legendY+2);

    // --- FONCTION DE DESSIN ---
    const drawCalendar = (startY) => {
        // Outils UTC pour calculer le jour de la semaine sans erreur de fuseau
        const utcDate = (y, m, d) => new Date(Date.UTC(y, m, d));
        const getDayOfWeek = (d) => (d.getUTCDay() + 6) % 7; // Lundi=0 ... Dimanche=6

        const daysInMonth = utcDate(safeYear, safeMonth, 0).getUTCDate();
        const firstDay = utcDate(safeYear, safeMonth - 1, 1);
        const startOffset = getDayOfWeek(firstDay); // Case de départ (0 à 6)

        // TAILLE RÉDUITE
        const cellWidth = 26; // Largeur
        const cellHeight = 14; // Hauteur
        const daysOfWeek = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

        // En-têtes
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(150);
        daysOfWeek.forEach((day, i) => {
            const xPos = 14 + (i * cellWidth) + (cellWidth/2);
            doc.text(day, xPos, startY + 8, { align: 'center' });
        });

        let currentY = startY + 12;

        // --- MAP ACTIVITÉS ROBUSTE (Sans Timezone) ---
        const activityMap = {};
        activities.forEach(act => {
            // On force l'interprétation de la date comme une chaine ISO YYYY-MM-DD
            // Cela évite que "2026-06-01" devienne "31 Mai" à cause du fuseau horaire
            let dayNum;
            if (typeof act.date === 'string') {
                // "2026-06-01" -> split -> "01" -> 1
                dayNum = parseInt(act.date.split('T')[0].split('-')[2], 10);
            } else {
                // Fallback si c'est un objet Date
                dayNum = act.date.getDate();
            }
            activityMap[dayNum] = act;
        });

        let dayCounter = 1;

        // Boucle sur 6 semaines max
        for (let row = 0; row < 6; row++) {
            if (dayCounter > daysInMonth) break;

            for (let col = 0; col < 7; col++) {
                const boxX = 14 + (col * cellWidth);
                const boxY = currentY;

                // Logique d'affichage (Offset de début)
                const isBeforeStart = (row === 0 && col < startOffset);
                const isAfterEnd = dayCounter > daysInMonth;

                if (isBeforeStart || isAfterEnd) {
                    // CASE VIDE
                    doc.setFillColor(GRAY_BG);
                    doc.rect(boxX, boxY, cellWidth, cellHeight, 'F');
                    doc.setDrawColor(230);
                    doc.rect(boxX, boxY, cellWidth, cellHeight, 'S');
                } else {
                    // JOUR DU MOIS
                    const act = activityMap[dayCounter];
                    const isWeekend = col >= 5; // Samedi ou Dimanche

                    // 1. Fond
                    let fillColor = '#ffffff';
                    if (isWeekend) fillColor = WEEKEND_BG;

                    if (act) {
                        if (act.type === 'BC') fillColor = CDG_BLUE;
                        else if (act.type === 'ABS' || act.type === 'ABSENCE') fillColor = RED_ABS;
                        else if (act.type === 'FERIE') fillColor = GREEN_FERIE;
                    }

                    doc.setFillColor(fillColor);
                    doc.rect(boxX, boxY, cellWidth, cellHeight, 'F');

                    // 2. HACHURES (Rayures pour impression N&B)
                    if (act) {
                        doc.setDrawColor(255, 255, 255); // Lignes blanches
                        doc.setLineWidth(0.2);

                        if (act.type === 'ABS' || act.type === 'ABSENCE') {
                            // Diagonales
                            for (let k = -cellHeight; k < cellWidth; k += 4) {
                                doc.line(Math.max(boxX, boxX + k), boxY + cellHeight, Math.min(boxX + cellWidth, boxX + k + cellHeight), boxY);
                            }
                        }
                        if (act.type === 'FERIE') {
                            // Verticales
                            for (let k = 3; k < cellWidth; k += 4) {
                                doc.line(boxX + k, boxY, boxX + k, boxY + cellHeight);
                            }
                        }
                    }

                    // 3. Bordure
                    doc.setDrawColor(200);
                    doc.setLineWidth(0.1);
                    doc.rect(boxX, boxY, cellWidth, cellHeight, 'S');

                    // 4. Numéro du jour
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");

                    if (act && (act.type === 'BC' || act.type === 'ABS' || act.type === 'FERIE')) {
                        doc.setTextColor(255, 255, 255);
                    } else {
                        doc.setTextColor(isWeekend ? 100 : 50);
                    }
                    doc.text(String(dayCounter), boxX + 2, boxY + 4);

                    // 5. Contenu (Texte centré)
                    if (act) {
                        doc.setFontSize(7);
                        doc.text(`${act.val} JH`, boxX + (cellWidth/2), boxY + 8, { align: 'center' });

                        doc.setFontSize(5);
                        doc.setFont("helvetica", "normal");
                        let label = "PRESTATION";
                        if(act.type === 'ABS' || act.type === 'ABSENCE') label = "ABSENCE";
                        if(act.type === 'FERIE') label = "FÉRIÉ";

                        doc.text(label, boxX + (cellWidth/2), boxY + 12, { align: 'center' });
                    }

                    dayCounter++;
                }
            }
            currentY += cellHeight;
        }
        return currentY;
    };

    let signatureY = drawCalendar(calendarStartY) + 10;

    // ==========================================
    // 5. SIGNATURES
    // ==========================================
    if (signatureY > 250) { doc.addPage(); signatureY = 30; }

    doc.setDrawColor(150);
    doc.setLineWidth(0.1);

    // Consultant
    doc.setFillColor(255, 255, 255);
    doc.rect(14, signatureY, 80, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(CDG_BLUE);
    doc.text("Signature du Consultant", 18, signatureY + 8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Fait le ${new Date().toLocaleDateString()}`, 18, signatureY + 30);

    // Responsable
    doc.rect(110, signatureY, 80, 35);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(CDG_BLUE);
    doc.text("Signature Responsable CDG Capital", 114, signatureY + 8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text("Bon pour accord", 114, signatureY + 30);

    // Pied de page
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`ConsultTrack - Document généré le ${new Date().toLocaleString()} - Page ${i}/${pageCount}`, 105, 290, { align: 'center' });
    }

    const filename = `CRA_${monthLabel.replace(' ', '_')}_${consultantName.replace(' ', '_')}.pdf`;
    doc.save(filename);
};