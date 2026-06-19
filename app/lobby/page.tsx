'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 로비 페이지는 대시보드로 통합됨
 * /lobby 접근 시 대시보드로 리다이렉트
 */
export default function LobbyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-[#0b1410] text-white/70">
      리다이렉트 중...
    </main>
  );
}
