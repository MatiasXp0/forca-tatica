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
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Car, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import {
  upsertDiscordMessage,
  deleteDiscordMessage,
} from '../utils/discordManager';

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

  // Buscar viaturas em tempo real
  useEffect(() => {
    const q = query(collection(db, 'viaturas'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setViaturas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  // ESC para fechar modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingViatura(null);
    setFormData({
      nome: '',
      modelo: '',
      velocidadeMax: '',
      descricao: '',
      fotoURL: '',
    });
  };

  // ========== SALVAR (CRIAR/EDITAR) ==========
  const handleSave = async () => {
    if (!formData.nome || !formData.modelo) {
      alert('Preencha pelo menos nome e modelo!');
      return;
    }

    const viaturaData = {
      ...formData,
      velocidadeMax: formData.velocidadeMax ? Number(formData.velocidadeMax) : null,
      createdAt: editingViatura ? editingViatura.createdAt : new Date(),
      updatedAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
    };

    try {
      if (editingViatura) {
        // ✅ EDIÇÃO: Atualiza Firebase E Discord (edita mensagem existente)
        await updateDoc(doc(db, 'viaturas', editingViatura.id), viaturaData);

        // Atualiza a mensagem no Discord (se existir)
        if (editingViatura.discordMessageId) {
          await upsertDiscordMessage('viaturas', editingViatura.id, {
            ...viaturaData,
            id: editingViatura.id,
            discordMessageId: editingViatura.discordMessageId,
          });
        }

        console.log(`✏️ Viatura atualizada: ${viaturaData.nome}`);
      } else {
        // ✅ CRIAÇÃO: Firebase + Discord
        const docRef = await addDoc(collection(db, 'viaturas'), viaturaData);

        const discordMessageId = await upsertDiscordMessage('viaturas', docRef.id, {
          ...viaturaData,
          id: docRef.id,
        });

        if (discordMessageId) {
          await updateDoc(doc(db, 'viaturas', docRef.id), {
            discordMessageId: discordMessageId,
          });
          console.log(`✅ Viatura criada e publicada no Discord: ${viaturaData.nome}`);
        }
      }

      closeModal();
    } catch (error) {
      console.error('Erro ao salvar viatura:', error);
      alert('Erro ao salvar viatura. Tente novamente.');
    }
  };

  // ========== EDITAR ==========
  const handleEdit = (viatura) => {
    setEditingViatura(viatura);
    setFormData({
      nome: viatura.nome,
      modelo: viatura.modelo,
      velocidadeMax: viatura.velocidadeMax?.toString() || '',
      descricao: viatura.descricao || '',
      fotoURL: viatura.fotoURL || '',
    });
    setModalOpen(true);
  };

  // ========== EXCLUIR ==========
  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta viatura?')) {
      try {
        const viaturaDoc = await getDoc(doc(db, 'viaturas', id));
        const viaturaData = viaturaDoc.data();
        if (!viaturaData) throw new Error('Viatura não encontrada');

        // ✅ REMOVER DO DISCORD
        if (viaturaData?.discordMessageId) {
          await deleteDiscordMessage('viaturas', {
            ...viaturaData,
            id,
            discordMessageId: viaturaData.discordMessageId,
          });
          console.log(`🗑️ Viatura removida do Discord: ${viaturaData.nome}`);
        }

        // ✅ REMOVER DO FIREBASE
        await deleteDoc(doc(db, 'viaturas', id));
      } catch (error) {
        console.error('Erro ao excluir viatura:', error);
        alert('Erro ao excluir viatura. Tente novamente.');
      }
    }
  };

  // ========== MODAL ==========
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
            {/* Nome */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Nome da Viatura *
              </label>
              <input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: ROTA-01"
                className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Modelo *
              </label>
              <input
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                placeholder="Ex: Toyota Hilux 4x4"
                className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Velocidade Máxima */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Velocidade Máxima (km/h)
              </label>
              <input
                type="number"
                value={formData.velocidadeMax}
                onChange={(e) => setFormData({ ...formData, velocidadeMax: e.target.value })}
                placeholder="Ex: 180"
                className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* URL da Foto */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                URL da Foto (opcional)
              </label>
              <input
                value={formData.fotoURL}
                onChange={(e) => setFormData({ ...formData, fotoURL: e.target.value })}
                placeholder="https://exemplo.com/foto-viatura.jpg"
                className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              />
              {formData.fotoURL && (
                <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border-2 border-blue-500/30">
                  <img
                    src={formData.fotoURL}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.src =
                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIGZpbGw9IiMxRjJBM0MiLz48cGF0aCBkPSJNNDggNDhMMzIgNjRMMTYgNDhMMzIgMzJMNDggNDhaIiBmaWxsPSIjM0I4MkVGIi8+PC9zdmc+';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Descrição
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
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
              <Save size={16} className="inline mr-2" />
              {editingViatura ? 'ATUALIZAR' : 'PUBLICAR'}
            </button>
            <button
              onClick={closeModal}
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
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Car size={20} className="text-blue-400" />
          Viaturas Operacionais
        </h2>
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
        {viaturas.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
            <Car size={48} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400">Nenhuma viatura cadastrada</p>
            {isAdmin && (
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                + Cadastrar primeira viatura
              </button>
            )}
          </div>
        ) : (
          viaturas.map((vtr) => (
            <div
              key={vtr.id}
              className="bg-gray-800/50 border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-500/40 transition group fade-in"
            >
              {/* Imagem */}
              <div className="h-48 overflow-hidden bg-gray-900">
                {vtr.fotoURL ? (
                  <img
                    src={vtr.fotoURL}
                    alt={vtr.nome}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-gray-900">
                    <Car size={64} className="text-blue-500/50" />
                  </div>
                )}
              </div>

              {/* Informações */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-blue-300">{vtr.nome}</h3>
                    <p className="text-gray-300 text-sm">Modelo: {vtr.modelo}</p>
                    {vtr.velocidadeMax && (
                      <p className="text-gray-400 text-sm mt-1">
                        <span className="font-semibold">Velocidade Máx:</span> {vtr.velocidadeMax} km/h
                      </p>
                    )}

                    {vtr.discordMessageId && (
                      <p className="text-xs text-gray-500 mt-1">
                        🟢 Discord ID: {vtr.discordMessageId.substring(0, 8)}...
                      </p>
                    )}

                    {/* 🔗 LINK DIRETO */}
                    <a
                      href={`https://forca-tatica.vercel.app/viaturas?id=${vtr.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition border border-blue-500/40 font-medium"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      🔗 LINK DIRETO PARA ESTA VIATURA
                    </a>
                  </div>
                </div>

                {vtr.descricao && (
                  <div className="mb-3 mt-2">
                    <p className="text-gray-400 text-sm">
                      <span className="font-semibold">Descrição:</span> {vtr.descricao}
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2 border-t border-gray-700 pt-3 mt-3">
                    <button
                      onClick={() => handleEdit(vtr)}
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(vtr.id)}
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-500 border-t border-gray-700/50 pt-2">
                  ID: {vtr.id.slice(-6)}
                  {vtr.updatedAt && (
                    <span className="ml-2">
                      • Atualizado:{' '}
                      {new Date(vtr.updatedAt?.seconds * 1000 || vtr.updatedAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {renderModal()}
    </div>
  );
};

export default Viaturas;