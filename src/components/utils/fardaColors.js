export const getFardaColor = (nome) => {
  const lowerNome = nome.toLowerCase();
  if (
    lowerNome.includes('operacional') ||
    lowerNome.includes('tático') ||
    lowerNome.includes('tatico')
  ) {
    return {
      bg: 'bg-gradient-to-br from-blue-600/20 to-blue-700/10',
      bgStrong: 'bg-gradient-to-br from-blue-600 to-blue-700',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      borderStrong: 'border-blue-500',
      iconColor: 'text-blue-400',
      dot: 'bg-blue-500',
      badge: 'bg-blue-500/20 text-blue-400',
    };
  }
  if (
    lowerNome.includes('social') ||
    lowerNome.includes('gala') ||
    lowerNome.includes('cerimonial')
  ) {
    return {
      bg: 'bg-gradient-to-br from-purple-600/20 to-purple-700/10',
      bgStrong: 'bg-gradient-to-br from-purple-600 to-purple-700',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
      borderStrong: 'border-purple-500',
      iconColor: 'text-purple-400',
      dot: 'bg-purple-500',
      badge: 'bg-purple-500/20 text-purple-400',
    };
  }
  if (
    lowerNome.includes('diário') ||
    lowerNome.includes('diario') ||
    lowerNome.includes('serviço') ||
    lowerNome.includes('servico')
  ) {
    return {
      bg: 'bg-gradient-to-br from-green-600/20 to-green-700/10',
      bgStrong: 'bg-gradient-to-br from-green-600 to-green-700',
      text: 'text-green-400',
      border: 'border-green-500/30',
      borderStrong: 'border-green-500',
      iconColor: 'text-green-400',
      dot: 'bg-green-500',
      badge: 'bg-green-500/20 text-green-400',
    };
  }
  if (
    lowerNome.includes('especial') ||
    lowerNome.includes('missão') ||
    lowerNome.includes('missao')
  ) {
    return {
      bg: 'bg-gradient-to-br from-orange-600/20 to-orange-700/10',
      bgStrong: 'bg-gradient-to-br from-orange-600 to-orange-700',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      borderStrong: 'border-orange-500',
      iconColor: 'text-orange-400',
      dot: 'bg-orange-500',
      badge: 'bg-orange-500/20 text-orange-400',
    };
  }
  return {
    bg: 'bg-gradient-to-br from-gray-600/20 to-gray-700/10',
    bgStrong: 'bg-gradient-to-br from-gray-600 to-gray-700',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    borderStrong: 'border-gray-500',
    iconColor: 'text-gray-400',
    dot: 'bg-gray-500',
    badge: 'bg-gray-500/20 text-gray-400',
  };
};

export const getAdvertenciaColor = (tipo) => {
  switch (tipo) {
    case 'ausencia':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'advertencia':
      return 'bg-red-500/20 text-red-400';
    case 'elogio':
      return 'bg-green-500/20 text-green-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
};
