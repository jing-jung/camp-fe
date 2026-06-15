"use client";

import { getServerWatchlist } from "@/lib/api";
import type { ServerWatchlistItem } from "@/types/api";

interface WatchlistData {
  items: ServerWatchlistItem[];
  count: number;
}

interface WatchlistFallbackResponse {
  data?: {
    items?: ServerWatchlistItem[];
    count?: number;
  };
  items?: ServerWatchlistItem[];
  count?: number;
}

interface Snapshot {
  data: WatchlistData | null;
  error: string | null;
}

class ServerWatchlistStore {
  private state: Record<string, Snapshot> = {};
  private listeners: Record<string, Set<() => void>> = {};
  private fetchPromises: Record<string, Promise<void>> = {};

  getSnapshot(token: string): Snapshot {
    if (!this.state[token]) {
      this.state[token] = { data: null, error: null };
      void this.refresh(token);
    }
    return this.state[token];
  }

  subscribe(token: string, listener: () => void) {
    if (!this.listeners[token]) {
      this.listeners[token] = new Set();
    }
    this.listeners[token].add(listener);
    return () => {
      this.listeners[token].delete(listener);
    };
  }

  private notify(token: string) {
    this.listeners[token]?.forEach((listener) => listener());
  }

  async refresh(token: string) {
    if (this.fetchPromises[token] !== undefined) {
      return this.fetchPromises[token];
    }

    const promise = (async () => {
      try {
        const response = await getServerWatchlist(token);
        const fallbackResponse = response as unknown as WatchlistFallbackResponse;
        // 백엔드 API 규격 대응 (공통 응답 data 래핑 여부에 따른 폴백)
        const items = fallbackResponse.data?.items ?? fallbackResponse.items ?? [];
        const count = fallbackResponse.data?.count ?? fallbackResponse.count ?? items.length;
        
        this.state[token] = { data: { items, count }, error: null };
      } catch {
        this.state[token] = { data: null, error: "서버 관심종목을 불러오지 못했습니다." };
      } finally {
        this.notify(token);
        delete this.fetchPromises[token];
      }
    })();

    this.fetchPromises[token] = promise;
    return promise;
  }
}

export const serverWatchlistStore = new ServerWatchlistStore();