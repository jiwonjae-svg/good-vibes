/**
 * notifyStatus.ts
 *
 * Firestore trigger: fires when a `community_quotes/{quoteId}` document is
 * updated. If the `status` field changed, send an FCM push notification to
 * the submitter so they know their quote was approved or rejected.
 *
 * Prerequisite: the submitter's FCM token must be stored at
 * `users/{submitterId}.fcmToken` (written by the app on notification
 * permission grant — see services/notificationService.ts).
 */

import * as admin from 'firebase-admin';
import { onDocumentUpdated, type FirestoreEvent, type Change, type QueryDocumentSnapshot } from 'firebase-functions/v2/firestore';
import type { ParamsOf } from 'firebase-functions/v2';

export const notifyStatus = onDocumentUpdated(
  'community_quotes/{quoteId}',
  async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, ParamsOf<'community_quotes/{quoteId}'>>) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();

    if (!before || !after) return;
    if (before.status === after.status) return; // no status change

    const newStatus: string = after.status;
    if (newStatus !== 'approved' && newStatus !== 'rejected') return;

    const submitterId: string | undefined = after.submitterId;
    if (!submitterId) return;

    // Fetch FCM token from user document
    const userSnap = await admin.firestore().doc(`users/${submitterId}`).get();
    const fcmToken: string | undefined = userSnap.data()?.fcmToken;
    if (!fcmToken) {
      console.log(`[notifyStatus] No FCM token for user ${submitterId} — skipping.`);
      return;
    }

    const isApproved = newStatus === 'approved';
    const truncatedText: string =
      typeof after.text === 'string'
        ? after.text.substring(0, 60) + (after.text.length > 60 ? '…' : '')
        : '';

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: isApproved ? '✅ 명언이 게시되었습니다!' : '명언 심사 결과',
        body: isApproved
          ? `"${truncatedText}" 이 커뮤니티에 게시되었습니다.`
          : `"${truncatedText}" 은(는) 게시되지 않았습니다.`,
      },
      data: {
        type: 'community_status',
        quoteId: event.params.quoteId,
        status: newStatus,
      },
      android: {
        notification: { channelId: 'community' },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log(`[notifyStatus] Sent FCM notification: ${response}`);
    } catch (err) {
      console.error('[notifyStatus] FCM send failed:', err);
    }
  }
);
