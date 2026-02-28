export interface SeedPraise {
  text: string;
  lang: 'ko' | 'en' | 'ja' | 'zh';
}

export const seedPraises: SeedPraise[] = [
  // ============================================
  // Korean Praises (한국어)
  // ============================================
  { text: '정말 대단해요! 당신의 노력이 빛나고 있어요.', lang: 'ko' },
  { text: '멋져요! 한 걸음 더 성장했네요.', lang: 'ko' },
  { text: '훌륭합니다! 꾸준한 노력이 결실을 맺을 거예요.', lang: 'ko' },
  { text: '와, 정말 잘했어요! 자신을 자랑스러워 하세요.', lang: 'ko' },
  { text: '최고예요! 오늘도 한 뼘 더 자랐어요.', lang: 'ko' },
  { text: '놀라워요! 당신의 열정이 느껴져요.', lang: 'ko' },
  { text: '참 잘했어요! 이 습관이 인생을 바꿀 거예요.', lang: 'ko' },
  { text: '감동이에요! 매일 발전하는 모습이 아름다워요.', lang: 'ko' },
  { text: '브라보! 오늘의 노력을 잊지 마세요.', lang: 'ko' },
  { text: '잘하고 있어요! 포기하지 않는 당신이 멋져요.', lang: 'ko' },
  { text: '오늘도 해냈네요! 작은 성공이 큰 기적을 만들어요.', lang: 'ko' },
  { text: '역시 대단해요! 꾸준함이 당신의 무기예요.', lang: 'ko' },
  { text: '짝짝짝! 오늘의 한 걸음이 내일의 큰 도약이 될 거예요.', lang: 'ko' },
  { text: '정말 자랑스러워요! 당신은 이미 충분히 빛나고 있어요.', lang: 'ko' },
  { text: '환상적이에요! 이 순간을 기억하세요.', lang: 'ko' },
  { text: '완벽해요! 당신의 성실함에 감탄해요.', lang: 'ko' },
  { text: '놀랍도록 잘했어요! 당신의 내일이 기대돼요.', lang: 'ko' },
  { text: '최선을 다하는 당신이 정말 아름다워요.', lang: 'ko' },
  { text: '한 걸음 한 걸음, 당신은 목표에 다가가고 있어요.', lang: 'ko' },
  { text: '오늘의 당신에게 박수를 보내요!', lang: 'ko' },

  // ============================================
  // English Praises
  // ============================================
  { text: "Amazing! Your effort is truly shining.", lang: 'en' },
  { text: "Wonderful! You've taken another step forward.", lang: 'en' },
  { text: "Excellent! Your consistent effort will pay off.", lang: 'en' },
  { text: "Wow, great job! Be proud of yourself.", lang: 'en' },
  { text: "You're the best! You grew a little more today.", lang: 'en' },
  { text: "Incredible! I can feel your passion.", lang: 'en' },
  { text: "Well done! This habit will change your life.", lang: 'en' },
  { text: "Inspiring! It's beautiful to see you improve every day.", lang: 'en' },
  { text: "Bravo! Don't forget today's effort.", lang: 'en' },
  { text: "You're doing great! You're amazing for not giving up.", lang: 'en' },
  { text: "You did it again today! Small wins create big miracles.", lang: 'en' },
  { text: "Impressive! Consistency is your superpower.", lang: 'en' },
  { text: "Fantastic! Today's step will be tomorrow's leap.", lang: 'en' },
  { text: "So proud of you! You're already shining bright.", lang: 'en' },
  { text: "Phenomenal! Remember this moment.", lang: 'en' },
  { text: "Perfect! Your dedication is admirable.", lang: 'en' },
  { text: "Remarkably done! I'm excited for your tomorrow.", lang: 'en' },
  { text: "You're beautiful for doing your best.", lang: 'en' },
  { text: "Step by step, you're getting closer to your goal.", lang: 'en' },
  { text: "A round of applause for you today!", lang: 'en' },

  // ============================================
  // Japanese Praises (日本語)
  // ============================================
  { text: '本当に素晴らしい！あなたの努力が輝いています。', lang: 'ja' },
  { text: '素敵です！また一歩成長しましたね。', lang: 'ja' },
  { text: '素晴らしい！継続的な努力は必ず実を結びます。', lang: 'ja' },
  { text: 'わあ、よくできました！自分を誇りに思ってください。', lang: 'ja' },
  { text: '最高です！今日もまた少し成長しましたね。', lang: 'ja' },
  { text: '驚きです！あなたの情熱が伝わってきます。', lang: 'ja' },
  { text: 'よくできました！この習慣があなたの人生を変えますよ。', lang: 'ja' },
  { text: '感動です！毎日成長する姿が美しいです。', lang: 'ja' },
  { text: 'ブラボー！今日の努力を忘れないでください。', lang: 'ja' },
  { text: 'うまくいっていますよ！諦めないあなたが素敵です。', lang: 'ja' },
  { text: '今日もやり遂げましたね！小さな成功が大きな奇跡を生みます。', lang: 'ja' },
  { text: 'さすがです！継続こそがあなたの武器です。', lang: 'ja' },
  { text: '拍手！今日の一歩が明日の大きな飛躍になりますよ。', lang: 'ja' },
  { text: '本当に誇らしいです！あなたはすでに十分輝いています。', lang: 'ja' },
  { text: '素晴らしい！この瞬間を覚えていてください。', lang: 'ja' },
  { text: '完璧です！あなたの誠実さに感心します。', lang: 'ja' },
  { text: '見事にできました！あなたの明日が楽しみです。', lang: 'ja' },
  { text: '最善を尽くすあなたは本当に美しいです。', lang: 'ja' },
  { text: '一歩一歩、目標に近づいていますよ。', lang: 'ja' },
  { text: '今日のあなたに拍手を送ります！', lang: 'ja' },

  // ============================================
  // Chinese Praises (中文)
  // ============================================
  { text: '真的很棒！你的努力正在发光。', lang: 'zh' },
  { text: '太好了！你又前进了一步。', lang: 'zh' },
  { text: '很出色！坚持的努力一定会有回报的。', lang: 'zh' },
  { text: '哇，做得真好！为自己感到骄傲吧。', lang: 'zh' },
  { text: '你是最棒的！今天又成长了一点。', lang: 'zh' },
  { text: '太厉害了！我能感受到你的热情。', lang: 'zh' },
  { text: '做得很好！这个习惯会改变你的人生。', lang: 'zh' },
  { text: '真感人！每天看到你进步的样子很美好。', lang: 'zh' },
  { text: '太棒了！别忘了今天的努力。', lang: 'zh' },
  { text: '你做得很好！不放弃的你真的很了不起。', lang: 'zh' },
  { text: '今天又做到了！小成功会创造大奇迹。', lang: 'zh' },
  { text: '果然很厉害！坚持就是你的武器。', lang: 'zh' },
  { text: '鼓掌！今天的一步会成为明天的大飞跃。', lang: 'zh' },
  { text: '真的很自豪！你已经足够闪耀了。', lang: 'zh' },
  { text: '太棒了！记住这个时刻。', lang: 'zh' },
  { text: '完美！你的认真让我很感动。', lang: 'zh' },
  { text: '做得非常好！期待你的明天。', lang: 'zh' },
  { text: '尽最大努力的你真的很美。', lang: 'zh' },
  { text: '一步一步，你正在接近目标。', lang: 'zh' },
  { text: '为今天的你鼓掌！', lang: 'zh' },
];

export function getPraisesByLanguage(lang: string): SeedPraise[] {
  return seedPraises.filter((p) => p.lang === lang);
}
