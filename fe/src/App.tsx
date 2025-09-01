import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/Auth/AuthPage';

import { ChatApp } from './components/Chat/ChatApp';

const AppContent: React.FC = () => {
  const { user, loading, login, register, error } = useAuth();

  const handleLoginSubmit = async (email: string, password: string) => {
    await login(email, password);
  };

  const handleRegisterSubmit = async (email: string, password: string, username: string) => {
    await register(email, password, username);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center  pixel-font">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center">
                <img src="../CatWith_white.png" alt="WinterX Logo" />
              </div>
          <div className="pixel-loading w-4 h-4 bg-white mx-auto mb-4">
          </div>
          <p className="text-white text-sm pixel-shadow">WinterX</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pixel-font pixelated">
      <Routes>
        <Route path="/login" element={!user ? <AuthLayout onLoginSubmit={handleLoginSubmit} onRegisterSubmit={handleRegisterSubmit} loading={loading} error={error} /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <AuthLayout onLoginSubmit={handleLoginSubmit} onRegisterSubmit={handleRegisterSubmit} loading={loading} error={error} /> : <Navigate to="/" />} />
        <Route path="/" element={user ? <ChatApp /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <div className="pixel-font pixelated" style={{ 
      fontFamily: '"Roboto Mono", monospace',
      imageRendering: 'pixelated'
    }}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </div>
  );
};

export default App;