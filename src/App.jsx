import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
} from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, db } from './firebaseConfig';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import {
  Shield,
  Car,
  Shirt,
  Users,
  LogOut,
  FileText,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Save,
  X,
  AlertTriangle,
  Info,
  UserCog,
  Bold,
  Italic,
  List,
  Hash,
  User,
  Award,
  AlertCircle,
  Calendar,
  Contact,
  ChevronRight,
  Link as LinkIcon,
} from 'lucide-react';

// --- LAYOUT PRINCIPAL ---
const Layout = ({ children, user, isAdmin }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white font-sans">
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-blue-500/20 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">
              FORÇA TÁTICA - PMESP
            </h1>
            <p className="text-blue-300 text-xs font-semibold tracking-wider mt-1">
              Sistema de Comunicados Operacionais
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg text-xs font-bold">
              <UserCog size={14} /> ADMIN
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Grid de Navegação */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
          <NavCard
            to="/"
            icon={FileText}
            label="Comunicados"
            desc="Visualize avisos, informações e instruções operacionais"
          />
          <NavCard
            to="/fardamento"
            icon={Shirt}
            label="Fardamentos"
            desc="Armário de fardamentos operacionais"
          />
          <NavCard
            to="/viaturas"
            icon={Car}
            label="Viaturas"
            desc="Frota operacional com especificações técnicas"
          />
          <NavCard
            to="/hierarquia"
            icon={Users}
            label="Hierarquia"
            desc="Estrutura organizacional do batalhão"
          />
        </div>

        {/* Conteúdo da Página */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/20 rounded-xl p-6 mb-6">
          {children}
        </div>

        {/* Card de Usuário */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <Shield size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="font-bold">
                  Bem-vindo,{' '}
                  <span className="text-blue-400">
                    {user?.displayName || 'Usuário'}
                  </span>
                </p>
                <p className="text-gray-400 text-sm">{user?.email || ''}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isAdmin
                    ? 'Permissão: Administrador'
                    : 'Permissão: Visualização'}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg font-semibold transition border border-red-500/30"
            >
              <LogOut size={16} className="inline mr-2" /> Sair
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const NavCard = ({ to, icon: Icon, label, desc }) => (
  <Link
    to={to}
    className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/20 p-4 rounded-xl hover:from-blue-900/30 hover:to-gray-800 transition-all duration-300 hover:border-blue-500/40 group"
  >
    <div className="flex items-center gap-3 mb-3">
      <div className="bg-blue-500/20 p-2 rounded-lg group-hover:bg-blue-500/30 transition">
        <Icon size={20} className="text-blue-400" />
      </div>
      <span className="text-blue-300 font-bold text-sm">{label}</span>
    </div>
    <p className="text-gray-400 text-xs leading-tight">{desc}</p>
  </Link>
);

// --- COMPONENTE DE VIATURAS ATUALIZADO COM FOTOS ---
const Viaturas = ({ isAdmin }) => {
  const [viaturas, setViaturas] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingViatura, setEditingViatura] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    modelo: '',
    velocidadeMax: '',
    descricao: '',
    fotoURL: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'viaturas'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setViaturas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const handleSave = async () => {
    if (!formData.nome || !formData.modelo) {
      alert('Preencha pelo menos nome e modelo!');
      return;
    }

    const viaturaData = {
      ...formData,
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
    };

    try {
      if (editingViatura) {
        await updateDoc(doc(db, 'viaturas', editingViatura.id), viaturaData);
      } else {
        await addDoc(collection(db, 'viaturas'), viaturaData);
      }
      setModalOpen(false);
      setEditingViatura(null);
      setFormData({
        nome: '',
        modelo: '',
        velocidadeMax: '',
        descricao: '',
        fotoURL: '',
      });
    } catch (error) {
      console.error('Erro ao salvar viatura:', error);
    }
  };

  const handleEdit = (viatura) => {
    setEditingViatura(viatura);
    setFormData({
      nome: viatura.nome,
      modelo: viatura.modelo,
      velocidadeMax: viatura.velocidadeMax,
      descricao: viatura.descricao,
      fotoURL: viatura.fotoURL || '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir esta viatura?')) {
      await deleteDoc(doc(db, 'viaturas', id));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Viaturas Disponíveis</h2>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold flex items-center gap-2 transition text-sm"
          >
            <Plus size={16} /> Nova Viatura
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {viaturas.map((vtr) => (
          <div
            key={vtr.id}
            className="bg-gray-800/50 border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-500/40 transition group"
          >
            {/* Foto da Viatura */}
            <div className="h-48 overflow-hidden bg-gray-900">
              {vtr.fotoURL ? (
                <img
                  src={vtr.fotoURL}
                  alt={vtr.nome}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-gray-900">
                  <Car size={64} className="text-blue-500/50" />
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-blue-300">
                    {vtr.nome}
                  </h3>
                  <p className="text-gray-300 text-sm">Modelo: {vtr.modelo}</p>
                  {vtr.velocidadeMax && (
                    <p className="text-gray-400 text-sm mt-1">
                      <span className="font-semibold">Velocidade Máx:</span>{' '}
                      {vtr.velocidadeMax} km/h
                    </p>
                  )}
                </div>
              </div>

              {vtr.descricao && (
                <div className="mb-3">
                  <p className="text-gray-400 text-sm">
                    <span className="font-semibold">Descrição:</span>{' '}
                    {vtr.descricao}
                  </p>
                </div>
              )}

              {isAdmin && (
                <div className="flex gap-2 border-t border-gray-700 pt-3 mt-3">
                  <button
                    onClick={() => handleEdit(vtr)}
                    className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-1 rounded text-sm flex items-center justify-center gap-1"
                  >
                    <Edit size={14} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(vtr.id)}
                    className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1 rounded text-sm flex items-center justify-center gap-1"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nova/Editar Viatura */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Car size={20} />
              {editingViatura ? 'Editar Viatura' : 'Nova Viatura'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Nome da Viatura *
                </label>
                <input
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: ROTA-01"
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Modelo *
                </label>
                <input
                  value={formData.modelo}
                  onChange={(e) =>
                    setFormData({ ...formData, modelo: e.target.value })
                  }
                  placeholder="Ex: Toyota Hilux 4x4"
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Velocidade Máxima (km/h)
                </label>
                <input
                  value={formData.velocidadeMax}
                  onChange={(e) =>
                    setFormData({ ...formData, velocidadeMax: e.target.value })
                  }
                  placeholder="Ex: 180"
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  URL da Foto (opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    value={formData.fotoURL}
                    onChange={(e) =>
                      setFormData({ ...formData, fotoURL: e.target.value })
                    }
                    placeholder="https://exemplo.com/foto-viatura.jpg"
                    className="flex-1 bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                  />
                  {formData.fotoURL && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-blue-500/20">
                      <img
                        src={formData.fotoURL}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiMxRjJBM0MiLz48cGF0aCBkPSJNNDAgMzJMMzIgNDBMMjQgMzJMMzIgMjRMNDAgMzJaIiBmaWxsPSIjM0I4MkVGIi8+PC9zdmc+';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                  placeholder="Descreva a viatura, equipamentos, observações..."
                  rows={4}
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700"
              >
                <Save size={16} className="inline mr-2" /> SALVAR
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingViatura(null);
                  setFormData({
                    nome: '',
                    modelo: '',
                    velocidadeMax: '',
                    descricao: '',
                    fotoURL: '',
                  });
                }}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600"
              >
                <X size={16} className="inline mr-2" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE DE FARDAMENTOS ATUALIZADO ---
const Fardamentos = ({ isAdmin }) => {
  const [fardamentos, setFardamentos] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingFarda, setEditingFarda] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    fotoURL: '',
    pecas: [''],
  });

  useEffect(() => {
    const q = query(
      collection(db, 'fardamentos'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setFardamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const addPeca = () => {
    setFormData({ ...formData, pecas: [...formData.pecas, ''] });
  };

  const updatePeca = (index, value) => {
    const newPecas = [...formData.pecas];
    newPecas[index] = value;
    setFormData({ ...formData, pecas: newPecas });
  };

  const removePeca = (index) => {
    const newPecas = formData.pecas.filter((_, i) => i !== index);
    setFormData({ ...formData, pecas: newPecas });
  };

  const handleSaveFarda = async () => {
    if (!formData.nome) {
      alert('Preencha o nome do fardamento!');
      return;
    }

    const pecasFiltradas = formData.pecas.filter((p) => p.trim() !== '');

    const fardaData = {
      ...formData,
      pecas: pecasFiltradas,
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
    };

    try {
      if (editingFarda) {
        await updateDoc(doc(db, 'fardamentos', editingFarda.id), fardaData);
      } else {
        await addDoc(collection(db, 'fardamentos'), fardaData);
      }
      setModalOpen(false);
      setEditingFarda(null);
      setFormData({ nome: '', descricao: '', fotoURL: '', pecas: [''] });
    } catch (error) {
      console.error('Erro ao salvar fardamento:', error);
    }
  };

  const handleEditFarda = (farda) => {
    setEditingFarda(farda);
    setFormData({
      nome: farda.nome,
      descricao: farda.descricao || '',
      fotoURL: farda.fotoURL || '',
      pecas: farda.pecas.length > 0 ? farda.pecas : [''],
    });
    setModalOpen(true);
  };

  const handleDeleteFarda = async (id) => {
    if (confirm('Tem certeza que deseja excluir este fardamento?')) {
      await deleteDoc(doc(db, 'fardamentos', id));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Fardamentos Operacionais</h2>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold flex items-center gap-2 transition text-sm"
          >
            <Plus size={16} /> Novo Fardamento
          </button>
        )}
      </div>

      {fardamentos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-xl">
          <Shirt size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">Nenhum fardamento cadastrado</p>
          {isAdmin && (
            <p className="text-sm text-gray-500 mt-2">
              Clique em "Novo Fardamento" para adicionar
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fardamentos.map((farda) => (
            <div
              key={farda.id}
              className="bg-gray-800/50 border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-500/40 transition"
            >
              {/* Cabeçalho do Fardamento */}
              <div
                className="cursor-pointer"
                onClick={() => toggleExpand(farda.id)}
              >
                <div className="flex items-center p-4 hover:bg-gray-800/70 transition">
                  <div className="flex-shrink-0 mr-4">
                    {farda.fotoURL ? (
                      <img
                        src={farda.fotoURL}
                        alt={farda.nome}
                        className="w-20 h-20 rounded-lg object-cover border-2 border-blue-500/30"
                        onError={(e) => {
                          e.target.src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiMxRjJBM0MiLz48cGF0aCBkPSJNNDAgNDBMMzIgNDhMMjQgNDBMMzIgMzJMNDAgNDBaIiBmaWxsPSIjM0I4MkVGIi8+PC9zdmc+';
                        }}
                      />
                    ) : (
                      <div className="w-20 h-20 bg-blue-500/20 rounded-lg flex items-center justify-center border-2 border-blue-500/30">
                        <Shirt size={32} className="text-blue-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg">{farda.nome}</h3>
                        <p className="text-gray-400 text-sm line-clamp-2">
                          {farda.descricao}
                        </p>
                      </div>
                      {expandedId === farda.id ? (
                        <ChevronUp className="text-gray-500" />
                      ) : (
                        <ChevronDown className="text-gray-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conteúdo Expandido (Armário) */}
              {expandedId === farda.id && (
                <div className="border-t border-gray-700 p-4 bg-gray-900/50">
                  <h4 className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                    <Shirt size={16} /> Guarda-Roupa
                  </h4>
                  <div className="space-y-2 mb-4">
                    {farda.pecas.map((peca, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg"
                      >
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm">{peca}</span>
                      </div>
                    ))}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 pt-4 border-t border-gray-700">
                      <button
                        onClick={() => handleEditFarda(farda)}
                        className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded text-sm flex items-center justify-center gap-1"
                      >
                        <Edit size={14} /> Editar
                      </button>
                      <button
                        onClick={() => handleDeleteFarda(farda.id)}
                        className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm flex items-center justify-center gap-1"
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Fardamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shirt size={20} />
              {editingFarda ? 'Editar Fardamento' : 'Novo Fardamento'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Nome do Fardamento *
                  </label>
                  <input
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    placeholder="Ex: Fardamento B4"
                    className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) =>
                      setFormData({ ...formData, descricao: e.target.value })
                    }
                    placeholder="Descreva quando e onde será usado..."
                    rows={3}
                    className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    URL da Foto (opcional)
                  </label>
                  <div className="flex gap-3">
                    <input
                      value={formData.fotoURL}
                      onChange={(e) =>
                        setFormData({ ...formData, fotoURL: e.target.value })
                      }
                      placeholder="https://exemplo.com/foto.jpg"
                      className="flex-1 bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                    />
                    {formData.fotoURL && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-blue-500/30">
                        <img
                          src={formData.fotoURL}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src =
                              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiMxRjJBM0MiLz48cGF0aCBkPSJNNDAgNDBMMzIgNDhMMjQgNDBMMzIgMzJMNDAgNDBaIiBmaWxsPSIjM0I4MkVGIi8+PC9zdmc+';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm text-gray-400">
                    Peças do Fardamento
                  </label>
                  <button
                    onClick={addPeca}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                <div className="space-y-2 mb-3 max-h-60 overflow-y-auto p-2">
                  {formData.pecas.map((peca, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={peca}
                        onChange={(e) => updatePeca(index, e.target.value)}
                        placeholder={`Peça ${
                          index + 1
                        } (Ex: Máscara 273 | txt 0 Oficiais)`}
                        className="flex-1 bg-gray-900 border border-blue-500/20 rounded-lg p-2 text-white text-sm outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => removePeca(index)}
                        className="bg-red-500/20 text-red-400 p-2 rounded-lg hover:bg-red-500/30 disabled:opacity-30"
                        disabled={formData.pecas.length <= 1}
                        title="Remover peça"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveFarda}
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700"
              >
                <Save size={16} className="inline mr-2" /> SALVAR
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingFarda(null);
                  setFormData({
                    nome: '',
                    descricao: '',
                    fotoURL: '',
                    pecas: [''],
                  });
                }}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600"
              >
                <X size={16} className="inline mr-2" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE DE COMUNICADOS COM SUPORTE A LINKS E LISTAS ---
const Comunicados = ({ isAdmin }) => {
  const [comunicados, setComunicados] = useState([]);
  const [expandedComId, setExpandedComId] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCom, setEditingCom] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    tipo: 'INFORMATIVO',
    conteudo: '',
  });

  useEffect(() => {
    const q = query(
      collection(db, 'comunicados'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const todosComunicados = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Filtrar: não-admins só veem comunicados ativos
      if (!isAdmin) {
        setComunicados(todosComunicados.filter((com) => com.isActive));
      } else {
        setComunicados(todosComunicados);
      }
    });
  }, [isAdmin]);

  const toggleComExpand = (id) => {
    setExpandedComId(expandedComId === id ? null : id);
  };

  const handleSaveComunicado = async () => {
    if (!formData.titulo || !formData.conteudo) {
      alert('Preencha título e conteúdo!');
      return;
    }

    const comunicadoData = {
      ...formData,
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
      isActive: true,
    };

    try {
      if (editingCom) {
        await updateDoc(doc(db, 'comunicados', editingCom.id), comunicadoData);
      } else {
        await addDoc(collection(db, 'comunicados'), comunicadoData);
      }
      setModalOpen(false);
      setEditingCom(null);
      setFormData({ titulo: '', tipo: 'INFORMATIVO', conteudo: '' });
    } catch (error) {
      console.error('Erro ao salvar comunicado:', error);
    }
  };

  const handleEditCom = (com) => {
    setEditingCom(com);
    setFormData({
      titulo: com.titulo,
      tipo: com.tipo,
      conteudo: com.conteudo,
    });
    setModalOpen(true);
  };

  const handleDeleteCom = async (id) => {
    if (confirm('Tem certeza que deseja excluir este comunicado?')) {
      await deleteDoc(doc(db, 'comunicados', id));
    }
  };

  const toggleComStatus = async (com) => {
    await updateDoc(doc(db, 'comunicados', com.id), {
      isActive: !com.isActive,
    });
  };

  // Formatação avançada de markdown com suporte a links e listas
  const formatContent = (text) => {
    let formatted = text;

    // Links no estilo [texto](url)
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline hover:no-underline transition">$1</a>'
    );

    // Negrito
    formatted = formatted.replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="font-bold">$1</strong>'
    );

    // Itálico
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Títulos
    formatted = formatted.replace(
      /### (.*?)(?:\n|$)/g,
      '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>'
    );
    formatted = formatted.replace(
      /## (.*?)(?:\n|$)/g,
      '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>'
    );
    formatted = formatted.replace(
      /# (.*?)(?:\n|$)/g,
      '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>'
    );

    // Listas com - ou *
    formatted = formatted.replace(
      /^[-*] (.+)$/gm,
      '<li class="flex items-start mb-1"><span class="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span><span>$1</span></li>'
    );

    // Agrupar itens de lista consecutivos
    formatted = formatted.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
      return `<ul class="space-y-2 my-3 ml-1">${match}</ul>`;
    });

    // Quebras de linha
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  };

  const insertMarkdown = (type) => {
    const textarea = document.querySelector('textarea[name="conteudo"]');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.conteudo.substring(start, end);

    let newText = '';
    let cursorPos = start;

    switch (type) {
      case 'bold':
        newText = `**${selectedText || 'texto'}**`;
        cursorPos = start + (selectedText ? 0 : 2);
        break;
      case 'italic':
        newText = `*${selectedText || 'texto'}*`;
        cursorPos = start + (selectedText ? 0 : 1);
        break;
      case 'h1':
        newText = `# ${selectedText || 'Título Grande'}`;
        cursorPos = start + (selectedText ? 0 : 2);
        break;
      case 'h2':
        newText = `## ${selectedText || 'Subtítulo'}`;
        cursorPos = start + (selectedText ? 0 : 3);
        break;
      case 'link':
        newText = `[${selectedText || 'texto do link'}](https://exemplo.com)`;
        cursorPos = start + (selectedText ? selectedText.length + 3 : 15);
        break;
      case 'list':
        newText = `- ${selectedText || 'item da lista'}`;
        cursorPos = start + (selectedText ? 0 : 2);
        break;
    }

    const updatedText =
      formData.conteudo.substring(0, start) +
      newText +
      formData.conteudo.substring(end);
    setFormData({ ...formData, conteudo: updatedText });

    // Foca no textarea e posiciona o cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Comunicados Operacionais</h2>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold flex items-center gap-2 transition text-sm"
          >
            <Plus size={16} /> Novo Comunicado
          </button>
        )}
      </div>

      <div className="space-y-4">
        {comunicados.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-xl">
            <FileText size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">Nenhum comunicado publicado</p>
            {isAdmin && (
              <p className="text-sm text-gray-500 mt-2">
                Clique em "Novo Comunicado" para adicionar
              </p>
            )}
          </div>
        ) : (
          comunicados.map((com) => (
            <div
              key={com.id}
              className="bg-gray-800/50 border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-500/40 transition"
            >
              {/* Cabeçalho do Comunicado */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-800/70 transition"
                onClick={() => toggleComExpand(com.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                      px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1
                      ${
                        com.tipo === 'INFORMATIVO'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }
                    `}
                    >
                      {com.tipo === 'INFORMATIVO' ? (
                        <Info size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      {com.tipo}
                    </div>
                    <div>
                      <h3 className="font-bold">{com.titulo}</h3>
                      <p className="text-gray-400 text-sm">
                        {com.createdAt?.seconds
                          ? new Date(
                              com.createdAt.seconds * 1000
                            ).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : com.createdAt
                          ? new Date(com.createdAt).toLocaleDateString(
                              'pt-BR',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )
                          : new Date().toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!com.isActive && (
                      <span className="text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded">
                        OCULTO
                      </span>
                    )}
                    {expandedComId === com.id ? (
                      <ChevronUp className="text-gray-500" />
                    ) : (
                      <ChevronDown className="text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Conteúdo Expandido */}
              {expandedComId === com.id && (
                <div className="border-t border-gray-700 p-6 bg-gray-900/50">
                  <div
                    className="prose prose-invert max-w-none mb-6"
                    dangerouslySetInnerHTML={{
                      __html: formatContent(com.conteudo),
                    }}
                  />

                  {isAdmin && (
                    <div className="flex gap-2 pt-6 border-t border-gray-700">
                      <button
                        onClick={() => handleEditCom(com)}
                        className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded text-sm flex items-center justify-center gap-1"
                      >
                        <Edit size={14} /> Editar
                      </button>
                      <button
                        onClick={() => toggleComStatus(com)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1"
                      >
                        {com.isActive ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                        {com.isActive ? ' Ocultar' : ' Mostrar'}
                      </button>
                      <button
                        onClick={() => handleDeleteCom(com.id)}
                        className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm flex items-center justify-center gap-1"
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Comunicado */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText size={20} />
              {editingCom ? 'Editar Comunicado' : 'Novo Comunicado'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Título *
                  </label>
                  <input
                    name="titulo"
                    value={formData.titulo}
                    onChange={(e) =>
                      setFormData({ ...formData, titulo: e.target.value })
                    }
                    placeholder="Título do comunicado"
                    className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Tipo *
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tipo: e.target.value,
                      })
                    }
                    className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                  >
                    <option value="INFORMATIVO">INFORMATIVO</option>
                    <option value="INSTRUTIVO">INSTRUTIVO</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm text-gray-400">
                    Conteúdo *
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => insertMarkdown('h1')}
                      className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                      title="Título grande"
                    >
                      <Hash size={12} />
                    </button>
                    <button
                      onClick={() => insertMarkdown('h2')}
                      className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                      title="Subtítulo"
                    >
                      <Hash size={12} /> <Hash size={10} />
                    </button>
                    <button
                      onClick={() => insertMarkdown('bold')}
                      className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                      title="Negrito"
                    >
                      <Bold size={12} />
                    </button>
                    <button
                      onClick={() => insertMarkdown('italic')}
                      className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                      title="Itálico"
                    >
                      <Italic size={12} />
                    </button>
                    <button
                      onClick={() => insertMarkdown('link')}
                      className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                      title="Link"
                    >
                      <LinkIcon size={12} />
                    </button>
                    <button
                      onClick={() => insertMarkdown('list')}
                      className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
                      title="Lista"
                    >
                      <List size={12} />
                    </button>
                  </div>
                </div>
                <textarea
                  name="conteudo"
                  value={formData.conteudo}
                  onChange={(e) =>
                    setFormData({ ...formData, conteudo: e.target.value })
                  }
                  placeholder="Digite o conteúdo do comunicado...

# Título Grande
## Subtítulo
### Subtítulo menor

**Texto em negrito**
*Texto em itálico*

- Item de lista 1
- Item de lista 2

[Texto do link](https://exemplo.com)"
                  rows={12}
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500 resize-none font-mono text-sm"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Dica: Use - para criar listas com marcadores
                </div>
              </div>

              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">
                  Pré-visualização:
                </h4>
                <div
                  className="text-white text-sm min-h-[100px] p-3 bg-gray-800/30 rounded"
                  dangerouslySetInnerHTML={{
                    __html: formatContent(formData.conteudo),
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveComunicado}
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700"
              >
                <Save size={16} className="inline mr-2" /> PUBLICAR
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingCom(null);
                  setFormData({
                    titulo: '',
                    tipo: 'INFORMATIVO',
                    conteudo: '',
                  });
                }}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600"
              >
                <X size={16} className="inline mr-2" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE DE HIERARQUIA COMPLETO ---
const Hierarquia = ({ isAdmin }) => {
  const [membros, setMembros] = useState([]);
  const [selectedMembro, setSelectedMembro] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isAdvertenciaModalOpen, setAdvertenciaModalOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    patente: 'Tenente Coronel',
    fotoURL: '',
    ativo: true,
    observacoes: '',
  });
  const [advertenciaForm, setAdvertenciaForm] = useState({
    tipo: 'ausencia',
    motivo: '',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: '',
    descricao: '',
  });

  const [advertenciaSubmitting, setAdvertenciaSubmitting] = useState(false);

  // Ordem das patentes (do maior para o menor)
  const ordemPatentes = [
    'Tenente Coronel',
    'Major',
    'Capitão',
    '1° Tenente',
    '2° Tenente',
    'Sub Tenente',
    '1° Sargento',
    '2° Sargento',
    '3° Sargento',
    'Cabo',
    'Soldado 1° Classe',
    'Soldado 2° Classe',
  ];

  useEffect(() => {
    const q = query(collection(db, 'hierarquia'), orderBy('patente'));
    return onSnapshot(q, (snap) => {
      const membrosData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordenar pela ordem definida
      membrosData.sort(
        (a, b) =>
          ordemPatentes.indexOf(a.patente) - ordemPatentes.indexOf(b.patente)
      );
      setMembros(membrosData);
    });
  }, []);

  const handleSaveMembro = async () => {
    if (!formData.nome || !formData.patente) {
      alert('Preencha nome e patente!');
      return;
    }

    const membroData = {
      ...formData,
      advertências: [],
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
    };

    try {
      if (editingMembro) {
        await updateDoc(doc(db, 'hierarquia', editingMembro.id), membroData);
      } else {
        await addDoc(collection(db, 'hierarquia'), membroData);
      }
      setModalOpen(false);
      setEditingMembro(null);
      setFormData({
        nome: '',
        patente: 'Tenente Coronel',
        fotoURL: '',
        ativo: true,
        observacoes: '',
      });
    } catch (error) {
      console.error('Erro ao salvar membro:', error);
    }
  };

  const handleSaveAdvertencia = async () => {
    if (!selectedMembro || !advertenciaForm.motivo || advertenciaSubmitting) {
      alert('Preencha o motivo!');
      return;
    }

    setAdvertenciaSubmitting(true);

    const novaAdvertencia = {
      ...advertenciaForm,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
    };

    try {
      const membroRef = doc(db, 'hierarquia', selectedMembro.id);
      const membroDoc = await getDoc(membroRef);
      const membroData = membroDoc.data();

      const advertênciasExistentes = membroData.advertências || [];
      const jaExiste = advertênciasExistentes.some(
        (adv) =>
          adv.tipo === novaAdvertencia.tipo &&
          adv.motivo === novaAdvertencia.motivo &&
          adv.dataInicio === novaAdvertencia.dataInicio
      );

      if (jaExiste) {
        alert('Este registro já foi adicionado anteriormente!');
        setAdvertenciaSubmitting(false);
        return;
      }

      await updateDoc(membroRef, {
        advertências: [...advertênciasExistentes, novaAdvertencia],
      });

      setSelectedMembro({
        ...selectedMembro,
        advertências: [...advertênciasExistentes, novaAdvertencia],
      });

      setMembros((prevMembros) =>
        prevMembros.map((m) =>
          m.id === selectedMembro.id
            ? {
                ...m,
                advertências: [...advertênciasExistentes, novaAdvertencia],
              }
            : m
        )
      );

      setAdvertenciaModalOpen(false);
      setAdvertenciaForm({
        tipo: 'ausencia',
        motivo: '',
        dataInicio: new Date().toISOString().split('T')[0],
        dataFim: '',
        descricao: '',
      });
    } catch (error) {
      console.error('Erro ao salvar advertência:', error);
    } finally {
      setAdvertenciaSubmitting(false);
    }
  };

  const handleEditMembro = (membro) => {
    setEditingMembro(membro);
    setFormData({
      nome: membro.nome,
      patente: membro.patente,
      fotoURL: membro.fotoURL || '',
      ativo: membro.ativo,
      observacoes: membro.observacoes || '',
    });
    setModalOpen(true);
  };

  const handleDeleteMembro = async (id) => {
    if (confirm('Tem certeza que deseja excluir este membro?')) {
      await deleteDoc(doc(db, 'hierarquia', id));
    }
  };

  const handleViewMembro = (membro) => {
    setSelectedMembro(membro);
  };

  const handleDeleteAdvertencia = async (advertenciaId) => {
    if (!selectedMembro) return;

    if (confirm('Tem certeza que deseja excluir esta advertência?')) {
      try {
        const membroRef = doc(db, 'hierarquia', selectedMembro.id);
        const membroDoc = await getDoc(membroRef);
        const membroData = membroDoc.data();

        const novasAdvertencias = membroData.advertências.filter(
          (a) => a.id !== advertenciaId
        );

        await updateDoc(membroRef, {
          advertências: novasAdvertencias,
        });

        const membroAtualizado = {
          ...selectedMembro,
          advertências: novasAdvertencias,
        };

        setSelectedMembro(membroAtualizado);

        setMembros((prevMembros) =>
          prevMembros.map((m) =>
            m.id === selectedMembro.id
              ? { ...m, advertências: novasAdvertencias }
              : m
          )
        );
      } catch (error) {
        console.error('Erro ao excluir advertência:', error);
      }
    }
  };

  const getPatenteColor = (patente) => {
    return 'text-white';
  };

  const getAdvertenciaColor = (tipo) => {
    switch (tipo) {
      case 'ausencia':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'advertencia':
        return 'bg-red-500/20 text-red-400';
      case 'elogio':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Hierarquia do Batalhão</h2>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold flex items-center gap-2 transition text-sm"
          >
            <Plus size={16} /> Novo Membro
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Membros */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800/50 border border-blue-500/20 rounded-xl p-4">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Contact size={20} /> Estrutura de Comando
            </h3>

            <div className="space-y-4">
              {ordemPatentes.map((patente) => {
                const membrosPatente = membros.filter(
                  (m) => m.patente === patente
                );
                if (membrosPatente.length === 0) return null;

                return (
                  <div
                    key={patente}
                    className="border-b border-gray-700 pb-4 last:border-0"
                  >
                    <h4
                      className={`font-semibold mb-2 ${getPatenteColor(
                        patente
                      )}`}
                    >
                      {patente}{' '}
                      {membrosPatente.length > 1 &&
                        `(${membrosPatente.length})`}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {membrosPatente.map((membro) => (
                        <div
                          key={membro.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition hover:bg-gray-800/70 ${
                            !membro.ativo ? 'opacity-60' : ''
                          } ${
                            selectedMembro?.id === membro.id
                              ? 'bg-gray-800/70 border border-blue-500/30'
                              : 'bg-gray-900/30'
                          }`}
                          onClick={() => handleViewMembro(membro)}
                        >
                          <div className="flex-shrink-0">
                            {membro.fotoURL ? (
                              <img
                                src={membro.fotoURL}
                                alt={membro.nome}
                                className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/30"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border-2 border-blue-500/30">
                                <User size={20} className="text-blue-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <p className="font-medium truncate">
                                {membro.nome}
                              </p>
                              {!membro.ativo && (
                                <span className="text-xs text-red-400 bg-red-500/20 px-2 py-0.5 rounded">
                                  INATIVO
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">
                              {membro.advertências?.filter(
                                (a) => a.tipo === 'advertencia'
                              ).length || 0}{' '}
                              advertência(s)
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-gray-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {membros.length === 0 && (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">Nenhum membro cadastrado</p>
                {isAdmin && (
                  <p className="text-sm text-gray-500 mt-2">
                    Clique em "Novo Membro" para adicionar
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detalhes do Membro Selecionado */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800/50 border border-blue-500/20 rounded-xl p-4 sticky top-4">
            {selectedMembro ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  {selectedMembro.fotoURL ? (
                    <img
                      src={selectedMembro.fotoURL}
                      alt={selectedMembro.nome}
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/30"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center border-2 border-blue-500/30">
                      <User size={28} className="text-blue-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg">{selectedMembro.nome}</h3>
                    <p
                      className={`font-semibold ${getPatenteColor(
                        selectedMembro.patente
                      )}`}
                    >
                      {selectedMembro.patente}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className={`px-2 py-0.5 rounded text-xs ${
                          selectedMembro.ativo
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {selectedMembro.ativo ? 'ATIVO' : 'INATIVO'}
                      </div>
                      <div className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                        {selectedMembro.advertências?.filter(
                          (a) => a.tipo === 'advertencia'
                        ).length || 0}
                        /3 advertências
                      </div>
                    </div>
                  </div>
                </div>

                {/* Advertências */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-gray-300">Registros</h4>
                    {isAdmin && (
                      <button
                        onClick={() => setAdvertenciaModalOpen(true)}
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <Plus size={14} /> Adicionar
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {selectedMembro.advertências &&
                    selectedMembro.advertências.length > 0 ? (
                      selectedMembro.advertências.map((adv) => (
                        <div
                          key={adv.id}
                          className={`p-3 rounded-lg ${getAdvertenciaColor(
                            adv.tipo
                          )}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              {adv.tipo === 'ausencia' && (
                                <Calendar size={14} />
                              )}
                              {adv.tipo === 'advertencia' && (
                                <AlertCircle size={14} />
                              )}
                              {adv.tipo === 'elogio' && <Award size={14} />}
                              <span className="font-semibold capitalize">
                                {adv.tipo}
                              </span>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteAdvertencia(adv.id)}
                                className="text-red-400 hover:text-red-300"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <p className="text-sm mb-1">
                            <strong>Motivo:</strong> {adv.motivo}
                          </p>
                          <p className="text-sm mb-1">
                            <strong>Período:</strong> {adv.dataInicio}
                            {adv.dataFim && ` até ${adv.dataFim}`}
                          </p>
                          {adv.descricao && (
                            <p className="text-sm mt-2">{adv.descricao}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            {adv.createdAt?.seconds
                              ? new Date(
                                  adv.createdAt.seconds * 1000
                                ).toLocaleDateString('pt-BR')
                              : adv.createdAt
                              ? new Date(adv.createdAt).toLocaleDateString(
                                  'pt-BR'
                                )
                              : new Date().toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm text-center py-4">
                        Nenhum registro encontrado
                      </p>
                    )}
                  </div>
                </div>

                {/* Observações (Apenas Admin) */}
                {isAdmin && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-300 mb-2">
                      Observações Internas
                    </h4>
                    <div className="bg-gray-900/50 p-3 rounded-lg min-h-[100px]">
                      {selectedMembro.observacoes || (
                        <p className="text-gray-500 text-sm">
                          Nenhuma observação registrada
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Botões de Ação (Apenas Admin) */}
                {isAdmin && (
                  <div className="flex gap-2 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => handleEditMembro(selectedMembro)}
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded text-sm flex items-center justify-center gap-1"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(`Alterar status de ${selectedMembro.nome}?`)
                        ) {
                          updateDoc(doc(db, 'hierarquia', selectedMembro.id), {
                            ativo: !selectedMembro.ativo,
                          }).then(() => {
                            setSelectedMembro({
                              ...selectedMembro,
                              ativo: !selectedMembro.ativo,
                            });
                          });
                        }
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1"
                    >
                      {selectedMembro.ativo ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                      {selectedMembro.ativo ? ' Inativar' : ' Ativar'}
                    </button>
                    <button
                      onClick={() => handleDeleteMembro(selectedMembro.id)}
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm flex items-center justify-center gap-1"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <User size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">Selecione um membro</p>
                <p className="text-sm text-gray-500 mt-2">
                  Clique em um nome para ver os detalhes
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo/Editar Membro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <User size={20} />
              {editingMembro ? 'Editar Membro' : 'Novo Membro'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Nome Completo *
                </label>
                <input
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: João da Silva"
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Patente *
                </label>
                <select
                  value={formData.patente}
                  onChange={(e) =>
                    setFormData({ ...formData, patente: e.target.value })
                  }
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                >
                  {ordemPatentes.map((patente) => (
                    <option key={patente} value={patente}>
                      {patente}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  URL da Foto (opcional)
                </label>
                <input
                  value={formData.fotoURL}
                  onChange={(e) =>
                    setFormData({ ...formData, fotoURL: e.target.value })
                  }
                  placeholder="https://exemplo.com/foto.jpg"
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Observações Internas
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  placeholder="Observações sobre o membro (visível apenas para administradores)"
                  rows={3}
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) =>
                    setFormData({ ...formData, ativo: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800"
                />
                <label htmlFor="ativo" className="text-sm text-gray-400">
                  Membro ativo no serviço
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveMembro}
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700"
              >
                <Save size={16} className="inline mr-2" /> SALVAR
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingMembro(null);
                  setFormData({
                    nome: '',
                    patente: 'Tenente Coronel',
                    fotoURL: '',
                    ativo: true,
                    observacoes: '',
                  });
                }}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600"
              >
                <X size={16} className="inline mr-2" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Advertência */}
      {isAdvertenciaModalOpen && selectedMembro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              {advertenciaForm.tipo === 'ausencia' && <Calendar size={20} />}
              {advertenciaForm.tipo === 'advertencia' && (
                <AlertCircle size={20} />
              )}
              {advertenciaForm.tipo === 'elogio' && <Award size={20} />}
              Nova{' '}
              {advertenciaForm.tipo === 'ausencia'
                ? 'Ausência'
                : advertenciaForm.tipo === 'advertencia'
                ? 'Advertência'
                : 'Elogio'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Para: <span className="text-blue-400">{selectedMembro.nome}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                <select
                  value={advertenciaForm.tipo}
                  onChange={(e) =>
                    setAdvertenciaForm({
                      ...advertenciaForm,
                      tipo: e.target.value,
                    })
                  }
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="ausencia">Ausência</option>
                  <option value="advertencia">Advertência</option>
                  <option value="elogio">Elogio</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Motivo *
                </label>
                <input
                  value={advertenciaForm.motivo}
                  onChange={(e) =>
                    setAdvertenciaForm({
                      ...advertenciaForm,
                      motivo: e.target.value,
                    })
                  }
                  placeholder="Ex: Ausência justificada, Falta de equipamento, etc."
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={advertenciaForm.dataInicio}
                    onChange={(e) =>
                      setAdvertenciaForm({
                        ...advertenciaForm,
                        dataInicio: e.target.value,
                      })
                    }
                    className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Data de Fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={advertenciaForm.dataFim}
                    onChange={(e) =>
                      setAdvertenciaForm({
                        ...advertenciaForm,
                        dataFim: e.target.value,
                      })
                    }
                    className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Descrição
                </label>
                <textarea
                  value={advertenciaForm.descricao}
                  onChange={(e) =>
                    setAdvertenciaForm({
                      ...advertenciaForm,
                      descricao: e.target.value,
                    })
                  }
                  placeholder="Detalhes adicionais..."
                  rows={3}
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveAdvertencia}
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700"
              >
                <Save size={16} className="inline mr-2" /> SALVAR
              </button>
              <button
                onClick={() => setAdvertenciaModalOpen(false)}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600"
              >
                <X size={16} className="inline mr-2" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- PÁGINA LOGIN ---
const Login = () => (
  <div className="h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/30 p-8 rounded-2xl text-center max-w-sm w-full">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4">
        <Shield size={28} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold mb-2">FORÇA TÁTICA</h1>
      <p className="text-gray-400 text-sm mb-6 font-semibold">
        Painel de Acesso Operacional
      </p>
      <button
        onClick={() => signInWithPopup(auth, googleProvider)}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-bold transition shadow-lg"
      >
        LOGAR COM GOOGLE
      </button>
    </div>
  </div>
);

// --- APP PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Verificar se é admin
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsAdmin(userData.role === 'admin');
        } else {
          // Criar novo usuário como não-admin por padrão
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
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
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
      <Routes>
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
}
