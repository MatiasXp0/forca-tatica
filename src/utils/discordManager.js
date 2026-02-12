// src/utils/discordManager.js
// SISTEMA COMPLETO DE INTEGRAÇÃO COM DISCORD VIA WEBHOOKS
// CORREÇÕES:
// - Comunicados: edição atualiza mensagem, data corrigida, urgência via edit
// - Viaturas: edição atualiza mensagem
// - Hierarquia: lista todos os eventos, emojis corretos

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

  // ========== HIERARQUIA - LISTA COMPLETA (CORRIGIDA) ==========
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

        // === LISTAR TODOS OS EVENTOS (COM DATA DE INÍCIO E DATA DE FIM) ===
        if (m.advertências && m.advertências.length > 0) {
          // Ordena do mais recente para o mais antigo
          const eventosOrdenados = [...m.advertências].sort((a, b) => {
            const dateA =
              a.createdAt?.seconds || new Date(a.createdAt).getTime();
            const dateB =
              b.createdAt?.seconds || new Date(b.createdAt).getTime();
            return dateB - dateA;
          });

          eventosOrdenados.forEach((evento) => {
            // Define emoji conforme o tipo
            let emoji = '📝';
            if (evento.tipo === 'advertencia') emoji = '⚠️';
            else if (evento.tipo === 'elogio') emoji = '🎖️';
            else if (evento.tipo === 'ausencia') emoji = '📅';

            // Formata datas
            const dataInicio =
              evento.dataInicio?.split('-').reverse().join('/') || 'N/I';
            const dataFim = evento.dataFim
              ? ` até ${evento.dataFim.split('-').reverse().join('/')}`
              : '';
            const motivo = evento.motivo?.substring(0, 40) || '';

            description += `└ ${emoji} **${evento.tipo}**: ${motivo}${
              motivo.length > 40 ? '…' : ''
            } (${dataInicio}${dataFim})\n`;
          });
        }
      });
      description += '\n';
    });

    // Limitar tamanho (Discord: 4096 caracteres)
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

  // ========== VIATURAS (COM EDIÇÃO CORRIGIDA) ==========
  async syncViatura(viatura, action = 'upsert') {
    const webhookUrl = this.webhooks.viaturas;
    if (!webhookUrl) {
      this._log('error', '❌ Webhook viaturas não configurado');
      return null;
    }

    const isDelete = action === 'delete';
    const url = `https://forca-tatica.vercel.app/viaturas`;

    try {
      // 1. EXCLUSÃO
      if (isDelete) {
        if (viatura.discordMessageId) {
          await this._deleteMessage(webhookUrl, viatura.discordMessageId);
          this._log(
            'success',
            `🗑️ Viatura removida do Discord: ${viatura.nome}`
          );
        }
        return true;
      }

      // 2. EDIÇÃO (já tem ID) → ATUALIZA a mensagem existente
      if (viatura.discordMessageId) {
        const embed = this._createViaturaEmbed(viatura);
        const updated = await this._editMessage(
          webhookUrl,
          viatura.discordMessageId,
          embed
        );
        if (updated) {
          this._log(
            'success',
            `✏️ Viatura atualizada no Discord: ${viatura.nome}`
          );
          return viatura.discordMessageId;
        } else {
          this._log(
            'warning',
            `⚠️ Falha ao editar viatura, tentando criar nova...`
          );
        }
      }

      // 3. CRIAÇÃO (não tem ID)
      if (!viatura.discordMessageId) {
        const embed = this._createViaturaEmbed(viatura);
        const messageId = await this._sendMessage(webhookUrl, embed);
        this._log(
          'success',
          `✅ Viatura publicada no Discord: ${viatura.nome}`
        );
        return messageId;
      }

      return viatura.discordMessageId;
    } catch (error) {
      this._log('error', 'Erro ao sincronizar viatura:', error);
      return null;
    }
  }

  // ========== EMBED DE VIATURA (COMPARTILHADO) ==========
  _createViaturaEmbed(viatura) {
    const url = `https://forca-tatica.vercel.app/viaturas`;

    const embed = {
      title: `🚗 ${
        viatura.discordMessageId ? 'VIATURA ATUALIZADA' : 'NOVA VIATURA'
      }: ${viatura.nome}`,
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
          value: viatura.velocidadeMax
            ? `${viatura.velocidadeMax} km/h`
            : 'N/I',
          inline: true,
        },
        {
          name: '🔗 ACESSO RÁPIDO',
          value: `[🔍 Ver todas as viaturas](${url})`,
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

    return embed;
  }

  // ========== FARDAMENTOS ==========
  _createFardamentoEmbed(fardamento) {
    const url = `https://forca-tatica.vercel.app/fardamento`;

    let pecasTexto = '';
    if (fardamento.pecas && fardamento.pecas.length > 0) {
      pecasTexto = fardamento.pecas
        .map((p, i) => {
          if (typeof p === 'string') {
            const partes = p.split('|').map((s) => s.trim());
            const principal = partes[0] || '';
            const texturaMatch =
              p.match(/txt\s*(\d+)/i) || p.match(/textura\s*(\d+)/i);
            const textura = texturaMatch ? ` · TXT ${texturaMatch[1]}` : '';
            const descricao = partes.slice(1).join(' | ').trim();
            const descricaoFormatada = descricao ? ` — ${descricao}` : '';
            return `${i + 1}. ${principal}${textura}${descricaoFormatada}`;
          }
          const tipo = p.tipo?.toUpperCase() || '';
          const numero = p.numero || '';
          const textura = p.textura ? ` · TXT ${p.textura}` : '';
          const descricao = p.descricao ? ` — ${p.descricao}` : '';
          return `${i + 1}. ${tipo} ${numero}${textura}${descricao}`;
        })
        .join('\n');
    }

    const embed = {
      title: `👕 ${
        fardamento.discordMessageId
          ? 'FARDAMENTO ATUALIZADO'
          : 'NOVO FARDAMENTO'
      }: ${fardamento.nome}`,
      description: fardamento.descricao || 'Fardamento operacional',
      color: 0x9b59b6,
      fields: [
        {
          name: '📦 PEÇAS',
          value: `${fardamento.pecas?.length || 0} itens`,
          inline: true,
        },
        {
          name: '🔗 ACESSO RÁPIDO',
          value: `[🛡️ Ver todos os fardamentos](${url})`,
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
      const MAX_FIELD_VALUE = 1024;
      const dividirTexto = (texto, tamanho) => {
        const partes = [];
        for (let i = 0; i < texto.length; i += tamanho) {
          partes.push(texto.substring(i, i + tamanho));
        }
        return partes;
      };
      const partes = dividirTexto(pecasTexto, MAX_FIELD_VALUE);
      partes.forEach((parte, index) => {
        embed.fields.push({
          name: `📋 COMPOSIÇÃO ${
            partes.length > 1 ? `(${index + 1}/${partes.length})` : ''
          }`,
          value: parte,
          inline: false,
        });
      });
    }

    if (fardamento.fotoURL) {
      embed.image = { url: fardamento.fotoURL };
      embed.thumbnail = { url: fardamento.fotoURL };
    }

    return embed;
  }

  async syncFardamento(fardamento, action = 'upsert') {
    const webhookUrl = this.webhooks.fardamentos;
    if (!webhookUrl) {
      this._log('error', '❌ Webhook fardamentos não configurado');
      return null;
    }

    const isDelete = action === 'delete';

    try {
      if (isDelete) {
        if (fardamento.discordMessageId) {
          await this._deleteMessage(webhookUrl, fardamento.discordMessageId);
          this._log(
            'success',
            `🗑️ Fardamento removido do Discord: ${fardamento.nome}`
          );
        }
        return true;
      }

      if (fardamento.discordMessageId) {
        const embed = this._createFardamentoEmbed(fardamento);
        const updated = await this._editMessage(
          webhookUrl,
          fardamento.discordMessageId,
          embed
        );
        if (updated) {
          this._log(
            'success',
            `✏️ Fardamento atualizado no Discord: ${fardamento.nome}`
          );
          return fardamento.discordMessageId;
        } else {
          this._log(
            'warning',
            `⚠️ Falha ao editar fardamento, criando nova mensagem...`
          );
        }
      }

      if (!fardamento.discordMessageId) {
        const embed = this._createFardamentoEmbed(fardamento);
        const messageId = await this._sendMessage(webhookUrl, embed);
        this._log(
          'success',
          `✅ Fardamento publicado no Discord: ${fardamento.nome}`
        );
        return messageId;
      }

      return fardamento.discordMessageId;
    } catch (error) {
      this._log('error', 'Erro ao sincronizar fardamento:', error);
      return null;
    }
  }

  // ========== COMUNICADOS (CORRIGIDO: edição, data, urgência) ==========
  async syncComunicado(comunicado, action = 'upsert') {
    const webhookUrl = this.webhooks.comunicados;
    if (!webhookUrl) {
      this._log('error', '❌ Webhook comunicados não configurado');
      return null;
    }

    const isDelete = action === 'delete';
    const isHide = action === 'hide';
    const isShow = action === 'show';
    const isUrgente = action === 'urgente';
    const url = `https://forca-tatica.vercel.app`;

    try {
      // DELETE ou OCULTAR
      if (isDelete || isHide) {
        if (comunicado.discordMessageId) {
          await this._deleteMessage(webhookUrl, comunicado.discordMessageId);
          this._log(
            'success',
            `🗑️ Comunicado removido do Discord: ${comunicado.titulo}`
          );
        }
        return true;
      }

      // ATUALIZAR URGÊNCIA (edição do embed)
      if (isUrgente && comunicado.discordMessageId) {
        const embed = this._createComunicadoEmbed(comunicado);
        const updated = await this._editMessage(
          webhookUrl,
          comunicado.discordMessageId,
          embed
        );
        if (updated) {
          this._log(
            'success',
            `⚠️ Urgência atualizada no Discord: ${comunicado.titulo}`
          );
          return comunicado.discordMessageId;
        } else {
          this._log(
            'warning',
            `⚠️ Falha ao atualizar urgência, tentando recriar...`
          );
          await this._deleteMessage(webhookUrl, comunicado.discordMessageId);
        }
      }

      // MOSTRAR (republicar)
      if (isShow) {
        if (comunicado.discordMessageId) {
          await this._deleteMessage(webhookUrl, comunicado.discordMessageId);
        }
        const embed = this._createComunicadoEmbed(comunicado);
        const messageId = await this._sendMessage(webhookUrl, embed);
        this._log(
          'success',
          `✅ Comunicado republicado no Discord: ${comunicado.titulo}`
        );
        return messageId;
      }

      // EDIÇÃO GERAL (já tem ID e não é ação específica) → ATUALIZA mensagem
      if (
        comunicado.discordMessageId &&
        !isDelete &&
        !isHide &&
        !isShow &&
        !isUrgente
      ) {
        const embed = this._createComunicadoEmbed(comunicado);
        const updated = await this._editMessage(
          webhookUrl,
          comunicado.discordMessageId,
          embed
        );
        if (updated) {
          this._log(
            'success',
            `✏️ Comunicado atualizado no Discord: ${comunicado.titulo}`
          );
          return comunicado.discordMessageId;
        } else {
          this._log(
            'warning',
            `⚠️ Falha ao editar comunicado, tentando recriar...`
          );
        }
      }

      // CRIAÇÃO (não tem ID)
      if (!comunicado.discordMessageId) {
        const embed = this._createComunicadoEmbed(comunicado);
        const messageId = await this._sendMessage(webhookUrl, embed);
        this._log(
          'success',
          `✅ Comunicado publicado no Discord: ${comunicado.titulo}`
        );
        return messageId;
      }

      return comunicado.discordMessageId;
    } catch (error) {
      this._log('error', 'Erro ao sincronizar comunicado:', error);
      return null;
    }
  }

  // ========== EMBED DE COMUNICADO (CORRIGIDO: DATA, TÍTULO, URGÊNCIA) ==========
  _createComunicadoEmbed(comunicado, action = 'upsert') {
    const isShow = action === 'show';
    const url = `https://forca-tatica.vercel.app`;

    const cores = {
      INFORMATIVO: 0x3498db,
      INSTRUTIVO: 0xf1c40f,
      URGENTE: 0xe74c3c,
      ORDEM_DIA: 0x9b59b6,
      ESCALA: 0x2ecc71,
    };

    let titulo = `📢 ${comunicado.titulo}`;
    if (comunicado.isUrgente) {
      titulo = `⚠️⚠️ URGENTE: ${comunicado.titulo} ⚠️⚠️`;
    }

    // === CONVERSÃO ROBUSTA DE DATA ===
    let dataFormatada = 'Data inválida';
    try {
      const data = comunicado.createdAt;
      if (data) {
        let dateObj;
        // Se for Firestore Timestamp
        if (data.toDate) {
          dateObj = data.toDate();
        }
        // Se for string ISO ou número
        else {
          dateObj = new Date(data);
        }
        if (!isNaN(dateObj.getTime())) {
          dataFormatada = dateObj.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      }
    } catch (e) {
      dataFormatada = 'Data inválida';
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
          value: dataFormatada,
          inline: true,
        },
        {
          name: '🔗 ACESSO RÁPIDO',
          value: `[📖 Ver todos os comunicados](${url})`,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: isShow ? 'Comunicado reativado' : 'Força Tática PMESP',
        icon_url: 'https://forca-tatica.vercel.app/favicon.ico',
      },
    };

    if (comunicado.createdByName) {
      embed.author = {
        name: `Por: ${comunicado.createdByName.split('@')[0]}`,
        icon_url: 'https://forca-tatica.vercel.app/logo-pm.png',
      };
    }

    if (comunicado.fotoURL) {
      embed.image = { url: comunicado.fotoURL };
    }

    return embed;
  }

  // ========== COMUNICAÇÃO COM DISCORD ==========
  async _sendMessage(webhookUrl, embed) {
    try {
      const payload = {
        content: `<@&1450612198576750766>`,
        embeds: [embed],
        username: 'Força Tática',
        avatar_url: 'https://forca-tatica.vercel.app/logo.png',
        allowed_mentions: {
          roles: ['1450612198576750766'],
        },
      };

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
export const upsertDiscordMessage = (
  collection,
  itemId,
  itemData,
  action = 'upsert'
) => {
  const method = {
    hierarquia: 'syncHierarquia',
    viaturas: 'syncViatura',
    fardamentos: 'syncFardamento',
    comunicados: 'syncComunicado',
  }[collection];

  if (!method) return null;
  return discordManager[method]({ ...itemData, id: itemId }, action);
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
