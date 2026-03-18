import { RecurrenceRule } from '../types';
import { createValidDate } from './dateUtils';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const calculateNextDueDate = (rule: RecurrenceRule, fromDate: Date): Date => {
  const nextDate = new Date(fromDate.getTime());
  nextDate.setHours(0, 0, 0, 0);

  if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
    let currentDay = nextDate.getDay();
    
    // Find the next valid day in the week
    let nextDay = sortedDays.find(day => day > currentDay);
    
    if (nextDay !== undefined) {
      // Next occurrence is in the same week
      nextDate.setDate(nextDate.getDate() + (nextDay - currentDay));
    } else {
      // Next occurrence is in the next week
      nextDate.setDate(nextDate.getDate() + (7 - currentDay + sortedDays[0]));
    }
  } else if (rule.frequency === 'monthly') {
    // This is a simple implementation. More complex logic is needed for edge cases like the 31st of a month.
    nextDate.setMonth(nextDate.getMonth() + 1);
    if (rule.dayOfMonth) {
      nextDate.setDate(rule.dayOfMonth);
    }
  } else {
    // Fallback: default to next week if rule is malformed
    nextDate.setDate(nextDate.getDate() + 7);
  }
  
  return nextDate;
};


export const formatRuleToString = (rule: RecurrenceRule | null): string => {
  if (!rule) {
    return 'Sem recorrência';
  }

  let summary = 'Repete ';

  if (rule.frequency === 'weekly') {
    summary += 'semanalmente';
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      const dayNames = rule.daysOfWeek.map(d => WEEKDAYS[d]).join(', ');
      summary += ` em: ${dayNames}`;
    }
  } else if (rule.frequency === 'monthly') {
    summary += 'mensalmente';
    if (rule.dayOfMonth) {
      summary += ` no dia ${rule.dayOfMonth}`;
    }
  }

  summary += `. Próxima: ${createValidDate(rule.nextDueDate)?.toLocaleDateString() ?? 'N/D'}`;

  return summary;
};