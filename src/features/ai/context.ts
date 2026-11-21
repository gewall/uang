import "server-only";
import { currentMonth, formatMonth, monthRange, shiftMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { rollupToRoot } from "../budgets/math";
import { getBudgetOverview } from "../budgets/queries";
import { listPortfolio } from "../investments/queries";
import { ASSET_TYPES } from "../investments/constants";
import { categoryRefs, expenseByCategory, monthlyCashflow } from "../reports/aggregates";
import { listWallets } from "../wallets/queries";

const rp = (minor: number) => formatMoney(minor, "IDR").replace(/ /g, " ");
const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Ringkasan keuangan AGREGAT yang dikirim ke AI. Sengaja tidak memuat transaksi mentah, catatan,
 * nama pihak lawan, atau nomor rekening — hanya total per bulan/kategori/dompet.
 */
export async function buildFinanceContext(userId: string, now = new Date()) {
  const month = currentMonth(now);
  const prev3Start = monthRange(shiftMonth(month, -3)).start;
  const prev3End = monthRange(month).start;
  const { start: curStart, end: curEnd } = monthRange(month);

  const [cashflow, cats, avgRaw, curRaw, budget, wallets, portfolio] = await Promise.all([
    monthlyCashflow(userId, month, 6),
    categoryRefs(userId),
    expenseByCategory(userId, prev3Start, prev3End),
    expenseByCategory(userId, curStart, curEnd),
    getBudgetOverview(userId, month, now),
    listWallets(userId),
    listPortfolio(userId),
  ]);

  const name = new Map(cats.map((c) => [c.id, c.name]));
  const avg = rollupToRoot(cats, avgRaw);
  const cur = rollupToRoot(cats, curRaw);
  const last3 = cashflow.slice(-4, -1); // 3 bulan penuh terakhir
  const avgIncome = Math.round(last3.reduce((n, m) => n + m.income, 0) / Math.max(1, last3.length));
  const avgExpense = Math.round(last3.reduce((n, m) => n + m.expense, 0) / Math.max(1, last3.length));
  const savingsRate = avgIncome > 0 ? (avgIncome - avgExpense) / avgIncome : 0;

  const expenseCategoryNames = cats
    .filter((c) => c.kind === "expense" && !c.archivedAt && !c.parentId)
    .map((c) => c.name);
  const activeWallets = wallets.filter((w) => !w.archivedAt);
  const lines: string[] = [];

  lines.push(`# Data keuangan pengguna (per ${formatMonth(month)}, mata uang Rupiah)`);
  lines.push("");
  lines.push("## Ringkasan 3 bulan penuh terakhir");
  lines.push(`- Rata-rata pemasukan: ${rp(avgIncome)}/bulan`);
  lines.push(`- Rata-rata pengeluaran: ${rp(avgExpense)}/bulan`);
  lines.push(`- Tingkat tabungan: ${avgIncome > 0 ? pct(savingsRate) : "belum bisa dihitung (tidak ada pemasukan)"}`);
  lines.push("");
  lines.push("## Arus kas 6 bulan");
  lines.push("| Bulan | Pemasukan | Pengeluaran | Selisih |");
  lines.push("|---|---|---|---|");
  for (const m of cashflow)
    lines.push(`| ${formatMonth(m.month)} | ${rp(m.income)} | ${rp(m.expense)} | ${rp(m.income - m.expense)} |`);
  lines.push("");
  lines.push(`## Pengeluaran per kategori (rata-rata 3 bulan vs ${formatMonth(month)} berjalan)`);
  lines.push("| Kategori | Rata-rata/bulan | Bulan ini |");
  lines.push("|---|---|---|");
  const catIds = [...new Set([...avg.keys(), ...cur.keys()])].sort((a, b) => (avg.get(b) ?? 0) - (avg.get(a) ?? 0));
  for (const id of catIds)
    lines.push(`| ${name.get(id) ?? "?"} | ${rp(Math.round((avg.get(id) ?? 0) / 3))} | ${rp(cur.get(id) ?? 0)} |`);
  if (catIds.length === 0) lines.push("| (belum ada pengeluaran) | - | - |");
  lines.push("");
  lines.push(`## Budget ${formatMonth(month)}`);
  if (budget.lines.length === 0) lines.push("Belum ada budget.");
  else {
    lines.push("| Kategori | Batas | Terpakai | Status |");
    lines.push("|---|---|---|---|");
    for (const l of budget.lines) {
      const status = l.status === "over" ? "lewat" : l.status === "warning" ? "hampir habis" : "aman";
      lines.push(`| ${l.name} | ${rp(l.amount)} | ${rp(l.spent)} (${pct(l.ratio)}) | ${status} |`);
    }
  }
  lines.push("");
  lines.push("## Dompet (saldo saat ini)");
  for (const w of activeWallets)
    lines.push(`- ${w.name} (${w.type}): ${formatMoney(w.balance, w.currency as "IDR" | "USD").replace(/ /g, " ")}`);
  if (activeWallets.length === 0) lines.push("- (belum ada dompet)");
  lines.push("");
  lines.push("## Investasi");
  if (portfolio.summary.marketValue === 0) lines.push("Belum ada investasi.");
  else {
    lines.push(
      `- Nilai: ${rp(portfolio.summary.marketValue)}, modal ${rp(portfolio.summary.costBasis)}, untung belum terealisasi ${rp(portfolio.summary.unrealized)}`,
    );
    const total = portfolio.summary.marketValue;
    lines.push(
      `- Alokasi: ${portfolio.allocation.map((a) => `${ASSET_TYPES[a.type].label} ${pct(a.value / total)}`).join(", ")}`,
    );
  }

  return {
    text: lines.join("\n"),
    month,
    nextMonth: shiftMonth(month, 1),
    avgIncome,
    avgExpense,
    expenseCategoryNames,
    expenseCategories: cats
      .filter((c) => c.kind === "expense" && !c.archivedAt)
      .map((c) => ({ id: c.id, name: c.name })),
  };
}
