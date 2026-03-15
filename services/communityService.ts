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
  submitterPhotoURL?: string | null;
  language: string;
  status: 'pending' | 'approved' | 'rejected';
  likeCount: number;
  createdAt: number; // Unix ms
  categories: string[];
}

const COMMUNITY_QUOTES = 'community_quotes';
const COMMUNITY_LIKES = 'community_likes';
const COMMUNITY_REPORTS = 'community_reports';

// Max 3 submissions per 24h per user (rate limit tracked locally via store)
export const SUBMISSION_RATE_LIMIT = 3;

// --------------------------------------------------------------------------
// XSS / injection defence
// --------------------------------------------------------------------------

/** Patterns that indicate injection attempts. Checked BEFORE stripping tags. */
const XSS_PATTERNS = [
  /<script[\s>/]/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /on\w+\s*=/i,       // inline event handlers (onclick=, onload=, …)
  /<iframe[\s>/]/i,
  /<object[\s>/]/i,
  /<embed[\s>/]/i,
  /data:\s*text\/html/i,
  /expression\s*\(/i, // CSS expression()
];

/** Returns true when the input contains known XSS patterns. */
function containsXss(input: string): boolean {
  return XSS_PATTERNS.some((p) => p.test(input));
}

/**
 * Strips residual HTML tags and normalises whitespace.
 * Applied AFTER the XSS pattern check so malicious input is rejected,
 * not silently mangled.
 */
function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')          // strip any remaining HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim();
}

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
  submitterPhotoURL?: string | null,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: 'offline' };

  // XSS defence — check raw input before any processing
  if (containsXss(text) || containsXss(author)) {
    appLog.warn('[communityService] XSS attempt blocked', { uid });
    return { success: false, error: 'xssBlocked' };
  }

  const trimmedText = sanitizeText(text);
  const trimmedAuthor = sanitizeText(author);

  // Client-side validation (also enforced server-side via security rules / Cloud Function)
  if (trimmedText.length < 10) return { success: false, error: 'tooShort' };
  if (trimmedText.length > 500) return { success: false, error: 'tooLong' };
  if (/https?:\/\//i.test(trimmedText)) return { success: false, error: 'noUrls' };

  try {
    const docRef = await addDoc(collection(db, COMMUNITY_QUOTES), {
      text: trimmedText,
      author: trimmedAuthor,
      submitterId: uid,
      submitterName,
      submitterPhotoURL: submitterPhotoURL ?? null,
      language,
      status: 'approved', // direct publish — no moderation queue
      likeCount: 0,
      createdAt: serverTimestamp(),
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
  sortBy: 'latest' | 'likes' = 'latest',
): Promise<{ quotes: CommunityQuote[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const db = getDb();
  if (!db) return { quotes: [], lastDoc: null };

  try {
    const col = collection(db, COMMUNITY_QUOTES);
    const sortField = sortBy === 'likes' ? 'likeCount' : 'createdAt';
    const constraints: QueryConstraint[] = [
      where('status', '==', 'approved'),
      where('language', '==', language),
      orderBy(sortField, 'desc'),
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
// My Submissions
// --------------------------------------------------------------------------

export async function fetchMySubmissions(
  uid: string,
  pageLimit = 50,
): Promise<CommunityQuote[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const col = collection(db, COMMUNITY_QUOTES);
    const q = query(
      col,
      where('submitterId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(pageLimit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CommunityQuote, 'id' | 'createdAt'>),
      createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
    }));
  } catch (e) {
    appLog.error('[communityService] fetchMySubmissions failed', e);
    return [];
  }
}

// --------------------------------------------------------------------------
// Server-side rate limit (Firestore users/{uid}.communitySubmissions)
// --------------------------------------------------------------------------

const USERS = 'users';

export async function checkServerRateLimit(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false; // offline: fall through to local check

  try {
    const userRef = doc(db, USERS, uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return false;
    const data = snap.data();
    const submissions: number[] = data?.communitySubmissions ?? [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = submissions.filter((t) => t > cutoff);
    return recent.length >= 3;
  } catch (e) {
    appLog.warn('[communityService] checkServerRateLimit failed, falling back to local', e);
    return false;
  }
}

export async function recordServerSubmission(uid: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    const userRef = doc(db, USERS, uid);
    const snap = await getDoc(userRef);
    const existing: number[] = snap.exists() ? (snap.data()?.communitySubmissions ?? []) : [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const pruned = existing.filter((t) => t > cutoff);
    pruned.push(Date.now());
    await updateDoc(userRef, { communitySubmissions: pruned });
  } catch (e) {
    appLog.warn('[communityService] recordServerSubmission failed', e);
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

// --------------------------------------------------------------------------
// Edit / Delete own posts
// --------------------------------------------------------------------------

export async function updateCommunityQuote(
  uid: string,
  quoteId: string,
  text: string,
  author: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: 'offline' };

  if (containsXss(text) || containsXss(author)) {
    return { success: false, error: 'xssBlocked' };
  }
  const trimmedText = sanitizeText(text);
  const trimmedAuthor = sanitizeText(author);
  if (trimmedText.length < 10) return { success: false, error: 'tooShort' };
  if (trimmedText.length > 500) return { success: false, error: 'tooLong' };
  if (/https?:\/\//i.test(trimmedText)) return { success: false, error: 'noUrls' };

  try {
    // Security: only the submitter can update
    const existing = await getDoc(doc(db, COMMUNITY_QUOTES, quoteId));
    if (!existing.exists() || existing.data()?.submitterId !== uid) {
      return { success: false, error: 'forbidden' };
    }
    await updateDoc(doc(db, COMMUNITY_QUOTES, quoteId), {
      text: trimmedText,
      author: trimmedAuthor,
      updatedAt: serverTimestamp(),
    });
    appLog.log('[communityService] updated', { quoteId, uid });
    return { success: true };
  } catch (e) {
    appLog.error('[communityService] update failed', e);
    return { success: false, error: 'serverError' };
  }
}

export async function deleteCommunityQuote(
  uid: string,
  quoteId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { success: false, error: 'offline' };

  try {
    const existing = await getDoc(doc(db, COMMUNITY_QUOTES, quoteId));
    if (!existing.exists() || existing.data()?.submitterId !== uid) {
      return { success: false, error: 'forbidden' };
    }
    // best-effort: 작성자 본인의 좋아요가 있으면 함께 삭제
    try {
      const myLikeRef = doc(db, COMMUNITY_LIKES, `${uid}_${quoteId}`);
      const myLikeSnap = await getDoc(myLikeRef);
      if (myLikeSnap.exists()) await deleteDoc(myLikeRef);
    } catch { /* non-critical */ }
    await deleteDoc(doc(db, COMMUNITY_QUOTES, quoteId));
    appLog.log('[communityService] deleted', { quoteId, uid });
    return { success: true };
  } catch (e) {
    appLog.error('[communityService] delete failed', e);
    return { success: false, error: 'serverError' };
  }
}

export async function fetchCommunityQuotesByUser(
  uid: string,
  pageLimit = 50,
): Promise<CommunityQuote[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const col = collection(db, COMMUNITY_QUOTES);
    const q = query(
      col,
      where('submitterId', '==', uid),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(pageLimit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CommunityQuote, 'id' | 'createdAt'>),
      createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
    }));
  } catch (e) {
    appLog.error('[communityService] fetchCommunityQuotesByUser failed', e);
    return [];
  }
}

// --------------------------------------------------------------------------
// Followed users' quotes (feed boosting)
// --------------------------------------------------------------------------

/**
 * Fetches recent approved quotes from a set of followed user UIDs.
 * Results are sorted by recency and deduplicated.
 * Firestore `in` query supports up to 30 items per chunk.
 */
export async function fetchFollowedQuotes(
  followedUids: string[],
  language: string,
  maxLimit = 15,
): Promise<CommunityQuote[]> {
  if (followedUids.length === 0) return [];
  const db = getDb();
  if (!db) return [];

  try {
    // Chunk into groups of 30 (Firestore 'in' operator limit)
    const chunks: string[][] = [];
    for (let i = 0; i < followedUids.length; i += 30) {
      chunks.push(followedUids.slice(i, i + 30));
    }

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const q = query(
          collection(db, COMMUNITY_QUOTES),
          where('submitterId', 'in', chunk),
          where('status', '==', 'approved'),
          where('language', '==', language),
          orderBy('createdAt', 'desc'),
          limit(maxLimit),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CommunityQuote, 'id' | 'createdAt'>),
          createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
        }));
      }),
    );

    // Flatten, deduplicate, sort by recency, cap at maxLimit
    const seen = new Set<string>();
    return results
      .flat()
      .filter((q) => { if (seen.has(q.id)) return false; seen.add(q.id); return true; })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, maxLimit);
  } catch (e) {
    appLog.error('[communityService] fetchFollowedQuotes failed', e);
    return [];
  }
}
