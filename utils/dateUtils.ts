// utils/dateUtils.ts
export const createValidDate = (dateInput: any): Date | null => {
  if (!dateInput) return null;

  let date: Date;

  // Prioriza a conversão de números ou strings numéricas (timestamps)
  if (typeof dateInput === 'number') {
      date = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
      const numericValue = Number(dateInput);
      // Verifica se é uma string puramente numérica e parece um timestamp em milissegundos
      if (!isNaN(numericValue) && dateInput.trim() !== '' && numericValue > 1000000000) {
          date = new Date(numericValue);
      } else if (/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
          // Formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ) é o mais confiável
          date = new Date(dateInput);
      } else {
          // Formatos comuns como "DD/MM/YYYY, HH:MM:SS" do Google Sheets
          const parts = dateInput.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (parts) {
              // Assumindo MM/DD/YYYY ou DD/MM/YYYY (new Date é flexível com isso)
              const [ , month, day, year] = parts;
              date = new Date(`${year}-${month}-${day}`);
          } else {
              // Fallback para outros formatos
              date = new Date(dateInput);
          }
      }
  } else {
      return null;
  }
  
  return isNaN(date.getTime()) ? null : date;
};

// Esta função formata corretamente um objeto Date para 'YYYY-MM-DD' para input[type=date]
// Ela leva em conta o deslocamento de fuso horário para evitar que a data fique um dia adiantada/atrasada.
export const formatDateForInput = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};