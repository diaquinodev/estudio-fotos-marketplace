import type { GenerationStep, GeneratedImage, ModelIdentity, EnvironmentConfig, FabricSpec, GarmentSpec, StylingConfig, ImageQuantity, PresentationMode, KitConfig, WizardStep } from '@/types';

/** Estado do estúdio persistido no IndexedDB (todos os campos são opcionais: sessões antigas podem estar incompletas). */
export interface StudioSessionState {
  step?: GenerationStep;
  wizardStep?: WizardStep;
  presentationMode?: PresentationMode;
  referenceImages?: { front: string | null; back: string | null };
  generatedImages?: GeneratedImage[];
  imageQuantity?: ImageQuantity;
  isValidationCompleted?: boolean;
  modelConfig?: ModelIdentity;
  fabricConfig?: FabricSpec;
  garmentConfig?: GarmentSpec;
  stylingConfig?: StylingConfig;
  envConfig?: EnvironmentConfig;
  additionalPrompt?: string;
  highFidelityJson?: string;
  kitConfig?: KitConfig;
}

const DB_NAME = 'EstudioFotosDB';
const STORE_NAME = 'appState';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle connection closing unexpectedly
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
};

export const saveState = async (state: StudioSessionState) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(state, 'currentSession');
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save state to IndexedDB:', error);
  }
};

export const loadState = async (): Promise<StudioSessionState | null | undefined> => {
  try {
    const db = await initDB();
    return new Promise<StudioSessionState | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('currentSession');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load state from IndexedDB:', error);
    return null;
  }
};

export const clearState = async () => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to clear state from IndexedDB:', error);
  }
};

export const deleteDB = async () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
  
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    request.onblocked = () => {
      console.warn("Delete DB blocked. Please close other tabs.");
      resolve();
    };
  });
};
