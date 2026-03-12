/**
 * onLikeWrite.ts
 *
 * Firestore trigger: whenever a document in `community_likes/{likeId}` is
 * created or deleted, atomically increment / decrement the `likeCount` field
 * on the corresponding `community_quotes/{quoteId}` document.
 *
 * Document ID convention: `{userId}_{quoteId}`
 */

import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const onLikeWrite = onDocumentWritten(
  'community_likes/{likeId}',
  async (event) => {
    const likeId: string = event.params.likeId;

    // Extract quoteId from the compound document ID:  "{userId}_{quoteId}"
    const underscoreIndex = likeId.indexOf('_');
    if (underscoreIndex === -1) {
      console.warn('[onLikeWrite] Unexpected likeId format:', likeId);
      return;
    }
    const quoteId = likeId.substring(underscoreIndex + 1);
    const quoteRef = admin.firestore().doc(`community_quotes/${quoteId}`);

    const before = event.data?.before;
    const after  = event.data?.after;

    if (!before?.exists && after?.exists) {
      // Document created → like added
      await quoteRef.update({ likeCount: FieldValue.increment(1) });
    } else if (before?.exists && !after?.exists) {
      // Document deleted → like removed
      await quoteRef.update({ likeCount: FieldValue.increment(-1) });
    }
    // updates are ignored (shouldn't happen by security rules)
  }
);
