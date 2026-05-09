import { databases, db, account, ID } from './appwrite';
import { Query } from 'appwrite';

/**
 * Logs a system activity for audit purposes.
 * @param {string} activity - Short description of the action (e.g., "Created Account")
 * @param {string} details - Detailed information (e.g., "Linked to supplier: MedLink Inc")
 */
export const logActivity = async (activity, details = '') => {
  try {
    const user = await account.get();
    
    // Fetch profile to get user-specific info
    let fullName = user.name || 'Unknown User';
    let role = 'user';

    try {
      const { documents } = await databases.listDocuments(
        db.id,
        db.collections.profiles,
        [Query.equal("userId", user.$id)]
      );
      if (documents.length > 0) {
        fullName = documents[0].fullName;
        role = documents[0].role;
      }
    } catch (profileErr) {
      console.warn('Could not fetch profile for log, using account data');
    }

    const logData = {
      userId: user.$id,
      userName: fullName,
      userRole: role,
      activity: activity,
      details: (typeof details === 'object' ? JSON.stringify(details) : details).substring(0, 199),
      timestamp: new Date().toISOString()
    };

    await databases.createDocument(
      db.id,
      db.collections.logs,
      ID.unique(),
      logData
    );
  } catch (err) {
    console.error('Audit Logging Failed:', err);
    // Notify the user so they know if the database structure is incorrect
    alert(`Audit Log Error: ${err.message}. Please ensure the "logs" collection exists with correct attributes.`);
  }
};
