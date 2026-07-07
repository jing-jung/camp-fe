import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchStocks } from "@/lib/api";

import SearchPage from "./page";

const mockSearchParams = new Map<string, string>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
    has: (key: string) => mockSearchParams.has(key),
    toString: () => "",
  }),
}));

vi.mock("@/lib/api", () => ({
  searchStocks: vi.fn(),
}));

const mockedSearchStocks = vi.mocked(searchStocks);

describe("SearchPage", () => {
  beforeEach(() => {
    mockSearchParams.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

    it("does not call the search API before the first search", () => {
    render(<SearchPage />);

    expect(mockedSearchStocks).not.toHaveBeenCalled();
    expect(screen.getByText("검색어를 입력해 주세요")).not.toBeNull();
  });

    it("does not call the search API for a whitespace-only query", () => {
    mockSearchParams.set("q", "   ");
    render(<SearchPage />);

    expect(mockedSearchStocks).not.toHaveBeenCalled();
    expect(screen.getByText("검색어를 입력해 주세요")).not.toBeNull();
  });

    it("calls the search API after a non-empty query", async () => {
    mockedSearchStocks.mockResolvedValue({
      query: "삼성",
      count: 0,
      items: [],
    });

    mockSearchParams.set("q", " 삼성 ");
    render(<SearchPage />);

    await waitFor(() => {
      expect(mockedSearchStocks).toHaveBeenCalledWith("삼성", 20);
    });
    
    expect(screen.getByText('"삼성" 검색 결과 0개')).not.toBeNull();
  });
});
