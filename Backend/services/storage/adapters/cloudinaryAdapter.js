// services/storage/adapters/cloudinaryAdapter.js
// Cloudinary Storage Adapter

import { v2 as cloudinary } from 'cloudinary';

// IMPORTANT: Set these in your .env file
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('⚠️  [Cloudinary] Missing CLOUDINARY credentials. File uploads will fail.');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder path in Cloudinary
 * @returns {Promise<{success: boolean, url?: string, publicId?: string, error?: string}>}
 */
export const upload = async (buffer, filename, folder = 'registrations') => {
  try {
    // Convert buffer to base64 data URI
    const base64 = buffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: folder,
      public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension
      resource_type: 'auto',
      overwrite: true,
    });

    console.log('[Cloudinary] Upload successful:', result.public_id);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      provider: 'cloudinary',
      size: result.bytes,
      format: result.format,
    };
  } catch (error) {
    console.error('[Cloudinary] Upload error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const remove = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      console.log('[Cloudinary] Delete successful:', publicId);
      return { success: true };
    } else {
      return { success: false, error: result.result };
    }
  } catch (error) {
    console.error('[Cloudinary] Delete error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get optimized URL for an image
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export const getUrl = (publicId, options = {}) => {
  const defaultOptions = {
    quality: 'auto',
    fetch_format: 'auto',
    ...options,
  };
  
  return cloudinary.url(publicId, defaultOptions);
};

/**
 * Get thumbnail URL
 * @param {string} publicId - Cloudinary public ID
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {string} - Thumbnail URL
 */
export const getThumbnail = (publicId, width = 150, height = 150) => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto',
  });
};

export default {
  upload,
  remove,
  getUrl,
  getThumbnail,
  provider: 'cloudinary',
};
