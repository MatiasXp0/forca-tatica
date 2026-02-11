// src/utils/discordSync.js - VERSÃO FINAL QUE FUNCIONA

import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// ========== CONFIGURAÇÃO ==========
// ESCOLHA: Webhook OU Bot - Configure apenas UM dos dois
const USE_WEBHOOKS = true; // ← TRUE para Webhooks (RECOMENDADO), FALSE para Bot

const CONFIG = {
  // WEBHOOKS (MELHOR para você)
  webhooks: {
    hierarquia: import.meta.env.VITE_DISCORD_WEBHOOK_HIERARQUIA || '',
    viaturas: import.meta.env.VITE_DISCORD_WEBHOOK_VIATURAS || '',
    fardamentos: import.meta.env.VITE_DISCORD_WEBHOOK_FARDAMENTOS || '',
    comunicados: import.meta.env.VITE_DISCORD_WEBHOOK_COMUNICADOS || '',
  },
  
  // BOT (se quiser usar depois)
  bot: {
    token: import.meta.env.VITE_DISCORD_BOT_TOKEN || '',
    channels: {
      hierarquia: import.meta.env.VITE_DISCORD_CHANNEL_HIERARQUIA || '',
      viaturas: import.meta.env.VITE_DISCORD_CHANNEL_VIATURAS || '',
      fardamentos: import.meta.env.VITE_DISCORD_CHANNEL_FARDAMENTOS || '',
      comunicados: import.meta.env.VITE_DISCORD_CHANNEL_COMUNICADOS || '',
    }
  }
};

// ========== LOGS ==========
const log = (type, message) => {
  const styles = {
    success: 'color: #2ecc71; font-weight: bold',
    error: 'color: #e74c3c; font-weight: bold',
    warning: 'color: #f39c12; font-weight: bold',
    info: 'color: #3498db; font-weight: bold'
  };
  console.log(`%c[${type.toUpperCase()}] ${message}`, styles[type]);
};

// ========== FUNÇÕES PRINCIPAIS ==========
/**
 * Cria ou atualiza uma mensagem no Discord
 */
export const upsertDiscordMessage = async (collection, itemId, itemData) => {
  if (USE_WEBHOOKS) {
    return await _upsertViaWebhook(collection, itemId, itemData);
  } else {
    return await _upsertViaBot(collection, itemId, itemData);
  }
};

/**
 * Remove uma mensagem do Discord
 */
export const deleteDiscordMessage = async (collection, itemData) => {
  if (USE_WEBHOOKS) {
    return await _deleteViaWebhook(collection, itemData);
  } else {
    return await _deleteViaBot(collection, itemData);
  }
};

/**
 * Envia log (apenas console por enquanto)
 */
export const sendDiscordLog = async (message, type = 'info') => {
  log(type, message);
  return true;
};

// ========== IMPLEMENTAÇÃO WEBHOOK ==========
async function _upsertViaWebhook(collection, itemId, itemData) {
  const webhookUrl = CONFIG.webhooks[collection];
  
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    log('warning', `Webhook para ${collection} não configurado. Configure VITE_DISCORD_WEBHOOK_${collection.toUpperCase()}`);
    return null;
  }

  const embed = _createEmbed(collection, itemData);
  if (!embed) {
    log('error', `Não foi possível criar embed para ${collection}`);
    return null;
  }

  try {
    let url = webhookUrl;
    let method = 'POST';
    
    // Se já tem messageId, estamos EDITANDO
    if (itemData.discordMessageId && itemData.discordMessageId.includes('webhook')) {
      const messageId = itemData.discordMessageId.split('/').pop();
      url = `${webhookUrl}/messages/${messageId}`;
      method = 'PATCH';
    }

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        embeds: [embed],
        // Marca @everyone para comunicados INSTRUTIVOS
        content: collection === 'comunicados' && itemData.tipo === 'INSTRUTIVO' ? '@everyone 📢 **COMUNICADO INSTRUTIVO!**' : ''
      })
    });

    if (response.ok) {
      const data = await response.json();
      const newMessageId = `${webhookUrl}/${data.id}`;
      
      // Salva o messageId no Firebase
      try {
        await updateDoc(doc(db, collection, itemId), {
          discordMessageId: newMessageId,
          lastDiscordSync: new Date()
        });
      } catch (error) {
        log('error', `Erro ao salvar no Firebase: ${error.message}`);
      }
      
      log('success', `${collection} sincronizado: ${itemData.nome || itemData.titulo}`);
      return newMessageId;
    } else {
      const errorText = await response.text();
      log('error', `Erro Discord ${response.status}: ${errorText}`);
    }
  } catch (error) {
    log('error', `Erro de conexão: ${error.message}`);
  }
  
  return null;
}

async function _deleteViaWebhook(collection, itemData) {
  if (!itemData.discordMessageId || !itemData.discordMessageId.includes('webhook')) {
    log('warning', `${collection} não tem messageId válido para deletar`);
    return false;
  }

  const webhookUrl = CONFIG.webhooks[collection];
  if (!webhookUrl) return false;

  try {
    const messageId = itemData.discordMessageId.split('/').pop();
    const url = `${webhookUrl}/messages/${messageId}`;
    
    const response = await fetch(url, { method: 'DELETE' });
    
    if (response.ok || response.status === 204) {
      log('success', `${collection} removido: ${itemData.nome || itemData.titulo}`);
      return true;
    }
  } catch (error) {
    log('error', `Erro ao deletar: ${error.message}`);
  }
  
  return false;
}

// ========== IMPLEMENTAÇÃO BOT (se quiser usar depois) ==========
async function _upsertViaBot(collection, itemId, itemData) {
  log('warning', 'Modo Bot ainda não implementado. Use webhooks (USE_WEBHOOKS = true)');
  return null;
}

async function _deleteViaBot(collection, itemData) {
  log('warning', 'Modo Bot ainda não implementado. Use webhooks (USE_WEBHOOKS = true)');
  return false;
}

// ========== CRIAÇÃO DE EMBEDS ==========
function _createEmbed(type, data) {
  const baseUrl = 'https://forca-tatica.vercel.app';
  
  switch (type) {
    case 'hierarquia':
      const advertCount = data.advertências?.length || 0;
      const advertText = advertCount > 0 
        ? `📋 **${advertCount} registro${advertCount > 1 ? 's' : ''}**`
        : 'Nenhum registro';
      
      return {
        title: `🎖️ ${data.patente} - ${data.nome}`,
        description: data.observacoes || '*Sem observações*',
        color: data.ativo ? 0x00ff00 : 0xff0000,
        fields: [
          { name: '📊 Status', value: data.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**', inline: true },
          { name: '📈 Registros', value: advertText, inline: true },
          { name: '🔗 Acesso', value: `[Ver detalhes](${baseUrl}/hierarquia)`, inline: false }
        ],
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: { text: `ID: ${data.id?.substring(0, 8) || 'N/A'} • Atualizado` }
      };

    case 'viaturas':
      return {
        title: `🚗 ${data.nome}`,
        description: `**Modelo:** ${data.modelo}\n${data.descricao || ''}`,
        color: 0x0099ff,
        fields: [
          { name: '⚡ Velocidade Máx', value: `${data.velocidadeMax || 'N/A'} km/h`, inline: true },
          { name: '🔗 Acesso', value: `[Ver no site](${baseUrl}/viaturas)`, inline: false }
        ],
        image: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: { text: `ID: ${data.id?.substring(0, 8) || 'N/A'}` }
      };

    case 'fardamentos':
      const pecasCount = data.pecas?.length || 0;
      let pecasPreview = 'Nenhuma peça cadastrada';
      
      if (pecasCount > 0) {
        const pecasList = data.pecas.slice(0, 3).map(p => {
          if (typeof p === 'string') return `• ${p.substring(0, 40)}${p.length > 40 ? '...' : ''}`;
          return `• ${p.tipo?.toUpperCase() || 'Peça'} ${p.numero || ''}`;
        });
        pecasPreview = pecasList.join('\n');
        if (pecasCount > 3) pecasPreview += `\n... e mais ${pecasCount - 3} peças`;
      }
      
      return {
        title: `👕 ${data.nome}`,
        description: data.descricao || 'Fardamento operacional',
        color: 0xff9900,
        fields: [
          { name: '🧩 Peças', value: pecasPreview, inline: false },
          { name: '📊 Total', value: `${pecasCount} peça${pecasCount !== 1 ? 's' : ''}`, inline: true },
          { name: '🔗 Acesso', value: `[Ver composição completa](${baseUrl}/fardamento)`, inline: false }
        ],
        image: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: { text: `ID: ${data.id?.substring(0, 8) || 'N/A'} • Clique para ver detalhes` }
      };

    case 'comunicados':
      return {
        title: `📢 ${data.titulo}`,
        description: data.conteudo.substring(0, 300) + (data.conteudo.length > 300 ? '...' : ''),
        color: data.tipo === 'INSTRUTIVO' ? 0xff0000 : 0x00aa00,
        fields: [
          { name: '📋 Tipo', value: data.tipo, inline: true },
          { name: '👁️ Visibilidade', value: data.isActive ? '✅ Visível a todos' : '🔒 Restrito', inline: true },
          { name: '🔗 Acesso', value: `[Ler completo](${baseUrl}/)`, inline: false }
        ],
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: { text: `ID: ${data.id?.substring(0, 8) || 'N/A'}` }
      };

    default:
      return null;
  }
}