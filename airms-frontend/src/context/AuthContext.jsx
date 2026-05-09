import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import authService from '../services/authService';
import toast from 'react-hot-toast';

// Create the context
export const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    const storedUser = authService.getCurrentUserFromStorage();

    if (token && storedUser) {
      setUser(storedUser);
      setIsAuthenticated(true);
      
      // Verify token with backend
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        localStorage.setItem('user', JSON.stringify(currentUser));
      } catch (error) {
        // Token invalid
        await logout();
      }
    }
    
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      const data = await authService.login(email, password);
      setUser(data.user);
      setIsAuthenticated(true);
      toast.success('Login successful!');
      return data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const user = await authService.register(userData);
      toast.success('Registration successful! Please login.');
      return user;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      throw error;
    }
  };

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      toast.success('Logged out successfully');
    }
  }, []);

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
      throw error;
    }
  };

  // ─── PERFORMANCE OPTIMIZATION: Memoize Flattened Permissions ───
  const allPermissions = useMemo(() => {
    if (!user) return [];
    
    // Safety check for complex user structures
    const legacy = user.role?.permissions?.map(p => typeof p === 'string' ? p : p.name).filter(Boolean) || [];
    const manyToMany = user.roles?.flatMap(r => r.permissions?.map(p => typeof p === 'string' ? p : p.name).filter(Boolean) || []) || [];
    const direct = user.permissions?.map(p => typeof p === 'string' ? p : p.name).filter(Boolean) || [];
    
    return [...new Set([...legacy, ...manyToMany, ...direct])];
  }, [user]);

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    
    // Absolute Bypass (God Mode)
    // Only Level 100 Super Admins or 'system:manage' holders have full access
    const isSuperAdmin = user.role?.level >= 100;
    if (isSuperAdmin || allPermissions.includes('system:manage')) return true;
    
    // Match the backend's hierarchical intent matching
    return allPermissions.some(p => 
      p === permission || 
      p.startsWith(`${permission}-`) || 
      p.startsWith(`${permission}:`)
    );
  }, [user, allPermissions]);

  const hasRole = useCallback((roleIdOrName) => {
    if (!user) return false;
    const search = roleIdOrName?.toString().toLowerCase().replace(/\s+/g, '_');
    
    const primaryMatch = user.role?.id === roleIdOrName || 
                         user.role?.name?.toLowerCase().replace(/\s+/g, '_') === search;
    
    if (primaryMatch) return true;

    return user.roles?.some(r => 
      r.id === roleIdOrName || 
      r.name?.toLowerCase().replace(/\s+/g, '_') === search
    ) || false;
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    changePassword,
    hasPermission,
    hasRole,
    company_id: user?.company_id,
    org_node_id: user?.org_node_id,
    company: user?.company,
    organizationNode: user?.organizationNode
  }), [user, loading, isAuthenticated, hasPermission, hasRole, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};