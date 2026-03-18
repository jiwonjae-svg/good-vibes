/**
 * Google Play Store 에셋 생성 스크립트
 * Usage: node scripts/generate-store-assets.js
 *
 * 생성 파일:
 *   store-assets/feature-graphic.png  — 1024×500
 *   store-assets/screenshot-1.png     — 1080×1920 (오늘의 명언)
 *   store-assets/screenshot-2.png     — 1080×1920 (잔디밭)
 *   store-assets/screenshot-3.png     — 1080×1920 (필사)
 *   store-assets/screenshot-4.png     — 1080×1920 (낭독)
 *   store-assets/screenshot-5.png     — 1080×1920 (보관함)
 *   store-assets/screenshot-6.png     — 1080×1920 (다국어)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'store-assets');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ─── 브랜드 색상 ─────────────────────────────────────────
const C = {
  primary:    '#FF9F7E',
  primaryDark:'#E8865F',
  warm:       '#FFF8F0',
  warmMid:    '#FFE8D0',
  warmDeep:   '#FFD4C2',
  surface:    '#FFFFFF',
  text:       '#2D2D2D',
  textSub:    '#6B6B6B',
  grass1:     '#9BE9A8',
  grass2:     '#40C463',
  grass3:     '#30A14E',
  grass4:     '#216E39',
  grassEmpty: '#EBEDF0',
};

// ─── 헬퍼 함수 ───────────────────────────────────────────
function encodeText(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function shadow(x=0, y=4, blur=16, opacity=0.12) {
  return `<filter id="sh${Math.random().toString(36).slice(2)}" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="${x}" dy="${y}" stdDeviation="${blur/2}" flood-opacity="${opacity}"/>
  </filter>`;
}

// 공유 defs (그라디언트 등)
const sharedDefs = `
  <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${C.warm}"/>
    <stop offset="60%" stop-color="${C.warmMid}"/>
    <stop offset="100%" stop-color="${C.warmDeep}"/>
  </linearGradient>
  <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#FFE5D9"/>
    <stop offset="100%" stop-color="#FFD4C2"/>
  </linearGradient>
  <linearGradient id="bannerGrad" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${C.primary}"/>
    <stop offset="100%" stop-color="${C.primaryDark}"/>
  </linearGradient>
  <filter id="shCard" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="8" stdDeviation="16" flood-opacity="0.10"/>
  </filter>
  <filter id="shSm" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="6" flood-opacity="0.10"/>
  </filter>
`;

// ═══════════════════════════════════════════════════════════
// 1. Feature Graphic — 1024 × 500
// ═══════════════════════════════════════════════════════════
function featureGraphicSvg() {
  // 잔디 그리드 (우하단 장식)
  function grassGrid(cols=18, rows=7, cell=22, gap=4) {
    const levels = [0,1,2,3,4,2,1,3,4,2,0,1,3,2,4,1,0,3,2,1,4,3,2,1,0,4,3,2,1,4,
                    2,3,4,2,1,0,3,4,2,1,3,0,2,4,1,3,2,0,4,3,1,2,4,0,3,2,1,4,3,2,
                    4,1,0,3,2,4,1,3,0,2,4,1,3,2,0,4,3,1,2,4,0,3,2,1,4,3,2,0,4,3,
                    1,2,3,4,0,2,1,3,4,2,0,4,3,1,2,4,0,3,2,1,4,3,2,0,4,3,1,0,2,3];
    const clr = ['#EBEDF044','#9BE9A866','#40C46388','#30A14EAA','#216E39BB'];
    let svg = `<g opacity="0.55">`;
    let i = 0;
    for (let r=0; r<rows; r++) {
      for (let c=0; c<cols; c++) {
        const x = 680 + c*(cell+gap);
        const y = 230 + r*(cell+gap);
        svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${clr[levels[i%levels.length]]}"/>`;
        i++;
      }
    }
    svg += `</g>`;
    return svg;
  }

  // sparkle 장식
  function sparkle(x, y, size=24, opacity=0.5) {
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" opacity="${opacity}">✦</text>`;
  }

  // 떠있는 명언 카드
  const cardW=340, cardH=190, cardX=620, cardY=130;
  const quoteCard = `
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="20" fill="white" filter="url(#shCard)"/>
    <text x="${cardX+cardW/2}" y="${cardY+42}" font-size="36" fill="${C.primary}" text-anchor="middle" font-family="serif" opacity="0.6">"</text>
    <text x="${cardX+28}" y="${cardY+78}" font-size="15" fill="${C.text}" font-family="sans-serif" font-weight="600">The only way to do great work</text>
    <text x="${cardX+28}" y="${cardY+98}" font-size="15" fill="${C.text}" font-family="sans-serif" font-weight="600">is to love what you do.</text>
    <text x="${cardX+28}" y="${cardY+132}" font-size="13" fill="${C.textSub}" font-family="sans-serif">— Steve Jobs</text>
    <rect x="${cardX+28}" y="${cardY+155}" width="60" height="6" rx="3" fill="${C.primary}" opacity="0.5"/>
    <rect x="${cardX+95}" y="${cardY+155}" width="30" height="6" rx="3" fill="${C.warmDeep}" opacity="0.5"/>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
  <defs>${sharedDefs}</defs>

  <!-- 배경 그라디언트 -->
  <rect width="1024" height="500" fill="url(#bgGrad)"/>

  <!-- 좌측 원형 장식 -->
  <circle cx="-40" cy="500" r="280" fill="${C.primary}" opacity="0.06"/>
  <circle cx="80" cy="-20" r="180" fill="${C.primary}" opacity="0.05"/>

  <!-- 잔디 그리드 배경 장식 -->
  ${grassGrid()}

  <!-- sparkles -->
  ${sparkle(560, 80, 20, 0.4)}
  ${sparkle(590, 420, 14, 0.3)}
  ${sparkle(610, 200, 18, 0.35)}
  ${sparkle(1000, 60, 16, 0.3)}

  <!-- 앱 이름 -->
  <text x="72" y="170" font-size="56" font-weight="800" fill="${C.text}" font-family="sans-serif" letter-spacing="-1">Daily Glow</text>

  <!-- 부제 라인 -->
  <rect x="72" y="192" width="80" height="4" rx="2" fill="${C.primary}"/>

  <!-- 카피 -->
  <text x="72" y="240" font-size="22" fill="${C.textSub}" font-family="sans-serif">오늘의 명언으로</text>
  <text x="72" y="270" font-size="22" fill="${C.textSub}" font-family="sans-serif">하루를 빛내세요 ✨</text>

  <!-- 기능 태그 -->
  <rect x="72" y="310" width="130" height="34" rx="17" fill="${C.primary}" opacity="0.15"/>
  <text x="137" y="332" font-size="13" fill="${C.primaryDark}" font-family="sans-serif" text-anchor="middle" font-weight="600">✍️ 필사 · 낭독</text>

  <rect x="214" y="310" width="120" height="34" rx="17" fill="${C.primary}" opacity="0.15"/>
  <text x="274" y="332" font-size="13" fill="${C.primaryDark}" font-family="sans-serif" text-anchor="middle" font-weight="600">🌱 잔디밭 스트릭</text>

  <rect x="346" y="310" width="110" height="34" rx="17" fill="${C.primary}" opacity="0.15"/>
  <text x="401" y="332" font-size="13" fill="${C.primaryDark}" font-family="sans-serif" text-anchor="middle" font-weight="600">🌍 5개 언어</text>

  <!-- 명언 카드 -->
  ${quoteCard}
</svg>`;
}

// ═══════════════════════════════════════════════════════════
// 2. 스크린샷 공통 레이아웃 빌더
// ═══════════════════════════════════════════════════════════
function screenshotBase({ bannerText, body }) {
  const W=1080, H=1920;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${sharedDefs}</defs>

  <!-- 배경 -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- 상단 배너 -->
  <rect x="0" y="0" width="${W}" height="200" fill="url(#bannerGrad)"/>
  <!-- 배너 장식 원 -->
  <circle cx="900" cy="60" r="120" fill="white" opacity="0.07"/>
  <circle cx="980" cy="180" r="70" fill="white" opacity="0.05"/>

  <!-- 상태바 시뮬레이션 -->
  <text x="60" y="65" font-size="28" fill="white" font-family="sans-serif" font-weight="700" opacity="0.9">Daily Glow</text>
  <text x="${W-60}" y="65" font-size="24" fill="white" text-anchor="end" font-family="sans-serif" opacity="0.8">9:41</text>

  <!-- 배너 기능명 -->
  <text x="${W/2}" y="148" font-size="42" fill="white" font-family="sans-serif" font-weight="800" text-anchor="middle">${encodeText(bannerText)}</text>

  <!-- 본문 영역 -->
  ${body}

  <!-- 하단 탭 바 시뮬레이션 -->
  <rect x="0" y="${H-140}" width="${W}" height="140" fill="white" opacity="0.95"/>
  <rect x="0" y="${H-141}" width="${W}" height="1" fill="${C.warmDeep}"/>
  ${['명언','피드','잔디밭','보관함','설정'].map((t,i)=>{
    const tx = 108 + i*216;
    return `<text x="${tx}" y="${H-60}" font-size="26" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">${encodeText(t)}</text>`;
  }).join('\n  ')}
</svg>`;
}

// ═══════════════════════════════════════════════════════════
// Screenshot 1 — 오늘의 명언
// ═══════════════════════════════════════════════════════════
function ss1() {
  const body = `
    <!-- 날짜 -->
    <text x="540" y="290" font-size="30" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">2026년 3월 18일 화요일</text>

    <!-- 명언 카드 메인 -->
    <rect x="80" y="330" width="920" height="440" rx="32" fill="url(#cardGrad)" filter="url(#shCard)"/>
    <text x="540" y="410" font-size="64" fill="${C.primary}" text-anchor="middle" font-family="serif" opacity="0.5">"</text>
    <text x="540" y="490" font-size="36" fill="${C.text}" text-anchor="middle" font-family="sans-serif" font-weight="700">The only way to do</text>
    <text x="540" y="538" font-size="36" fill="${C.text}" text-anchor="middle" font-family="sans-serif" font-weight="700">great work is to love</text>
    <text x="540" y="586" font-size="36" fill="${C.text}" text-anchor="middle" font-family="sans-serif" font-weight="700">what you do.</text>
    <text x="540" y="640" font-size="28" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">— Steve Jobs</text>

    <!-- 카테고리 칩 -->
    <rect x="340" y="680" width="170" height="52" rx="26" fill="white" opacity="0.8"/>
    <text x="425" y="712" font-size="24" fill="${C.primaryDark}" text-anchor="middle" font-family="sans-serif" font-weight="600">💼 work</text>
    <rect x="530" y="680" width="210" height="52" rx="26" fill="white" opacity="0.8"/>
    <text x="635" y="712" font-size="24" fill="${C.primaryDark}" text-anchor="middle" font-family="sans-serif" font-weight="600">🌱 passion</text>

    <!-- 액션 버튼들 -->
    <rect x="80" y="820" width="920" height="110" rx="24" fill="white" filter="url(#shSm)" opacity="0.95"/>
    <text x="220" y="886" font-size="36" text-anchor="middle">✍️</text>
    <text x="220" y="914" font-size="22" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">필사</text>
    <text x="420" y="886" font-size="36" text-anchor="middle">🔊</text>
    <text x="420" y="914" font-size="22" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">낭독</text>
    <text x="620" y="886" font-size="36" text-anchor="middle">⌨️</text>
    <text x="620" y="914" font-size="22" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">타이핑</text>
    <text x="820" y="886" font-size="36" text-anchor="middle">🔖</text>
    <text x="820" y="914" font-size="22" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">저장</text>

    <!-- 스트릭 미니 -->
    <rect x="80" y="980" width="920" height="110" rx="24" fill="white" filter="url(#shSm)" opacity="0.95"/>
    <text x="150" y="1046" font-size="32" text-anchor="middle">🔥</text>
    <text x="260" y="1040" font-size="30" fill="${C.text}" font-family="sans-serif" font-weight="700">14일 연속 달성 중!</text>
    <text x="260" y="1072" font-size="22" fill="${C.textSub}" font-family="sans-serif">계속 이어가세요</text>
  `;
  return screenshotBase({ bannerText: '오늘의 명언 한 줄', body });
}

// ═══════════════════════════════════════════════════════════
// Screenshot 2 — 잔디밭 스트릭
// ═══════════════════════════════════════════════════════════
function ss2() {
  function grassCell(x, y, level) {
    const clr = [C.grassEmpty, C.grass1, C.grass2, C.grass3, C.grass4];
    return `<rect x="${x}" y="${y}" width="44" height="44" rx="8" fill="${clr[level]}"/>`;
  }
  const rows = 7, cols = 18;
  const pattern = [0,1,1,2,2,3,3,4,4,3,3,2,2,1,1,2,3,4,
                   1,2,2,3,3,4,4,3,3,2,2,1,0,1,2,3,4,3,
                   2,3,3,4,4,3,3,2,2,1,1,2,3,4,3,2,1,0,
                   3,4,4,3,3,2,2,1,1,2,3,4,3,2,1,0,1,2,
                   4,3,3,2,2,1,0,1,2,3,4,3,2,1,0,1,2,3,
                   3,2,2,1,1,0,1,2,3,4,3,2,1,0,0,0,0,0,
                   2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  let grid = '';
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      const x = 80 + c*52;
      const y = 560 + r*52;
      grid += grassCell(x, y, pattern[r*cols+c]);
    }
  }

  const body = `
    <!-- 스트릭 카드 -->
    <rect x="80" y="240" width="920" height="240" rx="32" fill="white" filter="url(#shCard)"/>
    <text x="540" y="330" font-size="90" text-anchor="middle">🔥</text>
    <text x="540" y="410" font-size="64" fill="${C.text}" text-anchor="middle" font-family="sans-serif" font-weight="800">14</text>
    <text x="540" y="455" font-size="30" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">일 연속 달성</text>

    <!-- 잔디 그리드 제목 -->
    <text x="80" y="530" font-size="30" fill="${C.textSub}" font-family="sans-serif" font-weight="600">2026년 활동 기록</text>
    <!-- 잔디 그리드 -->
    ${grid}

    <!-- 범례 -->
    <text x="80" y="960" font-size="24" fill="${C.textSub}" font-family="sans-serif">적음</text>
    <rect x="170" y="942" width="36" height="36" rx="6" fill="${C.grass1}"/>
    <rect x="214" y="942" width="36" height="36" rx="6" fill="${C.grass2}"/>
    <rect x="258" y="942" width="36" height="36" rx="6" fill="${C.grass3}"/>
    <rect x="302" y="942" width="36" height="36" rx="6" fill="${C.grass4}"/>
    <text x="352" y="960" font-size="24" fill="${C.textSub}" font-family="sans-serif">많음</text>

    <!-- 통계 카드 -->
    <rect x="80" y="1010" width="440" height="180" rx="24" fill="white" filter="url(#shSm)" opacity="0.95"/>
    <text x="300" y="1075" font-size="28" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">총 기록일</text>
    <text x="300" y="1145" font-size="60" fill="${C.text}" text-anchor="middle" font-family="sans-serif" font-weight="800">87</text>

    <rect x="560" y="1010" width="440" height="180" rx="24" fill="white" filter="url(#shSm)" opacity="0.95"/>
    <text x="780" y="1075" font-size="28" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">최장 스트릭</text>
    <text x="780" y="1145" font-size="60" fill="${C.primary}" text-anchor="middle" font-family="sans-serif" font-weight="800">21일</text>
  `;
  return screenshotBase({ bannerText: '꾸준함이 쌓이는 잔디밭', body });
}

// ═══════════════════════════════════════════════════════════
// Screenshot 3 — 필사 (Write Along)
// ═══════════════════════════════════════════════════════════
function ss3() {
  const body = `
    <!-- 원문 카드 -->
    <rect x="80" y="240" width="920" height="220" rx="28" fill="url(#cardGrad)" filter="url(#shCard)"/>
    <text x="120" y="310" font-size="26" fill="${C.textSub}" font-family="sans-serif">따라 쓸 문장</text>
    <text x="120" y="366" font-size="34" fill="${C.text}" font-family="sans-serif" font-weight="700">The only way to do great</text>
    <text x="120" y="408" font-size="34" fill="${C.text}" font-family="sans-serif" font-weight="700">work is to love what you do.</text>

    <!-- 필사 입력 영역 -->
    <rect x="80" y="500" width="920" height="560" rx="28" fill="white" filter="url(#shCard)"/>
    <text x="120" y="560" font-size="26" fill="${C.textSub}" font-family="sans-serif">손으로 따라 쓰기</text>

    <!-- 필기 라인들 -->
    ${[620,680,740,800,860,920,980].map(y=>`<line x1="120" y1="${y}" x2="960" y2="${y}" stroke="${C.warmDeep}" stroke-width="2"/>`).join('\n    ')}

    <!-- 필기된 텍스트 시뮬레이션 (약간 기울어진 느낌) -->
    <text x="124" y="615" font-size="30" fill="${C.text}" font-family="cursive" opacity="0.7">The only way to do great</text>
    <text x="124" y="675" font-size="30" fill="${C.text}" font-family="cursive" opacity="0.7">work is to love</text>

    <!-- 커서 -->
    <rect x="460" y="654" width="3" height="34" fill="${C.primary}" rx="1">
      <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
    </rect>

    <!-- 진행률 바 -->
    <rect x="120" y="1020" width="840" height="12" rx="6" fill="${C.warmDeep}"/>
    <rect x="120" y="1020" width="420" height="12" rx="6" fill="${C.primary}"/>
    <text x="540" y="1070" font-size="26" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">50% 완성</text>

    <!-- 제출 버튼 -->
    <rect x="200" y="1100" width="680" height="90" rx="45" fill="${C.primary}"/>
    <text x="540" y="1155" font-size="32" fill="white" text-anchor="middle" font-family="sans-serif" font-weight="700">완성하기</text>
  `;
  return screenshotBase({ bannerText: '손으로 쓰며 마음에 새기기', body });
}

// ═══════════════════════════════════════════════════════════
// Screenshot 4 — 낭독 (Speak Along)
// ═══════════════════════════════════════════════════════════
function ss4() {
  // 파형 시뮬레이션
  const heights = [20,40,60,80,100,120,100,80,120,100,60,40,80,100,80,60,40,20,
                   40,60,80,60,40,20,40,80,100,80,60,100,120,80,60,40,20];
  const waveforms = heights.map((h,i)=>{
    const x = 120 + i*24;
    const y = 800 - h;
    return `<rect x="${x}" y="${y}" width="14" height="${h*2}" rx="7" fill="${C.primary}" opacity="${0.4+h/200}"/>`;
  }).join('\n    ');

  const body = `
    <!-- 명언 카드 (하이라이트) -->
    <rect x="80" y="240" width="920" height="300" rx="28" fill="url(#cardGrad)" filter="url(#shCard)"/>
    <text x="120" y="310" font-size="26" fill="${C.textSub}" font-family="sans-serif">소리 내어 읽기</text>

    <!-- 단어별 하이라이트 시뮬레이션 -->
    <rect x="115" y="345" width="80" height="46" rx="8" fill="${C.primary}" opacity="0.3"/>
    <text x="120" y="380" font-size="38" fill="${C.text}" font-family="sans-serif" font-weight="700">The </text>
    <text x="205" y="380" font-size="38" fill="${C.text}" font-family="sans-serif" font-weight="700">only </text>
    <text x="340" y="380" font-size="38" fill="${C.text}" font-family="sans-serif" font-weight="700">way </text>
    <text x="470" y="380" font-size="38" fill="${C.text}" font-family="sans-serif" font-weight="700">to</text>
    <text x="120" y="428" font-size="38" fill="${C.text}" font-family="sans-serif" font-weight="700">do great work is to</text>
    <text x="120" y="476" font-size="38" fill="${C.text}" font-family="sans-serif" font-weight="700">love what you do.</text>

    <!-- 파형 -->
    <rect x="80" y="660" width="920" height="280" rx="28" fill="white" filter="url(#shSm)" opacity="0.95"/>
    ${waveforms}

    <!-- 마이크 버튼 -->
    <circle cx="540" cy="1060" r="90" fill="white" filter="url(#shCard)"/>
    <circle cx="540" cy="1060" r="72" fill="${C.primary}"/>
    <text x="540" y="1082" font-size="60" text-anchor="middle" dominant-baseline="middle">🎙️</text>

    <!-- 결과 유사도 표시 -->
    <rect x="80" y="1190" width="920" height="120" rx="24" fill="white" filter="url(#shSm)" opacity="0.95"/>
    <text x="200" y="1265" font-size="30" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">유사도</text>
    <text x="420" y="1265" font-size="48" fill="${C.grass3}" text-anchor="middle" font-family="sans-serif" font-weight="800">92%</text>
    <text x="650" y="1265" font-size="40" text-anchor="middle">🎉</text>
    <text x="820" y="1265" font-size="30" fill="${C.primary}" text-anchor="middle" font-family="sans-serif" font-weight="700">훌륭해요!</text>
  `;
  return screenshotBase({ bannerText: '소리 내어 읽으며 체득하기', body });
}

// ═══════════════════════════════════════════════════════════
// Screenshot 5 — 보관함
// ═══════════════════════════════════════════════════════════
function ss5() {
  const quotes = [
    { en: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', cat: '💼 work' },
    { en: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein', cat: '🌱 growth' },
    { en: 'It always seems impossible until it is done.', author: 'Nelson Mandela', cat: '💪 courage' },
    { en: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt', cat: '✨ dream' },
  ];

  const cards = quotes.map((q,i) => {
    const y = 320 + i*230;
    const gradients = ['url(#cardGrad)', `#E8F4FF`, `#F0FFE8`, `#FAF0FF`];
    return `
    <rect x="80" y="${y}" width="920" height="200" rx="24" fill="${gradients[i]}" filter="url(#shSm)"/>
    <text x="120" y="${y+52}" font-size="22" fill="${C.textSub}" font-family="sans-serif">${encodeText(q.cat)}</text>
    <text x="120" y="${y+92}" font-size="26" fill="${C.text}" font-family="sans-serif" font-weight="600"
      textLength="760" lengthAdjust="spacingAndGlyphs">${encodeText(q.en.length>42 ? q.en.slice(0,42)+'...' : q.en)}</text>
    <text x="120" y="${y+132}" font-size="22" fill="${C.textSub}" font-family="sans-serif">— ${encodeText(q.author)}</text>
    <text x="940" y="${y+100}" font-size="36" text-anchor="middle">🔖</text>
    `;
  }).join('');

  const body = `
    <!-- 검색 바 -->
    <rect x="80" y="240" width="920" height="70" rx="35" fill="white" filter="url(#shSm)"/>
    <text x="150" y="284" font-size="30" text-anchor="middle">🔍</text>
    <text x="200" y="286" font-size="28" fill="${C.textSub}" font-family="sans-serif">명언 검색...</text>

    ${cards}

    <!-- 총 개수 -->
    <text x="540" y="1260" font-size="28" fill="${C.textSub}" text-anchor="middle" font-family="sans-serif">총 24개의 명언 저장됨</text>
  `;
  return screenshotBase({ bannerText: '나만의 명언 컬렉션', body });
}

// ═══════════════════════════════════════════════════════════
// Screenshot 6 — 다국어 지원
// ═══════════════════════════════════════════════════════════
function ss6() {
  const langs = [
    { code:'KO', label:'한국어', flag:'🇰🇷', text:'하는 일을 사랑하는 것이\n훌륭한 일을 하는 유일한 방법이다.' },
    { code:'EN', label:'English', flag:'🇺🇸', text:'The only way to do\ngreat work is to love what you do.' },
    { code:'JA', label:'日本語', flag:'🇯🇵', text:'偉大な仕事をする唯一の方法は、\n自分のしていることを愛することだ。' },
    { code:'ZH', label:'中文', flag:'🇨🇳', text:'做好工作的唯一途径\n就是热爱自己所做的事情。' },
    { code:'ES', label:'Español', flag:'🇪🇸', text:'La única forma de hacer\nun gran trabajo es amar lo que haces.' },
  ];

  // 탭 바
  const tabs = langs.map((l,i) => {
    const x = 100 + i*180;
    const active = i === 0;
    return `
    <rect x="${x}" y="252" width="160" height="62" rx="16"
      fill="${active ? C.primary : 'white'}" opacity="${active ? 1 : 0.85}"/>
    <text x="${x+80}" y="276" font-size="22" text-anchor="middle" dominant-baseline="middle">${l.flag}</text>
    <text x="${x+80}" y="300" font-size="18" fill="${active ? 'white' : C.textSub}" text-anchor="middle" font-family="sans-serif">${encodeText(l.code)}</text>
    `;
  }).join('');

  // 언어별 카드들
  const cards = langs.map((l,i) => {
    const y = 360 + i*240;
    const active = i === 0;
    return `
    <rect x="80" y="${y}" width="920" height="210" rx="24"
      fill="${active ? 'url(#cardGrad)' : 'white'}"
      filter="url(#shSm)" opacity="${active ? 1 : 0.8}"/>
    <text x="120" y="${y+48}" font-size="28" font-family="sans-serif" font-weight="700"
      fill="${C.textSub}">${l.flag} ${encodeText(l.label)}</text>
    ${l.text.split('\n').map((line,li)=>
      `<text x="120" y="${y+96+li*46}" font-size="${active?30:26}" fill="${C.text}"
        font-family="sans-serif" ${active?'font-weight="600"':''}>${encodeText(line)}</text>`
    ).join('\n    ')}
    `;
  }).join('');

  const body = `${tabs}${cards}`;
  return screenshotBase({ bannerText: '5개 언어로 감상하기', body });
}

// ═══════════════════════════════════════════════════════════
// 렌더링
// ═══════════════════════════════════════════════════════════
async function generate() {
  const assets = [
    { name: 'feature-graphic.png', width: 1024, height: 500, svg: featureGraphicSvg() },
    { name: 'screenshot-1.png',    width: 1080, height: 1920, svg: ss1() },
    { name: 'screenshot-2.png',    width: 1080, height: 1920, svg: ss2() },
    { name: 'screenshot-3.png',    width: 1080, height: 1920, svg: ss3() },
    { name: 'screenshot-4.png',    width: 1080, height: 1920, svg: ss4() },
    { name: 'screenshot-5.png',    width: 1080, height: 1920, svg: ss5() },
    { name: 'screenshot-6.png',    width: 1080, height: 1920, svg: ss6() },
  ];

  for (const asset of assets) {
    const outPath = path.join(OUT_DIR, asset.name);
    await sharp(Buffer.from(asset.svg))
      .png({ quality: 95 })
      .toFile(outPath);
    const stat = fs.statSync(outPath);
    console.log(`✅  ${asset.name} (${(stat.size/1024).toFixed(0)} KB)`);
  }
  console.log(`\n📁  저장 위치: ${OUT_DIR}`);
}

generate().catch(err => { console.error('❌', err.message); process.exit(1); });
