'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Hole, Shot, Target, Team } from '@/lib/game/types';
import { HOLE, createSeedTeams, defaultAvatar } from '@/lib/game/data';
import { calculateShot } from '@/lib/game/calculateShot';

const MY_TEAM_ID = 'my-team';

interface ApplyShotArgs {
  similarity: number;
  prompt: string;
  targetN: number;
  generatedHtml: string | null;
  screenshotUrl: string | null;
}

interface GameState {
  teams: Team[];
  hole: Hole;
  targets: Target[];
  targetsLoaded: boolean;
  myTeamId: string;
  shots: Shot[];
  profileReady: boolean;
  lastShot: Shot | null;
  /** Bumped whenever the active team's ball moves, so the 3D scene can react. */
  shotTick: number;

  // selectors
  myTeam: () => Team | undefined;
  activeTeam: () => Team | undefined;
  leaderboard: () => Team[];
  /** Target the player must recreate on the upcoming swing (null if done). */
  currentTarget: () => Target | null;

  // actions
  ensureSeeded: () => void;
  loadTargets: () => Promise<void>;
  setProfile: (name: string, imageUrl: string | null) => void;
  applyShot: (args: ApplyShotArgs) => Shot;
  resetGame: () => void;
}

function makeMyTeam(name = '버디헌터스', imageUrl: string | null = null): Team {
  return {
    id: MY_TEAM_ID,
    name,
    imageUrl: imageUrl ?? defaultAvatar(name),
    score: 0,
    currentStroke: 0,
    ballPosition: { x: 0, z: 0 },
    totalDistance: 0,
    isCurrentTurn: true,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      teams: [],
      hole: HOLE,
      targets: [],
      targetsLoaded: false,
      myTeamId: MY_TEAM_ID,
      shots: [],
      profileReady: false,
      lastShot: null,
      shotTick: 0,

      myTeam: () => get().teams.find((t) => t.id === get().myTeamId),
      activeTeam: () => get().teams.find((t) => t.isCurrentTurn) ?? get().myTeam(),
      leaderboard: () => [...get().teams].sort((a, b) => a.score - b.score),
      currentTarget: () => {
        const me = get().myTeam();
        const idx = me?.currentStroke ?? 0;
        return get().targets[idx] ?? null;
      },

      ensureSeeded: () => {
        if (get().teams.length > 0) return;
        set({ teams: [makeMyTeam(), ...createSeedTeams()] });
      },

      loadTargets: async () => {
        try {
          const res = await fetch('/api/targets');
          const data = (await res.json()) as { targets: Target[] };
          set({ targets: data.targets ?? [], targetsLoaded: true });
        } catch {
          set({ targets: [], targetsLoaded: true });
        }
      },

      setProfile: (name, imageUrl) =>
        set((state) => {
          const trimmed = name.trim() || '버디헌터스';
          const exists = state.teams.some((t) => t.id === state.myTeamId);
          const teams = exists
            ? state.teams.map((t) =>
                t.id === state.myTeamId
                  ? { ...t, name: trimmed, imageUrl: imageUrl ?? defaultAvatar(trimmed) }
                  : t,
              )
            : [makeMyTeam(trimmed, imageUrl), ...state.teams];
          return { teams, profileReady: true };
        }),

      applyShot: ({ similarity, prompt, targetN, generatedHtml, screenshotUrl }) => {
        const state = get();
        const hole = state.hole;
        if (!state.teams.some((t) => t.id === state.myTeamId)) {
          set({ teams: [makeMyTeam(), ...state.teams] });
        }
        const me = get().teams.find((t) => t.id === get().myTeamId)!;

        const result = calculateShot({
          teamId: me.id,
          prompt,
          targetN,
          generatedHtml,
          screenshotUrl,
          similarity,
          hole,
          from: me.ballPosition,
          fromDistance: me.totalDistance,
        });

        const nextStroke = me.currentStroke + 1;
        // Hole ends when sunk OR there are no more target images to play.
        const outOfTargets = nextStroke >= get().targets.length;
        const finished = result.sunk || outOfTargets;

        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === me.id
              ? {
                  ...t,
                  ballPosition: result.position,
                  totalDistance: result.totalDistance,
                  currentStroke: nextStroke,
                  score: finished ? t.score + (nextStroke - hole.par) : t.score,
                  finished,
                }
              : t,
          ),
          shots: [result.shot, ...s.shots].slice(0, 50),
          lastShot: result.shot,
          shotTick: s.shotTick + 1,
        }));

        return result.shot;
      },

      resetGame: () => {
        const me = get().myTeam();
        set({
          teams: [me ? makeMyTeam(me.name, me.imageUrl) : makeMyTeam(), ...createSeedTeams()],
          shots: [],
          lastShot: null,
          shotTick: 0,
        });
      },
    }),
    {
      name: 'prompt-golf-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        teams: s.teams,
        myTeamId: s.myTeamId,
        profileReady: s.profileReady,
        shots: s.shots,
      }),
    },
  ),
);
