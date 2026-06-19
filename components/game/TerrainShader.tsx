'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend, useFrame } from '@react-three/fiber';
import type { CourseLayout, HillDefinition } from '@/lib/game/types';
import { getFairwayCenterX, getFairwayWidth } from '@/lib/game/courseLayout';

/**
 * 벙커 blob 정의 (셰이더의 bunkerSDF와 동기화)
 * 레퍼런스 이미지 기반 배치
 */
const BUNKER_BLOBS = [
  // === 그린 주변 벙커들 (7개) ===
  { centers: [[-32, 398], [-38, 392]], radii: [7, 5], depth: 0.7 },
  { centers: [[-28, 385], [-35, 380]], radii: [6, 5], depth: 0.6 },
  { centers: [[-30, 365], [-35, 358]], radii: [6, 5], depth: 0.6 },
  { centers: [[18, 395], [25, 388]], radii: [7, 5], depth: 0.8 },   // 항아리 벙커
  { centers: [[22, 378], [28, 372]], radii: [6, 5], depth: 0.7 },
  { centers: [[20, 358], [15, 350]], radii: [6, 5], depth: 0.6 },
  { centers: [[-5, 340], [5, 335]], radii: [5, 4], depth: 0.5 },
  // === 페어웨이 벙커들 (4개) ===
  { centers: [[30, 220], [35, 212]], radii: [7, 5], depth: 0.5 },
  { centers: [[-28, 180], [-22, 172]], radii: [6, 5], depth: 0.5 },
  { centers: [[25, 120], [30, 112]], radii: [5, 4], depth: 0.4 },
  { centers: [[-20, 50], [-25, 42]], radii: [5, 4], depth: 0.4 },
];

export { BUNKER_BLOBS };

// Smooth minimum (JavaScript 버전)
function smin(a: number, b: number, k: number): number {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

// 간단한 2D 해시 노이즈
function hash(x: number, y: number): number {
  return ((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1 + 1) % 1;
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);

  return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy;
}

/**
 * 벙커 SDF 계산 (셰이더와 동일한 로직)
 * @returns 거리가 0보다 작으면 벙커 내부
 */
function bunkerSDF(x: number, z: number): { inside: boolean; depth: number; normalizedDist: number } {
  let minDist = 1000;
  let bunkerDepth = 0;

  for (const blob of BUNKER_BLOBS) {
    let blobDist = 1000;

    // 여러 원의 smooth union
    for (let i = 0; i < blob.centers.length; i++) {
      const [cx, cz] = blob.centers[i];
      const r = blob.radii[i];
      const dist = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2) - r;

      if (i === 0) {
        blobDist = dist;
      } else {
        blobDist = smin(blobDist, dist, 5);
      }
    }

    // 노이즈 추가
    const n = noise2D(x * 0.2, z * 0.2) * 2.5;
    blobDist += n;

    if (blobDist < minDist) {
      minDist = blobDist;
      bunkerDepth = blob.depth;
    }
  }

  const inside = minDist < 0;
  // 벙커 내부에서 중심으로 갈수록 깊어짐 (포물선 프로파일)
  const normalizedDist = inside ? Math.min(1, -minDist / 8) : 0;

  return { inside, depth: bunkerDepth, normalizedDist };
}

/**
 * 벙커 깊이 계산 (지형 높이 조정용)
 * 가장자리는 얕고 중심으로 갈수록 깊어짐
 */
function getBunkerDepth(x: number, z: number): number {
  const result = bunkerSDF(x, z);
  if (!result.inside) return 0;

  // 포물선 프로파일: 가장자리 0, 중심 최대 깊이
  const t = result.normalizedDist;
  return result.depth * (1 - (1 - t) * (1 - t));
}

/**
 * 언덕 높이 계산
 */
function calculateHeight(x: number, z: number, hills: HillDefinition[]): number {
  let height = 0;
  for (const hill of hills) {
    const dx = x - hill.position[0];
    const dz = z - hill.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < hill.radius) {
      const t = dist / hill.radius;
      const contribution = (hill.height * (1 + Math.cos(Math.PI * t))) / 2;
      height = Math.max(height, contribution);
    }
  }
  return height - getBunkerDepth(x, z);
}

/**
 * 지형 높이 계산
 */
function getHeightAt(x: number, z: number, hills: HillDefinition[]): number {
  if (x < -150) {
    return -0.8;
  } else if (x < -75) {
    const beachProgress = (x + 150) / 75;
    return beachProgress * 0.5;
  } else {
    return calculateHeight(x, z, hills);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLSL Shader
// ─────────────────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  // 그린 위치 (uniform으로 전달받지만 셰이더에서 직접 정의도 가능)
  uniform vec3 uGreenCenter;
  uniform float uGreenRadius;

  // 조명
  uniform vec3 uLightDir;

  // 색상 정의 - 레퍼런스 이미지 기반 열대 골프장 색상
  const vec3 COLOR_OCEAN_DEEP = vec3(0.000, 0.545, 0.600);    // #008B99 깊은 바다
  const vec3 COLOR_OCEAN_SHALLOW = vec3(0.200, 0.700, 0.720); // #33B3B8 얕은 바다
  const vec3 COLOR_BEACH = vec3(0.957, 0.918, 0.820);         // #F4EAD1 밝은 백사장
  const vec3 COLOR_BUNKER = vec3(0.925, 0.878, 0.745);        // #ECE0BE 벙커 모래
  const vec3 COLOR_TEEBOX = vec3(0.300, 0.680, 0.350);        // #4DAD59 티박스
  const vec3 COLOR_GREEN = vec3(0.350, 0.720, 0.380);         // #59B861 밝은 그린
  const vec3 COLOR_FRINGE = vec3(0.320, 0.680, 0.350);        // #52AD59 프린지
  const vec3 COLOR_FAIRWAY_LIGHT = vec3(0.420, 0.750, 0.380); // #6BBF61 페어웨이 밝음
  const vec3 COLOR_FAIRWAY_DARK = vec3(0.360, 0.700, 0.340);  // #5CB357 페어웨이 어두움
  const vec3 COLOR_SEMI_ROUGH = vec3(0.280, 0.580, 0.280);    // #479447 세미러프
  const vec3 COLOR_LIGHT_ROUGH = vec3(0.220, 0.500, 0.220);   // #388038 라이트러프
  const vec3 COLOR_ROUGH = vec3(0.180, 0.420, 0.180);         // #2E6B2E 러프 (짙은 숲)
  const vec3 COLOR_LAGOON = vec3(0.100, 0.620, 0.680);        // #1A9EAD 라군

  // ─────────────────────────────────────────────────────────────────────────────
  // Noise functions for organic shapes
  // ─────────────────────────────────────────────────────────────────────────────

  // Simple hash function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // 2D noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Smooth min for blob union
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 그린 SDF - 땅콩/조롱박 모양 (레퍼런스 이미지 기반)
  // ─────────────────────────────────────────────────────────────────────────────

  float greenSDF(vec2 pos) {
    // 그린은 세 개의 원을 합친 유기적 모양
    vec2 greenMain = vec2(-8.0, 375.0);    // 메인 원 (가장 큼)
    vec2 greenTop = vec2(-5.0, 395.0);     // 위쪽 원
    vec2 greenBottom = vec2(-12.0, 358.0); // 아래쪽 원

    float d1 = length(pos - greenMain) - 18.0;
    float d2 = length(pos - greenTop) - 14.0;
    float d3 = length(pos - greenBottom) - 12.0;

    float d = smin(smin(d1, d2, 12.0), d3, 10.0);

    // 노이즈로 가장자리 약간 불규칙하게
    float n = noise(pos * 0.12) * 2.0;

    return d + n;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 벙커 SDF - 레퍼런스 이미지 기반 배치
  // ─────────────────────────────────────────────────────────────────────────────

  float bunkerSDF(vec2 pos) {
    float d = 1000.0;

    // === 그린 주변 벙커들 (7개) ===

    // 그린 왼쪽 위 벙커 1
    vec2 b1a = vec2(-32.0, 398.0);
    vec2 b1b = vec2(-38.0, 392.0);
    float db1 = smin(length(pos - b1a) - 7.0, length(pos - b1b) - 5.0, 4.0);
    d = min(d, db1);

    // 그린 왼쪽 위 벙커 2
    vec2 b2a = vec2(-28.0, 385.0);
    vec2 b2b = vec2(-35.0, 380.0);
    float db2 = smin(length(pos - b2a) - 6.0, length(pos - b2b) - 5.0, 4.0);
    d = min(d, db2);

    // 그린 왼쪽 아래 벙커
    vec2 b3a = vec2(-30.0, 365.0);
    vec2 b3b = vec2(-35.0, 358.0);
    float db3 = smin(length(pos - b3a) - 6.0, length(pos - b3b) - 5.0, 4.0);
    d = min(d, db3);

    // 그린 오른쪽 위 벙커 1
    vec2 b4a = vec2(18.0, 395.0);
    vec2 b4b = vec2(25.0, 388.0);
    float db4 = smin(length(pos - b4a) - 7.0, length(pos - b4b) - 5.0, 4.0);
    d = min(d, db4);

    // 그린 오른쪽 위 벙커 2
    vec2 b5a = vec2(22.0, 378.0);
    vec2 b5b = vec2(28.0, 372.0);
    float db5 = smin(length(pos - b5a) - 6.0, length(pos - b5b) - 5.0, 4.0);
    d = min(d, db5);

    // 그린 오른쪽 아래 벙커
    vec2 b6a = vec2(20.0, 358.0);
    vec2 b6b = vec2(15.0, 350.0);
    float db6 = smin(length(pos - b6a) - 6.0, length(pos - b6b) - 5.0, 4.0);
    d = min(d, db6);

    // 그린 앞 벙커 (페어웨이와 그린 사이)
    vec2 b7a = vec2(-5.0, 340.0);
    vec2 b7b = vec2(5.0, 335.0);
    float db7 = smin(length(pos - b7a) - 5.0, length(pos - b7b) - 4.0, 3.0);
    d = min(d, db7);

    // === 페어웨이 벙커들 (4개) ===

    // 페어웨이 오른쪽 벙커 1 (중간)
    vec2 fb1a = vec2(30.0, 220.0);
    vec2 fb1b = vec2(35.0, 212.0);
    float dfb1 = smin(length(pos - fb1a) - 7.0, length(pos - fb1b) - 5.0, 4.0);
    d = min(d, dfb1);

    // 페어웨이 왼쪽 벙커 (중간)
    vec2 fb2a = vec2(-28.0, 180.0);
    vec2 fb2b = vec2(-22.0, 172.0);
    float dfb2 = smin(length(pos - fb2a) - 6.0, length(pos - fb2b) - 5.0, 4.0);
    d = min(d, dfb2);

    // 페어웨이 오른쪽 벙커 2 (아래)
    vec2 fb3a = vec2(25.0, 120.0);
    vec2 fb3b = vec2(30.0, 112.0);
    float dfb3 = smin(length(pos - fb3a) - 5.0, length(pos - fb3b) - 4.0, 3.0);
    d = min(d, dfb3);

    // 티박스 근처 벙커
    vec2 fb4a = vec2(-20.0, 50.0);
    vec2 fb4b = vec2(-25.0, 42.0);
    float dfb4 = smin(length(pos - fb4a) - 5.0, length(pos - fb4b) - 4.0, 3.0);
    d = min(d, dfb4);

    // 노이즈로 가장자리 구불구불하게
    float n = noise(pos * 0.18) * 2.0;

    return d + n;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 라군/워터 해저드 SDF - 오른쪽 상단에 큰 라군
  // ─────────────────────────────────────────────────────────────────────────────

  float lagoonSDF(vec2 pos) {
    // 큰 불규칙한 라군 (그린 오른쪽)
    vec2 l1 = vec2(55.0, 380.0);   // 메인
    vec2 l2 = vec2(70.0, 365.0);   // 오른쪽
    vec2 l3 = vec2(45.0, 395.0);   // 위
    vec2 l4 = vec2(60.0, 350.0);   // 아래

    float d = smin(
      smin(length(pos - l1) - 22.0, length(pos - l2) - 18.0, 15.0),
      smin(length(pos - l3) - 14.0, length(pos - l4) - 16.0, 12.0),
      18.0
    );

    // 노이즈로 해안선 불규칙하게
    float n = noise(pos * 0.08) * 4.0;

    return d + n;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // S-커브 페어웨이 - 더 유기적인 곡선
  // ─────────────────────────────────────────────────────────────────────────────

  const int FAIRWAY_PATH_COUNT = 11;
  const vec3 FAIRWAY_PATH[11] = vec3[11](
    vec3(0.0, 0.0, 32.0),         // 티박스
    vec3(40.0, 0.0, 38.0),        // 시작
    vec3(80.0, -5.0, 45.0),       // 약간 왼쪽
    vec3(130.0, -12.0, 50.0),     // 왼쪽으로
    vec3(180.0, -8.0, 48.0),      // 왼쪽 정점
    vec3(230.0, 5.0, 45.0),       // 오른쪽으로
    vec3(280.0, 12.0, 42.0),      // 오른쪽 정점
    vec3(320.0, 5.0, 40.0),       // 다시 중앙으로
    vec3(350.0, -5.0, 38.0),      // 그린 접근
    vec3(370.0, -8.0, 35.0),      // 그린 앞
    vec3(400.0, -8.0, 30.0)       // 그린
  );

  float getFairwayCenterX(float z) {
    if (z < FAIRWAY_PATH[0].x) return FAIRWAY_PATH[0].y;
    if (z > FAIRWAY_PATH[10].x) return FAIRWAY_PATH[10].y;

    for (int i = 0; i < 10; i++) {
      float currZ = FAIRWAY_PATH[i].x;
      float nextZ = FAIRWAY_PATH[i + 1].x;

      if (z >= currZ && z <= nextZ) {
        float t = (z - currZ) / (nextZ - currZ);
        // smooth interpolation
        t = t * t * (3.0 - 2.0 * t);
        return mix(FAIRWAY_PATH[i].y, FAIRWAY_PATH[i + 1].y, t);
      }
    }
    return 0.0;
  }

  float getFairwayWidth(float z) {
    if (z < FAIRWAY_PATH[0].x) return FAIRWAY_PATH[0].z;
    if (z > FAIRWAY_PATH[10].x) return FAIRWAY_PATH[10].z;

    for (int i = 0; i < 10; i++) {
      float currZ = FAIRWAY_PATH[i].x;
      float nextZ = FAIRWAY_PATH[i + 1].x;

      if (z >= currZ && z <= nextZ) {
        float t = (z - currZ) / (nextZ - currZ);
        t = t * t * (3.0 - 2.0 * t);
        return mix(FAIRWAY_PATH[i].z, FAIRWAY_PATH[i + 1].z, t);
      }
    }
    return 35.0;
  }

  // 페어웨이 가장자리에 약간의 노이즈
  float fairwayEdgeNoise(vec2 pos) {
    return noise(pos * 0.06) * 5.0;
  }

  // 해안선 노이즈 (유기적인 경계)
  float coastlineNoise(vec2 pos) {
    return noise(pos * 0.025) * 25.0 + noise(pos * 0.05) * 10.0;
  }

  // 바다/해변 경계 SDF
  float oceanSDF(vec2 pos) {
    float baseX = -120.0;
    float n = coastlineNoise(pos);
    return pos.x - (baseX + n);
  }

  // 해변/러프 경계 SDF
  float beachSDF(vec2 pos) {
    float baseX = -55.0;
    float n = coastlineNoise(pos) * 0.6;
    return pos.x - (baseX + n);
  }

  void main() {
    float x = vWorldPosition.x;
    float z = vWorldPosition.z;
    vec2 pos = vec2(x, z);

    vec3 color;

    // === 바다 영역 (유기적 해안선) ===
    float oceanDist = oceanSDF(pos);
    if (oceanDist < 0.0) {
      // 깊이에 따른 바다색 그라데이션
      float depth = clamp(-oceanDist / 50.0, 0.0, 1.0);
      color = mix(COLOR_OCEAN_SHALLOW, COLOR_OCEAN_DEEP, depth);
    }
    // === 해변 영역 (유기적 경계) ===
    else if (beachSDF(pos) < 0.0) {
      color = COLOR_BEACH;
    }
    // === 라군/워터 해저드 ===
    else if (lagoonSDF(pos) < 0.0) {
      color = COLOR_LAGOON;
    }
    // === 벙커 체크 ===
    else if (bunkerSDF(pos) < 0.0) {
      color = COLOR_BUNKER;
    }
    // === 티박스 ===
    else if (z >= -5.0 && z <= 12.0 && abs(x) <= 10.0) {
      color = COLOR_TEEBOX;
    }
    // === 그린 영역 ===
    else if (greenSDF(pos) < 0.0) {
      color = COLOR_GREEN;
    }
    // === 프린지 ===
    else if (greenSDF(pos) < 6.0) {
      color = COLOR_FRINGE;
    }
    // === 페어웨이 영역 ===
    else if (z >= 5.0 && z <= 410.0) {
      float fairwayCenterX = getFairwayCenterX(z);
      float fairwayWidth = getFairwayWidth(z);
      float edgeNoise = fairwayEdgeNoise(pos);
      float distFromCenter = abs(x - fairwayCenterX);
      float halfWidth = fairwayWidth / 2.0 + edgeNoise;

      if (distFromCenter <= halfWidth) {
        // 스트라이프 패턴 (대각선) - 더 자연스럽게
        float stripePhase = z + x * 0.25;
        int stripeIndex = int(floor(stripePhase / 15.0));
        bool isLightStripe = mod(float(stripeIndex), 2.0) < 1.0;
        color = isLightStripe ? COLOR_FAIRWAY_LIGHT : COLOR_FAIRWAY_DARK;
      }
      else if (distFromCenter <= halfWidth + 10.0) {
        color = COLOR_SEMI_ROUGH;
      }
      else if (distFromCenter <= halfWidth + 22.0) {
        color = COLOR_LIGHT_ROUGH;
      }
      else {
        color = COLOR_ROUGH;
      }
    }
    else {
      color = COLOR_ROUGH;
    }

    // 조명
    float diffuse = max(dot(vNormal, uLightDir), 0.0);
    float ambient = 0.55;
    float lighting = ambient + diffuse * 0.45;

    gl_FragColor = vec4(color * lighting, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// React Component
// ─────────────────────────────────────────────────────────────────────────────

interface TerrainShaderProps {
  layout: CourseLayout;
  length?: number;
  width?: number;
  segments?: number;
}

export function TerrainShaderMesh({
  layout,
  length = 450,
  width = 1000,
  segments = 200,
}: TerrainShaderProps) {
  const { geometry, uniforms } = useMemo(() => {
    const extendedLength = length + 400;

    // 기본 PlaneGeometry 생성
    const geo = new THREE.PlaneGeometry(width, extendedLength, segments, segments);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, (length / 2) + 50);

    // 높이 적용
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const h = getHeightAt(x, z, layout.hills);
      positions.setY(i, h);
    }
    geo.computeVertexNormals();

    const uniformData = {
      uGreenCenter: { value: new THREE.Vector3(-15, 0, 380) },
      uGreenRadius: { value: 30 },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
    };

    return { geometry: geo, uniforms: uniformData };
  }, [layout, length, width, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
