// src/utils/discordMaster.js - SISTEMA COMPLETO

// ========== CONFIGURAÇÃO ==========
const WEBHOOKS = {
  hierarquia: import.meta.env.VITE_DISCORD_WEBHOOK_HIERARQUIA || '',
  viaturas: import.meta.env.VITE_DISCORD_WEBHOOK_VIATURAS || '',
  fardamentos: import.meta.env.VITE_DISCORD_WEBHOOK_FARDAMENTOS || '',
  comunicados: import.meta.env.VITE_DISCORD_WEBHOOK_COMUNICADOS || '',
  logs: import.meta.env.VITE_DISCORD_WEBHOOK_LOGS || ''
};

// ========== LOGS PROFISSIONAIS ==========
const log = (type, message, data = null) => {
  const styles = {
    success: 'background: #2ecc71; color: white; padding: 2px 6px; border-radius: 3px;',
    error: 'background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px;',
    warning: 'background: #f39c12; color: white; padding: 2px 6px; border-radius: 3px;',
    info: 'background: #3498db; color: white; padding: 2px 6px; border-radius: 3px;'
  };
  
  console.log(`%cDISCORD ${type.toUpperCase()}`, styles[type], message);
  if (data) console.log('📦 Dados:', data);
};

// ========== SISTEMA DE MENSAGENS ÚNICAS ==========
class DiscordMessageManager {
  constructor() {
    this.messageCache = new Map(); // Cache de mensagens por ID
  }

  /**
   * Cria ou atualiza uma mensagem ÚNICA no Discord
   * Retorna o messageId para salvar no Firebase
   */
  async upsertMessage(collection, firebaseId, data) {
    const webhookUrl = WEBHOOKS[collection];
    
    if (!this._validateWebhook(collection, webhookUrl)) {
      return null;
    }

    const embed = this._createProfessionalEmbed(collection, data);
    const messageId = data.discordMessageId;

    try {
      let result;
      
      // SE JÁ TEM MENSAGEM → EDITAR
      if (messageId && this._isValidMessageId(messageId)) {
        result = await this._editExistingMessage(webhookUrl, messageId, embed, collection, data);
      } 
      // SE NÃO TEM MENSAGEM → CRIAR NOVA
      else {
        result = await this._createNewMessage(webhookUrl, embed, collection, data);
      }

      if (result?.id) {
        const fullMessageId = `${webhookUrl}/${result.id}`;
        this.messageCache.set(firebaseId, fullMessageId);
        log('success', `✅ ${collection} sincronizado: ${data.nome || data.titulo}`);
        return fullMessageId;
      }
    } catch (error) {
      log('error', `❌ Erro ao sincronizar ${collection}:`, error.message);
    }
    
    return null;
  }

  /**
   * Remove uma mensagem do Discord
   */
  async deleteMessage(collection, data) {
    if (!data.discordMessageId) {
      log('warning', `⚠️ ${collection} não tem messageId para deletar`);
      return false;
    }

    const webhookUrl = WEBHOOKS[collection];
    if (!webhookUrl) return false;

    try {
      const messageId = data.discordMessageId.split('/').pop();
      const url = `${webhookUrl}/messages/${messageId}`;
      
      const response = await fetch(url, { method: 'DELETE' });
      
      if (response.ok || response.status === 204) {
        log('success', `🗑️ ${collection} removido: ${data.nome || data.titulo}`);
        this.messageCache.delete(data.id);
        return true;
      }
    } catch (error) {
      log('error', `❌ Erro ao deletar ${collection}:`, error.message);
    }
    
    return false;
  }

  /**
   * Notificação rápida (como o sistema antigo)
   */
  async sendNotification(collection, data) {
    const webhookUrl = WEBHOOKS[collection];
    
    if (!this._validateWebhook(collection, webhookUrl)) {
      return false;
    }

    const embed = this._createNotificationEmbed(collection, data);
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [embed],
          content: collection === 'comunicados' && data.tipo === 'INSTRUTIVO' 
            ? '@everyone 📢 **COMUNICADO INSTRUTIVO!**' 
            : ''
        })
      });

      if (response.ok) {
        log('success', `🔔 Notificação ${collection} enviada`);
        return true;
      }
    } catch (error) {
      log('error', `❌ Erro na notificação:`, error.message);
    }
    
    return false;
  }

  // ========== MÉTODOS PRIVADOS ==========
  async _createNewMessage(webhookUrl, embed, collection, data) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        embeds: [embed],
        // Thread para organizar (opcional)
        thread_name: collection === 'hierarquia' ? `Histórico - ${data.nome}` : undefined
      })
    });

    return response.ok ? await response.json() : null;
  }

  async _editExistingMessage(webhookUrl, messageId, embed, collection, data) {
    const msgId = messageId.split('/').pop();
    const url = `${webhookUrl}/messages/${msgId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    return response.ok ? await response.json() : null;
  }

  _validateWebhook(collection, webhookUrl) {
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      log('error', `❌ Webhook ${collection} não configurado!`);
      log('info', `ℹ️ Configure: VITE_DISCORD_WEBHOOK_${collection.toUpperCase()}`);
      return false;
    }
    return true;
  }

  _isValidMessageId(messageId) {
    return messageId && messageId.includes('webhooks/') && messageId.split('/').length > 6;
  }

  // ========== EMBEDS PROFISSIONAIS ==========
  _createProfessionalEmbed(type, data) {
    const baseUrl = 'https://forca-tatica.vercel.app';
    const now = new Date();
    
    const templates = {
      hierarquia: {
        title: `🎖️ ${data.patente}`,
        description: `**${data.nome}**\n${data.observacoes || '_Sem observações_'}`,
        color: data.ativo ? 0x00ff00 : 0xff0000,
        fields: [
          { name: '📊 Status', value: data.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**', inline: true },
          { name: '📈 Registros', value: `${data.advertências?.length || 0}`, inline: true },
          { name: '🆔 ID', value: `\`${data.id?.substring(0, 8) || 'N/A'}\``, inline: true },
          { name: '🔗', value: `[Ver detalhes](${baseUrl}/hierarquia)`, inline: false }
        ],
        thumbnail: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: now.toISOString(),
        footer: { text: 'FORÇA TÁTICA • Atualizado' }
      },
      
      fardamentos: {
        title: `👕 ${data.nome}`,
        description: data.descricao || 'Fardamento operacional',
        color: 0xff9900,
        fields: [
          { name: '🧩 Peças', value: `${data.pecas?.length || 0}`, inline: true },
          { name: '🔗', value: `[Ver composição](${baseUrl}/fardamento)`, inline: false }
        ],
        image: data.fotoURL ? { url: data.fotoURL } : undefined,
        timestamp: now.toISOString(),
        footer: { text: 'Catálogo de Fardamentos' }
      }
    };

    return templates[type] || null;
  }

  _createNotificationEmbed(type, data) {
    // Usa o sistema antigo mas melhorado
    const baseEmbeds = {
      hierarquia: {
        title: `👤 **${data.ativo ? 'NOVO MEMBRO' : 'ATUALIZAÇÃO'}: ${data.nome}**`,
        description: `**Patente:** ${data.patente}`,
        color: data.ativo ? 0x00cc66 : 0xff3333,
        timestamp: new Date().toISOString()
      }
    };
    
    return baseEmbeds[type];
  }
}

// ========== EXPORTAÇÃO ==========
const discordMaster = new DiscordMessageManager();

// Funções compatíveis com seu código atual
export const upsertDiscordMessage = (collection, firebaseId, data) => 
  discordMaster.upsertMessage(collection, firebaseId, data);

export const deleteDiscordMessage = (collection, data) => 
  discordMaster.deleteMessage(collection, data);

export const sendDiscordLog = async (message, type = 'info') => {
  log(type, message);
  
  // Se tiver webhook de logs, envia para Discord também
  if (WEBHOOKS.logs) {
    await discordMaster.sendNotification('logs', {
      titulo: `Log: ${type}`,
      descricao: message
    });
  }
  
  return true;
};

// Sistema de notificações rápido (compatível com antigo)
export const sendDiscordNotification = (type, data) => 
  discordMaster.sendNotification(type, data);

// Exporta a instância completa se precisar
export { discordMaster };