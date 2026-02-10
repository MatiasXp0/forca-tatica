import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { LogOut, UserCog } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export const Layout = ({ children, user, isAdmin }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white font-sans"
      style={{
        '--scrollbar-track': 'rgba(31, 41, 55, 0.3)',
        '--scrollbar-thumb': 'rgba(59, 130, 246, 0.5)',
      }}
    >
      <div className="flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          user={user}
          isAdmin={isAdmin}
        />

        <main className="flex-1 min-h-screen flex flex-col">
          <header className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-blue-500/20 p-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">FORÇA TÁTICA - PMESP</h1>
                <p className="text-blue-300 text-xs font-semibold">
                  Sistema de Comunicados Operacionais
                </p>
              </div>
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <span className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg text-xs font-bold">
                    <UserCog size={12} /> ADMIN
                  </span>
                )}
                <button
                  onClick={() => signOut(auth)}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg font-semibold transition border border-red-500/30 flex items-center gap-2"
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 p-6">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/20 rounded-xl p-6 fade-in">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
