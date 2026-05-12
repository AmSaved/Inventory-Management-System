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

  const majorCategories = [
    {
      id: 'approval-suite',
      name: 'Requests',
      icon: <ShieldAlert size={18} />,
      items: [
        { name: 'Procurement Requests', href: '/requests/procurement', permissions: ['request:approve'], icon: <PlusSquare size={14} /> },
        { name: 'Item Transfer Requests', href: '/requests/items', permissions: ['request:approve'], icon: <ArrowLeftRight size={14} /> },
        { name: 'Return Item Requests', href: '/requests/returns', permissions: ['return:approve'], icon: <RotateCcw size={14} /> },
        { name: 'Discharge Authorizations', href: '/requests/discharge', permissions: ['discharge:approve'], icon: <Truck size={14} /> },
        { name: 'Inventory Transfers', href: '/requests/inventory', permissions: ['transfer:approve'], icon: <Search size={14} /> },
        { name: 'Inventory Returns', href: '/requests/inventory-returns', permissions: ['stock:return:approve'], icon: <RotateCcw size={14} /> },
      ]
    },
    {
      id: 'governance-suite',
      name: 'System Governance',
      icon: <Compass size={18} />,
      items: [
        { name: 'Organization Hierarchy', href: '/dashboard?tab=structure', permissions: ['branch:read'], icon: <Map size={14} /> },
        { name: 'Consolidate Branches', href: '/admin/merge-branches', permissions: ['branch:create'], icon: <GitMerge size={14} /> },
        { name: 'Process Designer', href: '/admin/workflows', permissions: ['workflow:manage'], icon: <Workflow size={14} /> },
        { name: 'User Management', href: '/dashboard?tab=users', permissions: ['user:read'], icon: <Users size={14} /> },
        { name: 'Roles & Safety', href: '/dashboard?tab=roles', permissions: ['role:read'], icon: <ShieldCheck size={14} /> },
        { name: 'Permissions Matrix', href: '/admin/permissions', permissions: ['permission:read'], icon: <Key size={14} /> },
      ]
    },
    {
      id: 'logistics-suite',
      name: 'Operational Logistics',
      icon: <Zap size={18} />,
      items: [
        { name: 'Stock Intake (Store)', href: '/store', permissions: ['stock:intake'], icon: <Store size={14} /> },
        { name: 'Discharge & Issuing', href: '/discharge', permissions: ['stock:discharge'], icon: <PackageCheck size={14} /> },
        { name: 'Return Logistics', href: '/inventory/return', permissions: ['return:read'], icon: <RotateCcw size={14} /> },
        { name: 'Transfer Logistics', href: '/transfers', permissions: ['stock:transfer'], icon: <ArrowLeftRight size={14} /> },
        { name: 'Exception Reports', href: '/issues', permissions: ['issue:read'], icon: <History size={14} /> },
        { name: 'Inventory Ledger', href: '/inventory', permissions: ['inventory:view'], icon: <Package size={14} /> },
        { name: 'Product Catalog', href: '/dashboard?tab=products', permissions: ['product:read'], icon: <Boxes size={14} /> },
      ]
    },
    {
      id: 'intel-suite',
      name: 'Business Intel',
      icon: <BarChart3 size={18} />,
      items: [
        { name: 'My Assets', href: '/assets', permissions: ['assignment:view'], icon: <Package size={14} /> },
        { name: 'Request Items', href: '/requests/new', permissions: ['request:create'], icon: <PlusSquare size={14} /> },
        { name: 'Reports', href: '/reports', permissions: ['report:view'], icon: <FileText size={14} /> },
      ]
    }
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out border-r border-gray-200 bg-white ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="h-full flex flex-col relative">
        {/* BRANDING HEADER */}
        <div className="p-8 border-b border-gray-100 relative z-10">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all group"
              title="Personal Dashboard"
            >
              <Home size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
              <div className="w-1 h-1 rounded-full bg-gray-200"></div>
              <div className="w-1 h-1 rounded-full bg-gray-200"></div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-4 group/brand"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-2 group-hover/brand:rotate-0 transition-all duration-500">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <div>
              <span className="text-xl font-bold text-gray-900 block leading-none">
                {user?.organization_node?.name || 'AIRMS'}
              </span>
              <span className="text-xs font-medium text-blue-600 mt-1 block opacity-90">
                Institutional Core
              </span>
            </div>
          </button>
        </div>


        <nav className="flex-1 px-4 py-8 overflow-y-auto space-y-8 custom-scrollbar relative z-10">


          {majorCategories.map((major) => {
            // INSTITUTIONAL FIREWALL: Super Admins (Level 100) only see Governance and Intel suites.
            // They are isolated from operational logistics and approval workflows.
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
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-2xl transition-all duration-300 group ${isMajorExpanded ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`transition-all duration-500 ${isMajorExpanded ? 'text-blue-600' : 'group-hover:text-blue-500'}`}>
                      {major.icon}
                    </div>
                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest text-left leading-tight">{major.name}</span>
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
                      {visibleItems.map((item) => {
                        const active = location.pathname === item.href;
                        return (
                          <NavLink
                            key={item.name}
                            to={item.href}
                            className={`
                                            flex items-center gap-4 px-5 py-3 rounded-2xl text-sm transition-all duration-300 relative group/link
                                            ${active
                                ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-500/20'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                                          `}
                          >
                            <div className={`transition-all duration-300 ${active ? 'text-white' : 'text-gray-400 group-hover/link:text-blue-600'}`}>
                              {item.icon}
                            </div>
                             <span className="text-sm font-bold">{item.name}</span>
                            {active && (
                              <div className="absolute right-4 w-1.5 h-1.5 bg-white rounded-full" />
                            )}
                          </NavLink>
                        );
                      })}
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