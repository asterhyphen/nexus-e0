import React, { useState, useEffect } from 'react';
import { LandingPage } from './pages/LandingPage';
import { TeamPage } from './pages/TeamPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { TeamSession } from './types';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  const [teamSession, setTeamSession] = useState<TeamSession | null>(() => {
    try {
      const stored = localStorage.getItem('nexus_team_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('nexus_admin_token') || null;
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTeamLogin = (session: TeamSession) => {
    setTeamSession(session);
    try {
      localStorage.setItem('nexus_team_session', JSON.stringify(session));
    } catch {
      // ignore
    }
    navigate('/team');
  };

  const handleTeamLogout = () => {
    setTeamSession(null);
    localStorage.removeItem('nexus_team_session');
    navigate('/');
  };

  const handleAdminLogin = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('nexus_admin_token', token);
    navigate('/admin/dashboard');
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('nexus_admin_token');
    navigate('/admin');
  };

  // Route dispatch
  const renderPage = () => {
    if (currentPath === '/team') {
      if (!teamSession) {
        return (
          <LandingPage
            onLoginSuccess={handleTeamLogin}
            onNavigateToAdmin={() => navigate('/admin')}
          />
        );
      }
      return <TeamPage session={teamSession} onLogout={handleTeamLogout} />;
    }

    if (currentPath === '/admin/dashboard') {
      if (!adminToken) {
        return (
          <AdminLoginPage
            onLoginSuccess={handleAdminLogin}
            onNavigateHome={() => navigate('/')}
          />
        );
      }
      return (
        <AdminDashboardPage
          token={adminToken}
          onLogout={handleAdminLogout}
          onNavigateHome={() => navigate('/')}
        />
      );
    }

    if (currentPath === '/admin') {
      if (adminToken) {
        return (
          <AdminDashboardPage
            token={adminToken}
            onLogout={handleAdminLogout}
            onNavigateHome={() => navigate('/')}
          />
        );
      }
      return (
        <AdminLoginPage
          onLoginSuccess={handleAdminLogin}
          onNavigateHome={() => navigate('/')}
        />
      );
    }

    // Default Landing page '/'
    return (
      <LandingPage
        onLoginSuccess={handleTeamLogin}
        onNavigateToAdmin={() => navigate('/admin')}
      />
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
      <main className="flex-1">{renderPage()}</main>
    </div>
  );
};
