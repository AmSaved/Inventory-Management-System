import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Search, Bell, Home } from 'lucide-react';
import requestService from '../../services/requestService';
import inventoryService from '../../services/inventoryService';

const Header = ({ setSidebarOpen }) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [loadingNotifications, setLoadingNotifications] = React.useState(false);

  // Global search state variables
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [showSearchResults, setShowSearchResults] = React.useState(false);

  // Local navigation pages for fast quick-jump
  const navigationRoutes = React.useMemo(() => [
    { name: 'Dashboard Home', path: '/dashboard', keywords: 'home stats cards indicators insa main' },
    { name: 'Inventory Ledger', path: '/inventory', keywords: 'stock items products warehouse assets list' },
    { name: 'Item Intake Manager', path: '/inventory/manage', keywords: 'intake add bulk register import item upload new' },
    { name: 'My Custody Assets', path: '/assets', keywords: 'custody assignments mine personal equipment gear' },
    { name: 'Transfers & Handover', path: '/transfers', keywords: 'transfer move assign target request swap' },
    { name: 'Discharges & Releases', path: '/discharge', keywords: 'discharge distribution release hand-out issue' },
    { name: 'Returns & Decommission', path: '/returns', keywords: 'return restore store decommission return status' },
    { name: 'Incident Compliance Issues', path: '/issues', keywords: 'issues incident damage report alert problem warning' },
    { name: 'Reports & Analytics', path: '/reports', keywords: 'reports stats telemetry insights graphs logs charts' },
    { name: 'Personnel Registry (Users)', path: '/admin/users', keywords: 'users employees accounts register staff database' },
    { name: 'Governance Roles', path: '/admin/roles', keywords: 'roles permissions security matrix groups level' },
    { name: 'Workflows & Approval Stages', path: '/admin/workflows', keywords: 'workflows steps paths approvals engine dynamic sequential' }
  ], []);

  // Filter local navigation dynamically
  const matchingNavs = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return navigationRoutes.filter(route => 
      route.name.toLowerCase().includes(query) || 
      route.keywords.toLowerCase().includes(query)
    ).slice(0, 4);
  }, [searchQuery, navigationRoutes]);

  // Debounced API call for inventory search
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await inventoryService.getAllInventory({ 
          search: searchQuery,
          limit: 5
        });
        const items = response?.data?.data || response?.data || response || [];
        setSearchResults(Array.isArray(items) ? items.slice(0, 5) : []);
      } catch (err) {
        console.error('Failed to search inventory:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchNotifications = React.useCallback(async () => {
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const list = [];
      
      // 1. Fetch pending approvals if they have permission to approve
      if (hasPermission && hasPermission('request:approve')) {
        try {
          const approvals = await requestService.getPendingApprovals();
          if (Array.isArray(approvals)) {
            approvals.forEach(req => {
              list.push({
                id: `approve-${req.id}`,
                type: 'approval',
                title: 'Pending Approval',
                description: `${req.requester?.first_name || 'User'} requested ${req.request_type}`,
                time: new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                link: '/dashboard',
                raw: req
              });
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      // 2. Fetch approved requests that need receipt acknowledgment
      try {
        const myRequestsRes = await requestService.getAllRequests({ 
          status: 'pending_acknowledgment',
          user_id: user.id
        });
        const myRequests = myRequestsRes?.data || myRequestsRes || [];
        if (Array.isArray(myRequests)) {
          myRequests.forEach(req => {
            list.push({
              id: `fulfill-${req.id}`,
              type: 'fulfillment',
              title: 'Action Required',
              description: `Request ${req.request_number} is awaiting receipt. Click to acknowledge.`,
              time: new Date(req.updated_at || req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              link: '/dashboard',
              raw: req
            });
          });
        }
      } catch (e) {
        console.error(e);
      }
      
      setNotifications(list);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [user, hasPermission]);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          
          {/* LEFT SIDE: Brand Title & Logo (Matching image) */}
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 lg:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <Link to="/dashboard" className="flex-shrink-0 flex items-center ml-2 lg:ml-0 gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-105">
                <Home size={22} className="stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm md:text-base font-extrabold uppercase tracking-wider text-emerald-700 leading-tight">
                  {user?.organizationNode?.name || user?.company?.name || "INSA"}
                </span>
                <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                  Inventory System
                </span>
              </div>
            </Link>
          </div>

          {/* CENTER SEARCH: Centered Global Intelligent Search with dropdown */}
          <div className="flex items-center justify-center flex-1 px-8 relative z-50">
            <div className="w-full max-w-md relative">
              <label htmlFor="search" className="sr-only">Search</label>
              <div className="relative text-slate-400 focus-within:text-emerald-600">
                <input
                  id="search"
                  className="block w-full bg-slate-50/50 border border-slate-200 rounded-xl py-2 pl-4 pr-10 text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all"
                  placeholder="Type to search assets, serials, SKUs or pages..."
                  type="search"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Search size={14} className="text-slate-400 transition-colors" />
                </div>
              </div>

              {/* Search Results Dropdown */}
              {showSearchResults && searchQuery.trim() && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
                  <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-3 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200 z-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                    
                    {/* Navigation Results */}
                    {matchingNavs.length > 0 && (
                      <div className="pb-2">
                        <div className="px-4 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          📁 System Pages
                        </div>
                        <div className="mt-1 space-y-1">
                          {matchingNavs.map(nav => (
                            <button
                              key={nav.path}
                              onClick={() => {
                                navigate(nav.path);
                                setSearchQuery('');
                                setShowSearchResults(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                            >
                              <span>{nav.name}</span>
                              <span className="text-[9px] font-medium text-slate-400">Navigate ➔</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inventory Items Results */}
                    <div className="pt-2">
                      <div className="px-4 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                        <span>📦 Inventory Items</span>
                        {searching && <span className="animate-pulse text-emerald-600">Searching...</span>}
                      </div>
                      <div className="mt-1 space-y-1">
                        {searchResults.length > 0 ? (
                          searchResults.map(item => (
                            <button
                              key={item.id}
                              onClick={() => {
                                navigate(`/inventory/${item.id}`);
                                setSearchQuery('');
                                setShowSearchResults(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs flex flex-col gap-0.5"
                            >
                              <div className="font-bold text-slate-800 uppercase tracking-tight flex items-center justify-between">
                                <span>{item.product?.name || 'Asset'}</span>
                                <span className="text-[9px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase">
                                  {item.condition || 'New'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex justify-between font-medium">
                                <span>SN: {item.serial_number || 'N/A'}</span>
                                <span>SKU: {item.product?.sku || 'N/A'}</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          !searching && (
                            <div className="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                              No matching assets found
                            </div>
                          )
                        )}
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Notifications & Avatar profile stacked layout (Matching image) */}
          <div className="flex items-center space-x-4">
            
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    fetchNotifications();
                  }
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl relative transition-all duration-200"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-rose-500 rounded-full ring-2 ring-white text-[9px] font-black text-white flex items-center justify-center animate-bounce">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-45" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl py-2 ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Notifications</span>
                      <button 
                        onClick={fetchNotifications}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                      {loadingNotifications ? (
                        <div className="px-4 py-6 text-center text-xs font-semibold text-slate-400">
                          Loading...
                        </div>
                      ) : notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => {
                              setShowNotifications(false);
                              navigate(notif.link);
                            }}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                notif.type === 'approval' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {notif.title}
                              </span>
                              <span className="text-[9px] font-medium text-slate-400">{notif.time}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-600 mt-1">{notif.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                          All caught up! No new notifications.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 focus:outline-none p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-200"
              >
                {/* Username and Role Stacked to the left of Avatar */}
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm md:text-base font-bold text-emerald-700 leading-tight">
                    {user?.first_name} {user?.last_name}
                  </span>
                  <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                    {user?.role?.name?.replace(/_/g, ' ') || "USER"}
                  </span>
                </div>
                
                {/* Avatar with dynamic initials */}
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-500/20 flex items-center justify-center text-emerald-700 font-black text-xs shadow-sm shrink-0">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
                
                <svg className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Dropdown Options menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl py-2 ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Signed in as</p>
                    <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/profile"
                      className="group flex items-center px-4 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <svg className="mr-3 h-4 w-4 text-slate-400 group-hover:text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Your Profile
                    </Link>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="group flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                      <svg className="mr-3 h-4 w-4 text-red-400 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-6 0v-1m6 0H9" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;