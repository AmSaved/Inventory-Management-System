import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import Footer from '../components/common/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';

const MainLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  // Start with sidebar closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);

  // Auto-close sidebar on mobile when navigating
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Top Navigation Bar Header - Spans full width of the screen */}
      <Header setSidebarOpen={setSidebarOpen} />
      
      <div className="flex flex-grow relative pt-20">
        {/* Mobile Overlay (Darkens background when sidebar is open) */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40 lg:hidden animate-in fade-in duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar Navigation - positioned below the header */}
        <Sidebar open={sidebarOpen} />
        
        {/* Main Content Area - positioned below the header */}
        <main className={`flex-1 transition-all duration-500 ease-in-out ${sidebarOpen ? 'lg:ml-64' : 'ml-0'} flex flex-col min-h-[calc(100vh-80px)]`}>
          <div className="p-4 lg:px-8 lg:pt-2 lg:pb-8 flex-grow">
            <Outlet />
          </div>
          
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;