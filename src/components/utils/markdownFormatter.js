export const formatContent = (text) => {
  let formatted = text;

  // Links no estilo [texto](url)
  formatted = formatted.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline hover:no-underline transition">$1</a>'
  );

  // Negrito
  formatted = formatted.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="font-bold">$1</strong>'
  );

  // Itálico
  formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

  // Títulos
  formatted = formatted.replace(
    /### (.*?)(?:\n|$)/g,
    '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>'
  );
  formatted = formatted.replace(
    /## (.*?)(?:\n|$)/g,
    '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>'
  );
  formatted = formatted.replace(
    /# (.*?)(?:\n|$)/g,
    '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>'
  );

  // Listas com - ou *
  formatted = formatted.replace(
    /^[-*] (.+)$/gm,
    '<li class="flex items-start mb-1"><span class="inline-block w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0"></span><span>$1</span></li>'
  );

  // Agrupar itens de lista consecutivos
  formatted = formatted.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ul class="space-y-2 my-3 ml-1">${match}</ul>`;
  });

  // Quebras de linha
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
};
