// src/utils/discordWebhooks.js

/**
 * Envia notificação para Discord via Webhook
 * @param {string} type - Tipo de notificação ('comunicados', 'fardamentos', 'viaturas', 'hierarquia')
 * @param {Object} data - Dados do item criado
 */
export const sendDiscordNotification = async (type, data) => {
  // URLs dos webhooks - você vai configurar essas depois no Vercel
  const webhookUrls = {
    comunicados: import.meta.env.VITE_DISCORD_WEBHOOK_COMUNICADOS,
    fardamentos: import.meta.env.VITE_DISCORD_WEBHOOK_FARDAMENTOS,
    viaturas: import.meta.env.VITE_DISCORD_WEBHOOK_VIATURAS,
    hierarquia: import.meta.env.VITE_DISCORD_WEBHOOK_HIERARQUIA
  };

  // Se não tiver webhook configurado, não faz nada
  const webhookUrl = webhookUrls[type];
  if (!webhookUrl) {
    console.log(`Webhook para ${type} não configurado`);
    return;
  }

  // Formatar a data
  const formatDate = (date) => {
    if (!date) return 'Data não informada';
    try {
      if (date.seconds) {
        return new Date(date.seconds * 1000).toLocaleDateString('pt-BR');
      }
      return new Date(date).toLocaleDateString('pt-BR');
    } catch (e) {
      return 'Data inválida';
    }
  };

  // Criar embed baseado no tipo
  let embed;

  switch (type) {
    case 'comunicados':
      embed = {
        title: `📢 **NOVO COMUNICADO: ${data.titulo}**`,
        description: data.conteudo.substring(0, 200) + (data.conteudo.length > 200 ? '...' : ''),
        color: data.tipo === 'INSTRUTIVO' ? 0xff9900 : 0x0099ff, // Laranja para instrutivo, Azul para informativo
        fields: [
          {
            name: '📋 **Tipo**',
            value: data.tipo,
            inline: true
          },
          {
            name: '📅 **Data**',
            value: formatDate(data.createdAt),
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'FORÇA TÁTICA PMESP • Sistema de Comunicados'
        }
      };
      break;

    case 'fardamentos':
      embed = {
        title: `👕 **NOVO FARDAMENTO: ${data.nome}**`,
        description: data.descricao || 'Sem descrição detalhada',
        color: 0x00ff99, // Verde
        fields: [
          {
            name: '🧩 **Peças**',
            value: `${data.pecas?.length || 0} itens cadastrados`,
            inline: true
          },
          {
            name: '📅 **Cadastrado em**',
            value: formatDate(data.createdAt),
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'FORÇA TÁTICA PMESP • Catálogo de Fardamentos'
        }
      };
      break;

    case 'viaturas':
      embed = {
        title: `🚗 **NOVA VIATURA: ${data.nome}**`,
        description: `**Modelo:** ${data.modelo}\n${data.descricao ? data.descricao.substring(0, 150) + '...' : 'Sem descrição'}`,
        color: 0xff3366, // Rosa
        fields: [
          {
            name: '⚡ **Velocidade Máxima**',
            value: `${data.velocidadeMax || 'N/A'} km/h`,
            inline: true
          },
          {
            name: '📅 **Cadastrada em**',
            value: formatDate(data.createdAt),
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'FORÇA TÁTICA PMESP • Frota de Viaturas'
        }
      };
      break;

    case 'hierarquia':
      embed = {
        title: `👤 **${data.ativo ? 'NOVO MEMBRO' : 'MEMBRO ATUALIZADO'}: ${data.nome}**`,
        description: `**Patente:** ${data.patente}\n${data.observacoes ? '📝 *Há observações internas*' : ''}`,
        color: data.ativo ? 0x00cc66 : 0xff3333, // Verde se ativo, Vermelho se inativo
        fields: [
          {
            name: '🎖️ **Patente**',
            value: data.patente,
            inline: true
          },
          {
            name: '📊 **Status**',
            value: data.ativo ? '✅ **ATIVO**' : '❌ **INATIVO**',
            inline: true
          },
          {
            name: '📅 **Cadastro**',
            value: formatDate(data.createdAt),
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'FORÇA TÁTICA PMESP • Hierarquia do Batalhão'
        }
      };
      break;

    default:
      console.log(`Tipo ${type} não suportado`);
      return;
  }

  // Adicionar thumbnail se tiver fotoURL
  if (data.fotoURL && data.fotoURL.trim() !== '') {
    embed.thumbnail = { url: data.fotoURL };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
        // Menciona @here apenas para comunicados importantes
        content: type === 'comunicados' && data.tipo === 'INSTRUTIVO' ? '@here **Novo comunicado INSTRUTIVO!**' : ''
      })
    });

    if (!response.ok) {
      console.error('Erro ao enviar para Discord:', await response.text());
    } else {
      console.log(`✅ Notificação para ${type} enviada com sucesso!`);
    }
  } catch (error) {
    console.error('Erro ao enviar notificação para Discord:', error);
    // Não mostra alerta para o usuário, só loga no console
  }
};

/**
 * Função simples para teste de webhook
 */
export const testDiscordWebhook = async (type) => {
  const testData = {
    titulo: 'TESTE - Comunicado de Sistema',
    tipo: 'INFORMATIVO',
    conteudo: 'Este é um teste do sistema de notificações do FORÇA TÁTICA PMESP.',
    createdAt: new Date(),
    createdBy: 'Sistema'
  };

  await sendDiscordNotification(type, testData);
};