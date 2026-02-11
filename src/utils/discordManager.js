// src/utils/discordManager.js
// SISTEMA COMPLETO DE INTEGRAÇÃO COM DISCORD VIA WEBHOOKS

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

class DiscordManager {
  constructor() {
    this.webhooks = {
      hierarquia: import.meta.env.VITE_DISCORD_WEBHOOK_HIERARQUIA,
      viaturas: import.meta.env.VITE_DISCORD_WEBHOOK_VIATURAS,
      fardamentos: import.meta.env.VITE_DISCORD_WEBHOOK_FARDAMENTOS,
      comunicados: import.meta.env.VITE_DISCORD_WEBHOOK_COMUNICADOS,
      logs: import.meta.env.VITE_DISCORD_WEBHOOK_LOGS
    };
    
    this.messageCache = new Map();
    this.ordemPatentes = [
      'Tenente Coronel',
      'Major',
      'Capitão',
      '1° Tenente',
      '2° Tenente',
      'Aspirante a Oficial',
      'Sub Tenente',
      '1° Sargento',
      '2° Sargento',
      '3° Sargento',
      'Cabo',
      'Soldado 1° Classe',
      'Soldado 2° Classe'
    ];
    
    this._init();
  }

  _init() {
    const missingWebhooks = Object.entries(this.webhooks)
      .filter(([key, value]) => !value && key !== 'logs')
      .map(([key]) => key);
    
    if (missingWebhooks.length > 0) {
      console.warn('⚠️ Discord: Webhooks não configurados:', missingWebhooks.join(', '));
    }
    
    console.log('✅ Discord Manager inicializado');
  }

  // ========== MÉTODOS PRINCIPAIS ==========

  // HIERARQUIA - LISTA COMPLETA
  async syncHierarquiaLista(membros) {
    const webhookUrl = this.webhooks.hierarquia;
    if (!webhookUrl) {
      this._log('error', '❌ Webhook hierarquia não configurado');
      return null;
    }

    // Ordenar por patente
    const membrosOrdenados = [...membros].sort((a, b) => 
      this.ordemPatentes.indexOf(a.patente) - this.ordemPatentes.indexOf(b.patente)
    );

    // Agrupar por patente
    const agrupado = {};
    membrosOrdenados.forEach(membro => {
      if (!agrupado[membro.patente]) agrupado[membro.patente] = [];
      agrupado[membro.patente].push(membro);
    });

    // Criar descrição formatada
    let description = '';
    
    this.ordemPatentes.forEach(patente => {
      const membrosPatente = agrupado[patente] || [];
      if (membrosPatente.length === 0) return;
      
      description += `**${patente}** ${membrosPatente.length > 1 ? `(${membrosPatente.length})` : ''}\n`;
      
      membrosPatente.forEach(m => {
        const status = m.ativo ? '✅' : '❌';
        const advertencias = m.advertências?.filter(a => a.tipo === 'advertencia').length || 0;
        const emojiAdvertencia = advertencias > 0 ? '⚠️' : '✨';
        
        description += `${status} **${m.nome}** - ${emojiAdvertencia} ${advertencias}/3\n`;
        
        // Última atividade
        if (m.advertências?.length > 0) {
          const ultima = m.advertências[m.advertências.length - 1];
          const data = ultima.dataInicio?.split('-').reverse().join('/') || 'N/I';
          const motivo = ultima.motivo?.substring(0, 30) || '';
          description += `└ 🕐 ${ultima.tipo}: ${motivo}${motivo.length > 30 ? '...' : ''} (${data})\n`;
        }
      });
      description += '\n';
    });

    // Limitar tamanho (Discord: 4096 caracteres)
    if (description.length > 4000) {
      description = description.substring(0, 3990) + '...\n\n*(Lista truncada)*';
    }

    const embed = {
      title: '🎖️ HIERARQUIA DO BATALHÃO',
      description: description || 'Nenhum membro cadastrado',
      color: 0x003366,
      fields: [
        {
          name: '📊 ESTATÍSTICAS',
          value: `👥 **Total:** ${membros.length} membros\n✅ **Ativos:** ${membros.filter(m => m.ativo).length}\n⚠️ **Advertências:** ${membros.reduce((acc, m) => acc + (m.advertências?.filter(a => a.tipo === 'advertencia').length || 0), 0)}`,
          inline: false
        },
        {
          name: '🔗 ACESSO RÁPIDO',
          value: '[📋 Ver Hierarquia Completa](https://forca-tatica.vercel.app/hierarquia) | [➕ Novo Membro](https://forca-tatica.vercel.app/hierarquia?novo)',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Força Tática PMESP • Atualizado em tempo real',
        icon_url: 'https://forca-tatica.vercel.app/favicon.ico'
      }
    };

    try {
      const mensagemId = await this._getMensagemHierarquia();
      
      if (mensagemId) {
        await this._editMessage(webhookUrl, mensagemId, embed);
        this._log('success', '✅ Hierarquia atualizada no Discord');
        return mensagemId;
      } else {
        const novaMensagemId = await this._sendMessage(webhookUrl, embed);
        await this._salvarMensagemHierarquia(novaMensagemId);
        this._log('success', '✅ Hierarquia publicada no Discord');
        return novaMensagemId;
      }
    } catch (error) {
      this._log('error', '❌ Erro ao sincronizar hierarquia:', error);
      return null;
    }
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

      const embed = createEmbed(item, action);
      
      if (item.discordMessageId) {
        const updated = await this._editMessage(webhookUrl, item.discordMessageId, embed);
        if (updated) {
          this._log('success', `✏️ ${type} atualizado: ${item.nome || item.titulo || item.id}`);
          return item.discordMessageId;
        }
      }

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
          avatar_url: 'https://forca-tatica.vercel.app/logo.png'
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

  // ========== GERENCIAMENTO DA MENSAGEM DA HIERARQUIA ==========

  async _getMensagemHierarquia() {
    try {
      const docRef = doc(db, 'config', 'discord_hierarquia');
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data().messageId : null;
    } catch (error) {
      this._log('error', 'Erro ao buscar mensagem da hierarquia:', error);
      return null;
    }
  }

  async _salvarMensagemHierarquia(messageId) {
    try {
      const docRef = doc(db, 'config', 'discord_hierarquia');
      await setDoc(docRef, {
        messageId,
        updatedAt: new Date()
      }, { merge: true });
      return true;
    } catch (error) {
      this._log('error', 'Erro ao salvar mensagem da hierarquia:', error);
      return false;
    }
  }

  // ========== EMBEDS COMPLETOS ==========

  _createViaturaEmbed(viatura, action = 'upsert') {
    const isDelete = action === 'delete';
    const url = `https://forca-tatica.vercel.app/viaturas?id=${viatura.id}`;
    
    const embed = {
      title: isDelete ? `❌ VIATURA REMOVIDA: ${viatura.nome}` : `🚗 ${viatura.nome}`,
      description: isDelete
        ? 'Esta viatura foi removida da frota'
        : (viatura.descricao || 'Viatura operacional da Força Tática'),
      color: isDelete ? 0xFF0000 : 0x3498db,
      fields: [
        {
          name: '📋 MODELO',
          value: viatura.modelo || 'Não informado',
          inline: true
        },
        {
          name: '⚡ VELOCIDADE',
          value: viatura.velocidadeMax ? `${viatura.velocidadeMax} km/h` : 'N/I',
          inline: true
        },
        {
          name: '🔗 DETALHES',
          value: `[🔍 Ver ficha completa da viatura](${url})`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isDelete ? 'Viatura removida' : 'Clique no link para mais informações',
        icon_url: 'https://forca-tatica.vercel.app/favicon.ico'
      }
    };

    if (viatura.fotoURL && !isDelete) {
      embed.image = { url: viatura.fotoURL };
      embed.thumbnail = { url: viatura.fotoURL };
    }

    return embed;
  }

  _createFardamentoEmbed(fardamento, action = 'upsert') {
    const isDelete = action === 'delete';
    const url = `https://forca-tatica.vercel.app/fardamento?id=${fardamento.id}`;
    
    let pecasTexto = '';
    if (fardamento.pecas && fardamento.pecas.length > 0) {
      pecasTexto = fardamento.pecas.slice(0, 8).map((p, i) => {
        if (typeof p === 'string') {
          return `${i+1}. ${p.split('|')[0].trim()}`;
        } else {
          return `${i+1}. ${p.tipo.toUpperCase()} ${p.numero}${p.textura ? ` (TXT ${p.textura})` : ''}`;
        }
      }).join('\n');
      
      if (fardamento.pecas.length > 8) {
        pecasTexto += `\n... e mais ${fardamento.pecas.length - 8} peças`;
      }
    }

    const embed = {
      title: isDelete ? `❌ FARDAMENTO REMOVIDO: ${fardamento.nome}` : `👕 ${fardamento.nome}`,
      description: isDelete
        ? 'Este fardamento foi removido do catálogo'
        : (fardamento.descricao || 'Fardamento operacional'),
      color: isDelete ? 0xFF0000 : 0x9b59b6,
      fields: [
        {
          name: '📦 PEÇAS',
          value: `${fardamento.pecas?.length || 0} ${fardamento.pecas?.length === 1 ? 'item' : 'itens'}`,
          inline: true
        },
        {
          name: '📅 CADASTRO',
          value: fardamento.createdAt ? new Date(fardamento.createdAt).toLocaleDateString('pt-BR') : 'N/A',
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isDelete ? 'Fardamento removido' : 'Clique para ver composição completa',
        icon_url: 'https://forca-tatica.vercel.app/favicon.ico'
      }
    };

    if (pecasTexto && !isDelete) {
      embed.fields.push({
        name: '📋 COMPOSIÇÃO',
        value: pecasTexto,
        inline: false
      });
    }

    embed.fields.push({
      name: '🔗 VER DETALHES',
      value: `[🛡️ Ver fardamento completo](${url})`,
      inline: false
    });

    if (fardamento.fotoURL && !isDelete) {
      embed.image = { url: fardamento.fotoURL };
      embed.thumbnail = { url: fardamento.fotoURL };
    }

    return embed;
  }

  _createComunicadoEmbed(comunicado, action = 'upsert') {
    const isDelete = action === 'delete';
    const url = `https://forca-tatica.vercel.app/comunicados?id=${comunicado.id}`;
    
    return {
      title: isDelete ? `❌ COMUNICADO REMOVIDO` : `📢 ${comunicado.titulo}`,
      description: isDelete
        ? 'Este comunicado foi removido do sistema'
        : (comunicado.conteudo?.substring(0, 300) + (comunicado.conteudo?.length > 300 ? '...' : '')),
      color: isDelete ? 0xFF0000 : (comunicado.tipo === 'INSTRUTIVO' ? 0xF1C40F : 0x3498db),
      fields: [
        {
          name: '📌 TIPO',
          value: comunicado.tipo || 'INFORMATIVO',
          inline: true
        },
        {
          name: '📅 DATA',
          value: comunicado.createdAt ? new Date(comunicado.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
          inline: true
        },
        {
          name: '🔗 LEIA COMPLETO',
          value: `[📖 Clique aqui para ler o comunicado completo](${url})`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isDelete ? 'Comunicado removido' : 'Clique no link para visualizar',
        icon_url: 'https://forca-tatica.vercel.app/favicon.ico'
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

  clearCache() {
    this.messageCache.clear();
    this._log('info', 'Cache limpo');
  }

  getStatus() {
    return {
      webhooks: {
        hierarquia: !!this.webhooks.hierarquia,
        viaturas: !!this.webhooks.viaturas,
        fardamentos: !!this.webhooks.fardamentos,
        comunicados: !!this.webhooks.comunicados
      },
      cachedMessages: this.messageCache.size
    };
  }
}

// Instância única
const discordManager = new DiscordManager();

// ========== EXPORTAÇÕES ==========
export const upsertDiscordMessage = (collection, itemId, itemData) => {
  const method = {
    hierarquia: 'syncHierarquia',
    viaturas: 'syncViatura',
    fardamentos: 'syncFardamento',
    comunicados: 'syncComunicado'
  }[collection];

  if (!method) return null;
  
  return discordManager[method]({ ...itemData, id: itemId }, 'upsert');
};

export const deleteDiscordMessage = (collection, itemData) => {
  const method = {
    hierarquia: 'syncHierarquia',
    viaturas: 'syncViatura',
    fardamentos: 'syncFardamento',
    comunicados: 'syncComunicado'
  }[collection];

  if (!method) return null;
  
  return discordManager[method](itemData, 'delete');
};

export const syncHierarquiaLista = (membros) => 
  discordManager.syncHierarquiaLista(membros);

export default discordManager;