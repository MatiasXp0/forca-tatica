import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { getDoc, doc, setDoc } from 'firebase/firestore';

import './styles/fardamentos.css';
import ComunicadoDetalhe from './pages/ComunicadoDetalhe';

// Componentes
import Layout from './components/Layout';
import { Login } from './components/Login';
import Comunicados from './components/Comunicados';
import Fardamentos from './components/Fardamentos';
import Viaturas from './components/Viaturas';
import Hierarquia from './components/Hierarquia';

// 🔴 COMPONENTE DE MIGRAÇÃO - REMOVA DEPOIS DE USAR
import DiscordMigracao from './components/DiscordMigracao';

const App = () => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 🔴 STATE PARA CONTROLAR O MODAL DE MIGRAÇÃO
  const [showMigracao, setShowMigracao] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsAdmin(userData.role === 'admin');
          } else {
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: 'user',
              createdAt: new Date(),
            });
            setIsAdmin(false);
          }

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
          });
        } catch (error) {
          console.error('Erro ao verificar usuário:', error);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
  <Router>
    {/* 🔴 BOTÃO FLUTUANTE DE MIGRAÇÃO (SÓ APARECE PARA ADMINS) */}
    {user && isAdmin && (
      <div className="fixed bottom-6 right-6 z-[9999]">
        <button
          onClick={() => setShowMigracao(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 shadow-2xl shadow-purple-500/30 transition-all hover:scale-110"
          title="Migrar dados para Discord"
        >
          <span className="text-xl">🔄</span>
          <span className="hidden md:inline">Migrar Discord</span>
        </button>
      </div>
    )}

    {/* 🔴 MODAL DE MIGRAÇÃO */}
    {showMigracao && (
      <DiscordMigracao onClose={() => setShowMigracao(false)} />
    )}

    <Routes>
      {/* ✅ ROTA DO COMUNICADO DETALHE - PRIMEIRA */}
      <Route path="/comunicados/:id" element={<ComunicadoDetalhe />} />
      
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/" />}
      />
      <Route
        path="/"
        element={
          user ? (
            <Layout user={user} isAdmin={isAdmin}>
              <Comunicados isAdmin={isAdmin} />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/viaturas"
        element={
          user ? (
            <Layout user={user} isAdmin={isAdmin}>
              <Viaturas isAdmin={isAdmin} />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/fardamento"
        element={
          user ? (
            <Layout user={user} isAdmin={isAdmin}>
              <Fardamentos isAdmin={isAdmin} />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/hierarquia"
        element={
          user ? (
            <Layout user={user} isAdmin={isAdmin}>
              <Hierarquia isAdmin={isAdmin} />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  </Router>
);
};

export default App;