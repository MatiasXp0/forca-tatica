import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Shirt,
  Car,
  Users,
  User,
  Calculator,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

const SidebarLink = ({ to, icon: Icon, label, collapsed, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700/50 transition group relative ${
      collapsed ? 'justify-center' : ''
    }`}
    title={collapsed ? label : ''}
  >
    <Icon size={20} className="text-blue-400" />
    {!collapsed && <span className="font-medium">{label}</span>}
    {collapsed && (
      <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-lg border border-gray-700 z-50">
        {label}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
      </div>
    )}
  </Link>
);

const SidebarExternal = ({ href, icon: Icon, label, collapsed, onClick }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-purple-500/10 transition group relative ${
      collapsed ? 'justify-center' : ''
    }`}
    title={collapsed ? label : ''}
  >
    <Icon size={20} className="text-purple-400" />
    {!collapsed && <span className="font-medium">{label}</span>}
    {collapsed && (
      <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-lg border border-gray-700 z-50">
        {label}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
      </div>
    )}
  </a>
);

export const Sidebar = ({ collapsed, toggleSidebar, user, isAdmin }) => {
  // Função chamada ao clicar em qualquer link
  const handleLinkClick = () => {
    if (!collapsed) {
      toggleSidebar(); // recolhe a sidebar se estiver expandida
    }
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } bg-gray-800/30 border-r border-blue-500/20 transition-all duration-300 h-screen sticky top-0`}
    >
      {/* Cabeçalho com logo e botão recolher */}
      <div className="p-4 border-b border-blue-500/20">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg">FORÇA TÁTICA</h1>
              <p className="text-blue-300 text-xs">PMESP</p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="hidden lg:block p-1.5 hover:bg-gray-700/50 rounded-lg transition"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Navegação principal */}
      <nav className="p-2 space-y-1">
        <SidebarLink
          to="/"
          icon={FileText}
          label="Comunicados"
          collapsed={collapsed}
          onClick={handleLinkClick}
        />
        <SidebarLink
          to="/fardamento"
          icon={Shirt}
          label="Fardamentos"
          collapsed={collapsed}
          onClick={handleLinkClick}
        />
        <SidebarLink
          to="/viaturas"
          icon={Car}
          label="Viaturas"
          collapsed={collapsed}
          onClick={handleLinkClick}
        />
        <SidebarLink
          to="/hierarquia"
          icon={Users}
          label="Hierarquia"
          collapsed={collapsed}
          onClick={handleLinkClick}
        />

        {/* Ferramentas externas */}
        <div className="pt-4">
          <p
            className={`text-xs text-gray-500 px-3 mb-2 ${
              collapsed ? 'hidden' : ''
            }`}
          >
            Ferramentas
          </p>
          <SidebarExternal
            href="https://saghatz.github.io/Calculadora_Penal_ABCD/"
            icon={Calculator}
            label="Calculadora Penal"
            collapsed={collapsed}
            onClick={handleLinkClick}
          />
        </div>
      </nav>

      {/* Rodapé com informações do usuário */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2 rounded-lg">
            <User size={16} className="text-blue-400" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.displayName || 'Usuário'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {isAdmin ? 'Administrador' : 'Usuário'}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};