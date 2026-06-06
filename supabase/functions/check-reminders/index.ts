import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get current time and one hour from now
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    // Fetch appointments within the next hour that haven't been reminded
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('reminder_sent', false)
      .gte('time', now.toISOString())
      .lte('time', oneHourFromNow.toISOString())

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ message: 'Failed to fetch appointments', error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Send reminders for each appointment
    let successCount = 0
    for (const appointment of appointments || []) {
      try {
        await sendReminderMessage(appointment.phone, appointment.name, appointment.time)

        // Update reminder_sent flag
        await supabase
          .from('appointments')
          .update({ reminder_sent: true })
          .eq('id', appointment.id)

        successCount++
        console.log(`Reminder sent for appointment ${appointment.id}`)
      } catch (error) {
        console.error(`Failed to send reminder for appointment ${appointment.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Reminder check completed',
        appointmentsFound: appointments?.length || 0,
        remindersSent: successCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ message: 'Internal server error', error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function sendReminderMessage(phone, name, appointmentTime) {
  try {
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioWhatsAppFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppFrom) {
      console.log('Twilio WhatsApp credentials not configured, skipping reminder message')
      return
    }

    const appointmentDate = new Date(appointmentTime)
    const timeStr = appointmentDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const message = `Hi ${name}, reminder: you have an appointment on ${timeStr}. Please be on time. Thank you!`

    const formData = new FormData()
    formData.append('To', formatWhatsAppAddress(phone))
    formData.append('From', formatWhatsAppAddress(twilioWhatsAppFrom))
    formData.append('Body', message)

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData,
    })

    if (!response.ok) {
      console.error('Failed to send reminder message:', await response.text())
      throw new Error('Failed to send reminder via Twilio')
    }
  } catch (error) {
    console.error('Error sending reminder message:', error)
    throw error
  }
}

function formatWhatsAppAddress(phone) {
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
}
