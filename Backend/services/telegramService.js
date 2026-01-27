// services/telegramService.js
// Telegram Bot Integration for Registration Notifications

import FormData from 'form-data';
import https from 'https';

// IMPORTANT: Set these in your .env file
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Validate required env vars
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.warn('⚠️  [Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set. Telegram notifications will be disabled.');
}

const TELEGRAM_API_URL = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : null;

/**
 * Send a text message to Telegram
 */
export const sendTelegramMessage = async (message) => {
  // Skip if Telegram is not configured
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Telegram] Skipping - not configured');
    return { success: true, skipped: true };
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('[Telegram] Failed to send message:', data.description);
      return { success: false, error: data.description };
    }

    console.log('[Telegram] Message sent successfully');
    return { success: true, messageId: data.result.message_id };
  } catch (error) {
    console.error('[Telegram] Error sending message:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send a photo to Telegram with caption using form-data
 */
export const sendTelegramPhoto = async (photoBuffer, filename, caption = '') => {
  return new Promise((resolve) => {
    try {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('photo', photoBuffer, { 
        filename: filename,
        contentType: 'image/jpeg'
      });
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }

      const options = {
        method: 'POST',
        host: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
        headers: formData.getHeaders(),
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.ok) {
              console.log('[Telegram] Photo sent successfully:', filename);
              resolve({ success: true, messageId: result.result.message_id });
            } else {
              console.error('[Telegram] Failed to send photo:', result.description);
              resolve({ success: false, error: result.description });
            }
          } catch (e) {
            console.error('[Telegram] Parse error:', e.message);
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', (error) => {
        console.error('[Telegram] Request error:', error.message);
        resolve({ success: false, error: error.message });
      });

      formData.pipe(req);

    } catch (error) {
      console.error('[Telegram] Error sending photo:', error.message);
      resolve({ success: false, error: error.message });
    }
  });
};

/**
 * Send a document to Telegram
 */
export const sendTelegramDocument = async (docBuffer, filename, caption = '') => {
  return new Promise((resolve) => {
    try {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('document', docBuffer, { filename });
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }

      const options = {
        method: 'POST',
        host: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
        headers: formData.getHeaders(),
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.ok) {
              console.log('[Telegram] Document sent successfully:', filename);
              resolve({ success: true, messageId: result.result.message_id });
            } else {
              console.error('[Telegram] Failed to send document:', result.description);
              resolve({ success: false, error: result.description });
            }
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', (error) => {
        console.error('[Telegram] Request error:', error.message);
        resolve({ success: false, error: error.message });
      });

      formData.pipe(req);

    } catch (error) {
      console.error('[Telegram] Error sending document:', error.message);
      resolve({ success: false, error: error.message });
    }
  });
};

/**
 * Format registration data for Telegram message
 */
export const formatRegistrationMessage = (data) => {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  
  return `
🆕 <b>NEW REGISTRATION REQUEST</b>
━━━━━━━━━━━━━━━━━━━━━

👤 <b>Personal Information</b>
├ Name: <b>${data.firstName} ${data.middleName || ''} ${data.lastName}</b>
├ Mobile: <code>${data.mobileNumber}</code>
├ WhatsApp: <code>${data.whatsappNumber}</code>
└ Email: ${data.email}

🪪 <b>KYC Details</b>
├ Name (Aadhaar): ${data.nameAsPerAadhaar}
├ Aadhaar No: <code>${data.aadhaarNumber}</code>
└ PAN No: <code>${data.panNumber}</code>

📍 <b>Address</b>
${data.permanentAddress}

📎 <b>Documents</b>
├ Aadhaar Front: ${data.hasAadhaarFront ? '✅' : '❌'}
├ Aadhaar Back: ${data.hasAadhaarBack ? '✅' : '❌'}
├ PAN Card: ${data.hasPanCard ? '✅' : '❌'}
└ Passport Photo: ${data.hasPassportPhoto ? '✅' : '❌'}

⏰ Submitted: ${timestamp}
━━━━━━━━━━━━━━━━━━━━━
  `.trim();
};

/**
 * Send complete registration to Telegram (message + documents)
 */
export const sendRegistrationToTelegram = async (formData, files) => {
  try {
    console.log('[Telegram] Sending registration for:', formData.firstName, formData.lastName);

    // 1. Send main info message
    const messageData = {
      ...formData,
      hasAadhaarFront: !!files.aadhaarFront,
      hasAadhaarBack: !!files.aadhaarBack,
      hasPanCard: !!files.panCard,
      hasPassportPhoto: !!files.passportPhoto,
    };

    const mainMessage = formatRegistrationMessage(messageData);
    const msgResult = await sendTelegramMessage(mainMessage);

    if (!msgResult.success) {
      return { success: false, error: 'Failed to send main message' };
    }

    // 2. Send documents one by one
    const documentResults = [];

    if (files.aadhaarFront) {
      const result = await sendTelegramPhoto(
        files.aadhaarFront.buffer,
        `aadhaar_front_${formData.aadhaarNumber}.${files.aadhaarFront.ext}`,
        `📄 <b>Aadhaar Front</b>\n${formData.firstName} ${formData.lastName}\nAadhaar: ${formData.aadhaarNumber}`
      );
      documentResults.push({ type: 'aadhaarFront', ...result });
    }

    if (files.aadhaarBack) {
      const result = await sendTelegramPhoto(
        files.aadhaarBack.buffer,
        `aadhaar_back_${formData.aadhaarNumber}.${files.aadhaarBack.ext}`,
        `📄 <b>Aadhaar Back</b>\n${formData.firstName} ${formData.lastName}`
      );
      documentResults.push({ type: 'aadhaarBack', ...result });
    }

    if (files.panCard) {
      const result = await sendTelegramPhoto(
        files.panCard.buffer,
        `pan_${formData.panNumber}.${files.panCard.ext}`,
        `📄 <b>PAN Card</b>\n${formData.firstName} ${formData.lastName}\nPAN: ${formData.panNumber}`
      );
      documentResults.push({ type: 'panCard', ...result });
    }

    if (files.passportPhoto) {
      const result = await sendTelegramPhoto(
        files.passportPhoto.buffer,
        `photo_${formData.firstName}_${formData.lastName}.${files.passportPhoto.ext}`,
        `📷 <b>Passport Photo</b>\n${formData.firstName} ${formData.lastName}`
      );
      documentResults.push({ type: 'passportPhoto', ...result });
    }

    console.log('[Telegram] Registration sent successfully');
    return { 
      success: true, 
      messageId: msgResult.messageId,
      documents: documentResults 
    };

  } catch (error) {
    console.error('[Telegram] Error sending registration:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
  sendRegistrationToTelegram,
  formatRegistrationMessage,
};
