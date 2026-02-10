import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Car, Plus, Edit, Trash2, Save, X } from 'lucide-react';

export const Viaturas = ({ isAdmin }) => {
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
    const unsubscribe = onSnapshot(q, (snap) => {
      setViaturas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
  const handleEsc = (e) => {
    if (e.key === 'Escape' && isModalOpen) {
      setModalOpen(false);
      setEditingViatura(null);
      setFormData({
        nome: '',
        modelo: '',
        velocidadeMax: '',
        descricao: '',
        fotoURL: '',
      });
    }
  };

  window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, [isModalOpen]);

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
      alert('Erro ao salvar viatura. Tente novamente.');
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
    if (window.confirm('Tem certeza que deseja excluir esta viatura?')) {
      try {
        await deleteDoc(doc(db, 'viaturas', id));
      } catch (error) {
        console.error('Erro ao excluir viatura:', error);
        alert('Erro ao excluir viatura. Tente novamente.');
      }
    }
  };

  const renderModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay">
        <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Car size={20} />
            {editingViatura ? 'Editar Viatura' : 'Nova Viatura'}
          </h3>

          <div className="space-y-4">
            {['nome', 'modelo', 'velocidadeMax', 'fotoURL'].map((field) => (
              <div key={field}>
                <label className="block text-sm text-gray-400 mb-1 capitalize">
                  {field === 'fotoURL'
                    ? 'URL da Foto (opcional)'
                    : field === 'velocidadeMax'
                    ? 'Velocidade Máxima (km/h)'
                    : `${field === 'nome' ? 'Nome da' : ''} ${field} *`}
                </label>
                <input
                  value={formData[field]}
                  onChange={(e) =>
                    setFormData({ ...formData, [field]: e.target.value })
                  }
                  placeholder={
                    field === 'nome'
                      ? 'Ex: ROTA-01'
                      : field === 'modelo'
                      ? 'Ex: Toyota Hilux 4x4'
                      : field === 'velocidadeMax'
                      ? 'Ex: 180'
                      : 'https://exemplo.com/foto-viatura.jpg'
                  }
                  className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                />
                {field === 'fotoURL' && formData.fotoURL && (
                  <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-blue-500/20">
                    <img
                      src={formData.fotoURL}
                      alt="Preview"
                      className="w-full h-full object-cover image-preview"
                      onError={(e) => {
                        e.target.src =
                          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiMxRjJBM0MiLz48cGF0aCBkPSJNNDAgMzJMMzIgNDBMMjQgMzJMMzIgMjRMNDAgMzJaIiBmaWxsPSIjM0I4MkVGIi8+PC9zdmc+';
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

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
              className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700 transition"
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
              className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
            >
              <X size={16} className="inline mr-2" /> CANCELAR
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
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
            className="bg-gray-800/50 border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-500/40 transition group fade-in"
          >
            <div className="h-80 overflow-hidden bg-gray-900">
              {vtr.fotoURL ? (
                <img
                  src={vtr.fotoURL}
                  alt={vtr.nome}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 image-preview"
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
                    className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-1 rounded text-sm flex items-center justify-center gap-1 transition"
                  >
                    <Edit size={14} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(vtr.id)}
                    className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1 rounded text-sm flex items-center justify-center gap-1 transition"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {renderModal()}
    </div>
  );
};

export default Viaturas;
