/**
 * autoApprove.ts
 *
 * Scheduled Cloud Function (runs every hour).
 * Automatically approves community quotes that:
 *   - have status === 'pending'
 *   - were submitted more than 48 hours ago
 *   - have reportCount === 0 (or reportCount field absent)
 *
 * This acts as a safety net so valid quotes are never stuck in review.
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const AUTO_APPROVE_AFTER_MS = 48 * 60 * 60 * 1000; // 48 hours in ms
const BATCH_SIZE = 400; // Firestore batch write limit is 500

export const autoApprove = onSchedule('every 1 hours', async () => {
  const db = admin.firestore();
  const cutoff = Date.now() - AUTO_APPROVE_AFTER_MS;

  const snapshot = await db
    .collection('community_quotes')
    .where('status', '==', 'pending')
    .where('createdAt', '<=', cutoff)
    .get();

  if (snapshot.empty) {
    console.log('[autoApprove] No pending quotes eligible for auto-approval.');
    return;
  }

  const eligible = snapshot.docs.filter(
    (doc) => (doc.data().reportCount ?? 0) === 0
  );

  console.log(`[autoApprove] Found ${eligible.length} quote(s) to auto-approve.`);

  // Process in batches to stay within the 500-operation limit
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = eligible.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      batch.update(doc.ref, { status: 'approved' });
    }
    await batch.commit();
    console.log(`[autoApprove] Approved batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} quote(s).`);
  }
});
