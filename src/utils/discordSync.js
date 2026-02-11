// src/utils/discordSync.js - VERSÃO SIMPLIFICADA

import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// Configurações - vazias por enquanto
const DISCORD_CONFIG = {
  token: import.meta.env.VITE_DISCORD_BOT_TOKEN || '',
  guildId: import.meta.env.VITE_DISCORD_GUILD_ID || '',
  channels: {
    hierarquia: import.meta.env.VITE_DISCORD_CHANNEL_HIERARQUIA || '',
    viaturas: import.meta.env.VITE_DISCORD_CHANNEL_VIATURAS || '',
    fardamentos: import.meta.env.VITE_DISCORD_CHANNEL_FARDAMENTOS || '',
    comunicados: import.meta.env.VITE_DISCORD_CHANNEL_COMUNICADOS || '',
    logs: import.meta.env.VITE_DISCORD_CHANNEL_LOGS || ''
  }
};

// Modo simulação
const SIMULATION_MODE = true; // Mude para false quando configurar o Discord

const log = (type, message, data = null) => {
  const colors = {
    info: 'color: #3498db',
    success: 'color: #2ecc71',
    warning: 'color: #f39c12',
    error: 'color: #e74c3c',
    discord: 'color: #7289da'
  };
  
  console.log(`%c[${type.toUpperCase()}] ${message}`, colors[type] || colors.info);
  if (data) console.log(data);
};

/**
 * Cria ou atualiza uma mensagem no Discord (ou simula)
 */
export const upsertDiscordMessage = async (collection, itemId, itemData) => {
  if (SIMULATION_MODE) {
    log('discord', `📨 SIMULAÇÃO: ${collection} "${itemData.nome || itemData.titulo}" sincronizado`);
    log('discord', `ID: ${itemId}`, itemData);
    return `simulated-${collection}-${itemId}`;
  }
  
  // Código real do Discord virá aqui depois
  log('warning', 'Discord não configurado. Configure as variáveis de ambiente.');
  return null;
};

/**
 * Remove uma mensagem do Discord (ou simula)
 */
export const deleteDiscordMessage = async (collection, itemData) => {
  if (SIMULATION_MODE) {
    log('discord', `🗑️ SIMULAÇÃO: ${collection} "${itemData.nome || itemData.titulo}" removido`);
    return true;
  }
  
  // Código real do Discord virá aqui depois
  log('warning', 'Discord não configurado. Configure as variáveis de ambiente.');
  return false;
};

/**
 * Envia log para o canal de logs (ou console)
 */
export const sendDiscordLog = async (message, type = 'info') => {
  log(type, message);
  return true;
};

/**
 * Cria embeds para visualização (usado no modo simulação)
 */
const createEmbed = (type, data) => {
  const baseUrl = 'https://forca-tatica.vercel.app';
  
  switch (type) {
    case 'hierarquia':
      return {
        title: `🎖️ ${data.patente} - ${data.nome}`,
        description: data.observacoes || '*Sem observações*',
        color: data.ativo ? 0x00ff00 : 0xff0000,
        fields: [
          { name: '📊 Status', value: data.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**', inline: true },
          { name: '🔗 Acesso', value: `[Ver detalhes](${baseUrl}/hierarquia)` }
        ]
      };
    // ... outros casos podem ser adicionados depois
    default:
      return null;
  }
};