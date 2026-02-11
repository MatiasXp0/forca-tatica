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
import { Shirt, Plus, Edit, Trash2, ChevronRight, Save, X, Layers, Calendar, ImageOff } from 'lucide-react';
import { getFardaColor } from './utils/fardaColors';
import '../styles/fardamentos.css';
import {
  upsertDiscordMessage,
  deleteDiscordMessage,
} from '../utils/discordManager';

// Componente de imagem com fallback elegante (corrigido)
const FardaImage = ({ farda, size = 'medium' }) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    small: 'w-16 h-16 sm:w-20 sm:h-20',
    medium: 'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32',
    large: 'w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44',
  };

  const iconSize = size === 'large' ? 44 : size === 'medium' ? 32 : 24;

  return (
    <div
      className={`${sizeClasses[size]} flex-shrink-0 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 flex items-center justify-center relative overflow-hidden border border-gray-700/50 shadow-md`}
    >
      {!imgError && farda.fotoURL ? (
        <img
          src={farda.fotoURL}
          alt={farda.nome}
          className="w-full h-full object-contain transition-transform duration-300 hover:scale-110"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff size={iconSize} className="text-gray-500" />
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

  // Buscar dados em tempo real
  useEffect(() => {
    const q = query(collection(db, 'fardamentos'), orderBy('createdAt', 'desc'));
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

  // ========== SALVAR ==========
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
        await updateDoc(doc(db, 'fardamentos', editingFarda.id), fardaData);
      } else {
        const docRef = await addDoc(collection(db, 'fardamentos'), fardaData);
        discordMessageId = await upsertDiscordMessage('fardamentos', docRef.id, {
          ...fardaData,
          id: docRef.id,
        });
        if (discordMessageId) {
          await updateDoc(doc(db, 'fardamentos', docRef.id), { discordMessageId });
        }
      }

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

        if (fardaData?.discordMessageId) {
          await deleteDiscordMessage('fardamentos', {
            ...fardaData,
            id,
            discordMessageId: fardaData.discordMessageId,
          });
        }

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

          if (tipoNumero.toLowerCase().includes('máscara') || tipoNumero.toLowerCase().includes('mascara')) {
            tipo = 'mascara';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('jaqueta')) {
            tipo = 'jaqueta';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('camisa')) {
            tipo = 'camisa';
            numero = tipoNumero.replace(/[^\d]/g, '');
          } else if (tipoNumero.toLowerCase().includes('calça') || tipoNumero.toLowerCase().includes('calca')) {
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

          const texturaMatch = pecaStr.match(/txt\s*(\d+)/i) || pecaStr.match(/textura\s*(\d+)/i);
          if (texturaMatch) textura = texturaMatch[1];

          return { tipo, numero, textura, descricao };
        });
      }
    }

    setFormData({
      nome: farda.nome,
      descricao: farda.descricao || '',
      fotoURL: farda.fotoURL || '',
      pecas: pecasFormatadas.length > 0 ? pecasFormatadas : [{ tipo: '', numero: '', textura: '', descricao: '' }],
    });
    setModalOpen(true);
  };

  // ========== SELECIONAR ==========
  const handleViewFarda = (farda) => setSelectedFarda(farda);

  return (
    <div className="fade-in w-full max-w-full overflow-x-hidden">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 lg:mb-8">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-2 lg:gap-3">
            <Shirt size={28} className="text-blue-400" />
            <span>Fardamentos Operacionais</span>
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Catálogo completo de uniformes da Força Tática PMESP
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-lg shadow-blue-500/20 text-sm lg:text-base"
          >
            <Plus size={18} /> Novo Fardamento
          </button>
        )}
      </div>

      {/* ===== LAYOUT PRINCIPAL - COM SCROLL INDEPENDENTE ===== */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 xl:gap-10 h-[calc(100vh-180px)] lg:h-[calc(100vh-160px)]">
        
        {/* === COLUNA ESQUERDA - CATÁLOGO === */}
        <div className="w-full lg:w-7/12 xl:w-8/12 h-full overflow-y-auto">
          <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-4 lg:p-5 xl:p-6 flex flex-col w-full h-full shadow-xl">
            
            {/* Título da seção */}
            <div className="flex justify-between items-center mb-4 lg:mb-5 flex-shrink-0">
              <h3 className="font-semibold text-base lg:text-lg flex items-center gap-2">
                <div className="p-1.5 lg:p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <Layers size={18} className="lg:w-5 lg:h-5 text-blue-400" />
                </div>
                <span className="text-white">Catálogo de Fardamentos</span>
              </h3>
              <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
                {fardamentos.length} {fardamentos.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {/* Lista de fardamentos - AGORA OCUPA ALTURA RESTANTE COM SCROLL PRÓPRIO */}
            <div className="flex-1 overflow-hidden">
              {fardamentos.length === 0 ? (
                <div className="text-center py-12 lg:py-16">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center">
                    <Shirt size={40} className="lg:w-12 lg:h-12 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-base lg:text-lg">Nenhum fardamento cadastrado</p>
                  {isAdmin && (
                    <p className="text-xs lg:text-sm text-gray-500 mt-2">
                      Clique em "Novo Fardamento" para adicionar
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-full overflow-y-auto pr-2 lg:pr-3 space-y-3 lg:space-y-2 scroll-smooth">
                  {fardamentos.map((farda) => {
                    const colors = getFardaColor(farda.nome);
                    const isSelected = selectedFarda?.id === farda.id;
                    return (
                      <div
                        key={farda.id}
                        className={`
                          group relative flex items-start lg:items-center p-3 lg:p-4 rounded-xl cursor-pointer 
                          transition-all duration-200 border
                          ${isSelected 
                            ? `${colors.bg} border-2 ${colors.borderStrong} shadow-lg shadow-blue-500/20 scale-[1.02]` 
                            : 'bg-gray-900/30 hover:bg-gray-800/60 border border-gray-700/50 hover:border-blue-500/30 hover:shadow-md'
                          }
                        `}
                        onClick={() => handleViewFarda(farda)}
                      >
                        {/* Imagem */}
                        <div className="flex-shrink-0 mr-3 lg:mr-4">
                          <FardaImage farda={farda} size="small" />
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <h4 className={`font-bold text-sm lg:text-base truncate ${isSelected ? 'text-white' : 'text-white group-hover:text-blue-300'}`}>
                                  {farda.nome}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-medium ${colors.badge} border ${colors.border}`}>
                                  {farda.pecas?.length || 0} peças
                                </span>
                              </div>

                              {farda.descricao && (
                                <p className="text-xs lg:text-sm text-gray-400 line-clamp-1 lg:line-clamp-2">
                                  {farda.descricao}
                                </p>
                              )}

                              {farda.pecas && farda.pecas.length > 0 && (
                                <div className="flex items-center gap-1 lg:gap-1.5 mt-1.5 flex-wrap">
                                  {farda.pecas.slice(0, 4).map((peca, idx) => {
                                    let display = '';
                                    if (typeof peca === 'string') {
                                      display = peca.split('|')[0].trim();
                                    } else {
                                      display = `${peca.tipo?.toUpperCase() || ''} ${peca.numero || ''}`.trim();
                                    }
                                    if (display.length > 8) display = display.slice(0, 8) + '…';
                                    return (
                                      <span
                                        key={idx}
                                        className="text-[10px] lg:text-xs px-2 py-0.5 bg-gray-800/80 rounded-full text-gray-300 border border-gray-700/80"
                                      >
                                        {display}
                                      </span>
                                    );
                                  })}
                                  {farda.pecas.length > 4 && (
                                    <span className="text-[10px] lg:text-xs px-2 py-0.5 bg-gray-800/80 rounded-lg text-gray-500">
                                      +{farda.pecas.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Data (desktop) */}
                            <div className="hidden lg:flex items-center gap-1 text-xs text-gray-500">
                              <Calendar size={12} />
                              <span>
                                {farda.createdAt?.toDate
                                  ? new Date(farda.createdAt.toDate()).toLocaleDateString('pt-BR')
                                  : farda.createdAt
                                  ? new Date(farda.createdAt).toLocaleDateString('pt-BR')
                                  : 'N/A'}
                              </span>
                            </div>
                            <ChevronRight size={16} className="text-gray-500 group-hover:text-blue-400 transition-colors lg:hidden" />
                          </div>
                        </div>

                        {/* Indicador de seleção (desktop) */}
                        {isSelected && (
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 hidden lg:block"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === COLUNA DIREITA - COMPOSIÇÃO === */}
        <div className="w-full lg:w-6/12 xl:w-5/12 h-full overflow-y-auto">
          <div className="bg-gradient-to-b from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-5 lg:p-6 xl:p-7 flex flex-col w-full h-full shadow-xl min-h-[400px] lg:min-h-0">
            {selectedFarda ? (
              <>
                {/* Header da composição */}
                <div className="text-center mb-5 lg:mb-6 flex-shrink-0">
                  <div className="relative inline-block mx-auto mb-4">
                    <FardaImage farda={selectedFarda} size="large" />
                    <div
                      className={`absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-[10px] lg:text-xs font-bold ${getFardaColor(selectedFarda.nome).badge} border ${getFardaColor(selectedFarda.nome).border} shadow-md`}
                    >
                      {selectedFarda.pecas?.length || 0} ITENS
                    </div>
                  </div>
                  <h3 className="text-lg lg:text-xl font-bold text-white mb-2">{selectedFarda.nome}</h3>
                  {selectedFarda.descricao && (
                    <div className="bg-gray-900/60 rounded-lg p-3 mb-2 text-sm lg:text-base text-gray-300 border border-gray-700/50 break-words">
                      {selectedFarda.descricao}
                    </div>
                  )}
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-5 lg:mb-6 flex-shrink-0">
                  <div className="bg-gray-900/50 rounded-xl p-3 lg:p-4 text-center border border-gray-700/50">
                    <div className="text-xl lg:text-2xl font-bold text-blue-400">{selectedFarda.pecas?.length || 0}</div>
                    <div className="text-xs lg:text-sm text-gray-400 mt-1">Peças</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-xl p-3 lg:p-4 text-center border border-gray-700/50">
                    <div className="text-xl lg:text-2xl font-bold text-green-400">
                      {selectedFarda.createdAt?.toDate
                        ? new Date(selectedFarda.createdAt.toDate()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        : selectedFarda.createdAt
                        ? new Date(selectedFarda.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        : 'N/A'}
                    </div>
                    <div className="text-xs lg:text-sm text-gray-400 mt-1">Cadastro</div>
                  </div>
                </div>

                {/* Lista de peças - COM QUEBRA DE LINHA OTIMIZADA E SCROLL PRÓPRIO */}
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-semibold text-gray-300 mb-3 flex items-center gap-2 text-sm lg:text-base border-b border-gray-700/80 pb-2 flex-shrink-0">
                    <Layers size={18} className="text-blue-400" />
                    COMPOSIÇÃO
                  </h4>
                  <div className="h-full overflow-y-auto pr-1 space-y-3 scroll-smooth">
                    {selectedFarda.pecas && selectedFarda.pecas.length > 0 ? (
                      selectedFarda.pecas.map((peca, index) => (
                        <div
                          key={index}
                          className="bg-gray-900/60 rounded-xl p-3 lg:p-4 hover:bg-gray-800/70 transition-all border border-gray-700/50 hover:border-blue-500/30 hover:shadow-md"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg ${getFardaColor(selectedFarda.nome).bg} border ${getFardaColor(selectedFarda.nome).border} flex items-center justify-center flex-shrink-0 shadow-sm`}
                            >
                              <span className="text-sm lg:text-base font-bold text-white">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold text-white text-sm lg:text-base break-words">
                                {typeof peca === 'string'
                                  ? peca.split('|')[0].trim()
                                  : `${peca.tipo?.toUpperCase() || ''} ${peca.numero || ''}${peca.textura ? ` · TXT ${peca.textura}` : ''}`}
                              </h5>
                              {typeof peca === 'string'
                                ? peca.split('|').slice(1).join(' | ') && (
                                    <p className="text-xs lg:text-sm text-gray-400 mt-1 whitespace-pre-wrap break-words">
                                      {peca.split('|').slice(1).join(' | ').trim()}
                                    </p>
                                  )
                                : peca.descricao && (
                                    <p className="text-xs lg:text-sm text-gray-400 mt-1 whitespace-pre-wrap break-words">
                                      {peca.descricao}
                                    </p>
                                  )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-xl">
                        <Layers size={40} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-gray-400 text-sm">Nenhuma peça cadastrada</p>
                        {isAdmin && (
                          <p className="text-xs text-gray-500 mt-2">Edite para adicionar peças</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões admin */}
                {isAdmin && (
                  <div className="flex gap-3 lg:gap-4 pt-4 lg:pt-5 border-t border-gray-700/80 mt-4 lg:mt-5 flex-shrink-0">
                    <button
                      onClick={() => handleEditFarda(selectedFarda)}
                      className="flex-1 bg-gradient-to-r from-yellow-600/20 to-yellow-700/10 hover:from-yellow-600/30 hover:to-yellow-700/20 text-yellow-400 py-2.5 lg:py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-yellow-500/30 hover:border-yellow-500/50 text-sm lg:text-base"
                    >
                      <Edit size={16} /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteFarda(selectedFarda.id)}
                      className="flex-1 bg-gradient-to-r from-red-600/20 to-red-700/10 hover:from-red-600/30 hover:to-red-700/20 text-red-400 py-2.5 lg:py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-red-500/30 hover:border-red-500/50 text-sm lg:text-base"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Placeholder elegante quando nada selecionado */
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] lg:min-h-[500px] text-center">
                <div className="w-24 h-24 lg:w-32 lg:h-32 mb-6 rounded-3xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-2 border-dashed border-gray-700 flex items-center justify-center">
                  <Shirt size={48} className="lg:w-16 lg:h-16 text-gray-600" />
                </div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-300 mb-2">Nenhum fardamento selecionado</h3>
                <p className="text-sm lg:text-base text-gray-500 max-w-xs">
                  Clique em um item do catálogo ao lado para visualizar sua composição completa.
                </p>
                <div className="mt-6 flex items-center gap-2 text-xs text-gray-600">
                  <Layers size={14} />
                  <span>Catálogo com {fardamentos.length} {fardamentos.length === 1 ? 'fardamento' : 'fardamentos'}</span>
                </div>
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