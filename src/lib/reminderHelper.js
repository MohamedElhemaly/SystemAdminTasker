/**
 * Helper utilities for Task Reminders & RRULE Recurring Rollovers
 */

export const REMINDER_PRESETS = [
  { id: 'on_day', label: 'On the day (09:00)', offsetDays: 0, time: '09:00' },
  { id: '1_day', label: '1 day early (09:00)', offsetDays: 1, time: '09:00' },
  { id: '2_days', label: '2 days early (09:00)', offsetDays: 2, time: '09:00' },
  { id: '3_days', label: '3 days early (09:00)', offsetDays: 3, time: '09:00' },
  { id: '1_week', label: '1 week early (09:00)', offsetDays: 7, time: '09:00' },
];

/**
 * Calculates the absolute next_reminder_at ISO timestamp
 * based on dueDate, offsetDays, and reminderTime.
 *
 * @param {string|Date} dueDate - The task due date
 * @param {number|null} offsetDays - Days before due date (0 = on day, 1 = 1 day early)
 * @param {string} reminderTime - Time string 'HH:mm' or 'HH:mm:ss' (default '09:00')
 * @returns {string|null} ISO 8601 timestamp or null
 */
export const calculateNextReminderAt = (dueDate, offsetDays, reminderTime = '09:00') => {
  if (offsetDays === null || offsetDays === undefined || offsetDays === '') {
    return null;
  }

  const baseDate = dueDate ? new Date(dueDate) : new Date();
  if (isNaN(baseDate.getTime())) return null;

  const targetDate = new Date(baseDate);
  // Subtract offset days
  targetDate.setDate(targetDate.getDate() - Number(offsetDays));

  // Parse reminderTime (HH:mm or HH:mm:ss)
  const timeStr = String(reminderTime || '09:00');
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);

  targetDate.setHours(isNaN(hours) ? 9 : hours);
  targetDate.setMinutes(isNaN(minutes) ? 0 : minutes);
  targetDate.setSeconds(0);
  targetDate.setMilliseconds(0);

  return targetDate.toISOString();
};

/**
 * Returns human-readable label for the reminder (matching TickTick reference image)
 */
export const getReminderLabel = (offsetDays, reminderTime) => {
  if (offsetDays === null || offsetDays === undefined || offsetDays === '') {
    return 'Reminder';
  }

  const num = Number(offsetDays);
  const formattedTime = (reminderTime || '09:00').slice(0, 5);

  if (num === 0) return `On the day (${formattedTime})`;
  if (num === 1) return `1 day early (${formattedTime})`;
  if (num === 2) return `2 days early (${formattedTime})`;
  if (num === 3) return `3 days early (${formattedTime})`;
  if (num === 7) return `1 week early (${formattedTime})`;

  return `${num} days early (${formattedTime})`;
};
