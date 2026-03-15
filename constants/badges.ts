export const BADGE_CONFIG: Record<string, { emoji: string; titleKey: string; descKey: string; image: ReturnType<typeof require> }> = {
  streak_3:    { emoji: '🌟', titleKey: 'badge.streak3Title',    descKey: 'badge.streak3Desc',    image: require('../assets/badge_streak_3.png') },
  streak_7:    { emoji: '🔥', titleKey: 'badge.streak7Title',    descKey: 'badge.streak7Desc',    image: require('../assets/badge_streak_7.png') },
  streak_30:   { emoji: '⭐', titleKey: 'badge.streak30Title',   descKey: 'badge.streak30Desc',   image: require('../assets/badge_streak_30.png') },
  streak_100:  { emoji: '👑', titleKey: 'badge.streak100Title',  descKey: 'badge.streak100Desc',  image: require('../assets/badge_streak_100.png') },
  streak_365:  { emoji: '🏆', titleKey: 'badge.streak365Title',  descKey: 'badge.streak365Desc',  image: require('../assets/badge_streak_365.png') },
  quotes_50:   { emoji: '📖', titleKey: 'badge.quotes50Title',   descKey: 'badge.quotes50Desc',   image: require('../assets/badge_quotes_50.png') },
  quotes_200:  { emoji: '📚', titleKey: 'badge.quotes200Title',  descKey: 'badge.quotes200Desc',  image: require('../assets/badge_quotes_200.png') },
  quotes_500:  { emoji: '🎯', titleKey: 'badge.quotes500Title',  descKey: 'badge.quotes500Desc',  image: require('../assets/badge_quotes_500.png') },
  bookmark_5:  { emoji: '💛', titleKey: 'badge.bookmark5Title',  descKey: 'badge.bookmark5Desc',  image: require('../assets/badge_bookmark_5.png') },
  bookmark_20: { emoji: '🌟', titleKey: 'badge.bookmark20Title', descKey: 'badge.bookmark20Desc', image: require('../assets/badge_bookmark_20.png') },
  community_1: { emoji: '✍️', titleKey: 'badge.community1Title', descKey: 'badge.community1Desc', image: require('../assets/badge_community_1.png') },
  community_5: { emoji: '📣', titleKey: 'badge.community5Title', descKey: 'badge.community5Desc', image: require('../assets/badge_community_5.png') },
  first_login:  { emoji: '🎉', titleKey: 'badge.firstLoginTitle',  descKey: 'badge.firstLoginDesc',  image: require('../assets/badge_first_login.png') },
  early_bird:   { emoji: '🌅', titleKey: 'badge.earlyBirdTitle',   descKey: 'badge.earlyBirdDesc',   image: require('../assets/badge_early_bird.png') },
  night_owl:    { emoji: '🦉', titleKey: 'badge.nightOwlTitle',    descKey: 'badge.nightOwlDesc',    image: require('../assets/badge_night_owl.png') },
  sharer:       { emoji: '📤', titleKey: 'badge.sharerTitle',      descKey: 'badge.sharerDesc',      image: require('../assets/badge_sharer.png') },
  multilingual: { emoji: '🌍', titleKey: 'badge.multilingualTitle', descKey: 'badge.multilingualDesc', image: require('../assets/badge_multilingual.png') },
  week_perfect: { emoji: '🏅', titleKey: 'badge.weekPerfectTitle', descKey: 'badge.weekPerfectDesc', image: require('../assets/badge_week_perfect.png') },
};

/**
 * Returns the image source for a photoURL that may contain a `badge:ID` prefix.
 * Returns a require()'d number for badge images, { uri } for regular URLs, or null if empty.
 */
export function getBadgeImageSource(photoURL: string | null | undefined): ReturnType<typeof require> | { uri: string } | null {
  if (!photoURL) return null;
  if (photoURL.startsWith('badge:')) {
    const badgeId = photoURL.slice(6);
    return BADGE_CONFIG[badgeId]?.image ?? null;
  }
  return { uri: photoURL };
}
