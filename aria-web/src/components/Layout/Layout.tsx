import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  ChevronDown,
  Search,
  Sparkles,
  UserCircle,
  PlusCircle,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Tableau de bord', path: '/doctor/dashboard' },
  { icon: Users, label: 'Patients', path: '/doctor/patients' },
  { icon: Activity, label: 'Analyses', path: '/doctor/analyses', badge: 3 },
  { icon: FileText, label: 'Rapports', path: '/doctor/reports' },
  { icon: Settings, label: 'Paramètres', path: '/doctor/settings' },
];

const sidebarVariants = {
  open: {
    width: 280,
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
  closed: {
    width: 80,
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  }
};

const navItemVariants = {
  open: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  closed: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const notifications = [
    { id: 1, title: 'Analyse terminée', message: 'Jean Dupont - Résultats disponibles', time: '5 min', type: 'success' },
    { id: 2, title: 'Urgence', message: 'Marie Kamga - Pneumonie détectée', time: '15 min', type: 'danger' },
    { id: 3, title: 'Nouveau patient', message: 'Pierre Nkam a été ajouté', time: '1h', type: 'info' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const displayName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.email || 'Utilisateur';

  const initials = user?.first_name && user?.last_name
    ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`
    : 'U';

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="flex min-h-screen">
        
        {/* ===== SIDEBAR ===== */}
        <motion.aside
          initial={false}
          animate={sidebarOpen ? 'open' : 'closed'}
          variants={sidebarVariants}
          className="fixed left-0 top-0 h-full z-50 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 shadow-2xl overflow-hidden border-r border-gray-700/50"
        >
          <div className="relative h-full flex flex-col">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            {/* Logo */}
            <div className="relative px-4 py-5 flex items-center justify-between border-b border-gray-700/50">
              <motion.div
                animate={{ opacity: sidebarOpen ? 1 : 0 }}
                className="flex items-center gap-3 overflow-hidden"
              >
                <motion.div
                  whileHover={{ rotate: 180 }}
                  transition={{ duration: 0.6 }}
                  className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/25"
                >
                  <Sparkles className="w-6 h-6 text-white" />
                </motion.div>
                <motion.span
                  initial={false}
                  animate={{ opacity: sidebarOpen ? 1 : 0 }}
                  className="text-xl font-bold text-white tracking-tight"
                >
                  ARIA
                </motion.span>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl hover:bg-white/5 transition-colors relative"
              >
                {sidebarOpen ? (
                  <X size={18} className="text-gray-400" />
                ) : (
                  <Menu size={18} className="text-gray-400" />
                )}
              </motion.button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto relative z-10">
              <LayoutGroup>
                {navItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <motion.button
                      key={item.path}
                      layout
                      whileHover={{ x: sidebarOpen ? 6 : 0, scale: sidebarOpen ? 1.02 : 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate(item.path)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-2xl
                        transition-all duration-300 relative group
                        ${active 
                          ? 'bg-primary-500/20 text-white shadow-lg shadow-primary-500/10' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      {active && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute inset-0 bg-primary-500/20 rounded-2xl"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                      
                      <item.icon size={20} className="relative z-10" />

                      <motion.span
                        variants={navItemVariants}
                        initial={false}
                        animate={sidebarOpen ? 'open' : 'closed'}
                        className="text-sm font-medium relative z-10 whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>

                      {item.badge && sidebarOpen && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full relative z-10"
                        >
                          {item.badge}
                        </motion.span>
                      )}

                      {active && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-3 w-1 h-8 bg-primary-400 rounded-full shadow-lg shadow-primary-500/25 z-10"
                        />
                      )}

                      {!sidebarOpen && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 0, x: 10 }}
                          whileHover={{ opacity: 1, x: 0 }}
                          className="absolute left-full ml-4 px-3 py-2 bg-gray-800 text-white text-sm rounded-xl shadow-xl whitespace-nowrap z-50 pointer-events-none border border-gray-700"
                        >
                          {item.label}
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </LayoutGroup>
            </nav>

            {/* Bas du sidebar */}
            <div className="relative px-3 py-4 border-t border-gray-700/50">
              <motion.button
                whileHover={{ scale: sidebarOpen ? 1.02 : 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setProfileOpen(!profileOpen)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl
                  hover:bg-white/5 transition-all duration-300
                  ${sidebarOpen ? '' : 'justify-center'}
                `}
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-500/25">
                    {initials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-gray-800" />
                </div>

                {sidebarOpen && (
                  <motion.div
                    initial={false}
                    animate={{ opacity: sidebarOpen ? 1 : 0 }}
                    className="flex-1 text-left overflow-hidden"
                  >
                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate capitalize">{user?.role || 'Utilisateur'}</p>
                  </motion.div>
                )}

                {sidebarOpen && (
                  <motion.div animate={{ rotate: profileOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown size={16} className="text-gray-500" />
                  </motion.div>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: sidebarOpen ? 1.02 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className={`
                  w-full flex items-center gap-3 mt-2 px-3 py-2.5 rounded-2xl
                  text-gray-500 hover:text-red-400 hover:bg-red-500/10
                  transition-all duration-300
                  ${sidebarOpen ? '' : 'justify-center'}
                `}
              >
                <LogOut size={20} />
                {sidebarOpen && (
                  <motion.span
                    initial={false}
                    animate={{ opacity: sidebarOpen ? 1 : 0 }}
                    className="text-sm font-medium"
                  >
                    Déconnexion
                  </motion.span>
                )}
              </motion.button>
            </div>
          </div>
        </motion.aside>

        {/* ===== CONTENU PRINCIPAL ===== */}
        <div className={`flex-1 ${sidebarOpen ? 'ml-[280px]' : 'ml-20'} transition-all duration-500`}>
          
          {/* Header */}
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="sticky top-0 z-40 bg-gray-800/90 backdrop-blur-xl border-b border-gray-700/50"
          >
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <motion.h1
                  key={location.pathname}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent"
                >
                  {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                </motion.h1>
              </div>

              <div className="flex items-center gap-2">
                {/* Nouvelle analyse */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/doctor/patients')}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all duration-300"
                >
                  <PlusCircle size={18} />
                  Nouvelle analyse
                </motion.button>

                {/* Recherche */}
                <motion.div
                  animate={{ width: searchOpen ? 240 : 40 }}
                  transition={{ duration: 0.3 }}
                  className="relative"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSearchOpen(!searchOpen)}
                    className="w-10 h-10 rounded-xl bg-gray-700/50 flex items-center justify-center hover:bg-gray-700 transition-colors"
                  >
                    <Search size={18} className="text-gray-400" />
                  </motion.button>
                  
                  <AnimatePresence>
                    {searchOpen && (
                      <motion.input
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 200 }}
                        exit={{ opacity: 0, width: 0 }}
                        type="text"
                        placeholder="Rechercher..."
                        className="absolute right-12 top-1/2 -translate-y-1/2 px-4 py-2 bg-gray-700 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        autoFocus
                      />
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Notifications */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className="w-10 h-10 rounded-xl bg-gray-700/50 flex items-center justify-center hover:bg-gray-700 transition-colors relative"
                  >
                    <Bell size={18} className="text-gray-400" />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  </motion.button>

                  <AnimatePresence>
                    {notificationsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden z-50"
                      >
                        <div className="p-4 border-b border-gray-700/50">
                          <span className="font-semibold text-white">Notifications</span>
                          <span className="text-xs text-gray-400 ml-2">3 nouvelles</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {notifications.map((notif) => (
                            <motion.div
                              key={notif.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`px-4 py-3 hover:bg-gray-700/50 cursor-pointer transition-colors border-b border-gray-700/50 last:border-0 ${
                                notif.type === 'danger' ? 'bg-red-900/20' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 mt-2 rounded-full ${
                                  notif.type === 'danger' ? 'bg-red-500' :
                                  notif.type === 'success' ? 'bg-green-500' :
                                  'bg-blue-500'
                                }`} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">{notif.title}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{notif.message}</p>
                                  <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        <div className="p-3 text-center border-t border-gray-700/50">
                          <button className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
                            Voir toutes les notifications
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Profil */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-500/25">
                      {initials}
                    </div>
                    <div className="hidden lg:block text-left">
                      <p className="text-sm font-medium text-white leading-tight">{displayName}</p>
                      <p className="text-xs text-gray-400 capitalize">{user?.role || 'Utilisateur'}</p>
                    </div>
                    <ChevronDown size={16} className="text-gray-500 hidden lg:block" />
                  </motion.button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden z-50"
                      >
                        <div className="px-4 py-4 border-b border-gray-700/50">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/25">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{displayName}</p>
                              <p className="text-sm text-gray-400">{user?.email}</p>
                            </div>
                          </div>
                        </div>

                        <div className="py-2">
                          <motion.button
                            whileHover={{ x: 4 }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-gray-700/50 transition-colors"
                          >
                            <UserCircle size={16} />
                            <span>Mon profil</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ x: 4 }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-gray-700/50 transition-colors"
                          >
                            <Settings size={16} />
                            <span>Paramètres</span>
                          </motion.button>
                        </div>

                        <div className="border-t border-gray-700/50 py-2">
                          <motion.button
                            whileHover={{ x: 4 }}
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-900/20 transition-colors"
                          >
                            <LogOut size={16} />
                            <span>Déconnexion</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.header>

          {/* Contenu */}
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 lg:p-8"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
};