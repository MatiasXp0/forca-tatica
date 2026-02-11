// src/utils/syncHierarquia.js
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import discordManager from './discordManager';

let unsubscribe = null;

export function iniciarSyncHierarquia() {
  if (unsubscribe) {
    console.log('🔄 Sync da hierarquia já está ativo');
    return;
  }

  console.log('🚀 Iniciando sincronização automática da hierarquia...');
  
  const q = query(collection(db, 'hierarquia'), orderBy('patente'));
  
  unsubscribe = onSnapshot(q, async (snapshot) => {
    try {
      const membros = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (membros.length > 0) {
        await discordManager.syncHierarquiaLista(membros);
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar hierarquia:', error);
    }
  }, (error) => {
    console.error('❌ Erro no listener da hierarquia:', error);
  });

  console.log('✅ Sincronização automática da hierarquia ativada');
}

export function pararSyncHierarquia() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    console.log('🛑 Sincronização da hierarquia parada');
  }
}

export function getSyncStatus() {
  return {
    ativo: unsubscribe !== null,
    timestamp: new Date().toISOString()
  };
}