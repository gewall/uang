// Dipakai di server & browser (tanpa "server-only").
import type { PlanContext } from "@/lib/import/plan";

/** Konteks rencana import yang serializable (Set → array) untuk dikirim ke client. */
export type PlanContextData = Omit<PlanContext, "existingExternalIds"> & { existingExternalIds: string[] };

export function toPlanContext(d: PlanContextData): PlanContext {
  return { ...d, existingExternalIds: new Set(d.existingExternalIds) };
}
