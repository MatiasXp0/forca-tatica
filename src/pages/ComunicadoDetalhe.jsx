import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { FileText, Calendar, User, AlertTriangle } from 'lucide-react';
import { formatContent } from '../components/utils/markdownFormatter';

const ComunicadoDetalhe = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const [comunicado, setComunicado] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buscarComunicado = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'comunicados', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setComunicado({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error('Erro ao buscar comunicado:', error);
      } finally {
        setLoading(false);
      }
    };

    buscarComunicado();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando comunicado...</p>
        </div>
      </div>
    );
  }

  if (!comunicado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <FileText size={64} className="mx-auto text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Comunicado não encontrado</h1>
          <p className="text-gray-400 mb-6">O comunicado que você está procurando não existe ou foi removido.</p>
          <a 
            href="/comunicados" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Voltar para Comunicados
          </a>
        </div>
      </div>
    );
  }

  const cores = {
    'INFORMATIVO': 'blue',
    'INSTRUTIVO': 'yellow',
    'URGENTE': 'red',
    'ORDEM_DIA': 'purple',
    'ESCALA': 'green'
  };

  const cor = cores[comunicado.tipo] || 'blue';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800/80 border border-blue-500/30 rounded-xl p-8 shadow-2xl">
          
          {/* Cabeçalho */}
          <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b border-gray-700">
            <span className={`px-4 py-2 rounded-full text-sm font-bold bg-${cor}-500/20 text-${cor}-400`}>
              {comunicado.tipo}
            </span>
            
            {comunicado.isUrgente && (
              <span className="px-4 py-2 rounded-full text-sm font-bold bg-red-500/20 text-red-400 flex items-center gap-2">
                <AlertTriangle size={16} />
                URGENTE
              </span>
            )}
            
            <div className="ml-auto flex items-center gap-3 text-sm text-gray-400">
              <Calendar size={16} />
              {new Date(comunicado.createdAt?.seconds * 1000 || comunicado.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>

          {/* Título */}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
            {comunicado.titulo}
          </h1>

          {/* Autor */}
          {comunicado.createdByName && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
              <User size={16} />
              Publicado por: <span className="text-blue-400 font-medium">{comunicado.createdByName.split('@')[0]}</span>
            </div>
          )}

          {/* Conteúdo */}
          <div 
            className="prose prose-invert max-w-none text-gray-200 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatContent(comunicado.conteudo) }}
          />

          {/* Rodapé */}
          <div className="mt-12 pt-6 border-t border-gray-700 flex justify-between items-center text-sm text-gray-500">
            <span>ID: {comunicado.id}</span>
            <a 
              href="/comunicados" 
              className="text-blue-400 hover:text-blue-300 transition flex items-center gap-2"
            >
              ← Voltar para lista
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComunicadoDetalhe;   