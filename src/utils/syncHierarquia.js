// src/utils/syncHierarquia.js
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { syncHierarquiaLista } from './discordManager';

let intervaloId = null;
let isSincronizando = false;

const buscarMembros = async () => {
  try {
    const q = query(collection(db, 'hierarquia'), orderBy('patente'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Erro ao buscar membros:', error);
    return [];
  }
};

export const sincronizarHierarquia = async () => {
  if (isSincronizando) return;
  
  isSincronizando = true;
  
  try {
    console.log('🔄 Sincronizando hierarquia...');
    const membros = await buscarMembros();
    
    if (membros.length > 0) {
      await syncHierarquiaLista(membros);
      console.log(`✅ Hierarquia sincronizada: ${membros.length} membros`);
    }
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  } finally {
    isSincronizando = false;
  }
};

export const iniciarSyncHierarquia = (intervaloMs = 30000) => {
  if (intervaloId) return;
  
  console.log(`🚀 Iniciando sincronização automática (${intervaloMs/1000}s)...`);
  sincronizarHierarquia();
  intervaloId = setInterval(sincronizarHierarquia, intervaloMs);
};

export const pararSyncHierarquia = () => {
  if (intervaloId) {
    clearInterval(intervaloId);
    intervaloId = null;
    console.log('🛑 Sincronização parada');
  }
};

export const sincronizarAgora = sincronizarHierarquia;