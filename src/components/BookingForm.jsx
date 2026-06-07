import { useState } from 'react';
import { bookAppointment } from '../api';
import '../styles/BookingForm.css';

export default function BookingForm({ onAppointmentBooked }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    time: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Helper to format Date to local YYYY-MM-DDThh:mm format
  const getLocalDatetimeString = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localTime = new Date(date.getTime() - tzOffset);
    return localTime.toISOString().slice(0, 16);
  };

  const handleShortcutClick = (minutesOffset, hourOfDay = null) => {
    const targetDate = new Date();
    if (hourOfDay !== null) {
      targetDate.setDate(targetDate.getDate() + 1); // Tomorrow
      targetDate.setHours(hourOfDay, 0, 0, 0);
    } else {
      targetDate.setMinutes(targetDate.getMinutes() + minutesOffset);
    }
    
    setFormData(prev => ({
      ...prev,
      time: getLocalDatetimeString(targetDate)
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.phone.trim() || !/^\+?[\d\s\-()]{8,18}$/.test(formData.phone)) {
      setError('Valid phone number (+123456789) is required');
      return false;
    }
    if (!formData.time) {
      setError('Appointment time is required');
      return false;
    }
    const appointmentTime = new Date(formData.time);
    if (appointmentTime <= new Date()) {
      setError('Appointment time must be in the future');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      await bookAppointment({
        ...formData,
        time: new Date(formData.time).toISOString()  // converts local IST → UTC before sending
      });
      setMessage('Appointment booked successfully!');
      setFormData({ name: '', phone: '', time: '' });
      
      if (onAppointmentBooked) {
        onAppointmentBooked();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-form-container">
      <div className="booking-form glass-card">
        <h2>Schedule Session</h2>
        <form onSubmit={handleSubmit} id="booking-appointment-form">
          <div className="form-group">
            <label htmlFor="form-name">Full Name *</label>
            <input
              type="text"
              id="form-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Sarah Connor"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="form-phone">Phone Number *</label>
            <input
              type="tel"
              id="form-phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g. +1 (555) 382-9011"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="form-time">Appointment Time *</label>
            <input
              type="datetime-local"
              id="form-time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              disabled={loading}
              required
            />
            
            <div className="time-shortcuts">
              <span className="shortcuts-label">Shortcuts:</span>
              <div className="shortcuts-list">
                <button
                  type="button"
                  onClick={() => handleShortcutClick(25)}
                  disabled={loading}
                  className="shortcut-btn"
                  title="Schedule in 25 minutes (Ideal for testing cron reminders)"
                >
                  +25m
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutClick(50)}
                  disabled={loading}
                  className="shortcut-btn"
                  title="Schedule in 50 minutes (Ideal for testing cron reminders)"
                >
                  +50m
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutClick(120)}
                  disabled={loading}
                  className="shortcut-btn"
                  title="Schedule in 2 hours"
                >
                  +2h
                </button>
                <button
                  type="button"
                  onClick={() => handleShortcutClick(0, 10)}
                  disabled={loading}
                  className="shortcut-btn"
                  title="Schedule for Tomorrow at 10:00 AM"
                >
                  Tomorrow
                </button>
              </div>
            </div>
          </div>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn" id="btn-submit-booking">
            {loading ? (
              <span className="spinner-container">
                <span className="spinner"></span> Booking...
              </span>
            ) : (
              'Book Appointment'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

