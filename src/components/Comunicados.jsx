import React, { useState, useEffect, useRef } from 'react';
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
  Bold,
  Italic,
  List,
  Hash,
  Link as LinkIcon,
} from 'lucide-react';
import { formatContent } from './utils/markdownFormatter';
import {
  upsertDiscordMessage,
  deleteDiscordMessage,
  hideDiscordMessage,
  showDiscordMessage,
} from '../utils/discordManager';

const Comunicados = ({ isAdmin }) => {
  const [comunicados, setComunicados] = useState([]);
  const [expandedComId, setExpandedComId] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCom, setEditingCom] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const textareaRef = useRef(null);

  const [formData, setFormData] = useState({
    titulo: '',
    tipo: 'INFORMATIVO',
    conteudo: '',
    isActive: true,
    isUrgente: false,
  });

  // Tipos de comunicado disponíveis
  const tiposComunicado = [
    { value: 'INFORMATIVO', label: '📋 Informativo', color: 'blue' },
    { value: 'INSTRUTIVO', label: '📌 Instrutivo', color: 'yellow' },
    { value: 'URGENTE', label: '⚠️ Urgente', color: 'red' },
    { value: 'ORDEM_DIA', label: '📅 Ordem do Dia', color: 'purple' },
    { value: 'ESCALA', label: '⏰ Escala', color: 'green' },
  ];

  // Buscar comunicados em tempo real
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

      if (!isAdmin) {
        setComunicados(
          todosComunicados.filter((com) => com.isActive !== false)
        );
      } else {
        setComunicados(todosComunicados);
      }
    });
  }, [isAdmin]);

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
    setEditingCom(null);
    setPreviewMode(false);
    setFormData({
      titulo: '',
      tipo: 'INFORMATIVO',
      conteudo: '',
      isActive: true,
      isUrgente: false,
    });
  };

  const toggleComExpand = (id) => {
    setExpandedComId(expandedComId === id ? null : id);
  };

  // ========== INSERIR FORMATAÇÃO ==========
  const insertMarkdown = (type) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
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
      default:
        return;
    }

    const updatedText =
      formData.conteudo.substring(0, start) +
      newText +
      formData.conteudo.substring(end);
    setFormData({ ...formData, conteudo: updatedText });

    setTimeout(() => {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  // ========== SALVAR COMUNICADO (COM DISCORD) ==========
  const handleSaveComunicado = async () => {
    if (!formData.titulo || !formData.conteudo) {
      alert('Preencha título e conteúdo!');
      return;
    }

    const comunicadoData = {
      ...formData,
      createdAt: editingCom ? editingCom.createdAt : new Date(),
      updatedAt: new Date(),
      createdBy: auth.currentUser?.uid || '',
      createdByName:
        auth.currentUser?.displayName || auth.currentUser?.email || 'Sistema',
    };

    try {
      if (editingCom) {
        // === EDIÇÃO: Firebase + Discord (edita mensagem existente) ===
        await updateDoc(doc(db, 'comunicados', editingCom.id), comunicadoData);

        if (editingCom.discordMessageId) {
          await upsertDiscordMessage('comunicados', editingCom.id, {
            ...comunicadoData,
            id: editingCom.id,
            discordMessageId: editingCom.discordMessageId,
          });
        }
      } else {
        // === CRIAÇÃO: Firebase + Discord ===
        const docRef = await addDoc(
          collection(db, 'comunicados'),
          comunicadoData
        );

        const discordMessageId = await upsertDiscordMessage(
          'comunicados',
          docRef.id,
          {
            ...comunicadoData,
            id: docRef.id,
          }
        );

        if (discordMessageId) {
          await updateDoc(doc(db, 'comunicados', docRef.id), {
            discordMessageId: discordMessageId,
          });
        }
      }

      closeModal();
      console.log(
        `✅ Comunicado ${editingCom ? 'atualizado' : 'publicado'}: ${
          comunicadoData.titulo
        }`
      );
    } catch (error) {
      console.error('Erro ao salvar comunicado:', error);
      alert('Erro ao salvar comunicado. Tente novamente.');
    }
  };

  // ========== EDITAR ==========
  const handleEditCom = (com) => {
    setEditingCom(com);
    setFormData({
      titulo: com.titulo || '',
      tipo: com.tipo || 'INFORMATIVO',
      conteudo: com.conteudo || '',
      isActive: com.isActive !== false,
      isUrgente: com.isUrgente || false,
    });
    setModalOpen(true);
  };

  // ========== EXCLUIR (COM DISCORD) ==========
  const handleDeleteCom = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este comunicado?')) {
      try {
        const comDoc = await getDoc(doc(db, 'comunicados', id));
        const comData = comDoc.data();

        if (!comData) {
          throw new Error('Comunicado não encontrado');
        }

        if (comData?.discordMessageId) {
          await deleteDiscordMessage('comunicados', {
            ...comData,
            id,
            discordMessageId: comData.discordMessageId,
          });
        }

        await deleteDoc(doc(db, 'comunicados', id));

        setComunicados((prev) => prev.filter((c) => c.id !== id));
        if (expandedComId === id) setExpandedComId(null);

        console.log(`🗑️ Comunicado removido: ${comData?.titulo}`);
      } catch (error) {
        console.error('Erro ao excluir comunicado:', error);
        alert('Erro ao excluir comunicado. Tente novamente.');
      }
    }
  };

  // ========== OCULTAR COMUNICADO ==========
  const handleHideCom = async (com) => {
    try {
      if (com.discordMessageId) {
        await hideDiscordMessage('comunicados', {
          ...com,
          id: com.id,
          discordMessageId: com.discordMessageId,
        });
      }

      await updateDoc(doc(db, 'comunicados', com.id), {
        isActive: false,
        updatedAt: new Date(),
      });

      console.log(`🙈 Comunicado ocultado: ${com.titulo}`);
    } catch (error) {
      console.error('Erro ao ocultar comunicado:', error);
      alert('Erro ao ocultar comunicado. Tente novamente.');
    }
  };

  // ========== MOSTRAR COMUNICADO ==========
  const handleShowCom = async (com) => {
    try {
      const discordMessageId = await showDiscordMessage('comunicados', {
        ...com,
        id: com.id,
        isActive: true,
        isUrgente: com.isUrgente,
      });

      await updateDoc(doc(db, 'comunicados', com.id), {
        isActive: true,
        discordMessageId: discordMessageId || com.discordMessageId,
        updatedAt: new Date(),
      });

      console.log(`👁️ Comunicado reativado: ${com.titulo}`);
    } catch (error) {
      console.error('Erro ao mostrar comunicado:', error);
      alert('Erro ao mostrar comunicado. Tente novamente.');
    }
  };

  // ========== TOGGLE URGENTE ==========
  const toggleComUrgente = async (com) => {
    try {
      const novoStatus = !com.isUrgente;

      await updateDoc(doc(db, 'comunicados', com.id), {
        isUrgente: novoStatus,
        updatedAt: new Date(),
      });

      if (com.discordMessageId) {
        await upsertDiscordMessage(
          'comunicados',
          com.id,
          {
            ...com,
            isUrgente: novoStatus,
            discordMessageId: com.discordMessageId,
          },
          'urgente'
        );
      }

      console.log(
        `${novoStatus ? '⚠️' : '📋'} Comunicado ${
          com.titulo
        } - Urgente: ${novoStatus ? 'SIM' : 'NÃO'}`
      );
    } catch (error) {
      console.error('Erro ao alterar urgência:', error);
      alert('Erro ao alterar urgência. Tente novamente.');
    }
  };

  // ========== FORMATAR DATA ==========
  const formatDate = (date) => {
    if (!date) return 'Data desconhecida';
    try {
      // Se for Firestore Timestamp
      if (date?.toDate) return date.toDate().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      // Se for string ISO ou Date
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Data inválida';
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Data inválida';
    }
  };

  // ========== OBTER INFO DO TIPO ==========
  const getTipoInfo = (tipo) => {
    return tiposComunicado.find((t) => t.value === tipo) || tiposComunicado[0];
  };

  // ========== RENDER MODAL ==========
  const renderModal = () => {
    if (!isModalOpen) return null;

    const tipoInfo = getTipoInfo(formData.tipo);

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay">
        <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FileText size={20} />
              {editingCom ? 'Editar Comunicado' : 'Novo Comunicado'}
            </h3>
            {editingCom && (
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-3 py-1 rounded text-sm ${
                  previewMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {previewMode ? '✏️ Editar' : '👁️ Visualizar'}
              </button>
            )}
          </div>

          {previewMode && editingCom ? (
            <div className="space-y-4">
              <div className="bg-gray-900/50 p-4 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold bg-${tipoInfo.color}-500/20 text-${tipoInfo.color}-400`}
                  >
                    {tipoInfo.label}
                  </span>
                  {formData.isUrgente && (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 flex items-center gap-1">
                      <AlertTriangle size={12} /> URGENTE
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatDate(new Date())}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  {formData.titulo}
                </h2>
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: formatContent(formData.conteudo),
                  }}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setPreviewMode(false)}
                  className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  VOLTAR PARA EDIÇÃO
                </button>
              </div>
            </div>
          ) : (
            <>
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
                        setFormData({ ...formData, tipo: e.target.value })
                      }
                      className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                    >
                      {tiposComunicado.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isUrgente}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isUrgente: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-red-600"
                    />
                    <span className="text-red-400">Marcar como urgente</span>
                  </label>

                  {editingCom && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isActive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span>Ativo (visível)</span>
                    </label>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm text-gray-400">
                      Conteúdo *
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => insertMarkdown('h1')}
                        className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition"
                        title="Título grande"
                        type="button"
                      >
                        <Hash size={12} />
                      </button>
                      <button
                        onClick={() => insertMarkdown('h2')}
                        className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition"
                        title="Subtítulo"
                        type="button"
                      >
                        <Hash size={12} /> <Hash size={10} />
                      </button>
                      <button
                        onClick={() => insertMarkdown('bold')}
                        className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition"
                        title="Negrito"
                        type="button"
                      >
                        <Bold size={12} />
                      </button>
                      <button
                        onClick={() => insertMarkdown('italic')}
                        className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition"
                        title="Itálico"
                        type="button"
                      >
                        <Italic size={12} />
                      </button>
                      <button
                        onClick={() => insertMarkdown('link')}
                        className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition"
                        title="Link"
                        type="button"
                      >
                        <LinkIcon size={12} />
                      </button>
                      <button
                        onClick={() => insertMarkdown('list')}
                        className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition"
                        title="Lista"
                        type="button"
                      >
                        <List size={12} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    name="conteudo"
                    value={formData.conteudo}
                    onChange={(e) =>
                      setFormData({ ...formData, conteudo: e.target.value })
                    }
                    placeholder="Digite o conteúdo do comunicado..."
                    rows={12}
                    className="w-full bg-gray-900 border border-blue-500/20 rounded-lg p-3 text-white outline-none focus:border-blue-500 resize-none font-mono text-sm"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Dica: Use **negrito**, *itálico*, # Título, ## Subtítulo, - lista
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
                  className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700 transition"
                >
                  <Save size={16} className="inline mr-2" />
                  {editingCom ? 'ATUALIZAR' : 'PUBLICAR'}
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 bg-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  <X size={16} className="inline mr-2" /> CANCELAR
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText size={20} className="text-blue-400" />
          Comunicados Operacionais
        </h2>
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
          comunicados.map((com) => {
            const tipoInfo = getTipoInfo(com.tipo);
            const isExpanded = expandedComId === com.id;

            return (
              <div
                key={com.id}
                className={`
                  bg-gray-800/50 border rounded-xl overflow-hidden transition
                  ${!com.isActive && isAdmin ? 'border-gray-700 opacity-60' : ''}
                  ${
                    com.isUrgente
                      ? 'border-red-500/50 bg-red-900/10'
                      : 'border-blue-500/20 hover:border-blue-500/40'
                  }
                `}
              >
                {/* Cabeçalho do comunicado */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-800/70 transition"
                  onClick={() => toggleComExpand(com.id)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 bg-${tipoInfo.color}-500/20 text-${tipoInfo.color}-400`}
                      >
                        {com.tipo === 'URGENTE' ? (
                          <AlertTriangle size={12} />
                        ) : (
                          <Info size={12} />
                        )}
                        {tipoInfo.label}
                      </div>
                      <div>
                        <h3 className="font-bold">{com.titulo}</h3>
                        <p className="text-gray-400 text-sm">
                          {formatDate(com.createdAt)}
                          {com.createdByName &&
                            ` • por ${com.createdByName.split('@')[0]}`}
                        </p>
                        {com.discordMessageId && (
                          <p className="text-xs text-gray-500 mt-1">
                            🟢 Discord ID: {com.discordMessageId.substring(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {com.isUrgente && (
                        <span className="text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded flex items-center gap-1">
                          <AlertTriangle size={12} /> URGENTE
                        </span>
                      )}
                      {!com.isActive && isAdmin && (
                        <span className="text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded">
                          OCULTO
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="text-gray-500" />
                      ) : (
                        <ChevronDown className="text-gray-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {isExpanded && (
                  <div className="border-t border-gray-700 p-6 bg-gray-900/50">
                    <div
                      className="prose prose-invert max-w-none mb-6"
                      dangerouslySetInnerHTML={{
                        __html: formatContent(com.conteudo),
                      }}
                    />

                  

                    {/* Ações administrativas */}
                    {isAdmin && (
                      <div className="flex gap-2 pt-6 border-t border-gray-700">
                        <button
                          onClick={() => handleEditCom(com)}
                          className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                        >
                          <Edit size={14} /> Editar
                        </button>

                        {com.isActive ? (
                          <button
                            onClick={() => handleHideCom(com)}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                          >
                            <EyeOff size={14} /> Ocultar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleShowCom(com)}
                            className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                          >
                            <Eye size={14} /> Mostrar
                          </button>
                        )}

                        <button
                          onClick={() => toggleComUrgente(com)}
                          className={`flex-1 py-2 rounded text-sm flex items-center justify-center gap-1 transition ${
                            com.isUrgente
                              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                              : 'bg-gray-700 hover:bg-gray-600 text-white'
                          }`}
                        >
                          <AlertTriangle size={14} />
                          {com.isUrgente ? 'Remover urgência' : 'Urgente'}
                        </button>

                        <button
                          onClick={() => handleDeleteCom(com.id)}
                          className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    )}

                    {/* Rodapé com metadados */}
                    <div className="mt-4 text-xs text-gray-500 border-t border-gray-700 pt-4">
                      <span>ID: {com.id.slice(-6)}</span>
                      {com.discordMessageId && (
                        <span className="ml-4">
                          Discord ID: {com.discordMessageId}
                        </span>
                      )}
                      <span className="ml-4">
                        Última atualização:{' '}
                        {formatDate(com.updatedAt || com.createdAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {renderModal()}
    </div>
  );
};

export default Comunicados;