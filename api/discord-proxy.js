// api/discord-proxy.js - VERSÃO COM LOGS DETALHADOS
export default async function handler(request, response) {
  console.log('🔍 Proxy chamado. Método:', request.method);
  
  // CORS simplificado para testes
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (request.method === 'OPTIONS') {
    console.log('📝 Respondendo preflight request');
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    console.log('❌ Método não permitido:', request.method);
    return response.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // 1. Log do body recebido
    const body = await request.json();
    console.log('📦 Body recebido:', JSON.stringify(body, null, 2));
    
    const { channelId, method, messageId, embed } = body;
    
    if (!channelId) {
      console.log('❌ channelId faltando');
      return response.status(400).json({ error: 'channelId é obrigatório' });
    }

    // 2. Verificar token
    const BOT_TOKEN = process.env.VITE_DISCORD_BOT_TOKEN;
    console.log('🔑 Token configurado?:', BOT_TOKEN ? 'SIM (primeiros 10 chars): ' + BOT_TOKEN.substring(0, 10) + '...' : 'NÃO');
    
    if (!BOT_TOKEN) {
      console.log('❌ Token do bot não configurado no Vercel');
      return response.status(500).json({ 
        error: 'Configuração do bot incompleta',
        details: 'VITE_DISCORD_BOT_TOKEN não encontrado nas variáveis de ambiente da Vercel'
      });
    }

    // 3. Montar URL do Discord
    let discordUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
    let discordMethod = method || 'POST';
    
    if (messageId) {
      discordUrl += `/${messageId}`;
      discordMethod = method === 'DELETE' ? 'DELETE' : 'PATCH';
    }
    
    console.log('🌐 Fazendo request para Discord:', {
      url: discordUrl,
      method: discordMethod,
      hasEmbed: !!embed
    });

    // 4. Fazer request para Discord
    const discordResponse = await fetch(discordUrl, {
      method: discordMethod,
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: discordMethod === 'DELETE' ? undefined : JSON.stringify({ 
        embeds: embed ? [embed] : [] 
      }),
    });

    console.log('📨 Resposta do Discord:', {
      status: discordResponse.status,
      statusText: discordResponse.statusText,
      headers: Object.fromEntries(discordResponse.headers.entries())
    });

    // 5. Processar resposta
    let responseData;
    const contentType = discordResponse.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await discordResponse.json();
      console.log('📊 Data da resposta:', responseData);
    } else if (discordResponse.status === 204) {
      responseData = { success: true };
    } else {
      responseData = await discordResponse.text();
      console.log('📝 Texto da resposta:', responseData);
    }

    // 6. Retornar para frontend
    return response.status(discordResponse.status).json(responseData);
    
  } catch (error) {
    console.error('💥 ERRO NO PROXY:', error);
    console.error('Stack:', error.stack);
    
    return response.status(500).json({ 
      error: 'Falha na comunicação com Discord',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}