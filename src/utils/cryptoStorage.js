const DB_NAME = 'SatranjSecureVault';
const STORE_NAME = 'keys';
const KEY_ID = 'device_master_key_v1';
const PREFIX = '__ENC__:v1:';

let cachedCryptoKey = null;

function openKeyDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getMasterKey() {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Cryptography API is not available');
  }

  try {
    const db = await openKeyDb();
    const existingKey = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_ID);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (existingKey) {
      cachedCryptoKey = existingKey;
      return existingKey;
    }

    const newKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(newKey, KEY_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    cachedCryptoKey = newKey;
    return newKey;
  } catch {
    const fallbackKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    cachedCryptoKey = fallbackKey;
    return fallbackKey;
  }
}

function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptString(plainText) {
  if (!plainText || typeof plainText !== 'string') return '';
  let cleanPlainText = plainText.trim();
  if (cleanPlainText.startsWith(PREFIX)) {
    cleanPlainText = await decryptString(cleanPlainText);
  }
  if (!cleanPlainText) return '';

  try {
    const key = await getMasterKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(cleanPlainText);

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const base64Iv = bufferToBase64(iv);
    const base64Cipher = bufferToBase64(cipherBuffer);

    return `${PREFIX}${base64Iv}:${base64Cipher}`;
  } catch (err) {
    console.error('[CryptoStorage] Encryption error:', err);
    return cleanPlainText;
  }
}

export async function decryptString(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return '';
  let current = cipherText.trim();
  let unwrapCount = 0;

  while (current && current.startsWith(PREFIX) && unwrapCount < 5) {
    unwrapCount++;
    try {
      const key = await getMasterKey();
      const payload = current.substring(PREFIX.length);
      const [base64Iv, base64Cipher] = payload.split(':');

      if (!base64Iv || !base64Cipher) break;

      const iv = base64ToBuffer(base64Iv);
      const cipherBuffer = base64ToBuffer(base64Cipher);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherBuffer
      );

      const next = new TextDecoder().decode(decryptedBuffer);
      if (!next || next === current) break;
      current = next.trim();
    } catch {
      break;
    }
  }

  if (current.startsWith(PREFIX)) {
    return '';
  }

  return current;
}

export async function setItemEncrypted(key, value) {
  if (typeof window === 'undefined') return;
  if (!value || !value.trim()) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    return;
  }

  try {
    const plainText = await decryptString(value);
    if (!plainText) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      return;
    }
    const encrypted = await encryptString(plainText);
    localStorage.setItem(key, encrypted);
    sessionStorage.setItem(key, plainText);
  } catch {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  }
}

export async function getItemEncrypted(key) {
  if (typeof window === 'undefined') return '';

  const sessionVal = sessionStorage.getItem(key);
  if (sessionVal) {
    const decryptedSession = await decryptString(sessionVal);
    if (decryptedSession) {
      sessionStorage.setItem(key, decryptedSession);
      return decryptedSession;
    } else if (sessionVal.startsWith(PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }

  const storedVal = localStorage.getItem(key);
  if (!storedVal) return '';

  const decrypted = await decryptString(storedVal);

  if (decrypted) {
    sessionStorage.setItem(key, decrypted);
    if (!storedVal.startsWith(PREFIX)) {
      setItemEncrypted(key, decrypted).catch(() => {});
    }
  } else if (storedVal.startsWith(PREFIX)) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  return decrypted;
}

export function removeItem(key) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}
