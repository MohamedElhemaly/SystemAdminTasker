import { supabase, isSupabaseConfigured } from './supabase';
import toast from 'react-hot-toast';

// Google Calendar OAuth Scopes required for 2-way sync
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
].join(' ');

const TOKEN_STORAGE_KEY = 'tasker_google_cal_token';
const SYNC_META_KEY = 'tasker_google_cal_meta';

/**
 * 1. OAuth Sign-In with Google Calendar Scopes
 * Triggers Supabase OAuth with Google and requests calendar event permissions.
 */
export async function signInWithGoogleCalendar() {
  if (!isSupabaseConfigured()) {
    toast.error('Supabase is not configured. Please use Demo/Custom Token mode.');
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: GOOGLE_CALENDAR_SCOPES,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('[GoogleCalendarSync] OAuth trigger error:', err);
    toast.error('Failed to initiate Google sign-in: ' + err.message);
    return { error: err };
  }
}

/**
 * 2. Retrieve the active Google Access Token
 * Checks:
 *   a) Supabase active session provider_token
 *   b) Stored custom/manual OAuth token in localStorage
 */
export async function getGoogleCalendarToken() {
  // Check custom/manual token in localStorage first (useful for dev/testing)
  const manualToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (manualToken && manualToken.trim()) {
    return manualToken.trim();
  }

  // Check Supabase session provider_token
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        return session.provider_token;
      }
    } catch (e) {
      console.warn('[GoogleCalendarSync] Error reading session provider token:', e);
    }
  }

  return null;
}

/**
 * Save a custom/manual Google OAuth Token (for testing or direct API keys)
 */
export function setStoredGoogleToken(token) {
  if (token && token.trim()) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    toast.success('Google Calendar token saved!');
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    toast('Google Calendar token cleared.');
  }
}

/**
 * Disconnect Google Calendar integration
 */
export function disconnectGoogleCalendar() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(SYNC_META_KEY);
  toast.success('Disconnected from Google Calendar');
}

/**
 * Get Sync Metadata (last sync time, status, stats)
 */
export function getSyncMetadata() {
  try {
    const meta = localStorage.getItem(SYNC_META_KEY);
    return meta ? JSON.parse(meta) : null;
  } catch {
    return null;
  }
}

/**
 * 3. Push Task to Google Calendar (App -> Google)
 * Creates or updates an event on the user's primary Google Calendar.
 * Endpoint: POST/PATCH https://www.googleapis.com/calendar/v3/calendars/primary/events
 */
export async function pushTaskToGoogleCalendar(task, token) {
  if (!token) {
    token = await getGoogleCalendarToken();
  }
  if (!token) {
    throw new Error('Google OAuth token not found. Please connect your Google Calendar.');
  }

  // Format event start and end
  let startDate, endDate;
  if (task.due_date) {
    const dateObj = new Date(task.due_date);
    startDate = dateObj.toISOString();
    // Default duration: 1 hour if not specified
    endDate = new Date(dateObj.getTime() + 60 * 60 * 1000).toISOString();
  } else {
    // If no due date, default to today
    const now = new Date();
    startDate = now.toISOString();
    endDate = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  const eventPayload = {
    summary: task.title || 'Untitled Task',
    description: [
      task.description || '',
      '\n---',
      `SystemAdmin Task ID: ${task.id}`,
      `Status: ${task.is_completed ? 'Completed' : 'Active'}`,
      task.recurrence_rule ? `Recurrence Rule: ${task.recurrence_rule}` : ''
    ].filter(Boolean).join('\n'),
    start: {
      dateTime: startDate,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    end: {
      dateTime: endDate,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    status: task.is_completed ? 'confirmed' : 'confirmed',
    extendedProperties: {
      private: {
        systemAdminTaskId: task.id,
        isCompleted: String(task.is_completed || false)
      }
    }
  };

  const isExistingGoogleEvent = Boolean(task.google_event_id);
  const endpoint = isExistingGoogleEvent
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.google_event_id}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const method = isExistingGoogleEvent ? 'PATCH' : 'POST';

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventPayload)
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody?.error?.message || `Google API error (${response.status})`;
    throw new Error(message);
  }

  const result = await response.json();
  return {
    success: true,
    eventId: result.id,
    htmlLink: result.htmlLink,
    event: result
  };
}

/**
 * 4. Pull Events from Google Calendar (Google -> App)
 * Fetches upcoming and recent events from the user's primary calendar.
 * Endpoint: GET https://www.googleapis.com/calendar/v3/calendars/primary/events
 */
export async function pullEventsFromGoogleCalendar(token, options = {}) {
  if (!token) {
    token = await getGoogleCalendarToken();
  }
  if (!token) {
    throw new Error('Google OAuth token not found. Please connect your Google Calendar.');
  }

  // Default time range: 30 days before today to 90 days after today
  const timeMin = options.timeMin || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = options.timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '150');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = errBody?.error?.message || `Google API error (${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();
  const items = data.items || [];

  // Map to normalized task format
  return items.map(item => {
    const startDate = item.start?.dateTime || item.start?.date;
    const endDate = item.end?.dateTime || item.end?.date;
    const isAllDay = !item.start?.dateTime;
    const localTaskId = item.extendedProperties?.private?.systemAdminTaskId;

    return {
      google_event_id: item.id,
      linked_task_id: localTaskId || null,
      title: item.summary || 'Untitled Event',
      description: item.description || '',
      due_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      allDay: isAllDay,
      htmlLink: item.htmlLink,
      status: item.status,
      creator: item.creator?.email || ''
    };
  });
}

/**
 * 5. Delete an event from Google Calendar
 */
export async function deleteEventFromGoogleCalendar(googleEventId, token) {
  if (!token) token = await getGoogleCalendarToken();
  if (!token || !googleEventId) return false;

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    return response.ok;
  } catch (err) {
    console.error('[GoogleCalendarSync] Delete event error:', err);
    return false;
  }
}

/**
 * 6. Two-Way Sync Orchestrator
 * Performs full bidirectional synchronization:
 *   Step A: Pull all events from Google Calendar.
 *           If an event already maps to a local task, updates its due_date/title.
 *           If an event is new from Google, inserts it into the tasks store.
 *   Step B: Push all local tasks that have a due_date to Google Calendar.
 *           If it already has google_event_id, updates Google event.
 *           If not, creates new Google event and associates google_event_id.
 */
export async function performTwoWaySync({ tasks, addTask, updateTask, token }) {
  if (!token) {
    token = await getGoogleCalendarToken();
  }
  if (!token) {
    throw new Error('Google OAuth token not found. Please connect your Google Calendar account first.');
  }

  const stats = {
    pulled: 0,
    pushed: 0,
    errors: []
  };

  // ── Step A: Pull from Google ──
  const googleEvents = await pullEventsFromGoogleCalendar(token);

  for (const gEvent of googleEvents) {
    try {
      // Find matching local task by google_event_id or linked_task_id
      const existingTask = tasks.find(
        t => (t.google_event_id && t.google_event_id === gEvent.google_event_id) ||
             (gEvent.linked_task_id && t.id === gEvent.linked_task_id)
      );

      if (existingTask) {
        // Update local task if date or title differs
        const dateChanged = existingTask.due_date !== gEvent.due_date;
        const titleChanged = existingTask.title !== gEvent.title;
        if (dateChanged || titleChanged || !existingTask.google_event_id) {
          await updateTask(existingTask.id, {
            due_date: gEvent.due_date,
            title: gEvent.title,
            google_event_id: gEvent.google_event_id
          });
          stats.pulled++;
        }
      } else {
        // Create new task from Google event
        await addTask({
          title: gEvent.title,
          description: gEvent.description ? `${gEvent.description}\n(Imported from Google Calendar)` : 'Imported from Google Calendar',
          due_date: gEvent.due_date,
          google_event_id: gEvent.google_event_id
        });
        stats.pulled++;
      }
    } catch (err) {
      console.error('[GoogleCalendarSync] Error syncing pulled event:', err);
      stats.errors.push(`Pull error for "${gEvent.title}": ${err.message}`);
    }
  }

  // ── Step B: Push to Google ──
  // Filter local tasks that have a due date and are active or recently updated
  const tasksWithDueDate = tasks.filter(t => Boolean(t.due_date));

  for (const task of tasksWithDueDate) {
    try {
      // If task already has a google_event_id, it is already pushed or pulled.
      // We push update to Google Calendar to ensure changes made in app reflect on Google.
      const pushRes = await pushTaskToGoogleCalendar(task, token);
      if (pushRes.success && pushRes.eventId && pushRes.eventId !== task.google_event_id) {
        await updateTask(task.id, { google_event_id: pushRes.eventId });
      }
      stats.pushed++;
    } catch (err) {
      console.error(`[GoogleCalendarSync] Error pushing task "${task.title}":`, err);
      stats.errors.push(`Push error for "${task.title}": ${err.message}`);
    }
  }

  // Update sync metadata
  const meta = {
    lastSyncTime: new Date().toISOString(),
    status: stats.errors.length > 0 ? 'warning' : 'success',
    pulled: stats.pulled,
    pushed: stats.pushed,
    totalEvents: googleEvents.length
  };
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));

  return {
    ...meta,
    errors: stats.errors
  };
}
