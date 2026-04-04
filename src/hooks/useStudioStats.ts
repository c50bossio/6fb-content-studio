import { useState, useEffect, useCallback } from 'react';

export interface StudioStats {
  clipsCreated: number;
  carouselsMade: number;
  videosRendered: number;
  blogPostsWritten: number;
}

const DEFAULT_STATS: StudioStats = {
  clipsCreated: 0,
  carouselsMade: 0,
  videosRendered: 0,
  blogPostsWritten: 0,
};

// Derive real counts from the filesystem via electronAPI
async function loadStatsFromFilesystem(): Promise<StudioStats> {
  try {
    const api = window.electronAPI;
    const [library, carousels, blogs] = await Promise.all([
      api.scanLibrary() as Promise<{ runs?: { clips: unknown[] }[] }>,
      api.listCarousels(),
      api.listBlogPosts(),
    ]);

    const runs = (library as any)?.runs ?? [];
    const clipsCreated = runs.reduce(
      (sum: number, run: { clips: unknown[] }) => sum + (run.clips?.length ?? 0), 0
    );

    return {
      clipsCreated,
      carouselsMade: carousels.carousels?.length ?? 0,
      videosRendered: 0, // no persistent render log yet
      blogPostsWritten: blogs.posts?.length ?? 0,
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function useStudioStats() {
  const [stats, setStats] = useState<StudioStats>({ ...DEFAULT_STATS });

  // Load real stats from filesystem on mount
  useEffect(() => {
    loadStatsFromFilesystem().then(setStats);
  }, []);

  // increment is kept for optimistic UI updates after creating content
  const increment = useCallback((key: keyof StudioStats, amount = 1) => {
    setStats(prev => ({ ...prev, [key]: prev[key] + amount }));
  }, []);

  const reset = useCallback(() => {
    setStats({ ...DEFAULT_STATS });
  }, []);

  return { stats, increment, reset };
}

