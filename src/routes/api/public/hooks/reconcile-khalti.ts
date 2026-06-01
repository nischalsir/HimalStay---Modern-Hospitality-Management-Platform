import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyKhaltiByPidx } from "@/lib/payment.server";

/**
 * Background reconciliation for Khalti payments.
 * Finds payments stuck in `initiated` or `pending` from the last 24h and
 * re-queries Khalti so booking status flips to confirmed/paid (or failed)
 * even if the user never returned to /payment/callback.
 *
 * Public endpoint — pg_cron calls it on a schedule. No PII returned.
 */
export const Route = createFileRoute("/api/public/hooks/reconcile-khalti")({
  server: {
    handlers: {
      POST: async () => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: rows, error } = await supabaseAdmin
          .from("payments")
          .select("id, pidx, status, created_at")
          .in("status", ["initiated", "pending"])
          .not("pidx", "is", null)
          .gte("created_at", since)
          .limit(100);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let completed = 0;
        let failed = 0;
        let stillPending = 0;
        const errors: string[] = [];

        for (const row of rows ?? []) {
          if (!row.pidx) continue;
          try {
            const res = await verifyKhaltiByPidx(row.pidx);
            if (res.status === "completed") completed++;
            else if (res.status === "failed") failed++;
            else stillPending++;
          } catch (e: any) {
            errors.push(`${row.id}: ${e?.message ?? "unknown"}`);
          }
        }

        return Response.json({
          ok: true,
          scanned: rows?.length ?? 0,
          completed,
          failed,
          stillPending,
          errors,
        });
      },
    },
  },
});
