// api/discord-proxy.js
export default async function handler(request, response) {
  // Configurar CORS - permitir apenas seu domínio
  response.setHeader('Access-Control-Allow-Origin', 'https://forca-tatica.vercel.app');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Lidar com preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Apenas POST permitido
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // 1. Pegar dados do frontend
    const { channelId, method, messageId, embed } = await request.json();
    
    if (!channelId) {
      return response.status(400).json({ error: 'channelId é obrigatório' });
    }

    // 2. Pegar token do bot das variáveis de ambiente DA VERCEL
    const BOT_TOKEN = process.env.VITE_DISCORD_BOT_TOKEN;
    
    if (!BOT_TOKEN) {
      console.error('Token do bot não configurado no Vercel');
      return response.status(500).json({ error: 'Configuração do bot incompleta' });
    }

    // 3. Montar URL para API do Discord
    let discordUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
    let discordMethod = method;
    
    if (messageId) {
      discordUrl += `/${messageId}`;
      discordMethod = method === 'DELETE' ? 'DELETE' : 'PATCH';
    }

    // 4. Fazer requisição para o Discord (do servidor, sem CORS)
    const discordResponse = await fetch(discordUrl, {
      method: discordMethod,
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: discordMethod === 'DELETE' ? undefined : JSON.stringify({ embeds: embed ? [embed] : [] }),
    });

    // 5. Passar headers importantes (como rate limiting) de volta
    if (discordResponse.headers.has('Retry-After')) {
      response.setHeader('Retry-After', discordResponse.headers.get('Retry-After'));
    }

    const data = discordResponse.status === 204 ? { success: true } : await discordResponse.json();
    
    // 6. Retornar resposta do Discord para o frontend
    return response.status(discordResponse.status).json(data);
    
  } catch (error) {
    console.error('Erro no proxy para Discord:', error);
    return response.status(500).json({ error: 'Falha na comunicação com Discord' });
  }
}