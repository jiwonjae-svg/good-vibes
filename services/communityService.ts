/**
 * communityService.ts
 * Firestore CRUD for community_quotes and community_likes collections.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  QueryDocumentSnapshot,
  DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb } from './firebaseConfig';
import { appLog } from './logger';

export interface CommunityQuote {
  id: string;
  text: string;
  author: string;
  submitterId: string;
  submitterName: string;
  language: string;
  status: 'pending' | 'approved' | 'rejected';
  likeCount: number;
  createdAt: number; // Unix ms
  categories: string[];
}

const COMMUNITY_QUOTES = 'community_quotes';
const COMMUNITY_LIKES = 'community_likes';

// Max 3 submissions per 24h per user (rate limit tracked locally via store)
export const SUBMISSION_RATE_LIMIT = 3;

// --------------------------------------------------------------------------
// Submit
// --------------------------------------------------------------------------

export async function submitCommunityQuote(
  uid: string,
  submitterName: string,
  text: string,
  author: string,
  language: string,
  categories: string[],
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: 'offline' };

  const trimmedText = text.trim();
  const trimmedAuthor = author.trim();

  // Client-side validation (also enforced server-side via security rules / Cloud Function)
  if (trimmedText.length < 10) return { success: false, error: 'tooShort' };
  if (trimmedText.length > 500) return { success: false, error: 'tooLong' };
  if (/https?:\/\//i.test(trimmedText)) return { success: false, error: 'noUrls' };

  try {
    const docRef = await addDoc(collection(db, COMMUNITY_QUOTES), {
      text: trimmedText,
      author: trimmedAuthor || submitterName,
      submitterId: uid,
      submitterName,
      language,
      status: 'pending',
      likeCount: 0,
      createdAt: serverTimestamp(),
      approvedAt: null,
      rejectedReason: null,
      reportCount: 0,
      categories: categories.slice(0, 3),
    });
    appLog.log('[communityService] submitted', { id: docRef.id, uid });
    return { success: true, id: docRef.id };
  } catch (e) {
    appLog.error('[communityService] submit failed', e);
    return { success: false, error: 'serverError' };
  }
}

// --------------------------------------------------------------------------
// Fetch feed
// --------------------------------------------------------------------------

export async function fetchApprovedCommunityQuotes(
  language: string,
  pageLimit = 20,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ quotes: CommunityQuote[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const db = getDb();
  if (!db) return { quotes: [], lastDoc: null };

  try {
    const col = collection(db, COMMUNITY_QUOTES);
    const constraints: QueryConstraint[] = [
      where('status', '==', 'approved'),
      where('language', '==', language),
      orderBy('createdAt', 'desc'),
      limit(pageLimit),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    const q = query(col, ...constraints);
    const snap = await getDocs(q);

    const quotes: CommunityQuote[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CommunityQuote, 'id' | 'createdAt'>),
      createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
    }));
    const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    appLog.log('[communityService] fetched', { count: quotes.length, language });
    return { quotes, lastDoc };
  } catch (e) {
    appLog.error('[communityService] fetch failed', e);
    return { quotes: [], lastDoc: null };
  }
}

// --------------------------------------------------------------------------
// Like / Unlike
// --------------------------------------------------------------------------

export async function likeCommunityQuote(uid: string, quoteId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const likeId = `${uid}_${quoteId}`;
  try {
    await setDoc(doc(db, COMMUNITY_LIKES, likeId), {
      userId: uid,
      quoteId,
      createdAt: serverTimestamp(),
    });
    // Increment denormalized counter
    await updateDoc(doc(db, COMMUNITY_QUOTES, quoteId), {
      likeCount: increment(1),
    });
  } catch (e) {
    appLog.error('[communityService] like failed', e);
    throw e;
  }
}

export async function unlikeCommunityQuote(uid: string, quoteId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const likeId = `${uid}_${quoteId}`;
  try {
    await deleteDoc(doc(db, COMMUNITY_LIKES, likeId));
    await updateDoc(doc(db, COMMUNITY_QUOTES, quoteId), {
      likeCount: increment(-1),
    });
  } catch (e) {
    appLog.error('[communityService] unlike failed', e);
    throw e;
  }
}

export async function fetchLikedIds(uid: string, quoteIds: string[]): Promise<string[]> {
  const db = getDb();
  if (!db || quoteIds.length === 0) return [];

  try {
    const checks = await Promise.all(
      quoteIds.map((qid) => getDoc(doc(db, COMMUNITY_LIKES, `${uid}_${qid}`))),
    );
    return quoteIds.filter((_, i) => checks[i].exists());
  } catch {
    return [];
  }
}

// --------------------------------------------------------------------------
// Report
// --------------------------------------------------------------------------

export async function reportCommunityQuote(
  uid: string,
  quoteId: string,
  reason: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // Store report record (prevent duplicate report by same user)
    await setDoc(doc(db, `community_reports/${uid}_${quoteId}`), {
      userId: uid,
      quoteId,
      reason,
      createdAt: serverTimestamp(),
    });
    // Increment reportCount — Cloud Function auto-rejects at threshold
    await updateDoc(doc(db, COMMUNITY_QUOTES, quoteId), {
      reportCount: increment(1),
    });
    appLog.log('[communityService] reported', { quoteId, reason });
  } catch (e) {
    appLog.error('[communityService] report failed', e);
  }
}
