require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for full access
const storageBucket = process.env.SUPABASE_BUCKET;

if (!supabaseUrl || !supabaseKey || !storageBucket) {
  console.error('Supabase configuration missing in .env');
}

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Upload a file (multer temporary file) to Supabase storage.
 * @param {Object} file Multer file object (contains path, originalname, mimetype)
 * @param {string} relativePath Optional folder path inside bucket
 */
async function uploadFile(file, relativePath = '') {
  const filePath = path.posix.join(relativePath, file.originalname);
  const fileBuffer = require('fs').readFileSync(file.path);
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .upload(filePath, fileBuffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  // Remove temporary file
  const fs = require('fs-extra');
  await fs.remove(file.path);

  if (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }
  return data;
}

/**
 * Generate a signed URL for a file.
 * @param {string} filePath Path inside bucket
 * @param {number} expiresIn Seconds before expiration (default 300)
 */
async function getSignedUrl(filePath, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(filePath, expiresIn);
  if (error) {
    console.error('Supabase signed URL error:', error);
    throw error;
  }
  return data.signedUrl;
}

/**
 * List objects under a prefix (simulates folder).
 * @param {string} prefix Folder path inside bucket (may be empty)
 */
async function listObjects(prefix = '') {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .list(prefix, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });
  if (error) {
    console.error('Supabase list error:', error);
    throw error;
  }
  // Transform to match previous API shape
  return data.map(item => ({
    name: item.name,
    path: item.name,
    isDirectory: item.type === 'folder',
    size: item.size,
    lastModified: item.last_modified,
  }));
}

/**
 * Delete an object from the bucket.
 */
async function deleteObject(filePath) {
  const { data, error } = await supabase.storage.from(storageBucket).remove([filePath]);
  if (error) {
    console.error('Supabase delete error:', error);
    throw error;
  }
  return data;
}

/**
 * Compute total size of all objects in the bucket (for quota).
 */
async function getBucketSize() {
  // Supabase does not have an aggregate API; we paginate through all files.
  let total = 0;
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(storageBucket).list('', { limit, offset });
    if (error) {
      console.error('Supabase bucket size error:', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    for (const obj of data) {
      if (obj.type === 'file') total += obj.size;
    }
    offset += limit;
  }
  return total;
}

module.exports = {
  uploadFile,
  getSignedUrl,
  listObjects,
  deleteObject,
  getBucketSize,
};
