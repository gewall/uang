import "server-only";
import { and, count, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, categories, investmentAssets, wallets } from "@/db/schema";
import { ENTITY_GROUPS, type EntityGroup } from "./describe";

export const ACTIVITY_PAGE_SIZE = 50;

export type ActivityFilters = { group?: EntityGroup; before?: Date };

export async function listActivity(userId: string, f: ActivityFilters) {
  const conds: SQL[] = [eq(activityLogs.userId, userId)];
  if (f.group) conds.push(inArray(activityLogs.entity, [...ENTITY_GROUPS[f.group].entities]));
  if (f.before) conds.push(lt(activityLogs.createdAt, f.before));

  const rows = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entity: activityLogs.entity,
      entityId: activityLogs.entityId,
      diff: activityLogs.diff,
      ip: activityLogs.ip,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(and(...conds))
    .orderBy(desc(activityLogs.createdAt))
    .limit(ACTIVITY_PAGE_SIZE + 1);

  const items = rows.slice(0, ACTIVITY_PAGE_SIZE);
  const names = await lookupNames(userId, items);
  return {
    items: items.map((r) => ({ ...r, entityName: names.get(nameKey(r)) ?? null })),
    nextCursor: rows.length > ACTIVITY_PAGE_SIZE ? items[items.length - 1].createdAt : null,
  };
}

type Row = { entity: string; entityId: string | null; diff: Record<string, unknown> | null };

/** budget dicatat per id budget, tapi yang informatif adalah nama kategorinya */
function nameKey(r: Row): string {
  if (r.entity === "budget" && typeof r.diff?.categoryId === "string") return `category:${r.diff.categoryId}`;
  return `${r.entity}:${r.entityId}`;
}

/** Nama entitas saat ini (yang masih ada) untuk wallet / category / investment_asset / budget. */
async function lookupNames(userId: string, rows: Row[]): Promise<Map<string, string>> {
  const ids = { wallet: new Set<string>(), category: new Set<string>(), investment_asset: new Set<string>() };
  for (const r of rows) {
    if (r.entity === "budget" && typeof r.diff?.categoryId === "string") ids.category.add(r.diff.categoryId);
    else if (r.entityId && r.entity in ids) ids[r.entity as keyof typeof ids].add(r.entityId);
  }
  const out = new Map<string, string>();
  const [w, c, a] = await Promise.all([
    ids.wallet.size
      ? db
          .select({ id: wallets.id, name: wallets.name })
          .from(wallets)
          .where(and(eq(wallets.userId, userId), inArray(wallets.id, [...ids.wallet])))
      : [],
    ids.category.size
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(and(eq(categories.userId, userId), inArray(categories.id, [...ids.category])))
      : [],
    ids.investment_asset.size
      ? db
          .select({ id: investmentAssets.id, name: investmentAssets.name })
          .from(investmentAssets)
          .where(and(eq(investmentAssets.userId, userId), inArray(investmentAssets.id, [...ids.investment_asset])))
      : [],
  ]);
  for (const x of w) out.set(`wallet:${x.id}`, x.name);
  for (const x of c) out.set(`category:${x.id}`, x.name);
  for (const x of a) out.set(`investment_asset:${x.id}`, x.name);
  return out;
}

/** Login terakhir (sebelum sesi ini) & jumlah login gagal 7 hari terakhir. */
export async function securitySummary(userId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [logins, [failed]] = await Promise.all([
    db
      .select({ createdAt: activityLogs.createdAt, ip: activityLogs.ip, diff: activityLogs.diff })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, userId), eq(activityLogs.action, "login")))
      .orderBy(desc(activityLogs.createdAt))
      .limit(2),
    db
      .select({ n: count() })
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.userId, userId),
          eq(activityLogs.action, "login_failed"),
          gte(activityLogs.createdAt, since),
        ),
      ),
  ]);
  return {
    current: logins[0] ?? null,
    previous: logins[1] ?? null,
    failedLast7Days: failed?.n ?? 0,
  };
}

export type ActivityRow = Awaited<ReturnType<typeof listActivity>>["items"][number];
