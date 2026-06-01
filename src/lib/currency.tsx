import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface CurrencyCtx {
  /** NPR per 1 USD */
  rate: number;
  updatedAt: number | null;
  isLive: boolean;
}

const FALLBACK_RATE = 133.5;
const STORAGE_KEY = "fx_usd_npr";
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

const Ctx = createContext<CurrencyCtx>({
  rate: FALLBACK_RATE,
  updatedAt: null,
  isLive: false,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CurrencyCtx>({
    rate: FALLBACK_RATE,
    updatedAt: null,
    isLive: false,
  });

  useEffect(() => {
    // Hydrate from cache
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { rate: number; updatedAt: number };
        if (parsed.rate > 0) {
          setState({ rate: parsed.rate, updatedAt: parsed.updatedAt, isLive: true });
          if (Date.now() - parsed.updatedAt < TTL_MS) return;
        }
      }
    } catch {
      /* ignore */
    }

    // Fetch fresh rate (open.er-api.com is free, no key required)
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((d) => {
        const rate = d?.rates?.NPR;
        if (typeof rate === "number" && rate > 0) {
          const updatedAt = Date.now();
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ rate, updatedAt }));
          setState({ rate, updatedAt, isLive: true });
        }
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useCurrency() {
  return useContext(Ctx);
}

export function formatNPR(npr: number) {
  // Nepali-style grouping (lakh): use en-IN which groups as 1,23,456
  return "रू " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(npr));
}

export function formatUSD(usd: number) {
  return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(usd));
}

/** Renders "रू 13,300 ($100)" — primary NPR, secondary USD */
export function Price({
  usd,
  className,
  showUsd = true,
  size = "md",
}: {
  usd: number;
  className?: string;
  showUsd?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const { rate } = useCurrency();
  const npr = usd * rate;
  const usdClass =
    size === "lg" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <span className={className}>
      <span>{formatNPR(npr)}</span>
      {showUsd && (
        <span className={`ml-1.5 font-normal text-muted-foreground ${usdClass}`}>
          ({formatUSD(usd)})
        </span>
      )}
    </span>
  );
}
