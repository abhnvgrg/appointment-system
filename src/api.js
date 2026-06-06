import axios from 'axios';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect if we should run in demo mode (i.e. no credentials or placeholder credentials)
export const isDemoMode = 
  !SUPABASE_URL || 
  !SUPABASE_ANON_KEY || 
  SUPABASE_URL.includes('your-project') || 
  SUPABASE_ANON_KEY.includes('your-anon-key');

const api = axios.create({
  baseURL: `${SUPABASE_URL}/functions/v1`,
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
});

// --- Local Storage Emulation for Demo Mode ---

const getLocalAppointments = () => {
  const data = localStorage.getItem('mock_appointments');
  return data ? JSON.parse(data) : [];
};

const saveLocalAppointments = (appointments) => {
  localStorage.setItem('mock_appointments', JSON.stringify(appointments));
};

export const getLocalLogs = () => {
  const data = localStorage.getItem('mock_logs');
  return data ? JSON.parse(data) : [];
};

const saveLocalLogs = (logs) => {
  localStorage.setItem('mock_logs', JSON.stringify(logs));
};

export const addLocalLog = (message, type = 'info') => {
  const logs = getLocalLogs();
  logs.unshift({
    id: Date.now() + Math.random().toString(),
    timestamp: new Date().toISOString(),
    message,
    type // 'info', 'success', 'warning', 'error', 'twilio'
  });
  saveLocalLogs(logs.slice(0, 100)); // limit to last 100 logs
  // Dispatch custom event to let components know logs updated
  window.dispatchEvent(new Event('mock_logs_updated'));
};

// Initialize default logs if they don't exist
if (isDemoMode && getLocalLogs().length === 0) {
  addLocalLog('Demo mode initialized. Database is simulated in local storage.', 'info');
  addLocalLog('Supabase Edge Functions are running in mock container environment.', 'info');
  addLocalLog('Twilio integration is running in sandbox simulation mode.', 'info');
}

// --- API Methods with Mock Fallbacks ---

export const bookAppointment = async (data) => {
  if (isDemoMode) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const appointments = getLocalAppointments();
    
    // Check if appointment already exists at the exact time for the same person (simple check)
    const duplicate = appointments.find(
      apt => apt.phone === data.phone && new Date(apt.time).getTime() === new Date(data.time).getTime()
    );
    if (duplicate) {
      addLocalLog(`POST /book-appointment - Blocked duplicate appointment for ${data.name}`, 'error');
      throw { response: { data: { message: 'Appointment already exists for this number at this time.' } } };
    }

    const newApt = {
      id: Date.now(),
      name: data.name,
      phone: data.phone,
      time: new Date(data.time).toISOString(),
      reminder_sent: false,
      created_at: new Date().toISOString()
    };

    appointments.push(newApt);
    saveLocalAppointments(appointments);

    addLocalLog(`POST /book-appointment - Status: 200 OK. Inserted row id: ${newApt.id}`, 'success');
    addLocalLog(`[Twilio SMS] Confirmation sent to ${data.phone}: "Hi ${data.name}, your appointment has been confirmed. You will receive a reminder before your scheduled time."`, 'twilio');

    return {
      message: 'Appointment booked successfully! Confirmation sent.',
      data: newApt
    };
  }

  try {
    const response = await api.post('/book-appointment', data);
    return response.data;
  } catch (error) {
    console.error('Error booking appointment:', error);
    throw error;
  }
};

export const fetchAppointments = async () => {
  if (isDemoMode) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    const appointments = getLocalAppointments();
    
    // Sort by appointment time (ascending)
    appointments.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    return {
      message: 'Appointments fetched successfully',
      appointments
    };
  }

  try {
    const response = await api.get('/get-appointments');
    return response.data;
  } catch (error) {
    console.error('Error fetching appointments:', error);
    throw error;
  }
};

// Check upcoming appointments and send reminders (cron simulator)
export const checkReminders = async () => {
  if (isDemoMode) {
    addLocalLog('Executing scheduled Deno Edge Function: check-reminders...', 'info');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 900));
    
    const appointments = getLocalAppointments();
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    let sentCount = 0;
    const updatedAppointments = appointments.map(apt => {
      const aptTime = new Date(apt.time);
      // If not sent, and time is between now and one hour from now
      if (!apt.reminder_sent && aptTime >= now && aptTime <= oneHourFromNow) {
        apt.reminder_sent = true;
        sentCount++;
        addLocalLog(`[Database] Row ID ${apt.id} updated: reminder_sent = true`, 'success');
        
        const timeStr = aptTime.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        
        addLocalLog(`[Twilio SMS] Reminder sent to ${apt.phone}: "Hi ${apt.name}, reminder: you have an appointment on ${timeStr}. Please be on time. Thank you!"`, 'twilio');
      }
      return apt;
    });

    if (sentCount > 0) {
      saveLocalAppointments(updatedAppointments);
      addLocalLog(`Scheduled Function Completed: Processed ${sentCount} reminders.`, 'success');
    } else {
      addLocalLog('Scheduled Function Completed: No reminders needed at this time.', 'info');
    }

    return {
      message: 'Reminder check completed',
      appointmentsFound: sentCount,
      remindersSent: sentCount
    };
  }

  try {
    const response = await api.post('/check-reminders');
    return response.data;
  } catch (error) {
    console.error('Error checking reminders:', error);
    throw error;
  }
};

// --- Developer Utilities for Demo Mode ---

export const clearAllData = () => {
  if (isDemoMode) {
    localStorage.removeItem('mock_appointments');
    localStorage.removeItem('mock_logs');
    addLocalLog('Database cleared. All local data deleted.', 'warning');
    // Dispatch logs update
    window.dispatchEvent(new Event('mock_logs_updated'));
  }
};

export const generateDummyData = () => {
  if (!isDemoMode) return;
  
  const now = new Date();
  
  const dummy = [
    {
      id: Date.now() + 1,
      name: 'Sarah Connor',
      phone: '+1 (555) 382-9011',
      time: new Date(now.getTime() + 25 * 60 * 1000).toISOString(), // 25 mins from now
      reminder_sent: false,
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: Date.now() + 2,
      name: 'John Connor',
      phone: '+1 (555) 762-4981',
      time: new Date(now.getTime() + 50 * 60 * 1000).toISOString(), // 50 mins from now
      reminder_sent: false,
      created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      id: Date.now() + 3,
      name: 'Ellen Ripley',
      phone: '+1 (555) 283-9990',
      time: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
      reminder_sent: false,
      created_at: now.toISOString()
    },
    {
      id: Date.now() + 4,
      name: 'Marcus Wright',
      phone: '+1 (555) 890-1122',
      time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      reminder_sent: false,
      created_at: now.toISOString()
    }
  ];

  const current = getLocalAppointments();
  // Filter out duplicates based on names just to keep it neat
  const existingNames = new Set(current.map(c => c.name));
  const filteredDummy = dummy.filter(d => !existingNames.has(d.name));
  
  const combined = [...current, ...filteredDummy];
  saveLocalAppointments(combined);
  
  addLocalLog(`Generated ${filteredDummy.length} demo appointments.`, 'success');
  if (filteredDummy.length > 0) {
    addLocalLog('Tip: Trigger "Check Reminders" to process appointments in the next hour (Sarah & John).', 'info');
  }
  
  window.dispatchEvent(new Event('mock_logs_updated'));
};

