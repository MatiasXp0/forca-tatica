// src/utils/discordBotSystem.js - SISTEMA COMPLETO COM BOT

class DiscordBotSystem {
  constructor() {
    this.proxyUrl = '/api/discord-proxy'; // Nosso proxy na Vercel
    this.messageCache = new Map();
  }

  // ========== MÉTODOS PÚBLICOS ==========
  async syncMembro(membro, action = 'upsert') {
    const embed = this._createMembroEmbed(membro);
    return await this._syncItem('hierarquia', membro, embed, action);
  }

  async syncViatura(viatura, action = 'upsert') {
    const embed = this._createViaturaEmbed(viatura);
    return await this._syncItem('viaturas', viatura, embed, action);
  }

  async syncFardamento(farda, action = 'upsert') {
    const embed = this._createFardamentoEmbed(farda);
    return await this._syncItem('fardamentos', farda, embed, action);
  }

  async syncComunicado(comunicado, action = 'upsert') {
    const embed = this._createComunicadoEmbed(comunicado);
    return await this._syncItem('comunicados', comunicado, embed, action);
  }

  // ========== MÉTODO PRIVADO GENÉRICO ==========
  async _syncItem(type, item, embed, action) {
    const channelIds = {
      hierarquia: import.meta.env.VITE_DISCORD_CHANNEL_HIERARQUIA,
      viaturas: import.meta.env.VITE_DISCORD_CHANNEL_VIATURAS,
      fardamentos: import.meta.env.VITE_DISCORD_CHANNEL_FARDAMENTOS,
      comunicados: import.meta.env.VITE_DISCORD_CHANNEL_COMUNICADOS
    };

    const channelId = channelIds[type];
    if (!channelId) {
      this._log('error', `❌ Canal ${type} não configurado`);
      return null;
    }

    // DELETE
    if (action === 'delete' && item.discordMessageId) {
      const success = await this._callProxy({
        channelId,
        method: 'DELETE',
        messageId: item.discordMessageId
      });
      
      if (success) this.messageCache.delete(item.id);
      return success;
    }

    // UPSERT (create/update)
    const method = item.discordMessageId ? 'PATCH' : 'POST';
    const result = await this._callProxy({
      channelId,
      method,
      messageId: item.discordMessageId,
      embed
    });

    if (result?.id) {
      const fullMessageId = result.id; // Discord retorna só o ID
      this.messageCache.set(item.id, fullMessageId);
      this._log('success', `✅ ${type} sincronizado: ${item.nome || item.titulo}`);
      return fullMessageId;
    }

    return null;
  }

  // ========== CHAMADA AO PROXY ==========
  async _callProxy({ channelId, method, messageId, embed }) {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          method,
          messageId,
          embed
        })
      });

      if (!response.ok) {
        const error = await response.text();
        this._log('error', `❌ Proxy ${response.status}:`, error);
        return null;
      }

      return await response.json();
    } catch (error) {
      this._log('error', `❌ Erro proxy:`, error.message);
      return null;
    }
  }

  // ========== EMBEDS ==========
  _createMembroEmbed(membro) {
    return {
      title: `🎖️ ${membro.patente} - ${membro.nome}`,
      description: membro.observacoes || '*Sem observações*',
      color: membro.ativo ? 0x00ff00 : 0xff0000,
      fields: [
        { name: '📊 Status', value: membro.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**', inline: true },
        { name: '📈 Registros', value: `${membro.advertências?.length || 0}`, inline: true },
        { name: '🔗 Acesso', value: `[Ver detalhes](https://forca-tatica.vercel.app/hierarquia)` }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: `ID: ${membro.id?.substring(0, 8)} • Atualizado` }
    };
  }

  // ... outros embeds

  // ========== LOGS ==========
  _log(type, message) {
    const styles = {
      success: 'color: #2ecc71; font-weight: bold',
      error: 'color: #e74c3c; font-weight: bold',
      info: 'color: #3498db; font-weight: bold'
    };
    console.log(`%c[🤖 BOT] ${message}`, styles[type]);
  }
}

// ========== EXPORTAÇÃO ==========
const discordBot = new DiscordBotSystem();

// Funções compatíveis
export const upsertDiscordMessage = (collection, itemId, itemData) => 
  discordBot[`sync${collection.charAt(0).toUpperCase() + collection.slice(1)}`]?.({
    ...itemData,
    id: itemId
  });

export const deleteDiscordMessage = (collection, itemData) => 
  discordBot[`sync${collection.charAt(0).toUpperCase() + collection.slice(1)}`]?.(itemData, 'delete');

export const sendDiscordLog = async (message, type = 'info') => {
  console.log(`%c[LOG ${type}] ${message}`, 'color: #3498db');
  return true;
};

export { discordBot };