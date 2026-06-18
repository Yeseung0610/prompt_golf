'use client';

import { useEffect, useState } from 'react';

/** True once the component has mounted on the client (post-hydration). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
