import { RRule, rrulestr } from 'rrule';
import { 
  addDays, addWeeks, addMonths, addYears, 
  format, parseISO, isValid, isPast 
} from 'date-fns';


export const WEEKDAYS = [
  { code: 'MO', label: 'M', full: 'Monday', index: 1 },
  { code: 'TU', label: 'T', full: 'Tuesday', index: 2 },
  { code: 'WE', label: 'W', full: 'Wednesday', index: 3 },
  { code: 'TH', label: 'T', full: 'Thursday', index: 4 },
  { code: 'FR', label: 'F', full: 'Friday', index: 5 },
  { code: 'SA', label: 'S', full: 'Saturday', index: 6 },
  { code: 'SU', label: 'S', full: 'Sunday', index: 0 },
];

/**
 * Returns weekday code from date (e.g. 'SU' for Sunday, 'MO' for Monday)
 */
export const getDayCode = (date) => {
  const d = date instanceof Date ? date : (date ? parseISO(date) : new Date());
  const day = d.getDay(); // 0 is Sunday
  const found = WEEKDAYS.find(w => w.index === day);
  return found ? found.code : 'MO';
};

/**
 * Returns ordinal suffix for a number (e.g. 11th, 1st, 2nd, 3rd)
 */
export const getOrdinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Generates dynamic quick repeat options based on current due date
 */
export const getQuickRepeatOptions = (dueDate) => {
  const baseDate = dueDate && isValid(new Date(dueDate)) ? new Date(dueDate) : new Date();
  const dayName = format(baseDate, 'EEEE');
  const dayOfMonth = getOrdinal(baseDate.getDate());
  const monthDay = format(baseDate, 'MMM d') + getOrdinal(baseDate.getDate()).slice(-2);
  const dayCode = getDayCode(baseDate);

  return [
    {
      id: 'daily',
      label: 'Daily',
      rule: 'FREQ=DAILY;INTERVAL=1',
      summary: 'Daily'
    },
    {
      id: 'weekly',
      label: `Weekly (${dayName})`,
      rule: `FREQ=WEEKLY;INTERVAL=1;BYDAY=${dayCode}`,
      summary: `Weekly on ${dayCode}`
    },
    {
      id: 'monthly',
      label: `Monthly (${dayOfMonth})`,
      rule: 'FREQ=MONTHLY;INTERVAL=1',
      summary: `Monthly on the ${dayOfMonth}`
    },
    {
      id: 'yearly',
      label: `Yearly (${monthDay})`,
      rule: 'FREQ=YEARLY;INTERVAL=1',
      summary: `Yearly on ${monthDay}`
    },
    {
      id: 'weekday',
      label: 'Every Weekday (Mon - Fri)',
      rule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR',
      summary: 'Every Weekday'
    }
  ];
};

/**
 * Parses an RRULE string into component state
 */
export const parseRRule = (ruleString, dueDate) => {
  if (!ruleString) {
    const defaultDay = getDayCode(dueDate || new Date());
    return {
      freq: 'WEEKLY',
      interval: 1,
      byDays: [defaultDay],
      mode: 'due_date'
    };
  }

  const parts = ruleString.split(';');
  let freq = 'WEEKLY';
  let interval = 1;
  let byDays = [];
  let mode = 'due_date';

  parts.forEach(part => {
    const [k, v] = part.split('=');
    if (!k || !v) return;
    if (k === 'FREQ') freq = v.toUpperCase();
    if (k === 'INTERVAL') interval = parseInt(v, 10) || 1;
    if (k === 'BYDAY') byDays = v.split(',').filter(Boolean);
    if (k === 'MODE' || k === 'X-MODE') mode = v.toLowerCase();
  });

  if (freq === 'WEEKLY' && byDays.length === 0) {
    byDays = [getDayCode(dueDate || new Date())];
  }

  return { freq, interval, byDays, mode };
};

/**
 * Builds standard RFC 5545 RRULE string
 */
export const buildRRule = ({ freq = 'WEEKLY', interval = 1, byDays = [], mode = 'due_date' }) => {
  const parts = [
    `FREQ=${freq.toUpperCase()}`,
    `INTERVAL=${Math.max(1, parseInt(interval, 10) || 1)}`
  ];

  if (freq.toUpperCase() === 'WEEKLY' && byDays && byDays.length > 0) {
    parts.push(`BYDAY=${byDays.join(',')}`);
  }

  if (mode === 'completion') {
    parts.push('X-MODE=COMPLETION');
  }

  return parts.join(';');
};

/**
 * Converts RRULE to user-friendly label (matching TickTick screenshot)
 */
export const getRRuleLabel = (ruleString, dueDate) => {
  if (!ruleString) return 'Repeat';

  const { freq, interval, byDays } = parseRRule(ruleString, dueDate);

  if (ruleString === 'FREQ=DAILY;INTERVAL=1') return 'Daily';
  if (ruleString === 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR') return 'Every Weekday';
  if (ruleString === 'FREQ=MONTHLY;INTERVAL=1') return 'Monthly';
  if (ruleString === 'FREQ=YEARLY;INTERVAL=1') return 'Yearly';

  if (freq === 'DAILY') {
    return interval === 1 ? 'Daily' : `Every ${interval} Days`;
  }

  if (freq === 'WEEKLY') {
    if (interval === 1 && byDays.length === 1) {
      return `Weekly on ${byDays[0].charAt(0) + byDays[0].slice(1).toLowerCase()}`;
    }
    if (byDays.length > 0) {
      const daysStr = byDays.map(d => d.charAt(0) + d.slice(1).toLowerCase()).join(', ');
      return interval === 1 ? `Weekly on ${daysStr}` : `Every ${interval} Weeks on ${daysStr}`;
    }
    return interval === 1 ? 'Weekly' : `Every ${interval} Weeks`;
  }

  if (freq === 'MONTHLY') {
    return interval === 1 ? 'Monthly' : `Every ${interval} Months`;
  }

  if (freq === 'YEARLY') {
    return interval === 1 ? 'Yearly' : `Every ${interval} Years`;
  }

  return 'Custom Repeat';
};

/**
 * Calculates the NEXT occurrence date for a recurring task based on RRULE
 * Uses RRule engine with safe date-fns fallback.
 */
export const getNextOccurrence = (ruleString, currentDueDate, completionDate) => {
  if (!ruleString) return null;

  try {
    const { freq, interval, byDays, mode } = parseRRule(ruleString, currentDueDate);
    
    // Base anchor date
    const baseDate = mode === 'completion' && completionDate
      ? new Date(completionDate)
      : (currentDueDate && isValid(new Date(currentDueDate)) ? new Date(currentDueDate) : new Date());

    // Clean rule for RRule library (strip X-MODE)
    const cleanRule = ruleString.replace(/;?X-MODE=[^;]+/gi, '');

    const rruleOptions = RRule.parseString(cleanRule);
    const rule = new RRule({
      ...rruleOptions,
      dtstart: baseDate
    });

    // We want the next occurrence strictly AFTER baseDate
    let nextDate = rule.after(baseDate, false);

    // Fallback if rule.after returned null or same date
    if (!nextDate || nextDate.getTime() <= baseDate.getTime()) {
      if (freq === 'DAILY') nextDate = addDays(baseDate, interval);
      else if (freq === 'WEEKLY') nextDate = addWeeks(baseDate, interval);
      else if (freq === 'MONTHLY') nextDate = addMonths(baseDate, interval);
      else if (freq === 'YEARLY') nextDate = addYears(baseDate, interval);
      else nextDate = addDays(baseDate, 1);
    }

    return nextDate;
  } catch (err) {
    console.warn('[rruleHelper] Error calculating next occurrence, using fallback:', err);
    const base = currentDueDate && isValid(new Date(currentDueDate)) ? new Date(currentDueDate) : new Date();
    return addDays(base, 1);
  }
};
