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
import { Shirt, Plus, Edit, Trash2, ChevronRight, Save, X } from 'lucide-react';
import { getFardaColor } from './utils/fardaColors';
import '../styles/fardamentos.css';

// Componente para exibir a foto
const FardaImage = ({ farda, size = 'medium' }) => {
  const colors = getFardaColor(farda.nome);

  const sizes = {
    small: { container: '120px', icon: 28 },
    medium: { container: '160px', icon: 36 },
    large: { container: '240px', icon: 52 },
  };
  const containerSize = sizes[size].container;
  const iconSize = sizes[size].icon;

  return (
    <div
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        background: 'rgba(31, 41, 55, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {farda.fotoURL ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <img
            src={farda.fotoURL}
            alt={farda.nome}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            className="transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              e.target.style.display = 'none';
              const parent = e.target.parentElement;
              if (parent) {
                parent.innerHTML = `
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(31,41,55,0.5);">
                  <div style="text-align:center">
                    <Shirt size="${iconSize}" style="color:rgba(255,255,255,0.6)" />
                    <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:6px;font-weight:600">${
                      farda.nome.split(' ')[0]
                    }</div>
                  </div>
                </div>
              `;
              }
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)',
              pointerEvents: 'none',
            }}
          ></div>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(31,41,55,0.5)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <Shirt size={iconSize} style={{ color: 'rgba(255,255,255,0.6)' }} />
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px',
                marginTop: '8px',
                fontWeight: '600',
              }}
            >
              {farda.nome.split(' ')[0]}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          border: '2px solid rgba(59, 130, 246, 0.5)',
          borderRadius: '13px',
          pointerEvents: 'none',
        }}
      ></div>
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

  useEffect(() => {
    const q = query(
      collection(db, 'fardamentos'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setFardamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);
  
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

  const handleSaveFarda = async () => {
    if (!formData.nome) {
      alert('Preencha o nome do fardamento!');
      return;
    }

    // Filtrar peças vazias e validar
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
      setFormData({
        nome: '',
        descricao: '',
        fotoURL: '',
        pecas: [{ tipo: '', numero: '', textura: '', descricao: '' }],
      });
    } catch (error) {
      console.error('Erro ao salvar fardamento:', error);
      alert('Erro ao salvar fardamento. Tente novamente.');
    }
  };

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
      pecas:
        pecasFormatadas.length > 0
          ? pecasFormatadas
          : [{ tipo: '', numero: '', textura: '', descricao: '' }],
    });
    setModalOpen(true);
  };

  const handleDeleteFarda = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este fardamento?')) {
      try {
        await deleteDoc(doc(db, 'fardamentos', id));
      } catch (error) {
        console.error('Erro ao excluir fardamento:', error);
        alert('Erro ao excluir fardamento. Tente novamente.');
      }
    }
  };

  const handleViewFarda = (farda) => {
    setSelectedFarda(farda);
  };

  return (
    <div className="fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Shirt size={28} className="text-blue-400" />
            Fardamentos Operacionais
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Catálogo completo de uniformes da Força Tática PMESP
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
          >
            <Plus size={18} /> Novo Fardamento
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row" style={{ gap: '48px' }}>
        {/* Catálogo de Fardamentos - Lado Esquerdo */}
        <div className="lg:w-7/12 w-full" style={{ display: 'flex' }}>
          <div
            className="bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-blue-500/20 rounded-xl p-8"
            style={{
              minHeight: '650px',
              height: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
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
                    className="text-blue-400"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M9 12h6" />
                    <path d="M12 9v6" />
                  </svg>
                </div>
                <span className="text-white">Catálogo de Fardamentos</span>
              </h3>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              {fardamentos.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center">
                    <Shirt size={48} className="text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-lg">
                    Nenhum fardamento cadastrado
                  </p>
                  {isAdmin && (
                    <p className="text-sm text-gray-500 mt-2">
                      Clique em "Novo Fardamento" para adicionar o primeiro
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="space-y-6"
                  style={{
                    maxHeight: 'calc(100vh - 200px)',
                    overflowY: 'auto',
                    paddingRight: '16px',
                  }}
                >
                  {fardamentos.map((farda) => {
                    const colors = getFardaColor(farda.nome);
                    return (
                      <div
                        key={farda.id}
                        className={`flex items-center p-6 rounded-xl cursor-pointer transition-all duration-300 ${
                          selectedFarda?.id === farda.id
                            ? `${colors.bg} border-2 ${colors.borderStrong} shadow-lg shadow-blue-500/10`
                            : 'bg-gray-900/30 hover:bg-gray-800/50 border border-gray-700/30'
                        } group hover:border-blue-500/30`}
                        onClick={() => handleViewFarda(farda)}
                      >
                        <div
                          className="flex-shrink-0"
                          style={{ marginRight: '24px' }}
                        >
                          <FardaImage farda={farda} size="medium" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">
                                  {farda.nome}
                                </h4>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs ${colors.badge} border ${colors.border}`}
                                >
                                  {farda.pecas?.length || 0} peças
                                </span>
                              </div>

                              {farda.descricao && (
                                <p className="text-sm text-gray-400 mb-2">
                                  {farda.descricao}
                                </p>
                              )}

                              {farda.pecas && farda.pecas.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {farda.pecas.slice(0, 4).map((peca, idx) => {
                                    let displayText = '';

                                    if (typeof peca === 'string') {
                                      displayText =
                                        peca.length > 15
                                          ? peca.substring(0, 15) + '...'
                                          : peca;
                                    } else {
                                      displayText = `${
                                        peca.tipo?.toUpperCase() || ''
                                      } ${peca.numero || ''}`.trim();
                                      if (peca.textura) {
                                        displayText += ` | TXT ${peca.textura}`;
                                      }
                                      if (displayText.length > 15) {
                                        displayText =
                                          displayText.substring(0, 15) + '...';
                                      }
                                    }

                                    return (
                                      <span
                                        key={idx}
                                        className="text-xs px-3 py-1 bg-gray-800/50 rounded-full text-gray-300 border border-gray-700/50"
                                      >
                                        {displayText}
                                      </span>
                                    );
                                  })}
                                  {farda.pecas.length > 4 && (
                                    <span className="text-xs px-2 py-1 bg-gray-800/50 rounded-lg text-gray-500">
                                      +{farda.pecas.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right hidden md:block">
                                <div className="text-xs text-gray-500">
                                  Criado em
                                </div>
                                <div className="text-sm text-gray-400">
                                  {farda.createdAt?.toDate
                                    ? new Date(
                                        farda.createdAt.toDate()
                                      ).toLocaleDateString('pt-BR')
                                    : 'N/A'}
                                </div>
                              </div>

                              <ChevronRight
                                size={20}
                                className="text-gray-500 group-hover:text-blue-400 transition-colors"
                              />
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
        <div className="lg:w-5/12 w-full" style={{ display: 'flex' }}>
          <div
            className="bg-gradient-to-b from-gray-800/50 to-gray-900/30 border border-blue-500/20 rounded-xl p-8"
            style={{
              minHeight: '650px',
              height: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }}
          >
            {selectedFarda ? (
              <>
                <div className="text-center mb-6">
                  <div className="relative mx-auto mb-4">
                    <div style={{ marginBottom: '24px' }}>
                      <FardaImage farda={selectedFarda} size="large" />
                    </div>
                    <div
                      className={`absolute -bottom-2 -right-2 px-4 py-1.5 rounded-full text-xs font-bold ${
                        getFardaColor(selectedFarda.nome).badge
                      } border ${getFardaColor(selectedFarda.nome).border}`}
                    >
                      {selectedFarda.pecas?.length || 0} ITENS
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3">
                    {selectedFarda.nome}
                  </h3>

                  {selectedFarda.descricao && (
                    <div className="bg-gray-900/40 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-300">
                        {selectedFarda.descricao}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gray-900/30 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-400">
                      {selectedFarda.pecas?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Peças</div>
                  </div>
                  <div className="bg-gray-900/30 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-400">
                      {selectedFarda.createdAt?.toDate
                        ? new Date(
                            selectedFarda.createdAt.toDate()
                          ).toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Cadastro</div>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <h4 className="font-semibold text-gray-300 mb-4 flex items-center gap-2 text-lg border-b border-gray-700 pb-2">
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
                        className="text-blue-400"
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                        <path d="M16 13H8" />
                        <path d="M16 17H8" />
                        <path d="M10 9H8" />
                      </svg>
                      COMPOSIÇÃO
                    </h4>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      paddingRight: '8px',
                      paddingLeft: '4px',
                    }}
                  >
                    <div className="space-y-4">
                      {selectedFarda.pecas && selectedFarda.pecas.length > 0 ? (
                        selectedFarda.pecas.map((peca, index) => {
                          if (typeof peca === 'string') {
                            const partes = peca.split('|').map((p) => p.trim());
                            const nomePeca = partes[0] || '';
                            const detalhes = partes.slice(1).join(' | ');

                            return (
                              <div
                                key={index}
                                className="bg-gray-900/40 rounded-lg p-4 hover:bg-gray-800/60 transition-all group border border-gray-700/30 hover:border-blue-500/30"
                              >
                                <div className="flex items-center gap-4 mb-3">
                                  <div
                                    className={`w-10 h-10 rounded-lg ${
                                      getFardaColor(selectedFarda.nome).bg
                                    } border ${
                                      getFardaColor(selectedFarda.nome).border
                                    } flex items-center justify-center flex-shrink-0`}
                                  >
                                    <span className="text-base font-bold text-white">
                                      {index + 1}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-white text-base">
                                      {nomePeca}
                                    </h5>
                                  </div>
                                </div>
                                {detalhes && (
                                  <div className="pl-14">
                                    <div className="text-sm text-gray-300 bg-gray-800/50 rounded-lg p-3 border-l-2 border-blue-500/50">
                                      {detalhes.split('|').map((item, i) => (
                                        <div key={i} className="mb-2 last:mb-0">
                                          {item.trim()}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          } else {
                            const tipoFormatado = peca.tipo
                              ? peca.tipo.toUpperCase()
                              : '';
                            const numero = peca.numero || '';
                            const textura = peca.textura
                              ? ` | TXT ${peca.textura}`
                              : '';
                            const descricao = peca.descricao || '';

                            return (
                              <div
                                key={index}
                                className="bg-gray-900/40 rounded-lg p-4 hover:bg-gray-800/60 transition-all group border border-gray-700/30 hover:border-blue-500/30"
                              >
                                <div className="flex items-center gap-4 mb-3">
                                  <div
                                    className={`w-10 h-10 rounded-lg ${
                                      getFardaColor(selectedFarda.nome).bg
                                    } border ${
                                      getFardaColor(selectedFarda.nome).border
                                    } flex items-center justify-center flex-shrink-0`}
                                  >
                                    <span className="text-base font-bold text-white">
                                      {index + 1}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-white text-base">
                                      {tipoFormatado} {numero}
                                      {textura}
                                    </h5>
                                  </div>
                                </div>

                                {descricao && (
                                  <div className="pl-14">
                                    <div className="text-sm text-gray-300 bg-gray-800/50 rounded-lg p-3 border-l-2 border-blue-500/50">
                                      {descricao}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="56"
                            height="56"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mx-auto text-gray-600 mb-4"
                          >
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <path d="M16 13H8" />
                            <path d="M16 17H8" />
                            <path d="M10 9H8" />
                          </svg>
                          <p className="text-gray-400 text-lg">
                            Nenhuma peça cadastrada
                          </p>
                          {isAdmin && (
                            <p className="text-base text-gray-500 mt-2">
                              Edite para adicionar peças
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-3 pt-4 border-t border-gray-700 mt-4">
                    <button
                      onClick={() => handleEditFarda(selectedFarda)}
                      className="flex-1 bg-gradient-to-r from-yellow-600/20 to-yellow-700/10 hover:from-yellow-600/30 hover:to-yellow-700/20 text-yellow-400 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-yellow-500/30 hover:border-yellow-500/50"
                    >
                      <Edit size={16} /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteFarda(selectedFarda.id)}
                      className="flex-1 bg-gradient-to-r from-red-600/20 to-red-700/10 hover:from-red-600/30 hover:to-red-700/20 text-red-400 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all border border-red-500/30 hover:border-red-500/50"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center">
                  <Shirt size={48} className="text-gray-600" />
                </div>
                <p className="text-gray-400 text-lg">Selecione um fardamento</p>
                <p className="text-sm text-gray-500 mt-2">
                  Clique em um item da lista para ver os detalhes completos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Novo/Editar Fardamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay">
          <div className="bg-gray-800 border border-blue-500/30 p-8 rounded-xl w-[95vw] max-w-[1400px] max-h-[90vh] min-h-[700px] overflow-y-auto modal-fardamento-grande fade-in">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Shirt size={24} />
              {editingFarda ? 'Editar Fardamento' : 'Novo Fardamento'}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* COLUNA DA ESQUERDA - INFORMAÇÕES GERAIS */}
              <div className="space-y-6">
                <div>
                  <label className="block text-base text-gray-300 mb-2 font-medium">
                    Nome do Fardamento *
                  </label>
                  <input
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    placeholder="Ex: Fardamento Tático B4"
                    className="w-full bg-gray-900 border-2 border-blue-500/30 rounded-xl p-4 text-white text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-base text-gray-300 mb-2 font-medium">
                    Descrição
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) =>
                      setFormData({ ...formData, descricao: e.target.value })
                    }
                    placeholder="Ex: Uso em operações especiais, composto por..."
                    rows={4}
                    className="w-full bg-gray-900 border-2 border-blue-500/30 rounded-xl p-4 text-white text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 resize-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-base text-gray-300 mb-2 font-medium">
                    URL da Foto (opcional)
                  </label>
                  <div className="flex gap-4">
                    <input
                      value={formData.fotoURL}
                      onChange={(e) =>
                        setFormData({ ...formData, fotoURL: e.target.value })
                      }
                      placeholder="https://exemplo.com/foto.jpg"
                      className="flex-1 bg-gray-900 border-2 border-blue-500/30 rounded-xl p-4 text-white text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-colors"
                    />
                    {formData.fotoURL && (
                      <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-blue-500/30 bg-gray-900/50 flex-shrink-0">
                        <img
                          src={formData.fotoURL}
                          alt="Preview"
                          className="w-full h-full object-cover image-preview"
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
              {/* COLUNA DA DIREITA - PEÇAS DO FARDAMENTO */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-base text-gray-300 font-semibold">
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
                    className="text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg flex items-center gap-2 transition hover:scale-105"
                  >
                    <Plus size={16} /> Nova Peça
                  </button>
                </div>

                {/* LISTA DE PEÇAS */}
                <div className="space-y-4 mb-6 max-h-80 overflow-y-auto p-5 border-2 border-gray-700/30 rounded-xl">
                  {formData.pecas.map((peca, index) => (
                    <div
                      key={index}
                      className="bg-gray-900/50 p-6 rounded-lg border border-gray-700/50 min-h-[280px] mb-6 space-y-4"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-base text-gray-200 font-medium">
                          Peça #{index + 1}
                        </span>
                        <button
                          onClick={() => {
                            const newPecas = formData.pecas.filter(
                              (_, i) => i !== index
                            );
                            setFormData({ ...formData, pecas: newPecas });
                          }}
                          className="text-sm text-red-400 hover:text-red-300 flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition"
                          disabled={formData.pecas.length <= 1}
                          title="Remover peça"
                          type="button"
                        >
                          <X size={14} /> Remover
                        </button>
                      </div>

                      {/* CAMPOS DA PEÇA */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* TIPO */}
                        <div>
                          <label className="block text-sm text-gray-300 mb-3 font-medium">
                            Tipo *
                          </label>
                          <select
                            value={peca.tipo}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = {
                                ...peca,
                                tipo: e.target.value,
                              };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
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
                        {/* NÚMERO */}
                        <div>
                          <label className="block text-sm text-gray-300 mb-3 font-medium">
                            Número *
                          </label>
                          <input
                            type="text"
                            value={peca.numero}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = {
                                ...peca,
                                numero: e.target.value,
                              };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            placeholder="Ex: 546, 272, 15"
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                          />
                        </div>
                        {/* TEXTURA */}
                        <div>
                          <label className="block text-sm text-gray-300 mb-3 font-medium">
                            Textura{' '}
                            <span className="text-gray-400">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={peca.textura}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = {
                                ...peca,
                                textura: e.target.value,
                              };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            placeholder="Ex: 5, 0, 1"
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                          />
                        </div>
                        {/* DESCRIÇÃO */}
                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-300 mb-3 font-medium">
                            Descrição{' '}
                            <span className="text-gray-400">(opcional)</span>
                          </label>
                          <textarea
                            value={peca.descricao}
                            onChange={(e) => {
                              const newPecas = [...formData.pecas];
                              newPecas[index] = {
                                ...peca,
                                descricao: e.target.value,
                              };
                              setFormData({ ...formData, pecas: newPecas });
                            }}
                            placeholder="Ex: Oficiais usam essa, Uso em treinamentos, etc."
                            rows="3"
                            className="w-full bg-gray-800 border-2 border-blue-500/30 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                          />
                        </div>
                      </div>

                      {/* PRÉ-VISUALIZAÇÃO */}
                      {peca.tipo && (
                        <div className="mt-4 pt-4 border-t border-gray-700/50">
                          <div className="text-sm text-gray-300">
                            <span className="font-semibold">
                              Como vai aparecer:
                            </span>{' '}
                            <span className="text-gray-100">
                              {peca.tipo.toUpperCase()} {peca.numero}
                              {peca.textura ? ` | TXT ${peca.textura}` : ''}
                              {peca.descricao ? ` (${peca.descricao})` : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-sm text-gray-400">
                  * Campos obrigatórios: Tipo e Número
                </div>
              </div>
            </div>
            {/* BOTÕES DE AÇÃO */}
            <div className="flex gap-6 mt-8">
              <button
                onClick={handleSaveFarda}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 py-4 rounded-lg font-semibold text-white hover:scale-[1.02] transition-transform text-lg min-h-[60px]"
              >
                <Save size={18} className="inline mr-3" /> SALVAR
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingFarda(null);
                  setFormData({
                    nome: '',
                    descricao: '',
                    fotoURL: '',
                    pecas: [
                      { tipo: '', numero: '', textura: '', descricao: '' },
                    ],
                  });
                }}
                className="flex-1 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 py-4 rounded-xl font-bold text-gray-200 text-base hover:scale-[1.02] transition-all"
              >
                <X size={18} className="inline mr-3" /> CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fardamentos;
