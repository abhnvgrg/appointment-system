import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, phone, time } = await req.json()

    // Validate input
    if (!name || !phone || !time) {
      return new Response(
        JSON.stringify({ message: 'Missing required fields: name, phone, time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert appointment into database
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          name,
          phone,
          time: new Date(time).toISOString(),
          reminder_sent: false,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ message: 'Failed to book appointment', error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send confirmation message via Twilio (optional integration)
    await sendConfirmationMessage(phone, name)

    return new Response(
      JSON.stringify({
        message: 'Appointment booked successfully!',
        data: data?.[0],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ message: 'Internal server error', error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendConfirmationMessage(phone, name) {
  try {
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioWhatsAppFrom = Deno.env.get('TWILIO_WHATSAPP_FROM')  // ← was TWILIO_PHONE_NUMBER

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppFrom) {
      console.log('Twilio credentials not configured, skipping confirmation message')
      return
    }

    const message = `Hi ${name}, your appointment has been confirmed! 📅 You will receive a reminder 1 hour before your scheduled time.`

    const formData = new FormData()
    formData.append('To', `whatsapp:${phone}`)           // ← was bare phone
    formData.append('From', twilioWhatsAppFrom)           // ← already has whatsapp: prefix from env
    formData.append('Body', message)

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
      console.error('Failed to send confirmation message:', await response.text())
    }
  } catch (error) {
    console.error('Error sending confirmation message:', error)
  }
}