// services/storage/adapters/localAdapter.js
// Local Disk Storage Adapter (for development/testing or self-hosted servers)

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || 'uploads';
const BASE_URL = process.env.LOCAL_BASE_URL || 'http://localhost:8080';

/**
 * Ensure upload directory exists
 */
const ensureDir = async (dir) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

/**
 * Upload a file to local disk
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder path
 * @returns {Promise<{success: boolean, url?: string, publicId?: string, error?: string}>}
 */
export const upload = async (buffer, filename, folder = 'registrations') => {
  try {
    const uploadPath = path.join(UPLOAD_DIR, folder);
    await ensureDir(uploadPath);

    // Generate unique filename
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(filename) || '.jpg';
    const uniqueFilename = `${path.basename(filename, ext)}_${uniqueId}${ext}`;
    const filePath = path.join(uploadPath, uniqueFilename);

    // Write file
    await fs.writeFile(filePath, buffer);

    const publicId = `${folder}/${uniqueFilename}`;
    const url = `${BASE_URL}/${UPLOAD_DIR}/${publicId}`;

    console.log('[LocalStorage] Upload successful:', publicId);

    return {
      success: true,
      url,
      publicId,
      provider: 'local',
      size: buffer.length,
      path: filePath,
    };
  } catch (error) {
    console.error('[LocalStorage] Upload error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete a file from local disk
 * @param {string} publicId - File path relative to upload dir
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const remove = async (publicId) => {
  try {
    const filePath = path.join(UPLOAD_DIR, publicId);
    await fs.unlink(filePath);
    
    console.log('[LocalStorage] Delete successful:', publicId);
    return { success: true };
  } catch (error) {
    console.error('[LocalStorage] Delete error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get URL for a file
 * @param {string} publicId - File path
 * @returns {string} - File URL
 */
export const getUrl = (publicId) => {
  return `${BASE_URL}/${UPLOAD_DIR}/${publicId}`;
};

/**
 * Get thumbnail URL (same as original for local storage)
 * @param {string} publicId - File path
 * @returns {string} - File URL
 */
export const getThumbnail = (publicId) => {
  return getUrl(publicId);
};

export default {
  upload,
  remove,
  getUrl,
  getThumbnail,
  provider: 'local',
};
