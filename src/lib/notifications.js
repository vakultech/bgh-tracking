import emailjs from '@emailjs/browser';
/**
 * Dual Notification Service (In-App + Email)
 */
import { databases, db, ID, Query } from './appwrite';

export const sendEmailNotification = async (toEmail, subject, message) => {
  const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  console.log(`[EMAIL-DEBUG] Attempting to send to: ${toEmail}`);
  console.log(`[EMAIL-DEBUG] Service ID: ${SERVICE_ID ? 'Loaded' : 'MISSING'}`);
  
  if (!SERVICE_ID || SERVICE_ID === 'YOUR_SERVICE_ID') {
    console.error("❌ EmailJS Keys are MISSING. Please restart your 'npm run dev' command.");
    return false;
  }

  try {
    const templateParams = {
      to_email: toEmail,
      subject: subject,
      message: message,
      from_name: "BGH Tracking System"
    };

    await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log(`%c✅ Email sent successfully to ${toEmail}`, 'color: #10b981; font-weight: bold;');
    return true;
  } catch (err) {
    console.error("❌ EmailJS Error:", err);
    return false;
  }
};

export const notifyUpdate = async (supplierEmail, supplyDeptEmails, projectName, updateType) => {
  const subject = `BGH Tracking: Project Update - ${projectName}`;
  const message = `The project "${projectName}" has been updated (${updateType}). Please check the portal for details.`;

  // Notify Supplier
  if (supplierEmail) {
    await sendEmailNotification(supplierEmail, subject, message);
  }

  // Notify Supply Dept
  for (const email of supplyDeptEmails) {
    await sendEmailNotification(email, subject, message);
  }
};

/**
 * In-App Notification Logic
 */

/**
 * Unified Alert Service
 * Sends both in-app and email notifications
 */
export const sendAlert = async ({ recipientId, email, title, message, type = 'info', link = '' }) => {
  try {
    // 1. Send In-App Notification
    await databases.createDocument(
      db.id, 
      db.collections.notifications, 
      ID.unique(), 
      {
        recipient_id: recipientId,
        title,
        message,
        type,
        link,
        is_read: false
      }
    );

    // 2. Send Email if address provided
    if (email) {
      await sendEmailNotification(email, title, message);
    }

    return true;
  } catch (err) {
    console.error("Alert Error:", err);
    return false;
  }
};

/**
 * Global Stakeholder Notification
 * Notifies the Supplier, Supply Dept, and Admin for ANY contract activity
 */
export const notifyStakeholders = async (contract, title, message, type = 'info') => {
  try {
    // 1. Get All Internal Staff (Supply Dept & Admin)
    const { documents: internalStaff } = await databases.listDocuments(
      db.id, db.collections.profiles, 
      [Query.or([Query.equal('role', 'supply_dept'), Query.equal('role', 'admin')])]
    );
    
    if (internalStaff.length === 0) {
      console.warn("⚠️ [NOTIFY] No internal staff found. Check Appwrite Permissions for 'profiles' collection! Ensure 'Any Authenticated User' has READ access.");
    } else {
      console.log(`[NOTIFY] Found ${internalStaff.length} internal staff members to notify.`);
    }

    // 2. Get the specific Supplier's profile
    const { documents: supplierRes } = await databases.listDocuments(
      db.id, db.collections.suppliers, [Query.equal('$id', contract.supplier_id)]
    );
    
    let supplierEmail = '';
    let supplierUserId = '';

    if (supplierRes.length > 0) {
      supplierEmail = supplierRes[0].email;
      const { documents: supplierProfiles } = await databases.listDocuments(
        db.id, db.collections.profiles, [Query.equal('email', supplierEmail)]
      );
      if (supplierProfiles.length > 0) {
        supplierUserId = supplierProfiles[0].userId;
      } else {
        console.warn(`⚠️ [NOTIFY] No profile found for supplier email ${supplierEmail}. Check if they have logged in once.`);
      }
    }

    // 3. Send to Internal Staff
    for (const staff of internalStaff) {
      try {
        await sendAlert({
          recipientId: staff.userId,
          email: staff.email,
          title,
          message,
          type
        });
      } catch (e) {
        console.error(`❌ [NOTIFY] Failed to notify staff ${staff.name}:`, e.message);
      }
    }

    // 4. Send to Supplier (if found)
    if (supplierUserId) {
      try {
        await sendAlert({
          recipientId: supplierUserId,
          email: supplierEmail,
          title,
          message,
          type
        });
      } catch (e) {
        console.error(`❌ [NOTIFY] Failed to notify supplier:`, e.message);
      }
    }

    return true;
  } catch (err) {
    console.error("Stakeholder Notification Error:", err);
    return false;
  }
};
