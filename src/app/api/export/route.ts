import type { NextRequest } from "next/server";
import { exportBackup, exportSheets, exportTransactions } from "@/features/export/data";
import { transactionsCsv, workbook } from "@/features/export/format";
import { logActivity } from "@/lib/activity-log";
import { getCurrentUser } from "@/lib/auth/dal";
import { getRequestMeta } from "@/lib/request";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/export?format=csv|xlsx|json[&from=YYYY-MM-DD&to=YYYY-MM-DD] — batas tanggal dalam WIB, `to` inklusif. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format");
  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");
  const from = fromRaw && DATE.test(fromRaw) ? new Date(`${fromRaw}T00:00:00+07:00`) : undefined;
  const to =
    toRaw && DATE.test(toRaw) ? new Date(new Date(`${toRaw}T00:00:00+07:00`).getTime() + 86_400_000) : undefined;
  const stamp = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const suffix = fromRaw || toRaw ? `_${fromRaw ?? "awal"}_${toRaw ?? stamp}` : `_${stamp}`;

  let body: BodyInit;
  let type: string;
  let filename: string;
  let count = 0;

  if (format === "csv") {
    const rows = await exportTransactions(user.id, { from, to });
    count = rows.length;
    body = transactionsCsv(rows);
    type = "text/csv; charset=utf-8";
    filename = `uang-transaksi${suffix}.csv`;
  } else if (format === "xlsx") {
    const [rows, sheets] = await Promise.all([exportTransactions(user.id, { from, to }), exportSheets(user.id)]);
    count = rows.length;
    body = new Uint8Array(await workbook(rows, sheets));
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    filename = `uang${suffix}.xlsx`;
  } else if (format === "json") {
    const backup = await exportBackup(user.id);
    count = backup.data.transactions.length;
    body = JSON.stringify(backup);
    type = "application/json";
    filename = `uang-backup_${stamp}.json`;
  } else {
    return new Response("format harus csv, xlsx, atau json", { status: 400 });
  }

  const { ip } = await getRequestMeta();
  await logActivity({
    userId: user.id,
    action: "export",
    entity: "export",
    diff: { format, from: fromRaw, to: toRaw, transactions: count },
    ip,
  });

  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
