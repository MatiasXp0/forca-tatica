import React, { useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { upsertDiscordMessage } from '../utils/discordManager';

const DiscordMigracao = () => {
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [logs, setLogs] = useState([]);

  const adicionarLog = (msg) => {
    setLogs(prev => [...prev, { timestamp: new Date(), msg }]);
  };

  const migrarColecao = async (nomeColecao) => {
    adicionarLog(`📦 Migrando ${nomeColecao}...`);
    const snapshot = await getDocs(collection(db, nomeColecao));
    let count = 0;
    
    for (const docSnap of snapshot.docs) {
      const item = { id: docSnap.id, ...docSnap.data() };
      
      if (!item.discordMessageId) {
        adicionarLog(`  ➜ Criando mensagem para: ${item.nome || item.titulo || item.id}`);
        
        try {
          const messageId = await upsertDiscordMessage(nomeColecao, item.id, item);
          
          if (messageId) {
            await updateDoc(doc(db, nomeColecao, item.id), {
              discordMessageId: messageId
            });
            count++;
            adicionarLog(`    ✅ ID: ${messageId.substring(0, 8)}...`);
          }
        } catch (error) {
          adicionarLog(`    ❌ Erro: ${error.message}`);
        }
      }
    }
    
    adicionarLog(`  ✅ ${nomeColecao}: ${count} itens migrados`);
    return count;
  };

  const iniciarMigracao = async () => {
    setMigrando(true);
    setLogs([]);
    adicionarLog('🚀 INICIANDO MIGRAÇÃO...');
    
    try {
      const total = {
        hierarquia: await migrarColecao('hierarquia'),
        viaturas: await migrarColecao('viaturas'),
        fardamentos: await migrarColecao('fardamentos'),
        comunicados: await migrarColecao('comunicados')
      };
      
      setResultado(total);
      adicionarLog('🎉 MIGRAÇÃO CONCLUÍDA!');
      adicionarLog(`📊 Total: ${Object.values(total).reduce((a,b) => a+b, 0)} itens`);
    } catch (error) {
      adicionarLog(`❌ ERRO GERAL: ${error.message}`);
    } finally {
      setMigrando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-blue-500/30 rounded-xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-4">🔄 Migração Discord</h2>
        
        <button
          onClick={iniciarMigracao}
          disabled={migrando}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold mb-6"
        >
          {migrando ? '⏳ Migrando...' : '🚀 INICIAR MIGRAÇÃO'}
        </button>

        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">📋 Logs:</h3>
            <div className="space-y-1 font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className="text-gray-300 border-b border-gray-700 pb-1">
                  <span className="text-gray-500">
                    {log.timestamp.toLocaleTimeString()}:
                  </span>{' '}
                  <span className={
                    log.msg.includes('✅') ? 'text-green-400' :
                    log.msg.includes('❌') ? 'text-red-400' :
                    log.msg.includes('📦') ? 'text-blue-400' :
                    'text-gray-300'
                  }>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {resultado && (
          <div className="mt-6 bg-green-500/20 border border-green-500/30 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-400 mb-2">✅ RESULTADO:</h3>
            <pre className="text-white">
              {JSON.stringify(resultado, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscordMigracao;