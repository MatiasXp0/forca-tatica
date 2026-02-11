// src/utils/discordSync.js

import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// Configurações do Discord
const DISCORD_CONFIG = {
  token: import.meta.env.VITE_DISCORD_BOT_TOKEN,
  guildId: import.meta.env.VITE_DISCORD_GUILD_ID,
  channels: {
    hierarquia: import.meta.env.VITE_DISCORD_CHANNEL_HIERARQUIA,
    viaturas: import.meta.env.VITE_DISCORD_CHANNEL_VIATURAS,
    fardamentos: import.meta.env.VITE_DISCORD_CHANNEL_FARDAMENTOS,
    comunicados: import.meta.env.VITE_DISCORD_CHANNEL_COMUNICADOS,
    logs: import.meta.env.VITE_DISCORD_CHANNEL_LOGS,
  },
};

// Verificar se as configurações estão disponíveis
const isDiscordConfigured = () => {
  return (
    DISCORD_CONFIG.token &&
    DISCORD_CONFIG.guildId &&
    DISCORD_CONFIG.channels.hierarquia &&
    DISCORD_CONFIG.channels.viaturas &&
    DISCORD_CONFIG.channels.fardamentos &&
    DISCORD_CONFIG.channels.comunicados
  );
};

/**
 * Faz requisições para a API do Discord VIA NOSSO PROXY NA VERCEL
 */
const discordRequest = async (endpoint, method = 'GET', body = null) => {
  if (!isDiscordConfigured()) {
    console.warn(
      'Discord não configurado. Configure as variáveis de ambiente.'
    );
    return null;
  }

  // 1. Extrair informações da URL do Discord para passar ao nosso proxy
  const channelMatch = endpoint.match(
    /\/channels\/(\d+)\/messages(?:\/(\d+))?/
  );

  if (!channelMatch) {
    console.error(`Endpoint do Discord não suportado pelo proxy: ${endpoint}`);
    return null;
  }

  const [, channelId, messageId] = channelMatch;

  // 2. Dados que vamos enviar para nosso proxy na Vercel
  const proxyData = {
    channelId,
    method: method.toUpperCase(),
    messageId: messageId || null,
    embed: body?.embeds?.[0] || null,
  };

  try {
    // 3. Chamar NOSSO ENDPOINT na Vercel (api/discord-proxy.js)
    const response = await fetch('/api/discord-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proxyData),
    });

    // 4. Lidar com rate limiting do Discord (passado pelo proxy)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 2;
      console.log(`Rate limit atingido. Aguardando ${retryAfter} segundos...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return await discordRequest(endpoint, method, body);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro via proxy ${response.status}:`, errorText);
      return null;
    }

    if (response.status === 204 || method.toUpperCase() === 'DELETE') {
      return { success: true };
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao chamar proxy para Discord:', error);
    return null;
  }
};

/**
 * Cria ou atualiza uma mensagem no Discord
 */
export const upsertDiscordMessage = async (collection, itemId, itemData) => {
  const channelMap = {
    hierarquia: DISCORD_CONFIG.channels.hierarquia,
    viaturas: DISCORD_CONFIG.channels.viaturas,
    fardamentos: DISCORD_CONFIG.channels.fardamentos,
    comunicados: DISCORD_CONFIG.channels.comunicados,
  };

  const channelId = channelMap[collection];
  if (!channelId) {
    console.error(`Canal não configurado para ${collection}`);
    return null;
  }

  // Buscar messageId atual do Firebase
  let currentMessageId = itemData.discordMessageId;

  // Criar embed baseado no tipo
  const embed = createEmbed(collection, itemData);

  if (!embed) {
    console.error(`Não foi possível criar embed para ${collection}`);
    return null;
  }

  // Se já tem messageId, atualiza a mensagem existente
  if (currentMessageId) {
    const result = await discordRequest(
      `/channels/${channelId}/messages/${currentMessageId}`,
      'PATCH',
      { embeds: [embed] }
    );

    if (result) {
      console.log(
        `✅ ${collection} atualizado no Discord: ${
          itemData.nome || itemData.titulo
        }`
      );
      return currentMessageId;
    }
  }

  // Se não tem messageId, cria nova mensagem
  const result = await discordRequest(
    `/channels/${channelId}/messages`,
    'POST',
    { embeds: [embed] }
  );

  if (result && result.id) {
    console.log(
      `✅ ${collection} criado no Discord: ${itemData.nome || itemData.titulo}`
    );

    // Salvar messageId no Firebase
    try {
      await updateDoc(doc(db, collection, itemId), {
        discordMessageId: result.id,
        lastDiscordSync: new Date(),
      });
    } catch (error) {
      console.error('Erro ao salvar discordMessageId:', error);
    }

    return result.id;
  }

  return null;
};

/**
 * Remove uma mensagem do Discord
 */
export const deleteDiscordMessage = async (collection, itemData) => {
  if (!itemData.discordMessageId) {
    console.log(`⚠️ ${collection} não tem messageId para deletar`);
    return false;
  }

  const channelMap = {
    hierarquia: DISCORD_CONFIG.channels.hierarquia,
    viaturas: DISCORD_CONFIG.channels.viaturas,
    fardamentos: DISCORD_CONFIG.channels.fardamentos,
    comunicados: DISCORD_CONFIG.channels.comunicados,
  };

  const channelId = channelMap[collection];
  if (!channelId) return false;

  const result = await discordRequest(
    `/channels/${channelId}/messages/${itemData.discordMessageId}`,
    'DELETE'
  );

  if (result) {
    console.log(
      `🗑️ ${collection} removido do Discord: ${
        itemData.nome || itemData.titulo
      }`
    );
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
      const advertText =
        advertCount > 0
          ? `📋 **${advertCount} registro${advertCount > 1 ? 's' : ''}**\n` +
            data.advertências
              ?.slice(0, 3)
              .map((a) => `• ${a.tipo}: ${a.motivo}`)
              .join('\n')
          : 'Nenhum registro';

      return {
        title: `🎖️ ${data.patente} - ${data.nome}`,
        description: data.observacoes || '*Sem observações*',
        color: data.ativo ? 0x00ff00 : 0xff0000,
        fields: [
          {
            name: '📊 Status',
            value: data.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**',
            inline: true,
          },
          {
            name: '📈 Registros',
            value: advertText,
            inline: false,
          },
          {
            name: '🔗 Acesso',
            value: `[Ver detalhes no site](${baseUrl}/hierarquia)`,
            inline: false,
          },
        ],
        timestamp: new Date(
          data.createdAt?.seconds * 1000 || data.createdAt || Date.now()
        ).toISOString(),
        footer: {
          text: `ID: ${data.id?.substring(0, 8) || 'N/A'} • Atualizado`,
        },
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
            inline: true,
          },
          {
            name: '📅 Cadastro',
            value: new Date(
              data.createdAt?.seconds * 1000 || data.createdAt || Date.now()
            ).toLocaleDateString('pt-BR'),
            inline: true,
          },
          {
            name: '🔗 Acesso',
            value: `[Ver no site](${baseUrl}/viaturas)`,
          },
        ],
        image: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: new Date(
          data.createdAt?.seconds * 1000 || data.createdAt || Date.now()
        ).toISOString(),
        footer: {
          text: `ID: ${data.id?.substring(0, 8) || 'N/A'}`,
        },
      };

    case 'fardamentos':
      const pecasCount = data.pecas?.length || 0;
      let pecasPreview = 'Nenhuma peça cadastrada';

      if (pecasCount > 0) {
        const pecasList = data.pecas.slice(0, 3).map((p) => {
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
            inline: false,
          },
          {
            name: '📊 Total',
            value: `${pecasCount} peça${pecasCount !== 1 ? 's' : ''}`,
            inline: true,
          },
          {
            name: '🔗 Acesso',
            value: `[Ver composição completa](${baseUrl}/fardamento)`,
          },
        ],
        image: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: new Date(
          data.createdAt?.seconds * 1000 || data.createdAt || Date.now()
        ).toISOString(),
        footer: {
          text: `ID: ${
            data.id?.substring(0, 8) || 'N/A'
          } • Clique para ver detalhes`,
        },
      };

    case 'comunicados':
      return {
        title: `📢 ${data.titulo}`,
        description:
          data.conteudo.substring(0, 300) +
          (data.conteudo.length > 300 ? '...' : ''),
        color: data.tipo === 'INSTRUTIVO' ? 0xff0000 : 0x00aa00,
        fields: [
          {
            name: '📋 Tipo',
            value: data.tipo,
            inline: true,
          },
          {
            name: '👁️ Visibilidade',
            value: data.isActive ? '✅ Visível a todos' : '🔒 Restrito',
            inline: true,
          },
          {
            name: '🔗 Acesso',
            value: `[Ler completo no site](${baseUrl}/)`,
          },
        ],
        timestamp: new Date(
          data.createdAt?.seconds * 1000 || data.createdAt || Date.now()
        ).toISOString(),
        footer: {
          text: `ID: ${data.id?.substring(0, 8) || 'N/A'}`,
        },
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
  if (!channelId) return;

  const colors = {
    info: 0x3498db,
    success: 0x2ecc71,
    warning: 0xf39c12,
    error: 0xe74c3c,
  };

  const embed = {
    title: '📋 Log do Sistema',
    description: message,
    color: colors[type] || colors.info,
    timestamp: new Date().toISOString(),
  };

  await discordRequest(`/channels/${channelId}/messages`, 'POST', {
    embeds: [embed],
  });
};

/**
 * Inicializa a sincronização para uma coleção
 */
export const initCollectionSync = async (collection, onDataChange) => {
  if (!isDiscordConfigured()) {
    console.warn(
      `Sincronização de ${collection} desativada - Discord não configurado`
    );
    return () => {}; // Retorna função vazia para unsubscribe
  }

  console.log(`🔄 Iniciando sincronização para ${collection}`);

  // Enviar log inicial
  await sendDiscordLog(
    `🔄 Sincronização iniciada para **${collection}**`,
    'info'
  );

  return onDataChange;
};
