/**
 * smartNotifications.ts
 *
 * Daily cron job that sends personalized push notifications to users.
 *
 * Logic (per user):
 *   1. If 50%+ of the last 10 viewed categories are "negative" → send a comfort quote
 *   2. Else 25% chance to resurface a bookmarked quote
 *   3. Else tag-match preferred categories → community quotes first, then catalog
 *   4. Personalized title: "${name}님, ${cat} 테마의 글이 도착했어요"
 *   5. Stale FCM tokens are silently removed from Firestore
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// ── Constants ────────────────────────────────────────────────────────────────

const NEGATIVE_CATS = new Set([
  'regret', 'sadness', 'despair', 'anxiety', 'fear',
  'loneliness', 'burnout', 'breakup', 'betrayal',
  'stress', 'anger', 'failure', 'jealousy',
]);

const COMFORT_CATS = [
  'comfort', 'encouragement', 'hope', 'healing', 'peace', 'selfLove', 'love',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

type QuoteSnippet = { id: string; text: string; author?: string };

async function pickCatalogQuote(
  db: admin.firestore.Firestore,
  categories?: string[],
): Promise<QuoteSnippet | null> {
  const col = db.collection('quotes_catalog');
  let snap: admin.firestore.QuerySnapshot;

  if (categories && categories.length > 0) {
    snap = await col
      .where('category', 'in', categories.slice(0, 10))
      .limit(50)
      .get();
  } else {
    snap = await col.limit(50).get();
  }

  if (snap.empty) return null;
  const chosen = snap.docs[Math.floor(Math.random() * snap.docs.length)];
  const d = chosen.data();
  return { id: chosen.id, text: d.text as string, author: d.author as string | undefined };
}

async function pickCommunityQuote(
  db: admin.firestore.Firestore,
  categories: string[],
  language: string,
): Promise<QuoteSnippet | null> {
  if (!categories.length) return null;

  const snap = await db
    .collection('community_quotes')
    .where('status', '==', 'approved')
    .where('language', '==', language)
    .where('categories', 'array-contains-any', categories.slice(0, 10))
    .orderBy('likeCount', 'desc')
    .limit(10)
    .get();

  if (snap.empty) return null;
  const chosen = snap.docs[Math.floor(Math.random() * snap.docs.length)];
  const d = chosen.data();
  return { id: chosen.id, text: d.text as string, author: d.author as string | undefined };
}

function truncate(text: string, max = 90): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// ── Language-aware title builder ──────────────────────────────────────────────

type SupportedLang = 'ko' | 'en' | 'ja' | 'zh' | 'es';

interface TitleSet {
  negative: (name: string) => string;
  bookmark: (name: string) => string;
  tagged: (name: string, cat: string) => string;
  fallback: (name: string) => string;
}

const TITLES: Record<SupportedLang, TitleSet> = {
  ko: {
    negative: (n) => n ? `${n}님 곁에 있을게요 💙` : '오늘 하루도 수고하셨어요 💙',
    bookmark: (n) => n ? `${n}님이 저장한 글이에요` : '저장한 글을 다시 꺼내봐요',
    tagged: (n, c) => n ? `${n}님, ${c} 테마의 글이 도착했어요` : `${c} 테마의 오늘의 글`,
    fallback: (n) => n ? `${n}님, 오늘의 글이 기다려요` : '오늘의 글이 기다리고 있어요',
  },
  en: {
    negative: (n) => n ? `${n}, we're here for you 💙` : "You're not alone today 💙",
    bookmark: (n) => n ? `${n}, a quote you saved` : "A quote you saved is waiting",
    tagged: (n, c) => n ? `${n}, a ${c} quote for you` : `Today's ${c} quote`,
    fallback: (n) => n ? `${n}, your daily quote is waiting` : "Your daily quote is waiting",
  },
  ja: {
    negative: (n) => n ? `${n}さん、そばにいますよ 💙` : '今日もお疲れさまでした 💙',
    bookmark: (n) => n ? `${n}さんが保存した言葉です` : '保存した名言を振り返りましょう',
    tagged: (n, c) => n ? `${n}さん、${c}の名言が届きました` : `今日の${c}の名言`,
    fallback: (n) => n ? `${n}さん、今日の名言をどうぞ` : '今日の名言が待っています',
  },
  zh: {
    negative: (n) => n ? `${n}，我们陪着你 💙` : '今天辛苦了 💙',
    bookmark: (n) => n ? `${n}，这是你收藏的一句话` : '回顾一下你收藏的名言吧',
    tagged: (n, c) => n ? `${n}，${c}主题的名言来了` : `今日${c}名言`,
    fallback: (n) => n ? `${n}，今天的名言在等你` : '今天的名言在等你',
  },
  es: {
    negative: (n) => n ? `${n}, aquí estamos para ti 💙` : 'Hoy también lo lograste 💙',
    bookmark: (n) => n ? `${n}, una cita que guardaste` : 'Una cita guardada te espera',
    tagged: (n, c) => n ? `${n}, una cita de ${c} para ti` : `La cita de ${c} de hoy`,
    fallback: (n) => n ? `${n}, tu cita diaria te espera` : 'Tu cita diaria te está esperando',
  },
};

function getTitles(language: string): TitleSet {
  return TITLES[(language as SupportedLang) in TITLES ? (language as SupportedLang) : 'ko'];
}

// ── Per-user send logic ───────────────────────────────────────────────────────

async function sendToUser(
  db: admin.firestore.Firestore,
  messaging: admin.messaging.Messaging,
  userDoc: admin.firestore.QueryDocumentSnapshot,
): Promise<boolean> {
  const data = userDoc.data();

  const fcmToken: string | undefined = data.fcmToken;
  if (!fcmToken) return false;

  const displayName: string = (data.displayName ?? '').trim();
  const selectedCategories: string[] = data.settings?.selectedCategories ?? [];
  const recentViewedCategories: string[] = data.settings?.recentViewedCategories ?? [];
  const language: string = data.settings?.language ?? 'ko';
  const bookmarkedQuotes: string[] = data.bookmarkedQuotes ?? [];

  let title = '';
  let body = '';
  let quoteId: string | undefined;

  const t = getTitles(language);
  const name = displayName;

  // 1. Negative-pattern detection: last 10 categories, threshold ≥ 50%
  const last10 = recentViewedCategories.slice(-10);
  const negCount = last10.filter((c) => NEGATIVE_CATS.has(c)).length;
  const hasNegativePattern = last10.length >= 3 && negCount / last10.length >= 0.5;

  if (hasNegativePattern) {
    const quote = await pickCatalogQuote(db, COMFORT_CATS);
    if (quote) {
      title = t.negative(name);
      body = truncate(quote.text);
      quoteId = quote.id;
    }
  }

  // 2. Weight-based reminder: 25% chance to resurface a bookmarked quote
  if (!body && bookmarkedQuotes.length > 0 && Math.random() < 0.25) {
    const randomId = bookmarkedQuotes[Math.floor(Math.random() * bookmarkedQuotes.length)];
    const snap = await db.collection('quotes_catalog').doc(randomId).get().catch(() => null);
    if (snap?.exists) {
      const d = snap.data()!;
      title = t.bookmark(name);
      body = truncate(d.text as string);
      quoteId = randomId;
    }
  }

  // 3. Tag-matched quote: community first, then catalog
  if (!body) {
    const cats = selectedCategories.length > 0 ? selectedCategories : COMFORT_CATS;
    const quote =
      (await pickCommunityQuote(db, cats, language)) ??
      (await pickCatalogQuote(db, cats));

    if (quote) {
      const catLabel = selectedCategories[0] ?? (language === 'ko' ? '오늘' : 'today');
      title = t.tagged(name, catLabel);
      body = truncate(quote.text);
      quoteId = quote.id;
    }
  }

  // 4. Fallback
  if (!body) {
    title = t.fallback(name);
    body = language === 'ko'
      ? '지금 DailyGlow에서 확인해보세요!'
      : 'Open DailyGlow to check it out!';
  }

  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: quoteId ? { quoteId } : {},
      android: { priority: 'normal', notification: { sound: 'default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? '';
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      // Silently remove stale token
      await userDoc.ref
        .update({ fcmToken: admin.firestore.FieldValue.delete() })
        .catch(() => {});
    }
    return false;
  }
}

// ── Scheduled function ────────────────────────────────────────────────────────

/**
 * Runs daily at 07:00 UTC.
 * Each user's device handles local time offsets via the client-side
 * `scheduleSmartNotifications()` for precise local delivery; this server
 * function supplements with richer, server-side personalisation.
 */
export const schedulePersonalizedPush = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    let usersSnap: admin.firestore.QuerySnapshot;
    try {
      usersSnap = await db
        .collection('users')
        .where('settings.dailyReminderEnabled', '==', true)
        .get();
    } catch (e) {
      console.error('[smartNotif] Failed to query users:', e);
      return;
    }

    console.log(`[smartNotif] Processing ${usersSnap.size} users`);

    const results = await Promise.allSettled(
      usersSnap.docs.map((doc) => sendToUser(db, messaging, doc)),
    );

    const sent = results.filter(
      (r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled' && r.value,
    ).length;

    console.log(`[smartNotif] Sent ${sent}/${usersSnap.size} notifications`);
  },
);
