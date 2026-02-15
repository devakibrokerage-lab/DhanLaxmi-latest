// scripts/generateTOTP.js
// Quick utility to generate TOTP code from a secret
// Usage: node scripts/generateTOTP.js YOUR_TOTP_SECRET

import { authenticator } from 'otplib';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const secret = process.argv[2];

if (!secret) {
    console.log('Usage: node scripts/generateTOTP.js YOUR_TOTP_SECRET');
    console.log('Example: node scripts/generateTOTP.js JBSWY3DPEHPK3PXP');
    process.exit(1);
}

/**
 * Decrypt a string using AES-256-GCM (Matching AutoLoginService.js)
 */
function decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

    try {
        const keyRaw = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-key-change-in-production!';
        const key = crypto.createHash('sha256').update(keyRaw).digest();

        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        if (!ivHex || !authTagHex || !encrypted) return encryptedText;

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        // If decryption fails, it might just be a regular secret with colons
        return encryptedText;
    }
}

// Check if it's an encrypted secret and decrypt if necessary
let cleanSecret = secret;
if (secret.includes(':')) {
    const decrypted = decrypt(secret);
    if (decrypted !== secret) {
        console.log('🔓 Decrypted encrypted secret found in arguments.');
        cleanSecret = decrypted;
    }
}

// Clean up the secret - remove spaces
cleanSecret = cleanSecret.replace(/\s+/g, '').toUpperCase();

try {
    const token = authenticator.generate(cleanSecret);
    const timeRemaining = 30 - Math.floor((Date.now() / 1000) % 30);

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║           TOTP CODE GENERATOR          ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║   Your OTP:  ${token}                      ║`);
    console.log(`║   Valid for: ${timeRemaining.toString().padStart(2, ' ')} seconds                  ║`);
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('⚡ Quick! Enter this code in Zerodha before it expires.');
    console.log('');

} catch (error) {
    console.error('❌ Error generating TOTP:', error.message);
    console.error('Make sure your secret is correct. It should be a base32 string.');
    process.exit(1);
}
