// src/utils/discordSyncManager.js

const DISCORD_BOT_TOKEN = import.meta.env.VITE_DISCORD_BOT_TOKEN;
const GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID;
const CHANNEL_IDS = {
  hierarquia: import.meta.env.VITE_DISCORD_CHANNEL_HIERARQUIA,
  viaturas: import.meta.env.VITE_DISCORD_CHANNEL_VIATURAS,
  fardamentos: import.meta.env.VITE_DISCORD_CHANNEL_FARDAMENTOS,
  comunicados: import.meta.env.VITE_DISCORD_CHANNEL_COMUNICADOS,
  logs: import.meta.env.VITE_DISCORD_CHANNEL_LOGS
};

class DiscordSyncManager {
  constructor() {
    this.baseUrl = 'https://discord.com/api/v10';
  }

  async sendRequest(endpoint, method = 'GET', body = null) {
    const headers = {
      'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    };

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Erro na requisição Discord:', error);
      return null;
    }
  }

  // CRIA ou ATUALIZA uma mensagem
  async upsertMessage(channelId, messageId = null, embed) {
    const endpoint = messageId 
      ? `/channels/${channelId}/messages/${messageId}` // EDITAR
      : `/channels/${channelId}/messages`; // CRIAR
    
    const method = messageId ? 'PATCH' : 'POST';
    
    return await this.sendRequest(endpoint, method, { embeds: [embed] });
  }

  // DELETA uma mensagem
  async deleteMessage(channelId, messageId) {
    return await this.sendRequest(`/channels/${channelId}/messages/${messageId}`, 'DELETE');
  }

  // Sincroniza um membro da hierarquia
  async syncMembro(membro, action = 'upsert') {
    const channelId = CHANNEL_IDS.hierarquia;
    if (!channelId || !membro.id) return;

    const embed = {
      title: `🎖️ ${membro.patente} - ${membro.nome}`,
      description: membro.observacoes || 'Sem observações',
      color: membro.ativo ? 0x00ff00 : 0xff0000,
      fields: [
        {
          name: '📊 Status',
          value: membro.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**',
          inline: true
        },
        {
          name: '📈 Registros',
          value: `${membro.advertências?.length || 0} registros`,
          inline: true
        },
        {
          name: '🔗 Acesso',
          value: `[Ver no Site](https://forca-tatica.vercel.app/hierarquia)`
        }
      ],
      timestamp: new Date(membro.createdAt?.seconds * 1000 || Date.now()).toISOString(),
      footer: {
        text: `ID: ${membro.id.substring(0, 8)} • Atualizado em`
      }
    };

    if (action === 'delete' && membro.discordMessageId) {
      await this.deleteMessage(channelId, membro.discordMessageId);
      return null;
    }

    const result = await this.upsertMessage(channelId, membro.discordMessageId, embed);
    
    if (result && result.id) {
      return result.id; // Retorna o messageId
    }
    
    return null;
  }

  // Sincroniza uma viatura
  async syncViatura(viatura, action = 'upsert') {
    const channelId = CHANNEL_IDS.viaturas;
    if (!channelId || !viatura.id) return;

    const embed = {
      title: `🚗 ${viatura.nome}`,
      description: `**Modelo:** ${viatura.modelo}\n${viatura.descricao || ''}`,
      color: 0x0099ff,
      fields: [
        {
          name: '⚡ Velocidade Máx',
          value: `${viatura.velocidadeMax || 'N/A'} km/h`,
          inline: true
        },
        {
          name: '🔗 Acesso',
          value: `[Ver no Site](https://forca-tatica.vercel.app/viaturas)`
        }
      ],
      image: viatura.fotoURL ? { url: viatura.fotoURL } : undefined,
      timestamp: new Date(viatura.createdAt?.seconds * 1000 || Date.now()).toISOString(),
      footer: {
        text: `ID: ${viatura.id.substring(0, 8)}`
      }
    };

    if (action === 'delete' && viatura.discordMessageId) {
      await this.deleteMessage(channelId, viatura.discordMessageId);
      return null;
    }

    const result = await this.upsertMessage(channelId, viatura.discordMessageId, embed);
    return result?.id;
  }

  // Sincroniza um fardamento
  async syncFardamento(farda, action = 'upsert') {
    const channelId = CHANNEL_IDS.fardamentos;
    if (!channelId || !farda.id) return;

    // Criar lista de peças formatada
    const pecasList = farda.pecas?.slice(0, 5).map((p, i) => {
      if (typeof p === 'string') {
        return `• ${p.substring(0, 50)}${p.length > 50 ? '...' : ''}`;
      }
      return `• ${p.tipo?.toUpperCase() || 'Peça'} ${p.numero || ''} ${p.textura ? `(TXT ${p.textura})` : ''}`;
    }).join('\n') || 'Nenhuma peça cadastrada';

    const embed = {
      title: `👕 ${farda.nome}`,
      description: farda.descricao || 'Sem descrição detalhada',
      color: 0xff9900,
      fields: [
        {
          name: '🧩 Peças',
          value: pecasList,
          inline: false
        },
        {
          name: '📊 Total',
          value: `${farda.pecas?.length || 0} peças`,
          inline: true
        },
        {
          name: '🔗 Acesso',
          value: `[Ver Detalhes no Site](https://forca-tatica.vercel.app/fardamento)`
        }
      ],
      image: farda.fotoURL ? { url: farda.fotoURL } : undefined,
      timestamp: new Date(farda.createdAt?.seconds * 1000 || Date.now()).toISOString(),
      footer: {
        text: `ID: ${farda.id.substring(0, 8)} • Clique no link para ver composição completa`
      }
    };

    if (action === 'delete' && farda.discordMessageId) {
      await this.deleteMessage(channelId, farda.discordMessageId);
      return null;
    }

    const result = await this.upsertMessage(channelId, farda.discordMessageId, embed);
    return result?.id;
  }

  // Sincroniza um comunicado
  async syncComunicado(comunicado, action = 'upsert') {
    const channelId = CHANNEL_IDS.comunicados;
    if (!channelId || !comunicado.id) return;

    const embed = {
      title: `📢 ${comunicado.titulo}`,
      description: comunicado.conteudo.substring(0, 500) + (comunicado.conteudo.length > 500 ? '...' : ''),
      color: comunicado.tipo === 'INSTRUTIVO' ? 0xff0000 : 0x00aa00,
      fields: [
        {
          name: '📋 Tipo',
          value: comunicado.tipo,
          inline: true
        },
        {
          name: '👁️ Visibilidade',
          value: comunicado.isActive ? '✅ Visível' : '❌ Oculto',
          inline: true
        },
        {
          name: '🔗 Acesso',
          value: `[Ler Completo no Site](https://forca-tatica.vercel.app/)`
        }
      ],
      timestamp: new Date(comunicado.createdAt?.seconds * 1000 || Date.now()).toISOString(),
      footer: {
        text: `ID: ${comunicado.id.substring(0, 8)}`
      }
    };

    if (action === 'delete' && comunicado.discordMessageId) {
      await this.deleteMessage(channelId, comunicado.discordMessageId);
      return null;
    }

    const result = await this.upsertMessage(channelId, comunicado.discordMessageId, embed);
    return result?.id;
  }

  // Log de sistema
  async logSystem(message) {
    const channelId = CHANNEL_IDS.logs;
    if (!channelId) return;

    const embed = {
      title: '📋 Log do Sistema',
      description: message,
      color: 0x666666,
      timestamp: new Date().toISOString()
    };

    await this.sendRequest(`/channels/${channelId}/messages`, 'POST', { embeds: [embed] });
  }
}

export const discordSync = new DiscordSyncManager();