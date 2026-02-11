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
import { sendDiscordNotification } from '../utils/discordWebhooks';

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

      if (!isAdmin) {
        setComunicados(todosComunicados.filter((com) => com.isActive));
      } else {
        setComunicados(todosComunicados);
      }
    });
  }, [isAdmin]);

  // ESC para fechar modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setModalOpen(false);
        setEditingCom(null);
        setFormData({
          titulo: '',
          tipo: 'INFORMATIVO',
          conteudo: '',
        });
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

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

      // ⭐⭐ ADICIONE ESTA LINHA ⭐⭐
      // Envia notificação para Discord APENAS se for um novo comunicado (não edição)
      if (!editingCom) {
        await sendDiscordNotification('comunicados', comunicadoData);
      }

      setModalOpen(false);
      setEditingCom(null);
      setFormData({ titulo: '', tipo: 'INFORMATIVO', conteudo: '' });
    } catch (error) {
      console.error('Erro ao salvar comunicado:', error);
      alert('Erro ao salvar comunicado. Tente novamente.');
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
    if (window.confirm('Tem certeza que deseja excluir este comunicado?')) {
      try {
        await deleteDoc(doc(db, 'comunicados', id));
      } catch (error) {
        console.error('Erro ao excluir comunicado:', error);
        alert('Erro ao excluir comunicado. Tente novamente.');
      }
    }
  };

  const toggleComStatus = async (com) => {
    try {
      await updateDoc(doc(db, 'comunicados', com.id), {
        isActive: !com.isActive,
      });
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status. Tente novamente.');
    }
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

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  return (
    <div className="fade-in">
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
              className="bg-gray-800/50 border border-blue-500/20 rounded-xl overflow-hidden hover:border-blue-500/40 transition fade-in"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-800/70 transition"
                onClick={() => toggleComExpand(com.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        com.tipo === 'INFORMATIVO'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
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
                        className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
                      >
                        <Edit size={14} /> Editar
                      </button>
                      <button
                        onClick={() => toggleComStatus(com)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm flex items-center justify-center gap-1 transition"
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
                        className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded text-sm flex items-center justify-center gap-1 transition"
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay">
          <div className="bg-gray-800 border border-blue-500/30 p-6 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto fade-in">
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
                className="flex-1 bg-blue-600 py-3 rounded-lg font-semibold text-white hover:bg-blue-700 transition"
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

export default Comunicados;
