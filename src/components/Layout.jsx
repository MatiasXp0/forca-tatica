import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Truck, 
  Shirt, 
  Users, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Settings,
  HelpCircle
} from 'lucide-react';

export const Sidebar = ({ collapsed, toggleSidebar, user, isAdmin }) => {
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: <Home size={20} />, label: 'Comunicados' },
    { path: '/viaturas', icon: <Truck size={20} />, label: 'Viaturas' },
    { path: '/fardamento', icon: <Shirt size={20} />, label: 'Fardamentos' },
    { path: '/hierarquia', icon: <Users size={20} />, label: 'Hierarquia' },
  ];

  return (
    <aside 
      className={`
        h-screen bg-gradient-to-b from-gray-800 to-gray-900 
        border-r border-blue-500/30 flex flex-col
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Logo e toggle */}
      <div className={`
        p-4 flex items-center border-b border-blue-500/20
        ${collapsed ? 'justify-center' : 'justify-between'}
      `}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-blue-400" />
            <span className="font-bold text-white">FT-PMESP</span>
          </div>
        )}
        {collapsed && (
          <Shield size={28} className="text-blue-400" />
        )}
        
        <button
          onClick={toggleSidebar}
          className="hidden lg:block p-1 rounded-lg hover:bg-gray-700 transition text-gray-400 hover:text-white"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 p-3 rounded-lg transition-all
              ${isActive 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white border border-transparent'
              }
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? item.label : ''}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && (
              <span className="font-medium truncate">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé */}
      <div className={`
        p-4 border-t border-blue-500/20
        ${collapsed ? 'text-center' : ''}
      `}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <span className="text-blue-400 font-bold text-sm">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email?.split('@')[0] || 'Usuário'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.email || ''}
                </p>
              </div>
            </div>
            
            {isAdmin && (
              <div className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded text-center">
                Administrador
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-blue-400 font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            {isAdmin && (
              <div className="w-2 h-2 rounded-full bg-yellow-400" title="Admin" />
            )}
          </div>
        )}
      </div>
    </aside>
  );
};