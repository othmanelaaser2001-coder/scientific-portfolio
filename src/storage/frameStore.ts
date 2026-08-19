/**
 * Temporary storage for captured full-resolution frames.
 *
 * Frames live in IndexedDB as encoded JPEG blobs rather than in memory, so a
 * long scan does not grow the JS heap. They are deleted as soon as the scan is
 * saved or discarded.
 */

const DB_NAME = 'abderrahmane-scanner';
const DB_VERSION = 1;
const FRAME_STORE = 'frames';

export interface StoredFrame {
  key: string;
  scanId: string;
  index: number;
  blob: Blob;
  width: number;
  height: number;
  capturedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FRAME_STORE)) {
        const store = db.createObjectStore(FRAME_STORE, { keyPath: 'key' });
        store.createIndex('scanId', 'scanId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local database'));
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = action(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Database request failed'));
      }),
  );
}

export async function putFrame(frame: StoredFrame): Promise<void> {
  await run(FRAME_STORE, 'readwrite', (store) => store.put(frame) as IDBRequest<IDBValidKey>);
}

export async function getFrame(scanId: string, index: number): Promise<StoredFrame | undefined> {
  return run<StoredFrame | undefined>(FRAME_STORE, 'readonly', (store) => store.get(`${scanId}:${index}`));
}

export async function clearScanFrames(scanId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FRAME_STORE, 'readwrite');
    const index = tx.objectStore(FRAME_STORE).index('scanId');
    const cursorRequest = index.openCursor(IDBKeyRange.only(scanId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear scan frames'));
  });
}

/** Removes leftovers from sessions that were interrupted (crash, tab close). */
export async function clearStaleFrames(activeScanId: string | null): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FRAME_STORE, 'readwrite');
    const cursorRequest = tx.objectStore(FRAME_STORE).openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const value = cursor.value as StoredFrame;
      if (value.scanId !== activeScanId) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear stale frames'));
  });
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
