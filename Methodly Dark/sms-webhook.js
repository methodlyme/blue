{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 exports.handler = async (event) => \{\
  if (event.httpMethod !== 'POST') \{\
    return \{ statusCode: 405, body: 'Method Not Allowed' \};\
  \}\
\
  // Parse Twilio's form-encoded body\
  const params = Object.fromEntries(new URLSearchParams(event.body));\
  const from = params.From || '';\
  const body = params.Body || '';\
  const fromFormatted = from.replace(/\\D/g, '');\
\
  const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;\
\
  try \{\
    // Search for existing contact by phone\
    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', \{\
      method: 'POST',\
      headers: \{\
        'Authorization': `Bearer $\{HUBSPOT_TOKEN\}`,\
        'Content-Type': 'application/json'\
      \},\
      body: JSON.stringify(\{\
        filterGroups: [\{\
          filters: [\{ propertyName: 'phone', operator: 'EQ', value: from \}]\
        \}],\
        properties: ['firstname', 'lastname', 'phone', 'email']\
      \})\
    \});\
\
    const searchData = await searchRes.json();\
\
    if (searchData.total > 0) \{\
      // Contact exists \'97 add a note with the SMS content\
      const contactId = searchData.results[0].id;\
      await fetch('https://api.hubapi.com/crm/v3/objects/notes', \{\
        method: 'POST',\
        headers: \{\
          'Authorization': `Bearer $\{HUBSPOT_TOKEN\}`,\
          'Content-Type': 'application/json'\
        \},\
        body: JSON.stringify(\{\
          properties: \{\
            hs_note_body: `Inbound SMS from $\{from\}: $\{body\}`,\
            hs_timestamp: Date.now().toString()\
          \},\
          associations: [\{\
            to: \{ id: contactId \},\
            types: [\{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 \}]\
          \}]\
        \})\
      \});\
    \} else \{\
      // New contact \'97 create them\
      await fetch('https://api.hubapi.com/crm/v3/objects/contacts', \{\
        method: 'POST',\
        headers: \{\
          'Authorization': `Bearer $\{HUBSPOT_TOKEN\}`,\
          'Content-Type': 'application/json'\
        \},\
        body: JSON.stringify(\{\
          properties: \{\
            phone: from,\
            hs_lead_status: 'NEW',\
            lifecyclestage: 'lead',\
            hs_content_membership_notes: `First contact via SMS: $\{body\}`\
          \}\
        \})\
      \});\
    \}\
\
    // Respond to Twilio with empty TwiML (no auto-reply)\
    return \{\
      statusCode: 200,\
      headers: \{ 'Content-Type': 'text/xml' \},\
      body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'\
    \};\
\
  \} catch (err) \{\
    console.error('Webhook error:', err);\
    return \{ statusCode: 500, body: 'Internal error' \};\
  \}\
\};}