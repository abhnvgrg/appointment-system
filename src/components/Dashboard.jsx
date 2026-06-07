import { useState, useEffect } from 'react';
import { fetchAppointments, getLocalLogs, isDemoMode } from '../api';
import '../styles/Dashboard.css';

export default function Dashboard({ refreshTrigger }) {
  const [appointments, setAppointments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings', 'logs', 'sms'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      setError('Failed to load appointments. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = () => {
    if (isDemoMode) {
      setLogs(getLocalLogs());
    }
  };

  // Load appointments when refreshTrigger is updated
  useEffect(() => {
    loadAppointments();
    loadLogs();
  }, [refreshTrigger]);

  // Subscribe to log updates in Demo Mode
  useEffect(() => {
    if (isDemoMode) {
      const handleLogsUpdate = () => {
        setLogs(getLocalLogs());
      };
      window.addEventListener('mock_logs_updated', handleLogsUpdate);
      return () => window.removeEventListener('mock_logs_updated', handleLogsUpdate);
    }
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  const getRelativeTimeText = (dateString) => {
    const diffMs = new Date(dateString) - new Date();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 0) {
      const absMins = Math.abs(diffMins);
      if (absMins < 60) return `${absMins}m ago`;
      const absHours = Math.round(absMins / 60);
      if (absHours < 24) return `${absHours}h ago`;
      return `${Math.round(absHours / 24)}d ago`;
    } else {
      if (diffMins < 60) return `in ${diffMins} mins`;
      const diffHours = Math.round(diffMins / 60);
      if (diffHours < 24) return `in ${diffHours} hours`;
      return `in ${Math.round(diffHours / 24)} days`;
    }
  };

  // Check if an appointment is upcoming in the next 1 hour
  const isHappeningSoon = (appointment) => {
    if (appointment.reminder_sent) return false;
    const diffMs = new Date(appointment.time) - new Date();
    const diffMins = diffMs / 60000;
    return diffMins > 0 && diffMins <= 60;
  };

  // Parse simulated SMS logs
  const getSimulatedSMS = () => {
    return logs
      .filter(log => log.type === 'twilio')
      .map(log => {
        const match = log.message.match(/sent to (\+?[\d\s\-()]+):\s*"(.*)"/);
        return {
          id: log.id,
          timestamp: log.timestamp,
          phone: match ? match[1] : 'Sandbox User',
          body: match ? match[2] : log.message
        };
      });
  };

  const smsMessages = getSimulatedSMS();

  return (
    <div className="dashboard-container">
      <div className="dashboard glass-card">
        <div className="dashboard-header">
          <div className="tabs-nav">
            <button 
              onClick={() => setActiveTab('bookings')} 
              className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            >
              📅 Sessions
              {appointments.length > 0 && <span className="tab-badge">{appointments.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('logs')} 
              className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            >
              💻 Event Stream
              {logs.length > 0 && <span className="tab-badge">{logs.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('sms')} 
              className={`tab-btn ${activeTab === 'sms' ? 'active' : ''}`}
            >
              📱 Twilio SMS ({smsMessages.length})
            </button>
          </div>
          <button 
            onClick={loadAppointments} 
            disabled={loading} 
            className="refresh-btn-icon"
            title="Refresh database"
          >
            {loading ? '⏳' : '🔄'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Tab 1: Bookings List */}
        {activeTab === 'bookings' && (
          <div className="tab-content bookings-tab">
            {loading && appointments.length === 0 ? (
              <div className="status-placeholder">
                <span className="spinner"></span> Loading appointments...
              </div>
            ) : appointments.length === 0 ? (
              <div className="status-placeholder no-appointments-box">
                <div className="placeholder-icon">📅</div>
                <h3>No appointments scheduled</h3>
                <p>Use the booking form or click "Load Sample Data" in the header to get started.</p>
              </div>
            ) : (
              <div className="appointments-table-container">
                <table className="appointments-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Scheduled Time</th>
                      <th>Status / Reminder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(apt => {
                      const soon = isHappeningSoon(apt);
                      return (
                        <tr key={apt.id} className={soon ? 'row-highlight' : ''}>
                          <td className="col-name">
                            <span className="name-text">{apt.name}</span>
                          </td>
                          <td className="col-phone">{apt.phone}</td>
                          <td className="col-time">
                            <div className="time-primary">{formatDate(apt.time)}</div>
                            <div className="time-relative">{getRelativeTimeText(apt.time)}</div>
                          </td>
                          <td className="col-status">
                            {apt.reminder_sent ? (
                              <span className="status-tag status-sent">✓ Sent</span>
                            ) : soon ? (
                              <span className="status-tag status-soon pulse">⚡ Soon (1hr)</span>
                            ) : new Date(apt.time) < new Date() ? (
                              <span className="status-tag status-past">Past</span>
                            ) : (
                              <span className="status-tag status-pending">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Deno logs terminal */}
        {activeTab === 'logs' && (
          <div className="tab-content logs-tab">
            <div className="terminal-shell">
              <div className="terminal-header">
                <div className="dots">
                  <span className="dot dot-red"></span>
                  <span className="dot dot-yellow"></span>
                  <span className="dot dot-green"></span>
                </div>
                <div className="terminal-title">Deno Edge Functions Server Console</div>
              </div>
              <div className="terminal-body">
                {logs.length === 0 ? (
                  <div className="terminal-empty">No activity logs recorded. Trigger actions to stream events.</div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className={`log-entry log-${log.type}`}>
                      <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Twilio SMS Sandbox phone */}
        {activeTab === 'sms' && (
          <div className="tab-content sms-tab">
            <div className="phone-wrapper">
              <div className="phone-body">
                <div className="phone-screen">
                  <div className="phone-header-bar">
                    <span className="phone-time">9:41 AM</span>
                    <div className="phone-notch"></div>
                    <div className="phone-icons">📶 🔋 100%</div>
                  </div>
                  
                  <div className="phone-chat-header">
                    <div className="avatar">💬</div>
                    <div className="sender-info">
                      <h4>Twilio Service</h4>
                      <p>SMS & WhatsApp Sandbox</p>
                    </div>
                  </div>

                  <div className="phone-chat-body">
                    {smsMessages.length === 0 ? (
                      <div className="phone-empty-state">
                        <div className="icon">💬</div>
                        <p>Inbox is empty.</p>
                        <p className="hint">Book appointments or run reminder checks to receive notifications here.</p>
                      </div>
                    ) : (
                      [...smsMessages].reverse().map(msg => (
                        <div key={msg.id} className="sms-bubble-group">
                          <span className="sms-number">To: {msg.phone}</span>
                          <div className="sms-bubble">
                            <p>{msg.body}</p>
                            <span className="sms-time">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

