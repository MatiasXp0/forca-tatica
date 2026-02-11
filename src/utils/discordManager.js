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
      logs: import.meta.env.VITE_DISCORD_WEBHOOK_LOGS,
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
      'Soldado 2° Classe',
    ];

    this._init();
  }

  _init() {
    const missingWebhooks = Object.entries(this.webhooks)
      .filter(([key, value]) => !value && key !== 'logs')
      .map(([key]) => key);

    if (missingWebhooks.length > 0) {
      console.warn(
        '⚠️ Discord: Webhooks não configurados:',
        missingWebhooks.join(', ')
      );
    }

    console.log('✅ Discord Manager inicializado');
  }

  // ========== HIERARQUIA - LISTA COMPLETA ==========
  async syncHierarquiaLista(membros) {
    const webhookUrl = this.webhooks.hierarquia;
    if (!webhookUrl) {
      this._log('error', '❌ Webhook hierarquia não configurado');
      return null;
    }

    const membrosOrdenados = [...membros].sort(
      (a, b) =>
        this.ordemPatentes.indexOf(a.patente) -
        this.ordemPatentes.indexOf(b.patente)
    );

    const agrupado = {};
    membrosOrdenados.forEach((membro) => {
      if (!agrupado[membro.patente]) agrupado[membro.patente] = [];
      agrupado[membro.patente].push(membro);
    });

    let description = '';

    this.ordemPatentes.forEach((patente) => {
      const membrosPatente = agrupado[patente] || [];
      if (membrosPatente.length === 0) return;

      description += `**${patente}** ${
        membrosPatente.length > 1 ? `(${membrosPatente.length})` : ''
      }\n`;

      membrosPatente.forEach((m) => {
        const status = m.ativo ? '✅' : '❌';
        const advertencias =
          m.advertências?.filter((a) => a.tipo === 'advertencia').length || 0;

        description += `${status} **${m.nome}** - ${advertencias}/3\n`;

        if (!m.ativo) {
          description += `└ ⚠️ **INATIVO**\n`;
        }

        if (m.advertências?.length > 0) {
          const ultima = m.advertências[m.advertências.length - 1];
          const data =
            ultima.dataInicio?.split('-').reverse().join('/') || 'N/I';
          const motivo = ultima.motivo?.substring(0, 30) || '';
          description += `└ 🕐 ${ultima.tipo}: ${motivo}${
            motivo.length > 30 ? '...' : ''
          } (${data})\n`;
        }
      });
      description += '\n';
    });

    if (description.length > 4000) {
      description =
        description.substring(0, 3990) + '...\n\n*(Lista truncada)*';
    }

    const totalMembros = membros.length;
    const ativos = membros.filter((m) => m.ativo).length;
    const inativos = totalMembros - ativos;
    const totalAdvertencias = membros.reduce(
      (acc, m) =>
        acc +
        (m.advertências?.filter((a) => a.tipo === 'advertencia').length || 0),
      0
    );

    const embed = {
      title: '🎖️ HIERARQUIA DO BATALHÃO',
      description: description || 'Nenhum membro cadastrado',
      color: 0x003366,
      fields: [
        {
          name: '📊 ESTATÍSTICAS',
          value: `👥 **Total:** ${totalMembros} membros\n✅ **Ativos:** ${ativos}\n❌ **Inativos:** ${inativos}\n⚠️ **Advertências:** ${totalAdvertencias}`,
          inline: false,
        },
        {
          name: '🔗 ACESSO RÁPIDO',
          value:
            '[📋 Ver Hierarquia Completa](https://forca-tatica.vercel.app/hierarquia) | [➕ Novo Membro](https://forca-tatica.vercel.app/hierarquia?novo)',
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Força Tática PMESP • Atualizado em tempo real',
        icon_url: 'https://forca-tatica.vercel.app/favicon.ico',
      },
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

  // ========== VIATURAS ==========
  async syncViatura(viatura, action = 'upsert') {
    const webhookUrl = this.webhooks.viaturas;
    if (!webhookUrl) {
      this._log('error', '❌ Webhook viaturas não configurado');
      return null;
    }

    const isDelete = action === 'delete';
    const url = `https://forca-tatica.vercel.app/viaturas?id=${viatura.id}`;

    try {
      if (isDelete) {
        if (viatura.discordMessageId) {
          await this._deleteMessage(webhookUrl, viatura.discordMessageId);
          this._log('success', `🗑️ Viatura removida do Discord: ${viatura.nome}`);
        }
        return true;
      }

      // SÓ CRIAÇÃO - EDIÇÃO NÃO GERA MENSAGEM
      if (!isDelete && !viatura.discordMessageId) {
        const embed = {
          title: `🚗 NOVA VIATURA: ${viatura.nome}`,
          description: viatura.descricao || 'Viatura operacional da Força Tática',
          color: 0x3498db,
          fields: [
            {
              name: '📋 MODELO',
              value: viatura.modelo || 'Não informado',
              inline: true,
            },
            {
              name: '⚡ VELOCIDADE',
              value: viatura.velocidadeMax ? `${viatura.velocidadeMax} km/h` : 'N/I',
              inline: true,
            },
            {
              name: '🔗 LINK DIRETO',
              value: `[🔍 Clique aqui para ver a viatura](${url})`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Força Tática PMESP',
            icon_url: 'https://forca-tatica.vercel.app/favicon.ico',
          },
        };

        if (viatura.fotoURL) {
          embed.image = { url: viatura.fotoURL };
          embed.thumbnail = { url: viatura.fotoURL };
        }

        const messageId = await this._sendMessage(webhookUrl, embed);
        this._log('success', `✅ Viatura publicada no Discord: ${viatura.nome}`);
        return messageId;
      }

      return viatura.discordMessageId;
    } catch (error) {
      this._log('error', 'Erro ao sincronizar viatura:', error);
      return null;
    }
  }

  // ========== FARDAMENTOS ==========
  async syncFardamento(fardamento, action = 'upsert') {
    const webhookUrl = this.webhooks.fardamentos;
    if (!webhookUrl) {
      this._log('error', '❌ Webhook fardamentos não configurado');
      return null;
    }

    const isDelete = action === 'delete';
    const url = `https://forca-tatica.vercel.app/fardamento?id=${fardamento.id}`;

    try {
      if (isDelete) {
        if (fardamento.discordMessageId) {
          await this._deleteMessage(webhookUrl, fardamento.discordMessageId);
          this._log('success', `🗑️ Fardamento removido do Discord: ${fardamento.nome}`);
        }
        return true;
      }

      // SÓ CRIAÇÃO - EDIÇÃO NÃO GERA MENSAGEM
      if (!isDelete && !fardamento.discordMessageId) {
        let pecasTexto = '';
        if (fardamento.pecas && fardamento.pecas.length > 0) {
          pecasTexto = fardamento.pecas
            .slice(0, 5)
            .map((p, i) => {
              if (typeof p === 'string') {
                return `${i + 1}. ${p.split('|')[0].trim()}`;
              }
              return `${i + 1}. ${p.tipo} ${p.numero || ''}`;
            })
            .join('\n');

          if (fardamento.pecas.length > 5) {
            pecasTexto += `\n... e mais ${fardamento.pecas.length - 5} peças`;
          }
        }

        const embed = {
          title: `👕 NOVO FARDAMENTO: ${fardamento.nome}`,
          description: fardamento.descricao || 'Fardamento operacional',
          color: 0x9b59b6,
          fields: [
            {
              name: '📦 PEÇAS',
              value: `${fardamento.pecas?.length || 0} itens`,
              inline: true,
            },
            {
              name: '🔗 LINK DIRETO',
              value: `[🛡️ Ver fardamento completo](${url})`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Força Tática PMESP',
            icon_url: 'https://forca-tatica.vercel.app/favicon.ico',
          },
        };

        if (pecasTexto) {
          embed.fields.push({
            name: '📋 COMPOSIÇÃO',
            value: pecasTexto,
            inline: false,
          });
        }

        if (fardamento.fotoURL) {
          embed.image = { url: fardamento.fotoURL };
          embed.thumbnail = { url: fardamento.fotoURL };
        }

        const messageId = await this._sendMessage(webhookUrl, embed);
        this._log('success', `✅ Fardamento publicado no Discord: ${fardamento.nome}`);
        return messageId;
      }

      return fardamento.discordMessageId;
    } catch (error) {
      this._log('error', 'Erro ao sincronizar fardamento:', error);
      return null;
    }
  }

  // ========== COMUNICADOS ==========
  async syncComunicado(comunicado, action = 'upsert') {
  const webhookUrl = this.webhooks.comunicados;
  if (!webhookUrl) {
    this._log('error', '❌ Webhook comunicados não configurado');
    return null;
  }

  const isDelete = action === 'delete';
  const isHide = action === 'hide';
  const isShow = action === 'show';
  const isUrgente = action === 'urgente';  // ✅ NOVO
  const url = `https://forca-tatica.vercel.app/comunicados?id=${comunicado.id}`;

  try {
    // DELETE ou OCULTAR
    if (isDelete || isHide) {
      if (comunicado.discordMessageId) {
        await this._deleteMessage(webhookUrl, comunicado.discordMessageId);
        this._log('success', `🗑️ Comunicado removido do Discord: ${comunicado.titulo}`);
      }
      return true;
    }

    // ✅ ATUALIZAR URGÊNCIA
    if (isUrgente && comunicado.discordMessageId) {
      const embed = this._createComunicadoEmbed(comunicado, 'upsert');
      await this._editMessage(webhookUrl, comunicado.discordMessageId, embed);
      this._log('success', `⚠️ Urgência atualizada: ${comunicado.titulo}`);
      return comunicado.discordMessageId;
    }

    // MOSTRAR (republicar)
    if (isShow) {
      if (comunicado.discordMessageId) {
        await this._deleteMessage(webhookUrl, comunicado.discordMessageId);
      }
      const embed = this._createComunicadoEmbed(comunicado, 'show');
      const messageId = await this._sendMessage(webhookUrl, embed, {
        content: `<@&1450612198576750766>`
      });
      this._log('success', `✅ Comunicado republicado no Discord: ${comunicado.titulo}`);
      return messageId;
    }

    // CRIAÇÃO
    if (!isDelete && !comunicado.discordMessageId) {
      const embed = this._createComunicadoEmbed(comunicado, 'upsert');
      const messageId = await this._sendMessage(webhookUrl, embed, {
        content: `<@&1450612198576750766>`
      });
      this._log('success', `✅ Comunicado publicado no Discord: ${comunicado.titulo}`);
      return messageId;
    }

    return comunicado.discordMessageId;
  } catch (error) {
    this._log('error', 'Erro ao sincronizar comunicado:', error);
    return null;
  }
}

  // ========== EMBED DE COMUNICADO (GRANDE) ==========
  _createComunicadoEmbed(comunicado, action = 'upsert') {
    const isShow = action === 'show';
    const url = `https://forca-tatica.vercel.app/comunicados?id=${comunicado.id}`;
    
    // CORES POR TIPO
    const cores = {
      'INFORMATIVO': 0x3498db,  // Azul
      'INSTRUTIVO': 0xf1c40f,   // Amarelo
      'URGENTE': 0xe74c3c,      // Vermelho
      'ORDEM_DIA': 0x9b59b6,    // Roxo
      'ESCALA': 0x2ecc71,       // Verde
    };

    // TÍTULO COM URGÊNCIA
    let titulo = `📢 ${comunicado.titulo}`;
    if (comunicado.isUrgente) {
      titulo = `⚠️⚠️ URGENTE: ${comunicado.titulo} ⚠️⚠️`;
    }

    const embed = {
      title: titulo,
      description: comunicado.conteudo?.substring(0, 2000) || 'Sem conteúdo',
      color: cores[comunicado.tipo] || 0x3498db,
      fields: [
        {
          name: '📌 TIPO',
          value: comunicado.tipo || 'INFORMATIVO',
          inline: true,
        },
        {
          name: '📅 DATA',
          value: comunicado.createdAt
            ? new Date(comunicado.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : new Date().toLocaleDateString('pt-BR'),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isShow ? 'Comunicado reativado' : 'Força Tática PMESP',
        icon_url: 'https://forca-tatica.vercel.app/favicon.ico',
      },
    };

    // ADICIONAR AUTOR
    if (comunicado.createdByName) {
      embed.author = {
        name: `Por: ${comunicado.createdByName.split('@')[0]}`,
        icon_url: 'https://forca-tatica.vercel.app/logo-pm.png',
      };
    }

    // LINK DIRETO GRANDE E VISÍVEL
    embed.fields.push({
      name: '🔗 LINK DIRETO',
      value: `**[📖 CLIQUE AQUI PARA LER O COMUNICADO COMPLETO](${url})**`,
      inline: false,
    });

    // ADICIONAR IMAGEM SE HOUVER
    if (comunicado.fotoURL) {
      embed.image = { url: comunicado.fotoURL };
    }

    return embed;
  }

  // ========== COMUNICAÇÃO COM DISCORD ==========
  async _sendMessage(webhookUrl, embed, options = {}) {
  try {
    const payload = {
      embeds: [embed],
      username: 'Força Tática',
      avatar_url: 'https://forca-tatica.vercel.app/logo.png',
    };

    // ✅ ADICIONAR CONTEÚDO (MENÇÃO) SE EXISTIR
    if (options.content) {
      payload.content = options.content;
    }

    const response = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
          embeds: [embed],
        }),
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
        method: 'DELETE',
      });
      return response.ok;
    } catch (error) {
      this._log('error', 'Falha ao deletar:', error.message);
      return false;
    }
  }

  // ========== GERENCIAMENTO HIERARQUIA ==========
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
      await setDoc(
        docRef,
        {
          messageId,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      return true;
    } catch (error) {
      this._log('error', 'Erro ao salvar mensagem da hierarquia:', error);
      return false;
    }
  }

  // ========== UTILITÁRIOS ==========
  _log(type, message, ...args) {
    const colors = {
      success: '#2ecc71',
      error: '#e74c3c',
      warning: '#f39c12',
      info: '#3498db',
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
        comunicados: !!this.webhooks.comunicados,
      },
      cachedMessages: this.messageCache.size,
    };
  }
}

// Instância única
const discordManager = new DiscordManager();

// ========== EXPORTAÇÕES ==========
export const upsertDiscordMessage = (collection, itemId, itemData, action = 'upsert') => {
  const method = {
    hierarquia: 'syncHierarquia',
    viaturas: 'syncViatura',
    fardamentos: 'syncFardamento',
    comunicados: 'syncComunicado',
  }[collection];

  if (!method) return null;
  return discordManager[method]({ ...itemData, id: itemId }, action);  // 👈 PASSA ACTION
};


export const deleteDiscordMessage = (collection, itemData) => {
  const method = {
    hierarquia: 'syncHierarquia',
    viaturas: 'syncViatura',
    fardamentos: 'syncFardamento',
    comunicados: 'syncComunicado',
  }[collection];

  if (!method) return null;
  return discordManager[method](itemData, 'delete');
};

// NOVAS EXPORTAÇÕES PARA COMUNICADOS
export const hideDiscordMessage = (collection, itemData) => {
  if (collection !== 'comunicados') return null;
  return discordManager.syncComunicado(itemData, 'hide');
};

export const showDiscordMessage = (collection, itemData) => {
  if (collection !== 'comunicados') return null;
  return discordManager.syncComunicado(itemData, 'show');
};

export const syncHierarquiaLista = (membros) =>
  discordManager.syncHierarquiaLista(membros);

export default discordManager;