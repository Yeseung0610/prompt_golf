'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Hole, Shot, Team } from '@/lib/game/types';
import { HOLES, createSeedTeams, defaultAvatar } from '@/lib/game/data';
import { calculateShot } from '@/lib/game/calculateShot';

const MY_TEAM_ID = 'my-team';

interface GameState {
  teams: Team[];
  holes: Hole[];
  currentHoleIndex: number;
  myTeamId: string;
  shots: Shot[];
  profileReady: boolean;
  lastShot: Shot | null;
  /** Bumped whenever the active team's ball moves, so the 3D scene can react. */
  shotTick: number;

  // selectors
  myTeam: () => Team | undefined;
  currentHole: () => Hole;
  activeTeam: () => Team | undefined;
  leaderboard: () => Team[];

  // actions
  ensureSeeded: () => void;
  setProfile: (name: string, imageUrl: string | null) => void;
  applyShot: (similarity: number, generatedImageUrl: string | null, prompt: string) => Shot;
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
      holes: HOLES,
      currentHoleIndex: 0,
      myTeamId: MY_TEAM_ID,
      shots: [],
      profileReady: false,
      lastShot: null,
      shotTick: 0,

      myTeam: () => get().teams.find((t) => t.id === get().myTeamId),
      currentHole: () => get().holes[get().currentHoleIndex],
      activeTeam: () => get().teams.find((t) => t.isCurrentTurn) ?? get().myTeam(),
      leaderboard: () => [...get().teams].sort((a, b) => a.score - b.score),

      ensureSeeded: () => {
        if (get().teams.length > 0) return;
        const seeded = createSeedTeams();
        set({ teams: [makeMyTeam(), ...seeded] });
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

      applyShot: (similarity, generatedImageUrl, prompt) => {
        const state = get();
        const hole = state.holes[state.currentHoleIndex];
        const team = state.teams.find((t) => t.id === state.myTeamId);
        if (!team) {
          // Should not happen; create lazily.
          const seeded = makeMyTeam();
          set({ teams: [seeded, ...state.teams] });
        }
        const me = get().teams.find((t) => t.id === get().myTeamId)!;

        const result = calculateShot({
          teamId: me.id,
          prompt,
          generatedImageUrl,
          similarity,
          hole,
          from: me.ballPosition,
          fromDistance: me.totalDistance,
        });

        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === me.id
              ? {
                  ...t,
                  ballPosition: result.position,
                  totalDistance: result.totalDistance,
                  currentStroke: t.currentStroke + 1,
                  // Score relative to par updates only when the hole is sunk.
                  score: result.sunk
                    ? t.score + (t.currentStroke + 1 - hole.par)
                    : t.score,
                  finished: result.sunk,
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
        const seeded = createSeedTeams();
        set({
          teams: [me ? { ...makeMyTeam(me.name, me.imageUrl) } : makeMyTeam(), ...seeded],
          shots: [],
          lastShot: null,
          currentHoleIndex: 0,
          shotTick: 0,
        });
      },
    }),
    {
      name: 'prompt-golf-state',
      storage: createJSONStorage(() => localStorage),
      // Holes are static; only persist mutable player state.
      partialize: (s) => ({
        teams: s.teams,
        myTeamId: s.myTeamId,
        currentHoleIndex: s.currentHoleIndex,
        profileReady: s.profileReady,
        shots: s.shots,
      }),
    },
  ),
);
