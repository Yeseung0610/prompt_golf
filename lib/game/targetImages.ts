/**
 * Built-in target scenes rendered as inline SVG data URIs so the "목표 이미지"
 * preview is never empty and requires no network / external asset hosting.
 * Each scene depicts a distinct golf landscape the player must recreate.
 */

function svg(inner: string): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

const sky = (a: string, b: string) => `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7bc46a"/><stop offset="1" stop-color="#3f8a3f"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#sky)"/>`;

const cloud = (x: number, y: number, s: number) =>
  `<g fill="#ffffff" opacity="0.85"><ellipse cx="${x}" cy="${y}" rx="${34 * s}" ry="${
    16 * s
  }"/><ellipse cx="${x + 26 * s}" cy="${y + 4 * s}" rx="${24 * s}" ry="${
    13 * s
  }"/><ellipse cx="${x - 26 * s}" cy="${y + 4 * s}" rx="${22 * s}" ry="${12 * s}"/></g>`;

const flag = (x: number, y: number, h = 60) => `
  <line x1="${x}" y1="${y}" x2="${x}" y2="${y - h}" stroke="#e8e8e8" stroke-width="3"/>
  <path d="M${x} ${y - h} l34 10 -34 10 z" fill="#e23b3b"/>
  <circle cx="${x}" cy="${y}" r="6" fill="#1c1c1c" opacity="0.35"/>`;

const tree = (x: number, y: number, s = 1) => `
  <rect x="${x - 4 * s}" y="${y - 10 * s}" width="${8 * s}" height="${18 * s}" fill="#6b4a2b"/>
  <circle cx="${x}" cy="${y - 24 * s}" r="${18 * s}" fill="#2f7d35"/>
  <circle cx="${x - 12 * s}" cy="${y - 14 * s}" r="${13 * s}" fill="#357f38"/>
  <circle cx="${x + 12 * s}" cy="${y - 14 * s}" r="${13 * s}" fill="#2c7333"/>`;

const scenes: string[] = [
  // 1 — open fairway, mountains, blue sky
  svg(`${sky('#5fb8f2', '#bfe6ff')}
    ${cloud(120, 70, 1)}${cloud(470, 55, 1.3)}
    <path d="M0 250 L120 170 L240 230 L360 160 L500 220 L640 175 L640 250 Z" fill="#6f86a6" opacity="0.7"/>
    <path d="M0 260 L160 200 L320 250 L480 195 L640 250 L640 260 Z" fill="#5d7a5a" opacity="0.8"/>
    <rect y="250" width="640" height="150" fill="url(#grass)"/>
    <path d="M180 400 Q320 250 360 250 Q400 250 460 400 Z" fill="#7fcf6f"/>
    ${tree(70, 300, 1.4)}${tree(580, 300, 1.5)}${tree(530, 285, 1)}
    ${flag(360, 256, 46)}
    <circle cx="320" cy="384" r="9" fill="#ffffff" stroke="#cfcfcf"/>`),

  // 2 — water hazard left, green right
  svg(`${sky('#4aa8e0', '#cdeeff')}
    ${cloud(200, 60, 1.1)}${cloud(520, 90, 1)}
    <path d="M0 245 L200 195 L420 240 L640 200 L640 245 Z" fill="#6a86a0" opacity="0.65"/>
    <rect y="245" width="640" height="155" fill="url(#grass)"/>
    <path d="M0 300 Q140 280 180 330 Q150 400 0 400 Z" fill="#2f7fb0"/>
    <path d="M0 300 Q140 280 180 330 Q150 400 0 400 Z" fill="#ffffff" opacity="0.08"/>
    <ellipse cx="470" cy="320" rx="120" ry="46" fill="#8ad77a"/>
    ${flag(470, 312, 50)}
    ${tree(600, 300, 1.3)}${tree(60, 270, 0.9)}
    <circle cx="320" cy="386" r="9" fill="#ffffff" stroke="#cfcfcf"/>`),

  // 3 — bunkers around the green, sunset
  svg(`${sky('#f4a05a', '#ffe2b0')}
    ${cloud(150, 65, 1.2)}${cloud(500, 50, 1)}
    <circle cx="540" cy="80" r="34" fill="#ffd27a" opacity="0.9"/>
    <path d="M0 250 L180 200 L380 245 L560 205 L640 240 L640 250 Z" fill="#8a6f6f" opacity="0.6"/>
    <rect y="250" width="640" height="150" fill="url(#grass)"/>
    <ellipse cx="320" cy="330" rx="150" ry="55" fill="#86d275"/>
    <ellipse cx="210" cy="350" rx="46" ry="20" fill="#e9d39a"/>
    <ellipse cx="430" cy="352" rx="50" ry="22" fill="#e9d39a"/>
    ${flag(320, 322, 48)}
    ${tree(70, 300, 1.2)}${tree(585, 300, 1.3)}
    <circle cx="320" cy="386" r="9" fill="#ffffff" stroke="#cfcfcf"/>`),

  // 4 — dogleg through forest
  svg(`${sky('#6fc0ef', '#d6f0ff')}
    ${cloud(110, 55, 1)}${cloud(420, 70, 1.2)}
    <rect y="250" width="640" height="150" fill="url(#grass)"/>
    <path d="M260 400 Q300 300 420 270 Q540 250 600 250 L600 400 Z" fill="#7fcf6f"/>
    ${tree(60, 320, 1.6)}${tree(120, 300, 1.2)}${tree(180, 290, 1)}
    ${tree(560, 290, 1.3)}${tree(610, 320, 1.6)}
    ${flag(520, 262, 44)}
    <circle cx="320" cy="386" r="9" fill="#ffffff" stroke="#cfcfcf"/>`),

  // 5 — island green
  svg(`${sky('#3f9fd8', '#bfe6ff')}
    ${cloud(180, 60, 1.1)}${cloud(500, 80, 1)}
    <rect y="250" width="640" height="150" fill="#2f7fb0"/>
    <ellipse cx="320" cy="330" rx="160" ry="60" fill="#7ecf6c"/>
    <ellipse cx="320" cy="330" rx="160" ry="60" fill="#ffffff" opacity="0.05"/>
    ${flag(320, 320, 50)}
    <rect x="40" y="252" width="560" height="6" fill="#caa46a" opacity="0.6"/>
    <circle cx="120" cy="384" r="9" fill="#ffffff" stroke="#cfcfcf"/>`),
];

export const TARGET_IMAGES = scenes;

export const TARGET_DESCRIPTIONS = [
  '푸른 하늘 아래 넓은 페어웨이와 멀리 보이는 산맥, 그린 위의 붉은 깃발',
  '왼쪽에 워터 해저드가 있고 오른쪽에 둥근 그린이 있는 골프 코스',
  '석양이 지는 하늘, 그린 주변을 감싸는 두 개의 벙커',
  '울창한 숲을 통과하는 도그렉 홀, 오른쪽으로 휘어지는 페어웨이',
  '물로 둘러싸인 아일랜드 그린과 그 위의 깃발',
];
