import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home.jsx';
import Admin from './pages/Admin.jsx';
import Navbar from './components/Navbar.jsx';
import { useAuth } from './context/AuthContext.jsx';

function App() {
  const { user } = useAuth();
  return (
    <>
      <Navbar />
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        {user?.role === 'admin' && <Route path="/admin" element={<Admin />} />}
      </Routes>
    </>
  );
}

export default App;
