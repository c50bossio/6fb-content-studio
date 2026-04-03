import { useState, useCallback } from 'react';

export interface StudioStats {
  clipsCreated: number;
  carouselsMade: number;
  videosRendered: number;
  blogPostsWritten: number;
}

const STORAGE_KEY = '6fb-studio-stats';

const DEFAULT_STATS: StudioStats = {
  clipsCreated: 0,
  carouselsMade: 0,
  videosRendered: 0,
  blogPostsWritten: 0,
};

function loadStats(): StudioStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATS, ...parsed };
    }
  } catch {
    // corrupted — start fresh
  }
  return { ...DEFAULT_STATS };
}

function saveStats(stats: StudioStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage full or private browsing
  }
}

export function useStudioStats() {
  const [stats, setStats] = useState<StudioStats>(loadStats);

  const increment = useCallback((key: keyof StudioStats, amount = 1) => {
    setStats(prev => {
      const next = { ...prev, [key]: prev[key] + amount };
      saveStats(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setStats({ ...DEFAULT_STATS });
    saveStats({ ...DEFAULT_STATS });
  }, []);

  return { stats, increment, reset };
}
