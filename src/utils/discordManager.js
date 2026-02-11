// src/utils/discordManager.js
// SISTEMA COMPLETO E UNIFICADO - USANDO WEBHOOKS

class DiscordManager {
  constructor() {
    // Webhooks por tipo (crie um webhook para cada canal)
    this.webhooks = {
      hierarquia: import.meta.env.VITE_DISCORD_WEBHOOK_HIERARQUIA,
      viaturas: import.meta.env.VITE_DISCORD_WEBHOOK_VIATURAS,
      fardamentos: import.meta.env.VITE_DISCORD_WEBHOOK_FARDAMENTOS,
      comunicados: import.meta.env.VITE_DISCORD_WEBHOOK_COMUNICADOS,
      logs: import.meta.env.VITE_DISCORD_WEBHOOK_LOGS // Opcional
    };
    
    // Cache para mensagens
    this.messageCache = new Map();
    this.initialized = false;
    
    this._init();
  }

  _init() {
    // Verificar configurações
    const missingWebhooks = Object.entries(this.webhooks)
      .filter(([key, value]) => !value && key !== 'logs')
      .map(([key]) => key);
    
    if (missingWebhooks.length > 0) {
      console.warn('⚠️ Discord: Webhooks não configurados:', missingWebhooks.join(', '));
    }
    
    this.initialized = true;
    console.log('✅ Discord Manager inicializado');
  }

  // ========== MÉTODOS PRINCIPAIS ==========

  // HIERARQUIA
  async syncHierarquia(membro, action = 'upsert') {
    return await this._syncItem({
      type: 'hierarquia',
      item: membro,
      action,
      createEmbed: this._createMembroEmbed.bind(this)
    });
  }

  // VIATURAS
  async syncViatura(viatura, action = 'upsert') {
    return await this._syncItem({
      type: 'viaturas',
      item: viatura,
      action,
      createEmbed: this._createViaturaEmbed.bind(this)
    });
  }

  // FARDAMENTOS
  async syncFardamento(fardamento, action = 'upsert') {
    return await this._syncItem({
      type: 'fardamentos',
      item: fardamento,
      action,
      createEmbed: this._createFardamentoEmbed.bind(this)
    });
  }

  // COMUNICADOS
  async syncComunicado(comunicado, action = 'upsert') {
    return await this._syncItem({
      type: 'comunicados',
      item: comunicado,
      action,
      createEmbed: this._createComunicadoEmbed.bind(this)
    });
  }

  // ========== SISTEMA GENÉRICO DE SINCRONIZAÇÃO ==========

  async _syncItem({ type, item, action, createEmbed }) {
    const webhookUrl = this.webhooks[type];
    
    if (!webhookUrl) {
      this._log('error', `❌ Webhook ${type} não configurado`);
      return null;
    }

    try {
      // DELETE - Apagar mensagem
      if (action === 'delete') {
        if (!item.discordMessageId) {
          this._log('warning', `${type}: Sem ID para deletar`, item.id);
          return true;
        }

        const deleted = await this._deleteMessage(webhookUrl, item.discordMessageId);
        if (deleted) {
          this.messageCache.delete(item.id);
          this._log('success', `🗑️ ${type} removido: ${item.nome || item.titulo || item.id}`);
        }
        return deleted;
      }

      // UPSERT - Criar ou atualizar
      const embed = createEmbed(item, action);
      
      // Se já tem mensagem, tenta atualizar
      if (item.discordMessageId) {
        const updated = await this._editMessage(
          webhookUrl, 
          item.discordMessageId, 
          embed
        );
        
        if (updated) {
          this._log('success', `✏️ ${type} atualizado: ${item.nome || item.titulo || item.id}`);
          return item.discordMessageId;
        }
      }

      // Se não tem ou falhou atualização, cria nova
      const messageId = await this._sendMessage(webhookUrl, embed);
      
      if (messageId) {
        this.messageCache.set(item.id, messageId);
        this._log('success', `✅ ${type} publicado: ${item.nome || item.titulo || item.id}`);
        return messageId;
      }

      return null;
    } catch (error) {
      this._log('error', `❌ Erro ${type}:`, error.message);
      return null;
    }
  }

  // ========== COMUNICAÇÃO COM DISCORD ==========

  async _sendMessage(webhookUrl, embed) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [embed],
          username: 'Força Tática',
          avatar_url: 'https://forca-tatica.vercel.app/logo.png' // Coloque seu logo
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      this._log('error', 'Falha ao enviar:', error.message);
      return null;
    }
  }

  async _editMessage(webhookUrl, messageId, embed) {
    try {
      const response = await fetch(`${webhookUrl}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [embed]
        })
      });

      return response.ok;
    } catch (error) {
      this._log('error', 'Falha ao editar:', error.message);
      return false;
    }
  }

  async _deleteMessage(webhookUrl, messageId) {
    try {
      const response = await fetch(`${webhookUrl}/messages/${messageId}`, {
        method: 'DELETE'
      });
      return response.ok;
    } catch (error) {
      this._log('error', 'Falha ao deletar:', error.message);
      return false;
    }
  }

  // ========== EMBEDS COMPLETOS ==========

  _createMembroEmbed(membro, action = 'upsert') {
    const isDelete = action === 'delete';
    const totalAdvertencias = membro.advertências?.filter(a => a.tipo === 'advertencia').length || 0;
    const totalElogios = membro.advertências?.filter(a => a.tipo === 'elogio').length || 0;
    const totalAusencias = membro.advertências?.filter(a => a.tipo === 'ausencia').length || 0;
    
    // Última atividade
    const ultimaAtividade = membro.advertências?.length > 0 
      ? membro.advertências[membro.advertências.length - 1]
      : null;
    
    return {
      title: isDelete ? `❌ MEMBRO REMOVIDO: ${membro.nome}` : `🎖️ ${membro.patente} - ${membro.nome}`,
      description: isDelete 
        ? 'Este membro foi removido do batalhão'
        : (membro.observacoes || 'Membro da Força Tática'),
      color: isDelete ? 0xFF0000 : (membro.ativo ? 0x00FF00 : 0xFF0000),
      fields: [
        {
          name: '📊 Status',
          value: isDelete ? '❌ Removido' : (membro.ativo ? '✅ ATIVO' : '❌ INATIVO'),
          inline: true
        },
        {
          name: '⚠️ Advertências',
          value: `${totalAdvertencias}`,
          inline: true
        },
        {
          name: '🎯 Elogios',
          value: `${totalElogios}`,
          inline: true
        },
        {
          name: '📋 Ausências',
          value: `${totalAusencias}`,
          inline: true
        },
        {
          name: '📈 Total Registros',
          value: `${membro.advertências?.length || 0}`,
          inline: true
        }
      ],
      ...(ultimaAtividade && !isDelete && {
        fields: [
          ...this._lastField,
          {
            name: '🕐 Última Atividade',
            value: `${ultimaAtividade.tipo}: ${ultimaAtividade.motivo}\n${ultimaAtividade.dataInicio}`,
            inline: false
          }
        ]
      }),
      timestamp: new Date().toISOString(),
      footer: {
        text: `ID: ${membro.id?.substring(0, 8)} • Força Tática • Atualizado em tempo real`
      },
      ...(membro.fotoURL && !isDelete && {
        thumbnail: { url: membro.fotoURL }
      })
    };
  }

  _createViaturaEmbed(viatura, action = 'upsert') {
    const isDelete = action === 'delete';
    
    return {
      title: isDelete ? `❌ VIATURA REMOVIDA: ${viatura.nome}` : `🚗 ${viatura.nome}`,
      description: isDelete 
        ? 'Esta viatura foi removida da frota'
        : (viatura.descricao || 'Viatura operacional'),
      color: isDelete ? 0xFF0000 : 0x3498db,
      fields: [
        {
          name: '📋 Modelo',
          value: viatura.modelo || 'Não informado',
          inline: true
        },
        {
          name: '⚡ Velocidade Máx',
          value: viatura.velocidadeMax ? `${viatura.velocidadeMax} km/h` : 'N/I',
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isDelete ? 'Viatura removida permanentemente' : 'Clique no link para ver detalhes'
      }
    };
  }

  _createFardamentoEmbed(fardamento, action = 'upsert') {
    const isDelete = action === 'delete';
    const totalPecas = fardamento.pecas?.length || 0;
    
    // Lista resumida das peças
    const listaPecas = fardamento.pecas?.slice(0, 5).map(p => {
      if (typeof p === 'string') return `• ${p.split('|')[0]}`;
      return `• ${p.tipo} ${p.numero}${p.textura ? ` (TXT ${p.textura})` : ''}`;
    }).join('\n');

    return {
      title: isDelete ? `❌ FARDAMENTO REMOVIDO: ${fardamento.nome}` : `👕 ${fardamento.nome}`,
      description: isDelete 
        ? 'Este fardamento foi removido do catálogo'
        : (fardamento.descricao || 'Fardamento operacional'),
      color: isDelete ? 0xFF0000 : 0x9b59b6,
      fields: [
        {
          name: '📦 Peças',
          value: `${totalPecas} ${totalPecas === 1 ? 'item' : 'itens'}`,
          inline: true
        },
        {
          name: '🔧 Status',
          value: isDelete ? '❌ Removido' : '✅ Disponível',
          inline: true
        },
        ...(totalPecas > 0 && !isDelete ? [{
          name: '📋 Composição',
          value: listaPecas || 'Nenhuma peça listada',
          inline: false
        }] : [])
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isDelete ? 'Fardamento removido do sistema' : 'Clique para ver composição completa'
      }
    };
  }

  _createComunicadoEmbed(comunicado, action = 'upsert') {
    const isDelete = action === 'delete';
    
    return {
      title: isDelete ? `❌ COMUNICADO REMOVIDO: ${comunicado.titulo}` : `📢 ${comunicado.titulo}`,
      description: isDelete 
        ? 'Este comunicado foi removido'
        : (comunicado.conteudo?.substring(0, 200) + (comunicado.conteudo?.length > 200 ? '...' : '')),
      color: isDelete ? 0xFF0000 : (comunicado.tipo === 'INSTRUTIVO' ? 0xF1C40F : 0x3498db),
      fields: [
        {
          name: '📌 Tipo',
          value: comunicado.tipo || 'INFORMATIVO',
          inline: true
        },
        {
          name: '👤 Autor',
          value: 'Força Tática',
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isDelete ? 'Comunicado removido' : 'Leia o comunicado completo no site'
      }
    };
  }

  // ========== UTILITÁRIOS ==========

  _log(type, message, ...args) {
    const colors = {
      success: '#2ecc71',
      error: '#e74c3c',
      warning: '#f39c12',
      info: '#3498db'
    };
    
    console.log(
      `%c[📢 DISCORD] ${message}`,
      `color: ${colors[type] || '#95a5a6'}; font-weight: bold`,
      ...args
    );
  }

  // LIMPAR CACHE
  clearCache() {
    this.messageCache.clear();
    this._log('info', 'Cache limpo');
  }
}

// Instância única
const discordManager = new DiscordManager();

// ========== EXPORTAÇÕES COMPATÍVEIS ==========

export const syncDiscord = {
  hierarquia: (membro, action) => discordManager.syncHierarquia(membro, action),
  viaturas: (viatura, action) => discordManager.syncViatura(viatura, action),
  fardamentos: (fardamento, action) => discordManager.syncFardamento(fardamento, action),
  comunicados: (comunicado, action) => discordManager.syncComunicado(comunicado, action)
};

// Funções para compatibilidade
export const upsertDiscordMessage = (collection, itemId, itemData) => {
  return syncDiscord[collection]?.({ ...itemData, id: itemId }, 'upsert');
};

export const deleteDiscordMessage = (collection, itemData) => {
  return syncDiscord[collection]?.(itemData, 'delete');
};

export const sendDiscordLog = async (message, type = 'info') => {
  if (discordManager.webhooks.logs) {
    // Envia log se tiver webhook configurado
  }
  console.log(`%c[📋 LOG] ${message}`, 'color: #9b59b6');
  return true;
};

export default discordManager;