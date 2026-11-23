import { makeWidgetId } from './widgetUtils';

const DB_NAME = 'ocsc_meadow_photos_v1';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

export interface StoredPhoto {
  id: string;
  blob: Blob;
  caption: string;
  createdAt: number;
}

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('เบราว์เซอร์นี้ไม่รองรับการจัดเก็บรูปภาพ (IndexedDB)'));
      return;
    }

    let req: IDBOpenDBRequest;
    try {
      req = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      reject(new Error('ไม่สามารถเปิดพื้นที่เก็บรูปภาพได้ (อาจอยู่ในโหมดไม่ระบุตัวตน)'));
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error('ไม่สามารถเข้าถึงคลังรูปภาพได้ (อาจถูกจำกัดสิทธิ์พื้นที่จัดเก็บ)'));
  });
}

/**
 * Auto-compresses uploaded images via Canvas to image/jpeg (0.82, max 1200px)
 * to avoid Safari image/webp->PNG bloat and keep IndexedDB lightweight (F5).
 */
export async function compressImageToJpeg(
  file: File,
  maxDim = 1200,
  quality = 0.82,
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ไม่สามารถประมวลผลรูปภาพได้');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((out) => resolve(out), 'image/jpeg', quality);
    });

    if (!blob) throw new Error('ไม่สามารถบีบอัดรูปภาพได้');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function listStoredPhotos(): Promise<StoredPhoto[]> {
  const db = await openPhotoDb();
  try {
    return await new Promise<StoredPhoto[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as StoredPhoto[]).sort((a, b) => a.createdAt - b.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(new Error('ไม่สามารถโหลดรายการรูปภาพได้'));
    });
  } finally {
    db.close();
  }
}

export async function addStoredPhoto(blob: Blob, caption = ''): Promise<StoredPhoto> {
  const db = await openPhotoDb();
  const record: StoredPhoto = {
    id: makeWidgetId('ph'),
    blob,
    caption,
    createdAt: Date.now(),
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error;
        if (err && err.name === 'QuotaExceededError') {
          reject(new Error('พื้นที่เก็บรูปเต็มแล้ว ลองลบรูปเก่าบางรูปออกก่อนนะครับ'));
        } else {
          reject(new Error('ไม่สามารถบันทึกรูปภาพได้'));
        }
      };
    });
    return record;
  } finally {
    db.close();
  }
}

export async function updateStoredPhotoCaption(id: string, caption: string): Promise<void> {
  const db = await openPhotoDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as StoredPhoto | undefined;
        if (!existing) {
          resolve();
          return;
        }
        store.put({ ...existing, caption });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('ไม่สามารถบันทึกคำบรรยายรูปได้'));
    });
  } finally {
    db.close();
  }
}

export async function deleteStoredPhoto(id: string): Promise<void> {
  const db = await openPhotoDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('ไม่สามารถลบรูปภาพได้'));
    });
  } finally {
    db.close();
  }
}

export async function clearAllStoredPhotos(): Promise<void> {
  const db = await openPhotoDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('ไม่สามารถล้างคลังรูปภาพได้'));
    });
  } finally {
    db.close();
  }
}
