/**
 * 타겟(샷) 이미지 관리 — 순서를 manifest.json으로 관리한다.
 * 파일명 순번(image_{n})에 의존하지 않으므로 추가/삭제/순서변경이 자유롭다.
 * 기존 image_{n} 파일은 첫 조회 시 자동으로 manifest에 마이그레이션된다. Server-only.
 */

import { promises as fs } from 'fs';
import path from 'path';

const TARGET_DIR = path.join(process.cwd(), 'public', 'targets');
const MANIFEST = path.join(TARGET_DIR, 'manifest.json');
const IMG_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
const LEGACY_RE = /^image_(\d+)\./i;

export interface TargetItem {
  /** 순서(1부터). manifest 배열 인덱스+1. */
  n: number;
  /** 저장 파일명 (compare에 그대로 전달). */
  file: string;
  /** 정적 서빙 URL. */
  url: string;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(TARGET_DIR, { recursive: true });
}

async function readManifest(): Promise<string[] | null> {
  try {
    const raw = await fs.readFile(MANIFEST, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((f) => typeof f === 'string') : null;
  } catch {
    return null;
  }
}

async function writeManifest(files: string[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(MANIFEST, JSON.stringify(files, null, 2), 'utf8');
}

async function scanImageFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(TARGET_DIR);
    return files.filter((f) => IMG_RE.test(f));
  } catch {
    return [];
  }
}

/** 순서가 반영된 파일명 목록. manifest를 디스크와 동기화(누락 제거·신규 추가·레거시 마이그레이션). */
export async function listTargetFiles(): Promise<string[]> {
  const onDisk = await scanImageFiles();
  const diskSet = new Set(onDisk);

  let manifest = await readManifest();
  if (!manifest) {
    // 레거시 image_{n} 순서로 초기 manifest 구성
    manifest = [...onDisk].sort((a, b) => {
      const na = Number(a.match(LEGACY_RE)?.[1] ?? Number.MAX_SAFE_INTEGER);
      const nb = Number(b.match(LEGACY_RE)?.[1] ?? Number.MAX_SAFE_INTEGER);
      return na - nb || a.localeCompare(b);
    });
  }

  // 존재하는 파일만 유지 + manifest에 없는 신규 파일은 뒤에 추가
  const ordered = manifest.filter((f) => diskSet.has(f));
  for (const f of onDisk) if (!ordered.includes(f)) ordered.push(f);

  await writeManifest(ordered);
  return ordered;
}

/** 파일명 목록 → 순서가 매겨진 TargetItem[]. */
export function toTargetItems(files: string[]): TargetItem[] {
  return files.map((file, i) => ({ n: i + 1, file, url: `/targets/${file}` }));
}

export async function addTargetFile(buf: Buffer, ext: string): Promise<string[]> {
  await ensureDir();
  const safeExt = (ext || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const name = `target-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  await fs.writeFile(path.join(TARGET_DIR, name), buf);
  const next = [...(await listTargetFiles()), name];
  await writeManifest(next);
  return next;
}

export async function deleteTargetFile(file: string): Promise<string[]> {
  const base = path.basename(file); // path traversal 방지
  const next = (await listTargetFiles()).filter((f) => f !== base);
  await writeManifest(next);
  try {
    await fs.unlink(path.join(TARGET_DIR, base));
  } catch {
    /* 이미 없으면 무시 */
  }
  return next;
}

export async function reorderTargetFiles(order: string[]): Promise<string[]> {
  const cur = await listTargetFiles();
  const curSet = new Set(cur);
  // 알려진 파일만 반영 + 빠진 파일은 안전하게 뒤에 보존
  const sanitized = order.map((f) => path.basename(f)).filter((f) => curSet.has(f));
  for (const f of cur) if (!sanitized.includes(f)) sanitized.push(f);
  await writeManifest(sanitized);
  return sanitized;
}
