import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';

import Dashboard from './components/Dashboard';
import TimesheetForm from './components/TimesheetForm';
import AdminPanel from './components/AdminPanel';
import AbsenceForm from './components/AbsenceForm';
import Documents from './components/Documents';
import ValidationHub from './components/ValidationHub';
import Profile from './components/Profile';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';
import api from './api/axiosConfig';

import logoConsultrack from './assets/logo_consultrack.png';

import {
    LayoutDashboard, CalendarCheck, LogOut, ShieldCheck, Coffee,
    Users, FileText, ClipboardCheck, UserCircle, ChevronRight
} from 'lucide-react';

const NavLink = ({ to, children, active, badge }) => {
    const activeClass = active
        ? 'bg-[#008858] text-white shadow-lg shadow-[#008858]/20'
        : 'text-blue-100 hover:bg-white/10 hover:text-white';
    return (
        <Link to={to} className={`flex items-center justify-between gap-3 p-3.5 rounded-xl transition-all font-bold no-underline text-sm mb-1 ${activeClass}`}>
            {children}
            {badge > 0 && (
                <span className="text-[10px] font-black bg-red-500 text-white rounded-full px-2 py-0.5">{badge}</span>
            )}
        </Link>
    );
};

const HEADER_TITLES = {
    ADMIN: 'Administration & Pilotage',
    RESPONSABLE: 'Espace Responsable',
    CONSULTANT: 'Mon Espace Consultant',
};

const App = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [pending, setPending] = useState(null);

    const userRole = user?.role;

    // Badges « à valider » (ADMIN + RESPONSABLE), rafraîchis à chaque navigation
    const loadPending = useCallback(() => {
        if (userRole === 'ADMIN' || userRole === 'RESPONSABLE') {
            api.get('/admin/validation/pending-counts')
                .then((r) => setPending(r.data))
                .catch(() => setPending(null));
        }
    }, [userRole]);
    useEffect(() => { loadPending(); }, [loadPending, location.pathname]);

    if (!user) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    const currentUserId = user.id;
    const userInitials = ((user.prenom?.[0] || '') + (user.nom?.[0] || '')).toUpperCase() || 'U';

    const sidebarStyle = {
        width: '18rem', backgroundColor: '#003366', color: 'white',
        position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column', padding: '2rem 1.5rem',
        boxShadow: '4px 0 15px rgba(0,0,0,0.2)', overflowY: 'auto',
    };
    const mainStyle = {
        marginLeft: '18rem', flex: 1, padding: '2rem',
        backgroundColor: '#f4f7fa', minHeight: '100vh',
    };
    const sectionTitleStyle = {
        fontSize: '11px', color: '#008858', fontWeight: '900', marginLeft: '12px',
        textTransform: 'uppercase', marginTop: '24px', marginBottom: '8px',
        letterSpacing: '1.5px', opacity: 0.8,
    };

    return (
        <div className="flex min-h-screen">
            <aside style={sidebarStyle}>
                <div className="mb-8 px-2 flex flex-col items-center">
                    <div className="bg-white p-2 rounded-xl shadow-lg mb-3 w-full flex justify-center">
                        <img src={logoConsultrack} alt="ConsulTrack"
                             style={{ height: '50px', width: 'auto', objectFit: 'contain' }} />
                    </div>
                    <p style={{ fontSize: '10px', textTransform: 'uppercase', color: '#008858',
                                fontWeight: 'bold', letterSpacing: '2px', margin: 0, opacity: 0.9 }}>
                        CDG CAPITAL
                    </p>
                </div>

                <nav className="flex-1">
                    <Navigation userRole={userRole} sectionTitleStyle={sectionTitleStyle} pending={pending} />
                </nav>

                <button onClick={logout}
                        className="flex items-center gap-3 p-4 text-red-300 hover:text-red-100 hover:bg-red-500/10 rounded-xl transition-all mt-auto border-t border-white/10 font-black uppercase text-[10px] bg-transparent border-none cursor-pointer tracking-widest">
                    <LogOut size={18} /> Déconnexion
                </button>
            </aside>

            <main style={mainStyle}>
                <div className="max-w-7xl mx-auto w-full">
                    <header className="mb-8 flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#003366',
                                     textTransform: 'uppercase', margin: 0 }}>
                            {HEADER_TITLES[userRole] || 'ConsulTrack'}
                        </h2>
                        <div className="flex items-center gap-4 border-l pl-5 border-gray-200">
                            <div className="text-right">
                                <div style={{ fontWeight: '900', color: '#003366', fontSize: '14px' }}>
                                    {user.prenom} {user.nom}
                                </div>
                                <div style={{ fontSize: '10px', color: '#008858', fontWeight: 'bold',
                                              textTransform: 'uppercase' }}>{userRole}</div>
                            </div>
                            <Link to="/profil" title="Mon profil"
                                  style={{ width: '42px', height: '42px', backgroundColor: '#003366',
                                           borderRadius: '14px', display: 'flex', alignItems: 'center',
                                           justifyContent: 'center', color: '#008858', fontWeight: '900',
                                           fontSize: '14px', border: '2px solid #e5e7eb', textDecoration: 'none' }}>
                                {userInitials}
                            </Link>
                        </div>
                    </header>

                    <div className="animate-in fade-in duration-500">
                        <Routes>
                            <Route path="/login" element={<Navigate to="/" replace />} />
                            <Route path="/" element={<Dashboard userRole={userRole} userId={currentUserId} />} />
                            <Route path="/profil" element={<Profile />} />
                            <Route path="/documents" element={<Documents userRole={userRole} userId={currentUserId} />} />

                            {/* Saisie (consultant + admin délégué) */}
                            <Route element={<PrivateRoute allowedRoles={['CONSULTANT', 'ADMIN']} />}>
                                <Route path="/timesheet" element={<TimesheetForm userRole={userRole} userId={currentUserId} />} />
                                <Route path="/absences" element={<AbsenceForm userRole={userRole} userId={currentUserId} />} />
                            </Route>

                            {/* Validation + référentiel (admin + responsable) */}
                            <Route element={<PrivateRoute allowedRoles={['ADMIN', 'RESPONSABLE']} />}>
                                <Route path="/validation" element={<ValidationHub />} />
                                <Route path="/admin" element={<AdminPanel userRole={userRole} />} />
                            </Route>

                            {/* Saisie déléguée (admin uniquement) */}
                            <Route element={<PrivateRoute allowedRoles={['ADMIN']} />}>
                                <Route path="/admin/timesheet-global" element={<TimesheetForm userRole="ADMIN" />} />
                                <Route path="/admin/saisie-absence" element={<AbsenceForm userRole="ADMIN" />} />
                            </Route>

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </div>
            </main>
        </div>
    );
};

const Navigation = ({ userRole, sectionTitleStyle, pending }) => {
    const location = useLocation();
    const is = (p) => location.pathname === p;

    return (
        <>
            <div style={sectionTitleStyle}>Général</div>
            <NavLink to="/" active={is('/')}>
                <div className="flex items-center gap-3">
                    <LayoutDashboard size={18} />
                    <span>{userRole === 'ADMIN' ? 'Pilotage Global'
                        : userRole === 'RESPONSABLE' ? 'Dashboard Équipe' : 'Mon Dashboard'}</span>
                </div>
            </NavLink>

            {userRole === 'CONSULTANT' && (
                <>
                    <div style={sectionTitleStyle}>Ma Mission</div>
                    <NavLink to="/timesheet" active={is('/timesheet')}>
                        <div className="flex items-center gap-3">
                            <CalendarCheck size={18} /><span>Ma Présence (RPI)</span>
                        </div>
                        <ChevronRight size={14} className="opacity-50" />
                    </NavLink>
                    <NavLink to="/absences" active={is('/absences')}>
                        <div className="flex items-center gap-3">
                            <Coffee size={18} /><span>Mes Congés</span>
                        </div>
                    </NavLink>
                    <NavLink to="/documents" active={is('/documents')}>
                        <div className="flex items-center gap-3">
                            <FileText size={18} /><span>Mes Documents</span>
                        </div>
                    </NavLink>
                </>
            )}

            {(userRole === 'ADMIN' || userRole === 'RESPONSABLE') && (
                <>
                    <div style={sectionTitleStyle}>Validation</div>
                    <NavLink to="/validation" active={is('/validation')} badge={pending?.total}>
                        <div className="flex items-center gap-3">
                            <ClipboardCheck size={18} /><span>À Valider</span>
                        </div>
                    </NavLink>

                    <div style={sectionTitleStyle}>
                        {userRole === 'ADMIN' ? 'Administration' : 'Référentiel'}
                    </div>
                    <NavLink to="/admin" active={is('/admin')}>
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={18} />
                            <span>{userRole === 'ADMIN' ? 'Administration' : 'Cabinets & BC'}</span>
                        </div>
                    </NavLink>

                    <div style={sectionTitleStyle}>Documents</div>
                    <NavLink to="/documents" active={is('/documents')}>
                        <div className="flex items-center gap-3">
                            <FileText size={18} /><span>RPI & Rapports</span>
                        </div>
                    </NavLink>
                </>
            )}

            {userRole === 'ADMIN' && (
                <>
                    <div style={sectionTitleStyle}>Saisie Déléguée</div>
                    <NavLink to="/admin/timesheet-global" active={is('/admin/timesheet-global')}>
                        <div className="flex items-center gap-3">
                            <Users size={18} /><span>Timesheet Consultant</span>
                        </div>
                    </NavLink>
                    <NavLink to="/admin/saisie-absence" active={is('/admin/saisie-absence')}>
                        <div className="flex items-center gap-3">
                            <Coffee size={18} /><span>Saisir une Absence</span>
                        </div>
                    </NavLink>
                </>
            )}

            <div style={sectionTitleStyle}>Compte</div>
            <NavLink to="/profil" active={is('/profil')}>
                <div className="flex items-center gap-3">
                    <UserCircle size={18} /><span>Mon Profil</span>
                </div>
            </NavLink>
        </>
    );
};

export default App;
