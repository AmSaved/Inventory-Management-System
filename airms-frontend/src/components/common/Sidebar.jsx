import React, { useState, memo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
// ... (rest of the imports remain the same)
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  PlusSquare,
  History,
  Settings,
  Users,
  LogOut,
  Search,
  Building2,
  PackageCheck,
  FileText,
  Workflow,
  ShieldCheck,
  Truck,
  RotateCcw,
  ArrowLeftRight,
  Boxes,
  Compass,
  Zap,
  BarChart3,
  Fingerprint,
  Key,
  Map,
  Split,
  Layers,
  Store,
  ChevronRight,
  ShieldAlert,
  GitMerge,
  Undo2,
  Home,

} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';


// Optimized Sidebar Data Structure (Outside component to prevent re-creation)
const MAJOR_CATEGORIES = [
  {
    id: 'approval-suite',
    name: 'Requests',
    icon: <ShieldAlert size={18} />,
    items: [
      { name: 'User Requests', href: '/requests/procurement', permissions: ['request:approve'], icon: <PlusSquare size={14} /> },
      { name: 'Item Transfer Requests', href: '/requests/items', permissions: ['request:approve'], icon: <ArrowLeftRight size={14} /> },
      { name: 'Return Item Requests', href: '/requests/returns', permissions: ['return:approve'], icon: <RotateCcw size={14} /> },
      { name: 'Discharge requests', href: '/requests/discharge', permissions: ['discharge:approve'], icon: <Truck size={14} /> },
      { name: 'Inventory Transfer requests', href: '/requests/inventory', permissions: ['transfer:approve'], icon: <Search size={14} /> },
      { name: 'Return requests', href: '/requests/inventory-returns', permissions: ['stock:return:approve'], icon: <RotateCcw size={14} /> },
    ]
  },
  {
    id: 'governance-suite',
    name: 'System Governance',
    icon: <Compass size={18} />,
    items: [
      { name: 'Organization Hierarchy', href: '/dashboard?tab=structure', permissions: ['branch:read'], icon: <Map size={14} /> },
      { name: 'Merge Branches', href: '/admin/merge-branches', permissions: ['branch:create'], icon: <GitMerge size={14} /> },
      { name: 'Workflows', href: '/admin/workflows', permissions: ['workflow:manage'], icon: <Workflow size={14} /> },
      { name: 'User Management', href: '/dashboard?tab=users', permissions: ['user:manage:all'], icon: <Users size={14} /> },
      { name: 'Roles', href: '/dashboard?tab=roles', permissions: ['role:read'], icon: <ShieldCheck size={14} /> },
      { name: 'Permissions', href: '/admin/permissions', permissions: ['permission:read'], icon: <Key size={14} /> },
    ]
  },
  {
    id: 'logistics-suite',
    name: 'Operations',
    icon: <Zap size={18} />,
    items: [
      { name: 'Intake', href: '/store', permissions: ['stock:intake'], icon: <Store size={14} /> },
      { name: 'Discharge', href: '/discharge', permissions: ['stock:discharge'], icon: <PackageCheck size={14} /> },
      { name: 'Return', href: '/inventory/return', permissions: ['return:read'], icon: <RotateCcw size={14} /> },
      { name: 'Transfer', href: '/transfers', permissions: ['stock:transfer'], icon: <ArrowLeftRight size={14} /> },
      { name: 'Report Center', href: '/issues', permissions: ['issue:read'], icon: <History size={14} /> },
      { name: 'Inventories', href: '/inventory', permissions: ['inventory:view'], icon: <Package size={14} /> },
      { name: 'Form Submissions', href: '/dashboard?tab=products', permissions: ['product:read'], icon: <Boxes size={14} /> },
    ]
  },
  {
    id: 'intel-suite',
    name: 'Business Intel',
    icon: <BarChart3 size={18} />,
    items: [
      { name: 'Request Items', href: '/requests/new', permissions: ['request:create'], icon: <PlusSquare size={14} /> },
      { name: 'Reports', href: '/reports', permissions: ['report:view'], icon: <FileText size={14} /> },
    ]
  }
];


const Sidebar = ({ open }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [expandedMajors, setExpandedMajors] = useState(['approval-suite', 'governance-suite', 'logistics-suite']);

  const toggleMajor = (majorId) => {
    setExpandedMajors(prev =>
      prev.includes(majorId) ? prev.filter(id => id !== majorId) : [...prev, majorId]
    );
  };

  const checkItemPermission = (permissions) => {
    if (!permissions || permissions.length === 0) return true;
    return permissions.some(p => hasPermission(p));
  };

  return (
    <aside className={`fixed top-20 bottom-0 left-0 z-50 lg:z-30 w-64 transition-transform duration-300 ease-in-out border-r border-gray-200 bg-white ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="h-full flex flex-col relative">
        <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-6 custom-scrollbar relative z-10">
          {MAJOR_CATEGORIES.map((major) => {
            const isInstitutionalOnly = user?.role?.level >= 100;
            const operationalSuites = ['approval-suite', 'logistics-suite'];

            if (isInstitutionalOnly && operationalSuites.includes(major.id)) return null;

            const visibleItems = major.items.filter(item => checkItemPermission(item.permissions));
            if (visibleItems.length === 0) return null;

            const isMajorExpanded = expandedMajors.includes(major.id);

            return (
              <div key={major.id} className="space-y-4">
                <button
                  onClick={() => toggleMajor(major.id)}
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-2xl transition-all duration-300 group ${isMajorExpanded ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`transition-all duration-500 ${isMajorExpanded ? 'text-blue-600' : 'group-hover:text-blue-500'}`}>
                      {major.icon}
                    </div>
                    <span className="text-sm font-bold text-gray-900 text-left leading-tight">{major.name}</span>
                  </div>
                  <ChevronRight size={14} className={`transition-transform duration-500 ${isMajorExpanded ? 'rotate-90 text-blue-600' : 'text-gray-300'}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isMajorExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-1 pl-4 border-l border-white/5 ml-6"
                    >
                      {visibleItems.map((item) => (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          className={({ isActive }) => `
                            flex items-center gap-4 px-5 py-3 rounded-2xl text-sm transition-all duration-300 relative group/link
                            ${isActive
                              ? 'bg-green-600 text-white font-bold shadow-lg shadow-green-500/20'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                          `}
                        >
                          {({ isActive }) => (
                            <>
                              <div className={`transition-all duration-300 ${isActive ? 'text-white' : 'text-gray-400 group-hover/link:text-blue-600'}`}>
                                {item.icon}
                              </div>
                              <span className="text-sm font-medium">{item.name}</span>
                              {isActive && (
                                <motion.div
                                  layoutId="sidebar-active-dot"
                                  className="absolute right-4 w-1.5 h-1.5 bg-white rounded-full"
                                />
                              )}
                            </>
                          )}
                        </NavLink>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className="p-6 mt-auto border-t border-gray-100 relative z-10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-4 px-6 py-4 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-[1.5rem] transition-all duration-500 group"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default memo(Sidebar);