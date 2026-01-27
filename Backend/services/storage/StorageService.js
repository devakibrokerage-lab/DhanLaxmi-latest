// services/storage/StorageService.js
// Storage Abstraction Layer - Switch between providers with one config change

/**
 * STORAGE SERVICE
 * 
 * This is the main interface for all storage operations.
 * It automatically selects the storage provider based on STORAGE_PROVIDER env variable.
 * 
 * Supported providers:
 * - cloudinary (default) - Cloudinary cloud storage
 * - local - Local disk storage
 * - s3 - AWS S3 (add adapter when needed)
 * - azure - Azure Blob (add adapter when needed)
 * 
 * Usage:
 *   import StorageService from './services/storage/StorageService.js';
 *   
 *   // Upload
 *   const result = await StorageService.upload(buffer, 'filename.jpg', 'folder');
 *   
 *   // Delete
 *   await StorageService.delete(publicId);
 *   
 *   // Get URL
 *   const url = StorageService.getUrl(publicId);
 * 
 * To switch providers, just change STORAGE_PROVIDER in .env:
 *   STORAGE_PROVIDER=cloudinary  →  STORAGE_PROVIDER=s3
 */

// Get provider from environment
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'cloudinary';

// Dynamic adapter loading
let adapter = null;

const loadAdapter = async () => {
  if (adapter) return adapter;

  switch (STORAGE_PROVIDER) {
    case 'local':
      adapter = (await import('./adapters/localAdapter.js')).default;
      break;
    case 's3':
      // Future: adapter = (await import('./adapters/s3Adapter.js')).default;
      throw new Error('S3 adapter not implemented yet. Use cloudinary or local.');
    case 'azure':
      // Future: adapter = (await import('./adapters/azureAdapter.js')).default;
      throw new Error('Azure adapter not implemented yet. Use cloudinary or local.');
    case 'cloudinary':
    default:
      adapter = (await import('./adapters/cloudinaryAdapter.js')).default;
      break;
  }

  console.log(`[StorageService] Using provider: ${adapter.provider}`);
  return adapter;
};

/**
 * Upload a file to storage
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder/path for organization
 * @returns {Promise<{success: boolean, url?: string, publicId?: string, provider?: string, error?: string}>}
 */
export const upload = async (buffer, filename, folder = 'uploads') => {
  const storageAdapter = await loadAdapter();
  return storageAdapter.upload(buffer, filename, folder);
};

/**
 * Delete a file from storage
 * @param {string} publicId - File identifier (provider-specific)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const remove = async (publicId) => {
  const storageAdapter = await loadAdapter();
  return storageAdapter.remove(publicId);
};

/**
 * Get URL for a file
 * @param {string} publicId - File identifier
 * @param {object} options - Provider-specific options
 * @returns {string} - File URL
 */
export const getUrl = async (publicId, options = {}) => {
  const storageAdapter = await loadAdapter();
  return storageAdapter.getUrl(publicId, options);
};

/**
 * Get thumbnail URL for an image
 * @param {string} publicId - File identifier
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {string} - Thumbnail URL
 */
export const getThumbnail = async (publicId, width = 150, height = 150) => {
  const storageAdapter = await loadAdapter();
  return storageAdapter.getThumbnail(publicId, width, height);
};

/**
 * Get current storage provider name
 * @returns {string} - Provider name
 */
export const getProvider = () => STORAGE_PROVIDER;

/**
 * Upload multiple files
 * @param {Array<{buffer: Buffer, filename: string}>} files - Array of files
 * @param {string} folder - Folder for all files
 * @returns {Promise<Array<{success: boolean, url?: string, publicId?: string, error?: string}>>}
 */
export const uploadMultiple = async (files, folder = 'uploads') => {
  const results = [];
  for (const file of files) {
    const result = await upload(file.buffer, file.filename, folder);
    results.push(result);
  }
  return results;
};

export default {
  upload,
  remove,
  getUrl,
  getThumbnail,
  getProvider,
  uploadMultiple,
};
