'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useHydrated } from '@/store/useHydrated';
import { HoleInfoPanel } from '@/components/game/HoleInfoPanel';
import { Leaderboard } from '@/components/game/Leaderboard';
import { TeamRoster } from '@/components/game/TeamRoster';
import { TeamProfileSetup } from '@/components/game/TeamProfileSetup';
import { IconRail } from '@/components/game/IconRail';
import { HoleMiniMap } from '@/components/game/HoleMiniMap';

const DashboardScene = dynamic(
  () => import('@/components/game/DashboardScene').then((m) => m.DashboardScene),
  { ssr: false },
);

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useHydrated();

  const ensureSeeded = useGameStore((s) => s.ensureSeeded);
  const setProfile = useGameStore((s) => s.setProfile);
  const teams = useGameStore((s) => s.teams);
  const myTeamId = useGameStore((s) => s.myTeamId);
  const leaderboard = useGameStore((s) => s.leaderboard());
  const hole = useGameStore((s) => s.currentHole());
  const myTeam = useGameStore((s) => s.myTeam());

  const [draftName, setDraftName] = useState('버디헌터스');
  const [draftImage, setDraftImage] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded();
  }, [ensureSeeded]);

  useEffect(() => {
    if (myTeam) {
      setDraftName(myTeam.name);
      setDraftImage(myTeam.imageUrl);
    }
  }, [myTeam]);

  const handleStart = () => {
    setProfile(draftName, draftImage);
    router.push('/play');
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1410]">
      {/* 3D golf field background */}
      <div className="absolute inset-0">
        {hydrated && <DashboardScene teams={teams} hole={hole} />}
      </div>

      {/* subtle vignette so HUD pops */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/45" />

      {/* Top-left: hole info */}
      <div className="absolute left-5 top-5">
        <HoleInfoPanel hole={hole} />
      </div>

      {/* Top-right: leaderboard */}
      {hydrated && (
        <div className="absolute right-5 top-5">
          <Leaderboard teams={leaderboard} myTeamId={myTeamId} title="순위" />
        </div>
      )}

      {/* Right side: minimap + icon rail */}
      {hydrated && (
        <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-4 xl:flex">
          <HoleMiniMap hole={hole} teams={teams} myTeamId={myTeamId} />
        </div>
      )}
      <div className="absolute bottom-6 right-5">
        <IconRail />
      </div>

      {/* Bottom-left: our team roster */}
      {hydrated && myTeam && (
        <div className="absolute bottom-6 left-5">
          <TeamRoster team={myTeam} />
        </div>
      )}

      {/* Bottom-center: profile setup + start button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-8 left-1/2 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-4 px-4"
      >
        <TeamProfileSetup
          initialName={draftName}
          initialImage={draftImage}
          onChange={(name, img) => {
            setDraftName(name);
            setDraftImage(img);
          }}
        />
        <button
          onClick={handleStart}
          className="action-btn w-full max-w-xs py-3.5 text-base shadow-lg shadow-action/30"
        >
          ▶ 게임 시작하기
        </button>
      </motion.div>

      {/* Title badge */}
      <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 text-center">
        <h1 className="text-sm font-semibold tracking-widest text-white/70">PROMPT GOLF</h1>
      </div>
    </main>
  );
}
