import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axiosConfig';
import {
    LayoutDashboard, Search, RefreshCw, Users,
    TrendingUp, Building2, Filter, Receipt,
    ShieldCheck, BarChart3, Activity, Target, PieChart,
    Download, AlertCircle
} from 'lucide-react';

const Dashboard = ({ userRole = 'ADMIN', userId = 1 }) => {
    // --- ÉTATS ---
    const [activeTab, setActiveTab] = useState('table');
    const [data, setData] = useState([]); // Données brutes (filtrées par rôle à la réception)
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());

    // Filtres UI
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCabinet, setFilterCabinet] = useState('');

    // --- CHARGEMENT DES DONNÉES ---
    useEffect(() => {
        let isMounted = true; // Pour éviter les mises à jour d'état sur un composant démonté
        fetchData(isMounted);
        return () => { isMounted = false; };
    }, [year, userId, userRole]);

    const fetchData = async (isMounted) => {
        setLoading(true);
        try {
            // Note: Idéalement, le backend devrait avoir une route /dashboard/my-report pour le consultant
            // Ici on utilise le rapport global et on filtre strictement à la réception
            const endpoint = `/dashboard/report?annee=${year}`;
            const res = await api.get(endpoint);
            let reportData = res.data;

            // 🔒 FILTRAGE DE SÉCURITÉ CÔTÉ FRONT
            if (userRole === 'CONSULTANT' || userRole === 'USER') {
                // On filtre pour ne garder que les lignes qui concernent ce consultant.
                // Si le DTO contient 'consultantId', on filtre dessus.
                // Sinon, c'est une faille potentielle si le backend renvoie tout le monde.
                if (reportData.length > 0 && reportData[0].hasOwnProperty('consultantId')) {
                    reportData = reportData.filter(d => d.consultantId === parseInt(userId));
                } else {
                    // Fallback si pas d'ID : on peut essayer de filtrer par nom si disponible dans les props,
                    // ou si c'est impossible, on vide pour la sécurité par défaut
                    // reportData = []; // Décommenter pour sécurité maximale si pas d'ID
                    console.warn("Attention: Filtrage par ID impossible, affichage complet par défaut (Risque sécurité)");
                }
            }

            if (isMounted) {
                setData(reportData);
            }
        } catch (error) {
            console.error("Erreur dashboard", error);
            if (isMounted) setData([]);
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    // --- FILTRAGE DYNAMIQUE (Recherche & Dropdown) ---
    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch =
                (item.nomConsultant?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (item.referenceBC?.toLowerCase() || '').includes(searchTerm.toLowerCase());

            const matchesCabinet = filterCabinet === "" || item.nomCabinet === filterCabinet;

            return matchesSearch && matchesCabinet;
        });
    }, [data, searchTerm, filterCabinet]);

    // --- CALCUL KPI DYNAMIQUE (Basé sur la vue filtrée) ---
    const kpi = useMemo(() => {
        const totalB = filteredData.reduce((acc, curr) => acc + (curr.totalJoursBC || 0), 0);
        const totalC = filteredData.reduce((acc, curr) => acc + (curr.joursConsommesYTD || 0), 0);
        const montantTotal = filteredData.reduce((acc, curr) => acc + (curr.montantConsommeYTD || 0), 0);

        return {
            totalBudget: totalB,
            totalConsomme: totalC,
            montantConsomme: montantTotal,
            tauxGlobal: totalB > 0 ? ((totalC / totalB) * 100).toFixed(1) : 0
        };
    }, [filteredData]);

    // --- EXPORT CSV ---
    const handleExport = () => {
        const headers = ["Consultant", "Cabinet", "Reference BC", "Budget JH", "Consommé JH", "Reste JH", "Montant Consommé"];
        const rows = filteredData.map(d => [
            d.nomConsultant, d.nomCabinet, d.referenceBC, d.totalJoursBC, d.joursConsommesYTD, d.joursRestants, d.montantConsommeYTD
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dashboard_export_${year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const tabStyle = (id) => ({
        padding: '10px 18px',
        cursor: 'pointer',
        backgroundColor: activeTab === id ? '#ffffff' : 'rgba(255,255,255,0.1)',
        color: activeTab === id ? '#003366' : '#ffffff',
        border: 'none',
        fontWeight: 'bold',
        borderRadius: '8px',
        display: 'flex', alignItems: 'center', gap: '8px', transition: '0.3s', fontSize: '12px'
    });

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-[#003366]">
            <RefreshCw className="animate-spin mb-4" size={40} />
            <h2 className="font-black text-xl tracking-tight">CHARGEMENT DES DONNÉES...</h2>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl p-4 space-y-6 font-sans text-slate-800">

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enveloppe {year} (Filtrée)</p>
                        <h3 className="text-3xl font-black text-[#003366] mt-1">{kpi.totalBudget.toLocaleString()} <span className="text-sm font-bold opacity-60">JH</span></h3>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl"><Target size={28} className="text-[#003366]"/></div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Consommé Réel</p>
                        <h3 className="text-3xl font-black text-[#C5A059] mt-1">{kpi.totalConsomme.toFixed(1)} <span className="text-sm font-bold opacity-60">JH</span></h3>
                        <div className="text-[10px] font-bold text-gray-400 mt-1">{kpi.montantConsomme.toLocaleString()} MAD HT</div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-xl"><Activity size={28} className="text-[#C5A059]"/></div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taux d'atterrissage</p>
                        <h3 className={`text-3xl font-black mt-1 ${kpi.tauxGlobal > 90 ? 'text-red-600' : 'text-[#2D6A4F]'}`}>{kpi.tauxGlobal}%</h3>
                    </div>
                    <div className={`p-3 rounded-xl ${kpi.tauxGlobal > 90 ? 'bg-red-50' : 'bg-green-50'}`}>
                        <PieChart size={28} className={kpi.tauxGlobal > 90 ? 'text-red-600' : 'text-[#2D6A4F]'}/>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

                {/* HEADER */}
                <div className="bg-[#003366] p-8 text-white">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/10 p-3 rounded-2xl"><ShieldCheck size={32} className="text-[#C5A059]" /></div>
                            <div>
                                <h1 className="m-0 text-xl md:text-2xl font-black tracking-tight">
                                    {userRole === 'ADMIN' ? 'PILOTAGE GLOBAL DSI' : 'MON ESPACE ANALYTIQUE'}
                                </h1>
                                <p className="text-xs opacity-70 font-bold uppercase tracking-wide mt-1">Suivi des prestations & consommations</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={handleExport} className="bg-[#C5A059] hover:bg-[#b08d4d] text-white p-2.5 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold uppercase">
                                <Download size={16}/> Export CSV
                            </button>
                            <select
                                className="bg-white/10 text-white border border-white/20 p-2.5 rounded-xl font-bold cursor-pointer outline-none hover:bg-white/20 transition-colors"
                                value={year} onChange={(e) => setYear(e.target.value)}
                            >
                                {[2024, 2025, 2026, 2027].map(y => <option key={y} className="text-slate-900" value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button style={tabStyle('table')} onClick={() => setActiveTab('table')}><TrendingUp size={16} /> VUE TABLEAU</button>
                        <button style={tabStyle('cards')} onClick={() => setActiveTab('cards')}><Receipt size={16} /> VUE CARTES</button>
                    </div>
                </div>

                {/* FILTERS & DATA */}
                <div className="p-8 bg-slate-50 min-h-[500px]">
                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                        <div className="flex-2 flex items-center gap-3 bg-white p-3 px-4 rounded-xl border border-gray-200 shadow-sm focus-within:border-[#003366] transition-colors">
                            <Search size={18} className="text-slate-400" />
                            <input
                                className="border-none bg-transparent w-full font-bold outline-none text-slate-700 placeholder:text-slate-300 text-sm"
                                placeholder={userRole === 'ADMIN' ? "Rechercher un consultant, un BC..." : "Filtrer mes BC..."}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Filtre Cabinet : Visible uniquement pour l'ADMIN */}
                        {userRole === 'ADMIN' && (
                            <div className="flex-1 flex items-center gap-3 bg-white p-3 px-4 rounded-xl border border-gray-200 shadow-sm">
                                <Filter size={18} className="text-[#003366]" />
                                <select
                                    className="border-none bg-transparent w-full font-bold outline-none text-slate-700 cursor-pointer text-sm"
                                    onChange={(e) => setFilterCabinet(e.target.value)}
                                >
                                    <option value="">Toutes les ESN</option>
                                    {[...new Set(data.map(i => i.nomCabinet))].filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {filteredData.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <AlertCircle size={48} className="mx-auto mb-4 opacity-50"/>
                            <p className="font-bold">Aucune donnée trouvée pour ces critères.</p>
                        </div>
                    ) : (
                        <>
                            {/* VUE TABLEAU */}
                            {activeTab === 'table' && (
                                <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50 text-slate-500 border-b border-gray-200 font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="p-4 text-left">Consultant & ESN</th>
                                                <th className="p-4 text-left">Référence BC</th>
                                                <th className="p-4 text-center bg-slate-100/50">Budget</th>
                                                {[...Array(12)].map((_, i) => (
                                                    <th key={i} className="p-2 text-center w-10">{new Date(0, i).toLocaleString('default', { month: 'narrow' })}</th>
                                                ))}
                                                <th className="p-4 text-center text-[#C5A059]">Conso.</th>
                                                <th className="p-4 text-center">Reste</th>
                                            </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                            {filteredData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-black text-[#003366] uppercase">{row.nomConsultant}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold">{row.nomCabinet}</div>
                                                    </td>
                                                    <td className="p-4 font-mono font-bold text-slate-600">{row.referenceBC}</td>
                                                    <td className="p-4 text-center font-black bg-slate-50/50">{row.totalJoursBC}</td>
                                                    {row.mensuel.map((val, m) => (
                                                        <td key={m} className={`p-2 text-center font-bold ${val > 0 ? 'text-[#003366]' : 'text-slate-200'}`}>
                                                            {val > 0 ? val : '·'}
                                                        </td>
                                                    ))}
                                                    <td className="p-4 text-center font-black text-[#C5A059]">{row.joursConsommesYTD}</td>
                                                    <td className="p-4 text-center">
                                                            <span className={`px-2 py-1 rounded-md font-bold text-[10px] ${row.joursRestants <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                                                {row.joursRestants.toFixed(1)} JH
                                                            </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* VUE CARTES */}
                            {activeTab === 'cards' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredData.map((bc, idx) => {
                                        const pourcentage = ((bc.joursConsommesYTD / bc.totalJoursBC) * 100).toFixed(1);
                                        const isCritical = pourcentage > 90;

                                        return (
                                            <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-all hover:-translate-y-1 relative overflow-hidden group">
                                                <div className={`absolute top-0 left-0 w-1 h-full ${isCritical ? 'bg-red-500' : 'bg-[#003366]'}`}></div>

                                                <div className="flex justify-between mb-4 pl-3">
                                                    <div>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold uppercase">BC Actif</span>
                                                        <h4 className="mt-2 text-lg font-black text-[#003366]">{bc.referenceBC}</h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-2xl font-black ${isCritical ? 'text-red-500' : 'text-[#2D6A4F]'}`}>{pourcentage}%</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl mb-4 ml-3 border border-slate-100">
                                                    <div className="bg-white p-2 rounded-full shadow-sm"><Users size={14} className="text-[#003366]" /></div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-700">{bc.nomConsultant}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{bc.nomCabinet}</div>
                                                    </div>
                                                </div>

                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-5 ml-1">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : 'bg-[#2D6A4F]'}`}
                                                        style={{ width: `${pourcentage}%` }}
                                                    ></div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 ml-1">
                                                    <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Consommé</div>
                                                        <div className="text-sm font-black text-[#003366]">{bc.joursConsommesYTD} JH</div>
                                                    </div>
                                                    <div className={`p-3 rounded-xl text-center border ${isCritical ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                                        <div className={`text-[9px] font-bold uppercase mb-1 ${isCritical ? 'text-red-400' : 'text-green-600'}`}>Reste</div>
                                                        <div className={`text-sm font-black ${isCritical ? 'text-red-600' : 'text-green-700'}`}>{bc.joursRestants.toFixed(1)} JH</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;