import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';

import Dashboard from './components/Dashboard';
import TimesheetForm from './components/TimesheetForm';
import AdminPanel from './components/AdminPanel';
import AbsenceForm from './components/AbsenceForm';
import Documents from './components/Documents';
import ValidationHub from './components/ValidationHub';
import Facturation from './components/Facturation';
import Profile from './components/Profile';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';
import api from './api/axiosConfig';

import logoConsultrack from './assets/logo_consultrack.png';

import {
    LayoutDashboard, CalendarCheck, LogOut, Coffee,
    Users, FileText, ClipboardCheck, UserCircle, ChevronRight, Receipt,
    Menu, X, WalletCards, Building2, UserRoundCog, Settings2,
} from 'lucide-react';

const NavLink = ({ to, children, active, badge, onNavigate }) => {
    const activeClass = active
        ? 'bg-[#008858] text-white shadow-lg shadow-[#008858]/20'
        : 'text-blue-100 hover:bg-white/10 hover:text-white';
    return (
        <Link to={to} onClick={onNavigate} aria-current={active ? 'page' : undefined}
              className={`flex items-center justify-between gap-3 rounded-xl p-3 transition-all font-bold no-underline text-sm mb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${activeClass}`}>
            {children}
            {badge > 0 && (
                <span className="text-[10px] font-black bg-red-500 text-white rounded-full px-2 py-0.5">{badge}</span>
            )}
        </Link>
    );
};

const ROLE_LABELS = { ADMIN: 'Superadmin', RESPONSABLE: 'Manager', CONSULTANT: 'Consultant' };
const HEADER_TITLES = {
    ADMIN: 'Administration & Pilotage',
    RESPONSABLE: 'Espace Manager',
    CONSULTANT: 'Mon espace Consultant',
};

const App = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [pending, setPending] = useState(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

    const sectionTitleStyle = { fontSize: '10px', color: '#9db6cc', fontWeight: '900', marginLeft: '12px', textTransform: 'uppercase', marginTop: '22px', marginBottom: '7px', letterSpacing: '1.2px' };

    return (
        <div className="flex min-h-screen">
            {mobileNavOpen && <button aria-label="Fermer le menu" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
            <aside id="primary-navigation" className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto p-5 pt-12 text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 lg:pt-5 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundColor: '#003366' }}>
                <button aria-label="Fermer le menu" onClick={() => setMobileNavOpen(false)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-white/75 hover:bg-white/10 lg:hidden"><X size={19} /></button>
                <div className="mb-6 px-1 flex flex-col items-center">
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
                    <Navigation userRole={userRole} sectionTitleStyle={sectionTitleStyle} pending={pending}
                        onNavigate={() => setMobileNavOpen(false)} />
                </nav>

                <button onClick={logout}
                        className="flex items-center gap-3 p-4 text-red-300 hover:text-red-100 hover:bg-red-500/10 rounded-xl transition-all mt-auto border-t border-white/10 font-black uppercase text-[10px] bg-transparent border-none cursor-pointer tracking-widest">
                    <LogOut size={18} /> Déconnexion
                </button>
            </aside>

            <main className="min-w-0 flex-1 bg-[#f4f7fa] p-4 sm:p-6 lg:ml-72 lg:p-8">
                <div className="mx-auto w-full max-w-7xl">
                    <header className="mb-5 flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:mb-7 sm:p-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <button aria-label="Ouvrir le menu" aria-expanded={mobileNavOpen} aria-controls="primary-navigation" onClick={() => setMobileNavOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#003366] hover:bg-slate-100 lg:hidden"><Menu size={21} /></button>
                            <div className="min-w-0"><div className="hidden text-[10px] font-black uppercase tracking-[.16em] text-[#008858] sm:block">ConsulTrack · {ROLE_LABELS[userRole] || 'Espace'}</div>
                                <h2 className="truncate text-base font-black uppercase text-[#003366] sm:text-lg">{HEADER_TITLES[userRole] || 'ConsulTrack'}</h2></div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 border-l border-gray-200 pl-3 sm:gap-3 sm:pl-4">
                            <div className="text-right">
                                <div className="max-w-[130px] truncate text-xs font-black text-[#003366] sm:max-w-none sm:text-sm">
                                    {user.prenom} {user.nom}
                                </div>
                                <div className="text-[9px] font-bold uppercase text-[#008858]">{ROLE_LABELS[userRole] || userRole}</div>
                            </div>
                            <Link to="/profil" title="Mon profil"
                                  className="grid h-10 w-10 place-items-center rounded-[14px] border-2 border-gray-200 bg-[#003366] text-sm font-black text-[#008858] no-underline"
                                  >
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

                            {/* Validation + référentiel + saisie déléguée (admin + responsable) */}
                            <Route element={<PrivateRoute allowedRoles={['ADMIN', 'RESPONSABLE']} />}>
                                <Route path="/validation" element={<ValidationHub />} />
                                <Route path="/facturation" element={<Facturation />} />
                                <Route path="/admin" element={<AdminPanel userRole={userRole} />} />
                                <Route path="/admin/timesheet-global" element={<TimesheetForm userRole={userRole} />} />
                                <Route path="/admin/saisie-absence" element={<AbsenceForm userRole={userRole} />} />
                            </Route>

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </div>
            </main>
        </div>
    );
};

const Navigation = ({ userRole, sectionTitleStyle, pending, onNavigate }) => {
    const location = useLocation();
    const is = (p) => location.pathname === p;
    const tab = new URLSearchParams(location.search).get('tab') || 'cabinets';
    const adminTab = (key) => location.pathname === '/admin' && tab === key;
    const dashboardLabel = userRole === 'ADMIN' ? 'Vue d’ensemble' : userRole === 'RESPONSABLE' ? 'Mon équipe' : 'Mon tableau de bord';

    return (
        <>
            <div style={sectionTitleStyle}>{userRole === 'CONSULTANT' ? 'Mon espace' : 'Pilotage'}</div>
            <NavLink to="/" active={is('/')} onNavigate={onNavigate}>
                <div className="flex items-center gap-3">
                    <LayoutDashboard size={18} />
                    <span>{dashboardLabel}</span>
                </div>
            </NavLink>

            {userRole === 'CONSULTANT' && (
                <>
                    <div style={sectionTitleStyle}>Ma mission</div>
                    <NavLink to="/timesheet" active={is('/timesheet')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3">
                            <CalendarCheck size={18} /><span>Ma Présence (RPI)</span>
                        </div>
                        <ChevronRight size={14} className="opacity-50" />
                    </NavLink>
                    <NavLink to="/absences" active={is('/absences')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3">
                            <Coffee size={18} /><span>Mes Congés</span>
                        </div>
                    </NavLink>
                    <NavLink to="/documents" active={is('/documents')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3">
                            <FileText size={18} /><span>Mes Documents</span>
                        </div>
                    </NavLink>
                </>
            )}

            {(userRole === 'ADMIN' || userRole === 'RESPONSABLE') && (
                <>
                    <div style={sectionTitleStyle}>Activité</div>
                    <NavLink to="/validation" active={is('/validation')} badge={pending?.total} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3">
                            <ClipboardCheck size={18} /><span>À Valider</span>
                        </div>
                    </NavLink>
                    <NavLink to="/facturation" active={is('/facturation')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3">
                            <Receipt size={18} /><span>Facturation</span>
                        </div>
                    </NavLink>

                    <NavLink to="/documents" active={is('/documents')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3"><FileText size={18} /><span>RPI et rapports</span></div>
                    </NavLink>

                    <div style={sectionTitleStyle}>Administration</div>
                    <NavLink to="/admin?tab=budgets" active={adminTab('budgets')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3"><WalletCards size={18} /><span>Budgets & DA</span></div>
                    </NavLink>
                    <NavLink to="/admin?tab=users" active={adminTab('users')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3"><UserRoundCog size={18} /><span>Consultants & utilisateurs</span></div>
                    </NavLink>
                    <NavLink to="/admin?tab=cabinets" active={adminTab('cabinets')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3"><Building2 size={18} /><span>Cabinets fournisseurs</span></div>
                    </NavLink>
                    <NavLink to="/admin?tab=bcs" active={adminTab('bcs')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3"><Receipt size={18} /><span>Bons de commande</span></div>
                    </NavLink>
                    {userRole === 'ADMIN' && <>
                        <NavLink to="/admin?tab=directions" active={adminTab('directions')} onNavigate={onNavigate}>
                            <div className="flex items-center gap-3"><Users size={18} /><span>Directions</span></div>
                        </NavLink>
                        <NavLink to="/admin?tab=feries" active={adminTab('feries')} onNavigate={onNavigate}>
                            <div className="flex items-center gap-3"><Settings2 size={18} /><span>Jours fériés</span></div>
                        </NavLink>
                    </>}
                </>
            )}

            {(userRole === 'ADMIN' || userRole === 'RESPONSABLE') && (
                <>
                    <div style={sectionTitleStyle}>Saisie d’équipe</div>
                    <NavLink to="/admin/timesheet-global" active={is('/admin/timesheet-global')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3">
                            <Users size={18} /><span>Timesheet Consultant</span>
                        </div>
                    </NavLink>
                    <NavLink to="/admin/saisie-absence" active={is('/admin/saisie-absence')} onNavigate={onNavigate}>
                        <div className="flex items-center gap-3">
                            <Coffee size={18} /><span>Saisir une Absence</span>
                        </div>
                    </NavLink>
                </>
            )}

            <div style={sectionTitleStyle}>Compte</div>
            <NavLink to="/profil" active={is('/profil')} onNavigate={onNavigate}>
                <div className="flex items-center gap-3">
                    <UserCircle size={18} /><span>Mon Profil</span>
                </div>
            </NavLink>
        </>
    );
};

export default App;
