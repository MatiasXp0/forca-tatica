import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { LogOut, UserCog, Menu, X } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export const Layout = ({ children, user, isAdmin }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detecta se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="flex relative min-h-screen">
        
        {/* ========== DESKTOP SIDEBAR ========== */}
        <div className="hidden lg:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            toggleSidebar={toggleSidebar}
            user={user}
            isAdmin={isAdmin}
          />
        </div>

        {/* ========== MOBILE MENU OVERLAY ========== */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed left-0 top-0 h-full w-64 z-50 lg:hidden animate-slideIn">
              <Sidebar
                collapsed={false}
                toggleSidebar={() => setMobileMenuOpen(false)}
                user={user}
                isAdmin={isAdmin}
              />
            </div>
          </>
        )}

        {/* ========== CONTEÚDO PRINCIPAL ========== */}
        <main className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
          
          {/* ========== HEADER RESPONSIVO ========== */}
          <header className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-blue-500/20 sticky top-0 z-30 w-full">
            <div className="px-4 py-3 lg:px-6 lg:py-4">
              <div className="flex items-center justify-between gap-2">
                
                {/* Lado esquerdo – menu hambúrguer + título */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Botão menu mobile */}
                  <button
                    onClick={toggleSidebar}
                    className="lg:hidden p-2 rounded-lg bg-gray-800 border border-blue-500/30 text-white hover:bg-gray-700 active:scale-95 transition"
                    aria-label="Abrir menu"
                  >
                    {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>

                  {/* Título – esconder em telas muito pequenas se necessário */}
                  <div className="flex-1 min-w-0">
                    <h1 className="font-bold truncate text-sm sm:text-base md:text-lg lg:text-xl">
                      FORÇA TÁTICA
                    </h1>
                    <p className="text-blue-300 text-xs truncate hidden xs:block">
                      PMESP
                    </p>
                  </div>
                </div>

                {/* Lado direito – admin + logout */}
                <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                  {isAdmin && (
                    <span className="hidden sm:flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-2 lg:px-3 py-1 rounded-lg text-xs font-bold">
                      <UserCog size={12} />
                      <span className="hidden md:inline">ADMIN</span>
                    </span>
                  )}
                  
                  <button
                    onClick={() => signOut(auth)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 px-3 lg:px-4 py-2 rounded-lg font-semibold transition border border-red-500/30 flex items-center gap-2 text-xs lg:text-sm"
                  >
                    <LogOut size={14} className="lg:w-4 lg:h-4" />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* ========== CONTEÚDO COM BACKGROUND FIXO ========== */}
          <div className="flex-1 w-full bg-gradient-to-br from-gray-900 to-black">
            <div className="p-4 lg:p-6 w-full max-w-7xl mx-auto">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/20 rounded-xl p-4 lg:p-6 w-full overflow-x-auto">
                {children}
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* Animação para o menu mobile */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};