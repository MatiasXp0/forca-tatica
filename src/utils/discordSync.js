// src/utils/discordSync.js - VERSÃO FINAL COM DISCORD REAL

import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// Configurações do Discord
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

// Modo simulação apenas se não tiver token
const SIMULATION_MODE = !DISCORD_CONFIG.token;

// Utilitário de logs
const log = (type, message, data = null) => {
  const colors = {
    info: 'color: #3498db',
    success: 'color: #2ecc71',
    warning: 'color: #f39c12',
    error: 'color: #e74c3c',
    discord: 'color: #7289da'
  };
  
  const emoji = {
    info: '🔵',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    discord: '🤖'
  };
  
  console.log(`${emoji[type] || '📝'} [${type.toUpperCase()}] ${message}`, colors[type] || colors.info);
  if (data && type !== 'discord') console.log(data);
};

/**
 * Faz requisições para a API do Discord
 */
const discordRequest = async (endpoint, method = 'GET', body = null) => {
  if (SIMULATION_MODE) {
    log('discord', `[SIMULAÇÃO] ${method} ${endpoint}`);
    if (endpoint.includes('/messages') && method === 'POST') {
      return { id: `simulated-${Date.now()}` };
    }
    return { success: true };
  }

  const url = `https://discord.com/api/v10${endpoint}`;
  const headers = {
    'Authorization': `Bot ${DISCORD_CONFIG.token}`,
    'Content-Type': 'application/json'
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(url, options);
    
    // Rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 2;
      log('warning', `Rate limit. Aguardando ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return await discordRequest(endpoint, method, body);
    }

    if (!response.ok) {
      const errorText = await response.text();
      log('error', `Discord API ${response.status}: ${errorText}`);
      return null;
    }

    if (response.status === 204) return { success: true };
    return await response.json();
  } catch (error) {
    log('error', `Erro Discord: ${error.message}`);
    return null;
  }
};

/**
 * Cria ou atualiza uma mensagem no Discord
 */
export const upsertDiscordMessage = async (collection, itemId, itemData) => {
  const channelMap = {
    'hierarquia': DISCORD_CONFIG.channels.hierarquia,
    'viaturas': DISCORD_CONFIG.channels.viaturas,
    'fardamentos': DISCORD_CONFIG.channels.fardamentos,
    'comunicados': DISCORD_CONFIG.channels.comunicados
  };

  const channelId = channelMap[collection];
  if (!channelId && !SIMULATION_MODE) {
    log('error', `Canal não configurado para ${collection}`);
    return null;
  }

  const embed = createEmbed(collection, itemData);
  if (!embed) {
    log('error', `Não foi possível criar embed para ${collection}`);
    return null;
  }

  const currentMessageId = itemData.discordMessageId;
  
  // Se já tem messageId, ATUALIZA
  if (currentMessageId && channelId) {
    const result = await discordRequest(
      `/channels/${channelId}/messages/${currentMessageId}`,
      'PATCH',
      { embeds: [embed] }
    );
    
    if (result) {
      log('success', `${collection} atualizado no Discord: ${itemData.nome || itemData.titulo}`);
      return currentMessageId;
    }
  }
  
  // Se não tem messageId, CRIA NOVA
  if (channelId) {
    const result = await discordRequest(
      `/channels/${channelId}/messages`,
      'POST',
      { embeds: [embed] }
    );
    
    if (result?.id) {
      log('success', `${collection} criado no Discord: ${itemData.nome || itemData.titulo}`);
      
      // Salvar messageId no Firebase
      try {
        await updateDoc(doc(db, collection, itemId), {
          discordMessageId: result.id,
          lastDiscordSync: new Date()
        });
      } catch (error) {
        log('error', `Erro ao salvar discordMessageId: ${error.message}`);
      }
      
      return result.id;
    }
  } else if (SIMULATION_MODE) {
    // Modo simulação
    const simulatedId = `simulated-${collection}-${itemId}`;
    log('discord', `${collection} sincronizado: ${itemData.nome || itemData.titulo}`);
    return simulatedId;
  }
  
  return null;
};

/**
 * Remove uma mensagem do Discord
 */
export const deleteDiscordMessage = async (collection, itemData) => {
  if (!itemData.discordMessageId) {
    log('warning', `${collection} não tem messageId para deletar`);
    return false;
  }

  const channelMap = {
    'hierarquia': DISCORD_CONFIG.channels.hierarquia,
    'viaturas': DISCORD_CONFIG.channels.viaturas,
    'fardamentos': DISCORD_CONFIG.channels.fardamentos,
    'comunicados': DISCORD_CONFIG.channels.comunicados
  };

  const channelId = channelMap[collection];
  
  if (channelId && itemData.discordMessageId && !itemData.discordMessageId.startsWith('simulated-')) {
    const result = await discordRequest(
      `/channels/${channelId}/messages/${itemData.discordMessageId}`,
      'DELETE'
    );

    if (result) {
      log('success', `${collection} removido do Discord: ${itemData.nome || itemData.titulo}`);
      return true;
    }
  } else if (SIMULATION_MODE) {
    log('discord', `${collection} removido (simulação): ${itemData.nome || itemData.titulo}`);
    return true;
  }

  return false;
};

/**
 * Cria embeds específicos para cada tipo
 */
const createEmbed = (type, data) => {
  const baseUrl = 'https://forca-tatica.vercel.app';
  
  switch (type) {
    case 'hierarquia':
      const advertCount = data.advertências?.length || 0;
      const advertText = advertCount > 0 
        ? `📋 **${advertCount} registro${advertCount > 1 ? 's' : ''}**\n` +
          data.advertências?.slice(0, 3).map(a => `• ${a.tipo}: ${a.motivo}`).join('\n')
        : 'Nenhum registro';
      
      return {
        title: `🎖️ ${data.patente} - ${data.nome}`,
        description: data.observacoes || '*Sem observações*',
        color: data.ativo ? 0x00ff00 : 0xff0000,
        fields: [
          {
            name: '📊 Status',
            value: data.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**',
            inline: true
          },
          {
            name: '📈 Registros',
            value: advertText,
            inline: false
          },
          {
            name: '🔗 Acesso',
            value: `[Ver detalhes no site](${baseUrl}/hierarquia)`,
            inline: false
          }
        ],
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: {
          text: `ID: ${data.id?.substring(0, 8) || 'N/A'} • Atualizado`
        }
      };

    case 'viaturas':
      return {
        title: `🚗 ${data.nome}`,
        description: `**Modelo:** ${data.modelo}\n${data.descricao || ''}`,
        color: 0x0099ff,
        fields: [
          {
            name: '⚡ Velocidade Máx',
            value: `${data.velocidadeMax || 'N/A'} km/h`,
            inline: true
          },
          {
            name: '📅 Cadastro',
            value: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toLocaleDateString('pt-BR'),
            inline: true
          },
          {
            name: '🔗 Acesso',
            value: `[Ver no site](${baseUrl}/viaturas)`
          }
        ],
        image: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: {
          text: `ID: ${data.id?.substring(0, 8) || 'N/A'}`
        }
      };

    case 'fardamentos':
      const pecasCount = data.pecas?.length || 0;
      let pecasPreview = 'Nenhuma peça cadastrada';
      
      if (pecasCount > 0) {
        const pecasList = data.pecas.slice(0, 3).map(p => {
          if (typeof p === 'string') {
            return `• ${p.substring(0, 40)}${p.length > 40 ? '...' : ''}`;
          }
          return `• ${p.tipo?.toUpperCase() || 'Peça'} ${p.numero || ''}`;
        });
        pecasPreview = pecasList.join('\n');
        if (pecasCount > 3) {
          pecasPreview += `\n... e mais ${pecasCount - 3} peças`;
        }
      }
      
      return {
        title: `👕 ${data.nome}`,
        description: data.descricao || 'Fardamento operacional',
        color: 0xff9900,
        fields: [
          {
            name: '🧩 Peças',
            value: pecasPreview,
            inline: false
          },
          {
            name: '📊 Total',
            value: `${pecasCount} peça${pecasCount !== 1 ? 's' : ''}`,
            inline: true
          },
          {
            name: '🔗 Acesso',
            value: `[Ver composição completa](${baseUrl}/fardamento)`
          }
        ],
        image: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: {
          text: `ID: ${data.id?.substring(0, 8) || 'N/A'} • Clique para ver detalhes`
        }
      };

    case 'comunicados':
      return {
        title: `📢 ${data.titulo}`,
        description: data.conteudo.substring(0, 300) + (data.conteudo.length > 300 ? '...' : ''),
        color: data.tipo === 'INSTRUTIVO' ? 0xff0000 : 0x00aa00,
        fields: [
          {
            name: '📋 Tipo',
            value: data.tipo,
            inline: true
          },
          {
            name: '👁️ Visibilidade',
            value: data.isActive ? '✅ Visível a todos' : '🔒 Restrito',
            inline: true
          },
          {
            name: '🔗 Acesso',
            value: `[Ler completo no site](${baseUrl}/)`
          }
        ],
        timestamp: new Date(data.createdAt?.seconds * 1000 || data.createdAt || Date.now()).toISOString(),
        footer: {
          text: `ID: ${data.id?.substring(0, 8) || 'N/A'}`
        }
      };

    default:
      return null;
  }
};

/**
 * Envia log para o canal de logs
 */
export const sendDiscordLog = async (message, type = 'info') => {
  const channelId = DISCORD_CONFIG.channels.logs;
  
  if (SIMULATION_MODE) {
    log(type, message);
    return true;
  }
  
  if (!channelId) {
    log('warning', 'Canal de logs não configurado');
    return false;
  }

  const colors = {
    info: 0x3498db,
    success: 0x2ecc71,
    warning: 0xf39c12,
    error: 0xe74c3c
  };

  const embed = {
    title: '📋 Log do Sistema',
    description: message,
    color: colors[type] || colors.info,
    timestamp: new Date().toISOString()
  };

  const result = await discordRequest(
    `/channels/${channelId}/messages`,
    'POST',
    { embeds: [embed] }
  );

  return !!result;
};

/**
 * Testa a conexão com o Discord
 */
export const testDiscordConnection = async () => {
  if (SIMULATION_MODE) {
    log('info', 'Modo simulação ativado. Configure o token para usar Discord real.');
    return false;
  }

  try {
    const result = await discordRequest(`/guilds/${DISCORD_CONFIG.guildId}`);
    if (result) {
      log('success', `✅ Conectado ao Discord: ${result.name}`);
      return true;
    }
  } catch (error) {
    log('error', `❌ Falha na conexão com Discord: ${error.message}`);
  }
  
  return false;
};