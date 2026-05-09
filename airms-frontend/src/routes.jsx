// This file is not needed if using App.jsx directly
// But kept for potential future use
export const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    component: 'DashboardPage',
    roles: ['super_admin', 'chairman', 'storage_manager', 'cluster_manager', 'user'],
  },
  {
    path: '/inventory',
    component: 'InventoryPage',
    roles: ['super_admin', 'storage_manager'],
  },
  {
    path: '/requests',
    component: 'RequestsPage',
    roles: ['super_admin', 'chairman', 'storage_manager', 'cluster_manager', 'user'],
  },
  {
    path: '/assets',
    component: 'AssetsPage',
    roles: ['super_admin', 'storage_manager', 'cluster_manager', 'user'],
  },
  {
    path: '/reports',
    component: 'ReportsPage',
    roles: ['super_admin', 'chairman', 'storage_manager', 'cluster_manager'],
  },
  {
    path: '/admin',
    component: 'AdminPage',
    roles: ['super_admin'],
  },
  {
    path: '/profile',
    component: 'ProfilePage',
    roles: ['super_admin', 'chairman', 'storage_manager', 'cluster_manager', 'user'],
  },
];