"use client";

import { useEffect, useState } from "react";

import { addServerWatchlistItem, deleteServerWatchlistItem } from "@/lib/api";
import { readAuthSession, subscribeAuthSession } from "@/lib/cognito-auth";
import { serverWatchlistStore } from "@/lib/server-watchlist-store";
import {
  isTickerSaved,
  removeWatchlistItem,
  saveWatchlistItem,
  subscribeWatchlist,
} from "@/lib/watchlist-storage";
import type { WatchlistInput } from "@/types/watchlist";

export function WatchlistToggle({
  item,
  variant = "default",
}: {
  item: WatchlistInput;
  variant?: "default" | "compact";
}) {
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      if (!readAuthSession()) {
        setSaved(isTickerSaved(item.ticker));
      }
      setReady(true);
    };

    sync();
    return subscribeWatchlist(sync);
  }, [item.ticker]);

  useEffect(() => {
    const sync = () => setAccessToken(readAuthSession()?.accessToken ?? null);
    sync();
    return subscribeAuthSession(sync);
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const checkSaved = () => {
      const snapshot = serverWatchlistStore.getSnapshot(accessToken);
      if (snapshot.data) {
        setSaved(snapshot.data.items.some((serverItem) => serverItem.ticker === item.ticker));
        setReady(true);
      } else if (snapshot.error) {
        setSaved(false);
        setReady(true);
      }
    };

    checkSaved();
    return serverWatchlistStore.subscribe(accessToken, checkSaved);
  }, [accessToken, item.ticker]);

  async function toggle() {
    if (accessToken) {
      setReady(false);
      try {
        if (saved) {
          await deleteServerWatchlistItem(accessToken, item.ticker);
        } else {
          await addServerWatchlistItem(accessToken, item);
        }
        await serverWatchlistStore.refresh(accessToken);
      } finally {
        setReady(true);
      }
      return;
    }

    if (saved) {
      removeWatchlistItem(item.ticker);
      return;
    }

    saveWatchlistItem(item);
  }

  const label = saved ? "관심종목 해제" : "관심종목 저장";
  const baseClass =
    "inline-flex items-center justify-center rounded-md border text-sm font-semibold transition focus:outline-none focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-60";
  const sizeClass = variant === "compact" ? "px-3 py-1.5" : "px-4 py-2";
  const toneClass = saved
    ? "border-accent bg-accent text-white hover:bg-ink"
    : "border-line bg-white text-ink hover:border-accent hover:text-accent";

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={!ready}
      onClick={() => void toggle()}
      className={`${baseClass} ${sizeClass} ${toneClass}`}
    >
      {ready ? label : "상태 확인"}
    </button>
  );
}