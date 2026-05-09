import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Helper for Database access
export const db = {
    id: import.meta.env.VITE_APPWRITE_DATABASE_ID,
    collections: {
        profiles: import.meta.env.VITE_APPWRITE_COLLECTION_PROFILES,
        suppliers: import.meta.env.VITE_APPWRITE_COLLECTION_SUPPLIERS,
        contracts: import.meta.env.VITE_APPWRITE_COLLECTION_CONTRACTS,
        logs: import.meta.env.VITE_APPWRITE_COLLECTION_LOGS,
        notifications: import.meta.env.VITE_APPWRITE_COLLECTION_NOTIFICATIONS || 'notifications',
    }
};

export { ID, Query };
