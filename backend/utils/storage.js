require('dotenv').config();
const { getBucketSize } = require('./supabaseStorage');

// Límite de 40 GB en bytes
const QUOTA_LIMIT = 40 * 1024 * 1024 * 1024;

/**
 * Obtiene el tamaño total del bucket de Supabase.
 * Si la llamada falla, retornamos 0 y dejamos que la lógica de cuota la maneje.
 */
async function getCurrentSize() {
  try {
    const size = await getBucketSize();
    return size;
  } catch (e) {
    console.error('Error obteniendo tamaño del bucket:', e);
    return 0;
  }
}

async function checkQuota(_unused, uploadSize = 0) {
  try {
    const currentSize = await getCurrentSize();
    if (currentSize + uploadSize > QUOTA_LIMIT) {
      return { allowed: false, currentSize, limit: QUOTA_LIMIT };
    }
    return { allowed: true, currentSize, limit: QUOTA_LIMIT };
  } catch (err) {
    console.error('Error calculando cuota:', err);
    return { allowed: false, currentSize: 0, limit: QUOTA_LIMIT };
  }
}

module.exports = {
  checkQuota,
  QUOTA_LIMIT,
};
