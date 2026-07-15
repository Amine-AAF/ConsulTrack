import React from 'react';
import { Check, X, User, Calculator, CheckCircle, Ticket, Info } from 'lucide-react';

const TimesheetValidationCard = ({ timesheet, onValidate, onReject, readOnly = false }) => {
    // Extraction date (ex: "2026-03")
    const [yearStr, monthStr] = timesheet.period.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => {
        const day = new Date(y, m, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    const stats = {
        totalMois: 0,
        absences: 0,
        feries: 0,
        bcs: {}
    };

    const bcColors = ['#003366', '#C5A059', '#2D6A4F', '#7c3aed', '#db2777'];

    const uniqueBCIds = [...new Set(timesheet.entries
        .filter(e => e.mode === 'BC' && (e.bonDeCommande?.id || e.bcId))
        .map(e => e.bonDeCommande?.id || e.bcId))
    ].sort();

    timesheet.entries.forEach(entry => {
        const duree = entry.duree || 0;

        if (entry.mode === 'BC') {
            const bcId = entry.bonDeCommande?.id || entry.bcId;
            const bcRef = entry.bonDeCommande?.reference || "BC Inconnu";
            const bcMax = entry.bonDeCommande?.joursMax || 0;
            const bcConsoGlobal = entry.bonDeCommande?.joursConsommes || 0;

            if (!stats.bcs[bcId]) {
                const colorIndex = uniqueBCIds.indexOf(bcId);
                stats.bcs[bcId] = {
                    ref: bcRef,
                    total: 0,
                    max: bcMax,
                    consoGlobal: bcConsoGlobal,
                    color: bcColors[colorIndex % bcColors.length]
                };
            }
            stats.bcs[bcId].total += duree;
            stats.totalMois += duree;
        }
        else if (entry.mode === 'ABSENCE' || entry.mode === 'ABS') {
            stats.absences += duree;
        }
        else if (entry.mode === 'FERIE') {
            stats.feries += duree;
        }
    });

    const getEntryForDay = (day) => {
        const dayStr = String(day).padStart(2, '0');
        const monthString = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthString}-${dayStr}`;
        return timesheet.entries.find(e => e.date === dateStr);
    };

    const getDayStyle = (entry, day) => {
        const date = new Date(year, month, day);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        if (isWeekend) return "bg-gray-50 text-gray-300";

        if (!entry) return "bg-white text-gray-300 border border-gray-100";

        switch (entry.mode) {
            case 'ABSENCE':
            case 'ABS':
                return "bg-red-500 text-white font-bold";
            case 'FERIE':
                return "bg-green-600 text-white font-bold";
            case 'BC':
                const bcId = entry.bonDeCommande?.id || entry.bcId;
                const bcInfo = stats.bcs[bcId];
                return bcInfo
                    ? `text-white font-bold`
                    : "bg-[#003366] text-white font-bold";
            default:
                return "bg-gray-200 text-gray-500";
        }
    };

    const getCellStyleObject = (entry) => {
        if (entry?.mode === 'BC') {
            const bcId = entry.bonDeCommande?.id || entry.bcId;
            const color = stats.bcs[bcId]?.color || '#003366';
            return { backgroundColor: color, borderColor: color };
        }
        return {};
    };

    return (
        <div className={`bg-white rounded-xl shadow-md border ${readOnly ? 'border-green-500/30' : 'border-gray-200'} p-5 w-full relative overflow-hidden transition-all hover:shadow-lg flex flex-col`}>

            {/* Badge VALIDÉ si readOnly + RÉCAP EN HAUT */}
            {readOnly && (
                <div className="absolute top-0 right-0 flex items-center">
                    <div className="bg-gray-50 text-gray-500 text-[9px] font-bold px-3 py-1 border-b border-gray-100">
                        ABS: {stats.absences} | FÉRIÉ: {stats.feries}
                    </div>
                    <div className="bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-b border-l border-green-200 flex items-center gap-1">
                        <CheckCircle size={12}/> VALIDÉ
                    </div>
                </div>
            )}

            {/* EN-TÊTE */}
            <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                <div>
                    <h3 className="text-md font-bold text-[#003366] flex items-center gap-2">
                        <User size={16}/> {timesheet.consultantName}
                    </h3>
                    <p className="text-xs text-gray-500 uppercase font-bold mt-1">
                        {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className={`text-right ${readOnly ? 'pt-5' : ''}`}>
                    <span className="bg-[#003366] text-white px-2 py-1 rounded text-xs font-bold block mb-1">
                        {stats.totalMois.toFixed(1)} JH Facturables
                    </span>
                    {!readOnly && (stats.absences > 0 || stats.feries > 0) && (
                        <div className="flex gap-1 justify-end">
                            {stats.absences > 0 && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold">ABS: {stats.absences}</span>}
                            {stats.feries > 0 && <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded font-bold">FÉRIÉ: {stats.feries}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* CALENDRIER */}
            <div className="mb-5 flex-grow">
                <div className="grid grid-cols-7 mb-1 text-center">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                        <div key={i} className="text-[9px] font-bold text-gray-400">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-[10px]">
                    {emptyDays.map((_, i) => <div key={`e-${i}`} />)}
                    {daysArray.map((day) => {
                        const entry = getEntryForDay(day);
                        return (
                            <div
                                key={day}
                                className={`aspect-square flex flex-col items-center justify-center rounded ${getDayStyle(entry, day)}`}
                                style={getCellStyleObject(entry)}
                                title={entry ? `${entry.mode} - ${entry.duree}j` : ''}
                            >
                                <span>{day}</span>
                                {entry && entry.duree < 1 && <span className="text-[7px] leading-none opacity-80">{entry.duree}</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* LÉGENDE DES BC (NOUVEAU) */}
            {Object.keys(stats.bcs).length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-1 mb-2 text-gray-400 text-[10px] font-bold uppercase border-b border-gray-100 pb-1">
                        <Info size={10}/> Répartition par BC
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.values(stats.bcs).map((bcStats, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded border border-gray-100 shadow-sm">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: bcStats.color }}></div>
                                <div className="text-[9px] font-bold text-gray-700">{bcStats.ref}</div>
                                <div className="text-[9px] font-black" style={{ color: bcStats.color }}>{bcStats.total.toFixed(1)} JH</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ACTIONS */}
            {!readOnly && (
                <div className="flex gap-2 mt-auto">
                    <button onClick={() => onReject(timesheet.id)} className="flex-1 py-2 rounded-md border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors">
                        REFUSER
                    </button>
                    <button onClick={() => onValidate(timesheet.id)} className="flex-1 py-2 rounded-md bg-[#2D6A4F] text-white hover:bg-[#1b4332] text-xs font-bold transition-colors flex items-center justify-center gap-2">
                        <Check size={14}/> VALIDER
                    </button>
                </div>
            )}
        </div>
    );
};

export default TimesheetValidationCard;