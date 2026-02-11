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
import {
  Users,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Save,
  X,
  User,
  Award,
  AlertCircle,
  Calendar,
  Contact,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getAdvertenciaColor } from './utils/fardaColors';
import {
  upsertDiscordMessage,
  deleteDiscordMessage,
  sendDiscordLog,
} from '../utils/discordBotSystem';

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

  const ordemPatentes = [
    'Tenente Coronel',
    'Major',
    'Capitão',
    '1° Tenente',
    '2° Tenente',
    'Aspirante a Oficial ',
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
      membrosData.sort(
        (a, b) =>
          ordemPatentes.indexOf(a.patente) - ordemPatentes.indexOf(b.patente)
      );
      setMembros(membrosData);
    });
  }, []);

  // ESC para fechar modais (membro e advertência)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          setModalOpen(false);
          setEditingMembro(null);
          setFormData({
            nome: '',
            patente: 'Tenente Coronel',
            fotoURL: '',
            ativo: true,
            observacoes: '',
          });
        }
        if (isAdvertenciaModalOpen) {
          setAdvertenciaModalOpen(false);
          setAdvertenciaForm({
            tipo: 'ausencia',
            motivo: '',
            dataInicio: new Date().toISOString().split('T')[0],
            dataFim: '',
            descricao: '',
          });
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, isAdvertenciaModalOpen]);

  const handleDeleteMembro = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este membro?')) {
      try {
        // Buscar dados antes de deletar
        const membroDoc = await getDoc(doc(db, 'hierarquia', id));
        const membroData = membroDoc.data();

        if (!membroData) {
          throw new Error('Membro não encontrado');
        }

        // 🔄 Remover do Discord primeiro
        if (membroData?.discordMessageId) {
          const deleted = await deleteDiscordMessage('hierarquia', {
            ...membroData,
            id: id,
            discordMessageId: membroData.discordMessageId,
          });

          if (!deleted) {
            console.warn('Não foi possível remover a mensagem do Discord');
          }
        }

        // Depois deletar do Firebase
        await deleteDoc(doc(db, 'hierarquia', id));

        // Atualizar estado local
        setMembros((prev) => prev.filter((m) => m.id !== id));
        if (selectedMembro?.id === id) {
          setSelectedMembro(null);
        }

        // Log de remoção
        await sendDiscordLog(
          `🗑️ Membro removido: **${membroData?.nome || 'Desconhecido'}** (${
            membroData?.patente
          })`,
          'warning'
        );
      } catch (error) {
        console.error('Erro ao excluir membro:', error);
        alert('Erro ao excluir membro. Tente novamente.');
        await sendDiscordLog(
          `❌ Erro ao excluir membro: ${error.message}`,
          'error'
        );
      }
    }
  };

  const handleSaveMembro = async () => {
    if (!formData.nome || !formData.patente) {
      alert('Preencha nome e patente!');
      return;
    }

    const membroData = {
      ...formData,
      advertências: editingMembro?.advertências || [],
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
    };

    try {
      let discordMessageId = null;

      if (editingMembro) {
        // Atualizar membro existente
        await updateDoc(doc(db, 'hierarquia', editingMembro.id), membroData);

        // 🔄 Sincronizar com Discord
        discordMessageId = await upsertDiscordMessage(
          'hierarquia',
          editingMembro.id,
          {
            ...membroData,
            id: editingMembro.id,
            discordMessageId: editingMembro.discordMessageId, // Mantém o ID existente
          }
        );
      } else {
        // Criar novo membro
        const result = await addDoc(collection(db, 'hierarquia'), membroData);

        // 🔄 Sincronizar com Discord primeiro
        discordMessageId = await upsertDiscordMessage('hierarquia', result.id, {
          ...membroData,
          id: result.id,
        });

        // Atualizar no Firebase com o discordMessageId
        if (discordMessageId) {
          await updateDoc(doc(db, 'hierarquia', result.id), {
            discordMessageId: discordMessageId,
          });
        }
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

      // Log de sucesso
      await sendDiscordLog(
        `${
          editingMembro ? '📝 Membro atualizado' : '👤 Novo membro adicionado'
        }: **${membroData.nome}** (${membroData.patente})`,
        'success'
      );
    } catch (error) {
      console.error('Erro ao salvar membro:', error);
      alert('Erro ao salvar membro. Tente novamente.');
      await sendDiscordLog(
        `❌ Erro ao salvar membro: ${error.message}`,
        'error'
      );
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
      alert('Erro ao salvar advertência. Tente novamente.');
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

  const handleViewMembro = (membro) => {
    setSelectedMembro(membro);
  };

  const handleDeleteAdvertencia = async (advertenciaId) => {
    if (!selectedMembro) return;

    if (window.confirm('Tem certeza que deseja excluir esta advertência?')) {
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
        alert('Erro ao excluir advertência. Tente novamente.');
      }
    }
  };

  const getPatenteColor = () => {
    return 'text-white';
  };

  return (
    <div className="fade-in">
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

      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        style={{ gap: '32px' }}
      >
        {/* Lista de Membros */}
        <div className="lg:col-span-2">
          <div
            className="bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-blue-500/20 rounded-xl p-6 h-full"
            style={{ minHeight: '500px' }}
          >
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
                    className="border-b border-gray-700 pb-4 last:border-0 fade-in"
                  >
                    <h4 className={`font-semibold mb-2 ${getPatenteColor()}`}>
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
          <div
            className="bg-gradient-to-b from-gray-800/50 to-gray-900/30 border border-blue-500/20 rounded-xl p-6 h-full"
            style={{ minHeight: '500px' }}
          >
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
                    <p className={`font-semibold ${getPatenteColor()}`}>
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
                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
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
                          )} fade-in`}
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
                                className="text-red-400 hover:text-red-300 transition"
                                title="Excluir"
                                type="button"
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
                    <div className="bg-gray-900/50 p-6 rounded-xl border-2 border-gray-700/50">
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
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Alterar status de ${selectedMembro.nome}?`
                          )
                        ) {
                          updateDoc(doc(db, 'hierarquia', selectedMembro.id), {
                            ativo: !selectedMembro.ativo,
                          })
                            .then(() => {
                              setSelectedMembro({
                                ...selectedMembro,
                                ativo: !selectedMembro.ativo,
                              });
                            })
                            .catch((error) => {
                              console.error('Erro ao alterar status:', error);
                              alert('Erro ao alterar status. Tente novamente.');
                            });
                        }
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1 transition"
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
                      className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-in">
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
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700 transition"
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
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
              >
                <X size={16} className="inline mr-2" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Advertência */}
      {isAdvertenciaModalOpen && selectedMembro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-in">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700 transition"
                disabled={advertenciaSubmitting}
              >
                <Save size={16} className="inline mr-2" /> SALVAR
              </button>
              <button
                onClick={() => setAdvertenciaModalOpen(false)}
                className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
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

export default Hierarquia;
