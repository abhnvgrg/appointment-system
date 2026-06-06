import { useState, useEffect } from 'react';
import BookingForm from './components/BookingForm';
import Dashboard from './components/Dashboard';
import { 
  isDemoMode, 
  generateDummyData, 
  clearAllData, 
  checkReminders, 
  addLocalLog 
} from './api';
import './App.css';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkingReminders, setCheckingReminders] = useState(false);
  const [notification, setNotification] = useState(null);

  // Live Clock Update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleAppointmentBooked = () => {
    // Refresh immediately to show the new appointment
    setRefreshTrigger(prev => prev + 1);
    triggerToast('Appointment booked and confirmation sent!', 'success');
  };

  const handleGenerateDummy = () => {
    generateDummyData();
    setRefreshTrigger(prev => prev + 1);
    triggerToast('Generated mock appointments!', 'success');
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all appointment and log data?')) {
      clearAllData();
      setRefreshTrigger(prev => prev + 1);
      triggerToast('All data cleared.', 'warning');
    }
  };

  const handleCheckReminders = async () => {
    setCheckingReminders(true);
    try {
      const res = await checkReminders();
      setRefreshTrigger(prev => prev + 1);
      if (res.remindersSent > 0) {
        triggerToast(`Reminder check complete: Sent ${res.remindersSent} SMS alerts!`, 'success');
      } else {
        triggerToast('Reminder check complete. No upcoming appointments found in the next hour.', 'info');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to execute reminder check.', 'error');
    } finally {
      setCheckingReminders(false);
    }
  };

  return (
    <div className="app">
      {notification && (
        <div className={`global-toast ${notification.type}`}>
          <div className="toast-icon">
            {notification.type === 'success' && '✓'}
            {notification.type === 'warning' && '⚠'}
            {notification.type === 'info' && 'ℹ'}
            {notification.type === 'error' && '✗'}
          </div>
          <div className="toast-content">{notification.message}</div>
        </div>
      )}

      <header className="app-header glass-card">
        <div className="header-top">
          <div className="logo-section">
            <span className="logo-emoji">📅</span>
            <div>
              <h1>Appointment Reminder System</h1>
              <p className="subtitle">Serverless Event-Driven Dashboard</p>
            </div>
          </div>
          
          <div className="system-status">
            <div className="status-indicator">
              <span className={`status-dot ${isDemoMode ? 'demo' : 'live'}`}></span>
              <span className="status-text">
                {isDemoMode ? 'Demo Sandbox Mode' : 'Live Supabase Connected'}
              </span>
            </div>
            <div className="live-clock">
              <span className="clock-label">Local Time:</span>
              <span className="clock-time">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {isDemoMode && (
          <div className="dev-banner">
            <div className="banner-info">
              <span className="banner-badge">Sandbox Controls</span>
              <span className="banner-desc">Simulate Supabase Edge Functions & Twilio SMS delivery locally.</span>
            </div>
            <div className="dev-actions">
              <button 
                onClick={handleGenerateDummy} 
                className="btn btn-secondary"
                id="btn-generate-dummy"
              >
                ⚡ Load Sample Data
              </button>
              <button 
                onClick={handleCheckReminders} 
                disabled={checkingReminders}
                className="btn btn-primary"
                id="btn-run-cron"
              >
                {checkingReminders ? '⏳ Running...' : '⚙️ Run Reminders Check'}
              </button>
              <button 
                onClick={handleClearData} 
                className="btn btn-danger"
                id="btn-clear-db"
              >
                🗑️ Purge DB
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="app-main">
        <div className="container">
          <div className="column-left">
            <BookingForm onAppointmentBooked={handleAppointmentBooked} />
          </div>
          <div className="column-right">
            <Dashboard refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; {new Date().getFullYear()} Appointment Reminder System. Designed with Premium Aesthetics.</p>
          <div className="footer-links">
            <span className="footer-tag">Supabase Edge Functions</span>
            <span className="footer-divider">•</span>
            <span className="footer-tag">Twilio SMS Integration</span>
            <span className="footer-divider">•</span>
            <span className="footer-tag">Vercel Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

