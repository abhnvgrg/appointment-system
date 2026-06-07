import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

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

    let successCount = 0
    for (const appointment of appointments || []) {
      try {
        await sendReminderSMS(appointment.phone, appointment.name, appointment.time)

        await supabase
          .from('appointments')
          .update({ reminder_sent: true })
          .eq('id', appointment.id)

        successCount++
        console.log(`Reminder sent for appointment ${appointment.id}`)
      } catch (err) {
        console.error(`Failed to send reminder for appointment ${appointment.id}:`, err)
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
  } catch (err) {
    console.error('Error:', err)
    return new Response(
      JSON.stringify({ message: 'Internal server error', error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function sendReminderSMS(phone, name, appointmentTime) {
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')  // same secret as book-appointment

  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log('Twilio credentials not configured, skipping reminder')
    return
  }

  const timeStr = new Date(appointmentTime).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const formData = new FormData()
  formData.append('To', phone)
  formData.append('From', twilioPhoneNumber)
  formData.append('Body', `Hi ${name}, reminder: you have an appointment on ${timeStr}. Please be on time!`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData,
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    console.error('Twilio error:', errText)
    throw new Error('Failed to send reminder SMS')
  }
}
