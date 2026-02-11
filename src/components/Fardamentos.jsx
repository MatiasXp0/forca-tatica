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
import { Shirt, Plus, Edit, Trash2, ChevronRight, Save, X } from 'lucide-react';
import { getFardaColor } from './utils/fardaColors';
import '../styles/fardamentos.css';
import {
  upsertDiscordMessage,
  deleteDiscordMessage,
} from '../utils/discordManager';

// Componente para exibir a foto (responsivo)
const FardaImage = ({ farda, size = 'medium' }) => {
  const colors = getFardaColor(farda.nome);

  const sizeClasses = {
    small: 'w-20 h-20 sm:w-24 sm:h-24',
    medium: 'w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40',
    large: 'w-36 h-36 sm:w-44 sm:h-44 md:w-56 md:h-56',
  };

  return (
    <div
      className={`${sizeClasses[size]} flex-shrink-0 rounded-xl bg-transparent flex items-center justify-center relative`}
    >
      {farda.fotoURL ? (
        <img
          src={farda.fotoURL}
          alt={farda.nome}
          className="w-full h-full object-contain rounded-xl transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            e.target.style.display = 'none';
            const parent = e.target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-gray-800/50 rounded-xl">
                  <div class="text-center">
                    <svg class="w-8 h-8 sm:w-10 sm:h-10 text-white/60 mx-auto" ...></svg>
                    <div class="text-white/50 text-xs sm:text-sm mt-1 font-semibold">${farda.nome.split(' ')[0]}</div>
                  </div>
                </div>
              `;
            }
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800/30 rounded-xl">
          <div className="text-center">
            <Shirt size={size === 'large' ? 52 : size === 'medium' ? 36 : 28} className="text-white/60 mx-auto" />
            <div className="text-white/50 text-xs sm:text-sm mt-1 font-semibold">
              {farda.nome.split(' ')[0]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Fardamentos = ({ isAdmin }) => {
  const [fardamentos, setFardamentos] = useState([]);
  const [selectedFarda, setSelectedFarda] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingFarda, setEditingFarda] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    fotoURL: '',
    pecas: [{ tipo: '', numero: '', textura: '', descricao: '' }],
  });

  // Buscar fardamentos em tempo real
  useEffect(() => {
    const q = query(
      collection(db, 'fardamentos'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setFardamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Fechar modal com ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setModalOpen(false);
        setEditingFarda(null);
        setFormData({
          nome: '',
          descricao: '',
          fotoURL: '',
          pecas: [{ tipo: '', numero: '', textura: '', descricao: '' }],
        });
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  // ========== SALVAR (CRIAÇÃO/EDIÇÃO) ==========
  const handleSaveFarda = async () => {
    if (!formData.nome) {
      alert('Preencha o nome do fardamento!');
      return;
    }

    const pecasFiltradas = formData.pecas
      .filter((p) => p.tipo.trim() !== '' && p.numero.trim() !== '')
      .map((p) => ({
        ...p,
        tipo: p.tipo.trim(),
        numero: p.numero.trim(),
        textura: p.textura.trim(),
        descricao: p.descricao.trim(),
      }));

    if (pecasFiltradas.length === 0) {
      alert('Adicione pelo menos uma peça válida (com tipo e número)!');
      return;
    }

    const fardaData = {
      ...formData,
      pecas: pecasFiltradas,
      createdAt: editingFarda ? editingFarda.createdAt : new Date(),
      updatedAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
    };

    try {
      let discordMessageId = null;

      if (editingFarda) {
        // EDIÇÃO: só Firebase
        await updateDoc(doc(db, 'fardamentos', editingFarda.id), fardaData);
      } else {
        // CRIAÇÃO: Firebase + Discord
        const docRef = await addDoc(collection(db, 'fardamentos'), fardaData);
        discordMessageId = await upsertDiscordMessage('fardamentos', docRef.id, {
          ...fardaData,
          id: docRef.id,
        });
        if (discordMessageId) {
          await updateDoc(doc(db, 'fardamentos', docRef.id), {
            discordMessageId,
          });
        }
      }

      // Fechar modal e resetar form
      setModalOpen(false);
      setEditingFarda(null);
      setFormData({
        nome: '',
        descricao: '',
        fotoURL: '',
        pecas: [{ tipo: '', numero: '', textura: '', descricao: '' }],
      });

      console.log(`✅ Fardamento ${editingFarda ? 'atualizado' : 'criado'}: ${fardaData.nome}`);
    } catch (error) {
      console.error('Erro ao salvar fardamento:', error);
      alert('Erro ao salvar fardamento. Tente novamente.');
    }
  };

  // ========== DELETAR ==========
  const handleDeleteFarda = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este fardamento?')) {
      try {
        const fardaDoc = await getDoc(doc(db, 'fardamentos', id));
        const fardaData = fardaDoc.data();
        if (!fardaData) throw new Error('Fardamento não encontrado');

        // Remover do Discord
        if (fardaData?.discordMessageId) {
          await deleteDiscordMessage('fardamentos', {
            ...fardaData,
            id,
            discordMessageId: fardaData.discordMessageId,
          });
        }

        // Remover do Firebase
        await deleteDoc(doc(db, 'fardamentos', id));

        setFardamentos((prev) => prev.filter((f) => f.id !== id));
        if (selectedFarda?.id === id) setSelectedFarda(null);

        console.log(`🗑️ Fardamento removido: ${fardaData?.nome}`);
      } catch (error) {
        console.error('Erro ao excluir fardamento:', error);
        alert('Erro ao excluir fardamento. Tente novamente.');
      }
    }
  };

  // ========== EDITAR ==========
  const handleEditFarda = (farda) => {
    setEditingFarda(farda);
    let pecasFormatadas = [];

    if (farda.pecas && farda.pecas.length > 0) {
      if (typeof farda.pecas[0] === 'object') {
        pecasFormatadas = farda.pecas;
      } else {
        pecasFormatadas = farda.pecas.map((pecaStr) => {
          const parts = pecaStr.split('|').map((p) => p.trim());
          const tipoNumero = parts[0] || '';
          let tipo = 'outro';
          let numero = '';
          let textura = '';
          let descricao = parts.slice(1).join(' | ') || '';

          if (
            tipoNumero.toLowerCase().includes('máscara') ||
            tipoNumero.toLowerCase().includes('mascara')
          ) {
            tipo = 'mascara';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('jaqueta')) {
            tipo = 'jaqueta';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('camisa')) {
            tipo = 'camisa';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (
            tipoNumero.toLowerCase().includes('calça') ||
            tipoNumero.toLowerCase().includes('calca')
          ) {
            tipo = 'calca';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('colete')) {
            tipo = 'colete';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('chapeu')) {
            tipo = 'chapeu';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('maos')) {
            tipo = 'maos';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('sapatos')) {
            tipo = 'sapatos';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('adesivos')) {
            tipo = 'adesivos';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('mochila')) {
            tipo = 'mochila';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('acessorios')) {
            tipo = 'acessorios';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else {
            tipo = 'outro';
            numero = tipoNumero;
          }

          const texturaMatch =
            pecaStr.match(/txt\s*(\d+)/i) || pecaStr.match(/textura\s*(\d+)/i);
          if (texturaMatch) {
            textura = texturaMatch[1];
          }

          return { tipo, numero, textura, descricao };
        });
      }
    }

    setFormData({
      nome: farda.nome,
      descricao: farda.descricao || '',
      fotoURL: farda.fotoURL || '',
      pecas: pecasFormatadas.length > 0
        ? pecasFormatadas
        : [{ tipo: '', numero: '', textura: '', descricao: '' }],
    });
    setModalOpen(true);
  };

  // ========== SELECIONAR FARDAMENTO ==========
  const handleViewFarda = (farda) => {
    setSelectedFarda(farda);
  };

  return (
    <div className="fade-in w-full max-w-full overflow-x-hidden">
      {/* Cabeçalho responsivo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
            <Shirt size={24} className="sm:w-7 sm:h-7 text-blue-400" />
            Fardamentos Operacionais
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Catálogo completo de uniformes da Força Tática PMESP
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-lg shadow-blue-500/20 text-sm sm:text-base"
          >
            <Plus size={18} /> Novo Fardamento
          </button>
        )}
      </div>

      {/* Layout principal: empilha no mobile, lado a lado no desktop */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">

        {/* Catálogo de Fardamentos - Lado Esquerdo */}
        <div className="w-full lg:w-7/12">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-blue-500/20 rounded-xl p-4 sm:p-6 lg:p-8 flex flex-col w-full">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M9 12h6" />
                    <path d="M12 9v6" />
                  </svg>
                </div>
                <span className="text-white">Catálogo de Fardamentos</span>
              </h3>
            </div>

            {/* Lista de fardamentos */}
            <div className="flex-1 overflow-hidden">
              {fardamentos.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center">
                    <Shirt size={32} className="sm:w-10 sm:h-10 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-base sm:text-lg">Nenhum fardamento cadastrado</p>
                  {isAdmin && (
                    <p className="text-xs sm:text-sm text-gray-500 mt-2">
                      Clique em "Novo Fardamento" para adicionar o primeiro
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6 max-h-[calc(100vh-300px)] lg:max-h-[calc(100vh-200px)] overflow-y-auto pr-2 sm:pr-4">
                  {fardamentos.map((farda) => {
                    const colors = getFardaColor(farda.nome);
                    return (
                      <div
                        key={farda.id}
                        className={`flex items-start sm:items-center p-4 sm:p-6 rounded-xl cursor-pointer transition-all duration-300 ${
                          selectedFarda?.id === farda.id
                            ? `${colors.bg} border-2 ${colors.borderStrong} shadow-lg shadow-blue-500/10`
                            : 'bg-gray-900/30 hover:bg-gray-800/50 border border-gray-700/30'
                        } group hover:border-blue-500/30`}
                        onClick={() => handleViewFarda(farda)}
                      >
                        <div className="flex-shrink-0 mr-3 sm:mr-6">
                          <FardaImage farda={farda} size="medium" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="font-bold text-base sm:text-lg text-white group-hover:text-blue-300 transition-colors truncate">
                                  {farda.nome}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs ${colors.badge} border ${colors.border}`}
                                >
                                  {farda.pecas?.length || 0} peças
                                </span>
                              </div>

                              {farda.descricao && (
                                <p className="text-xs sm:text-sm text-gray-400 mb-2 line-clamp-2">
                                  {farda.descricao}
                                </p>
                              )}

                              {farda.pecas && farda.pecas.length > 0 && (
                                <div className="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
                                  {farda.pecas.slice(0, 3).map((peca, idx) => {
                                    let displayText = '';
                                    if (typeof peca === 'string') {
                                      displayText = peca.length > 10 ? peca.substring(0, 10) + '...' : peca;
                                    } else {
                                      displayText = `${peca.tipo?.toUpperCase() || ''} ${peca.numero || ''}`.trim();
                                      if (displayText.length > 10) displayText = displayText.substring(0, 10) + '...';
                                    }
                                    return (
                                      <span
                                        key={idx}
                                        className="text-xs px-2 py-0.5 sm:px-3 sm:py-1 bg-gray-800/50 rounded-full text-gray-300 border border-gray-700/50"
                                      >
                                        {displayText}
                                      </span>
                                    );
                                  })}
                                  {farda.pecas.length > 3 && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-800/50 rounded-lg text-gray-500">
                                      +{farda.pecas.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-start">
                              <div className="text-right hidden sm:block">
                                <div className="text-xs text-gray-500">Criado em</div>
                                <div className="text-sm text-gray-400">
                                  {farda.createdAt?.toDate
                                    ? new Date(farda.createdAt.toDate()).toLocaleDateString('pt-BR')
                                    : farda.createdAt
                                    ? new Date(farda.createdAt).toLocaleDateString('pt-BR')
                                    : 'N/A'}
                                </div>
                              </div>
                              <ChevronRight size={18} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Composição do Fardamento - Lado Direito */}
        <div className="w-full lg:w-5/12">
          <div className="bg-gradient-to-b from-gray-800/50 to-gray-900/30 border border-blue-500/20 rounded-xl p-4 sm:p-6 lg:p-8 flex flex-col w-full min-h-[400px] lg:min-h-[650px]">
            {selectedFarda ? (
              <>
                <div className="text-center mb-4 sm:mb-6">
                  <div className="relative mx-auto mb-3 sm:mb-4">
                    <FardaImage farda={selectedFarda} size="large" />
                    <div
                      className={`absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-xs font-bold ${
                        getFardaColor(selectedFarda.nome).badge
                      } border ${getFardaColor(selectedFarda.nome).border}`}
                    >
                      {selectedFarda.pecas?.length || 0} ITENS
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{selectedFarda.nome}</h3>
                  {selectedFarda.descricao && (
                    <div className="bg-gray-900/40 rounded-lg p-2 sm:p-3 mb-3">
                      <p className="text-xs sm:text-sm text-gray-300">{selectedFarda.descricao}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div className="bg-gray-900/30 rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-lg sm:text-xl font-bold text-blue-400">
                      {selectedFarda.pecas?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Peças</div>
                  </div>
                  <div className="bg-gray-900/30 rounded-lg p-2 sm:p-3 text-center">
                    <div className="text-lg sm:text-xl font-bold text-green-400">
                      {selectedFarda.createdAt?.toDate
                        ? new Date(selectedFarda.createdAt.toDate()).toLocaleDateString('pt-BR')
                        : selectedFarda.createdAt
                        ? new Date(selectedFarda.createdAt).toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Cadastro</div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <h4 className="font-semibold text-gray-300 mb-3 flex items-center gap-2 text-base sm:text-lg border-b border-gray-700 pb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5 text-blue-400"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M16 13H8" />
                      <path d="M16 17H8" />
                      <path d="M10 9H8" />
                    </svg>
                    COMPOSIÇÃO
                  </h4>
                  <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3 sm:space-y-4">
                    {selectedFarda.pecas && selectedFarda.pecas.length > 0 ? (
                      selectedFarda.pecas.map((peca, index) => {
                        if (typeof peca === 'string') {
                          const partes = peca.split('|').map((p) => p.trim());
                          const nomePeca = partes[0] || '';
                          const detalhes = partes.slice(1).join(' | ');
                          return (
                            <div
                              key={index}
                              className="bg-gray-900/40 rounded-lg p-3 sm:p-4 hover:bg-gray-800/60 transition-all border border-gray-700/30 hover:border-blue-500/30"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <div
                                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${
                                    getFardaColor(selectedFarda.nome).bg
                                  } border ${getFardaColor(selectedFarda.nome).border} flex items-center justify-center flex-shrink-0`}
                                >
                                  <span className="text-sm sm:text-base font-bold text-white">{index + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-semibold text-white text-sm sm:text-base">{nomePeca}</h5>
                                </div>
                              </div>
                              {detalhes && (
                                <div className="pl-11 sm:pl-14">
                                  <div className="text-xs sm:text-sm text-gray-300 bg-gray-800/50 rounded-lg p-2 sm:p-3 border-l-2 border-blue-500/50">
                                    {detalhes.split('|').map((item, i) => (
                                      <div key={i} className="mb-1 last:mb-0">{item.trim()}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          const tipoFormatado = peca.tipo ? peca.tipo.toUpperCase() : '';
                          const numero = peca.numero || '';
                          const textura = peca.textura ? ` | TXT ${peca.textura}` : '';
                          const descricao = peca.descricao || '';
                          return (
                            <div
                              key={index}
                              className="bg-gray-900/40 rounded-lg p-3 sm:p-4 hover:bg-gray-800/60 transition-all border border-gray-700/30 hover:border-blue-500/30"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <div
                                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${
                                    getFardaColor(selectedFarda.nome).bg
                                  } border ${getFardaColor(selectedFarda.nome).border} flex items-center justify-center flex-shrink-0`}
                                >
                                  <span className="text-sm sm:text-base font-bold text-white">{index + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-semibold text-white text-sm sm:text-base">
                                    {tipoFormatado} {numero}
                                    {textura}
                                  </h5>
                                </div>
                              </div>
                              {descricao && (
                                <div className="pl-11 sm:pl-14">
                                  <div className="text-xs sm:text-sm text-gray-300 bg-gray-800/50 rounded-lg p-2 sm:p-3 border-l-2 border-blue-500/50">
                                    {descricao}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                      })
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-lg">
                        <Shirt size={40} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-gray-400 text-sm">Nenhuma peça cadastrada</p>
                        {isAdmin && (
                          <p className="text-xs text-gray-500 mt-1">Edite para adicionar peças</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 sm:gap-3 pt-4 border-t border-gray-700 mt-4">
                    <button
                      onClick={() => handleEditFarda(selectedFarda)}
                      className="flex-1 bg-gradient-to-r from-yellow-600/20 to-yellow-700/10 hover:from-yellow-600/30 hover:to-yellow-700/20 text-yellow-400 py-2 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-yellow-500/30 hover:border-yellow-500/50 text-sm sm:text-base"
                    >
                      <Edit size={16} /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteFarda(selectedFarda.id)}
                      className="flex-1 bg-gradient-to-r from-red-600/20 to-red-700/10 hover:from-red-600/30 hover:to-red-700/20 text-red-400 py-2 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-red-500/30 hover:border-red-500/50 text-sm sm:text-base"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center">
                  <Shirt size={32} className="sm:w-10 sm:h-10 text-gray-600" />
                </div>
                <p className="text-gray-400 text-base sm:text-lg">Selecione um fardamento</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  Clique em um item da lista para ver os detalhes completos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== MODAL NOVO/EDITAR FARDAMENTO ========== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 modal-overlay">
          <div className="bg-gray-800 border border-blue-500/30 p-4 sm:p-6 lg:p-8 rounded-xl w-full max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1400px] max-h-[90vh] overflow-y-auto modal-fardamento-grande fade-in">
            <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Shirt size={22} className="sm:w-6 sm:h-6" />
              {editingFarda ? 'Editar Fardamento' : 'Novo Fardamento'}
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              {/* COLUNA ESQUERDA - INFORMAÇÕES GERAIS */}
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-sm sm:text-base text-gray-300 mb-1 sm:mb-2 font-medium">
                    Nome do Fardamento *
                  </label>
                  <input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Fardamento Tático B4"
                    className="w-full bg-gray-900 border-2 border-blue-500/30 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white text-sm sm:text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm sm:text-base text-gray-300 mb-1 sm:mb-2 font-medium">
                    Descrição
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Ex: Uso em operações especiais, composto por..."
                    rows={3}
                    className="w-full bg-gray-900 border-2 border-blue-500/30 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white text-sm sm:text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm sm:text-base text-gray-300 mb-1 sm:mb-2 font-medium">
                    URL da Foto (opcional)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <input
                      value={formData.fotoURL}
                      onChange={(e) => setFormData({ ...formData, fotoURL: e.target.value })}
                      placeholder="https://exemplo.com/foto.jpg"
                      className="flex-1 bg-gray-900 border-2 border-blue-500/30 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white text-sm sm:text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-colors"
                    />
                    {formData.fotoURL && (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-blue-500/30 bg-gray-900/50 flex-shrink-0 mx-auto sm:mx-0">
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
                </div>
              </div>

              {/* COLUNA DIREITA - PEÇAS DO FARDAMENTO */}
              <div>
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <label className="block text-sm sm:text-base text-gray-300 font-semibold">
                    Peças do Fardamento
                  </label>
                  <button
                    onClick={() =>
                      setFormData({
                        ...formData,
                        pecas: [
                          ...formData.pecas,
                          { tipo: '', numero: '', textura: '', descricao: '' },
                        ],
                      })
                    }
                    className="text-xs sm:text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 transition hover:scale-105"
                  >
                    <Plus size={16} /> Nova Peça
                  </button>
                </div>

                <div className="space-y-3 sm:space-y-4 max-h-60 sm:max-h-80 overflow-y-auto p-3 sm:p-4 border-2 border-gray-700/30 rounded-xl">
                  {formData.pecas.map((peca, index) => (
                    <div
                      key={index}
                      className="bg-gray-900/50 p-4 sm:p-5 rounded-lg border border-gray-700/50 space-y-3 sm:space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm sm:text-base text-gray-200 font-medium">
                          Peça #{index + 1}
                        </span>
                        <button
                          onClick={() => {
                            const newPecas = formData.pecas.filter((_, i) => i !== index);
                            setFormData({ ...formData, pecas: newPecas });
                          }}
                          className="text-xs sm:text-sm text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition"
                          disabled={formData.pecas.length <= 1}
                        >
                          <X size={14} /> Remover
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm text-gray-300 mb-1 font-medium">
                            Tipo *
                          </label>
                          <select
                            value={peca.tipo}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = { ...peca, tipo: e.target.value };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-lg p-2 sm:p-3 text-white text-sm outline-none focus:border-blue-500"
                          >
                            <option value="">Selecione o tipo</option>
                            <option value="chapeu">Chapéu</option>
                            <option value="mascara">Máscara</option>
                            <option value="camisa">Camisa</option>
                            <option value="jaqueta">Jaqueta</option>
                            <option value="maos">Mãos</option>
                            <option value="colete">Colete</option>
                            <option value="calca">Calça</option>
                            <option value="sapatos">Sapatos</option>
                            <option value="adesivos">Adesivos</option>
                            <option value="acessorios">Acessórios</option>
                            <option value="mochila">Mochila</option>
                            <option value="outro">Outro</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs sm:text-sm text-gray-300 mb-1 font-medium">
                            Número *
                          </label>
                          <input
                            type="text"
                            value={peca.numero}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = { ...peca, numero: e.target.value };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            placeholder="Ex: 546, 272, 15"
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-lg p-2 sm:p-3 text-white text-sm outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs sm:text-sm text-gray-300 mb-1 font-medium">
                            Textura <span className="text-gray-400">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={peca.textura}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = { ...peca, textura: e.target.value };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            placeholder="Ex: 5, 0, 1"
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-lg p-2 sm:p-3 text-white text-sm outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs sm:text-sm text-gray-300 mb-1 font-medium">
                            Descrição <span className="text-gray-400">(opcional)</span>
                          </label>
                          <textarea
                            value={peca.descricao}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = { ...peca, descricao: e.target.value };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            placeholder="Ex: Oficiais usam essa, Uso em treinamentos, etc."
                            rows={2}
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-lg p-2 sm:p-3 text-white text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {peca.tipo && (
                        <div className="pt-2 border-t border-gray-700/50">
                          <span className="text-xs text-gray-300 font-semibold">Preview: </span>
                          <span className="text-xs text-gray-100">
                            {peca.tipo.toUpperCase()} {peca.numero}
                            {peca.textura && ` | TXT ${peca.textura}`}
                            {peca.descricao && ` (${peca.descricao})`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">* Campos obrigatórios: Tipo e Número</p>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 mt-6 sm:mt-8">
              <button
                onClick={handleSaveFarda}
                className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 py-3 sm:py-4 rounded-lg font-semibold text-white hover:scale-[1.02] transition-transform text-base sm:text-lg"
              >
                <Save size={18} className="inline mr-2 sm:mr-3" /> SALVAR
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingFarda(null);
                  setFormData({
                    nome: '',
                    descricao: '',
                    fotoURL: '',
                    pecas: [{ tipo: '', numero: '', textura: '', descricao: '' }],
                  });
                }}
                className="w-full sm:flex-1 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 py-3 sm:py-4 rounded-lg font-bold text-gray-200 hover:scale-[1.02] transition-all"
              >
                <X size={18} className="inline mr-2 sm:mr-3" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fardamentos;