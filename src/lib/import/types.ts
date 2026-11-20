// Tipe umum hasil parse sumber import (PDF Jago, CSV, Excel) — dinormalisasi ke bentuk "laporan per kantong".
import type { JagoKind } from "./jago";

export type ImportKind = JagoKind | "generic";

export type ImportRow = {
  externalId: string;
  /** ISO string (supaya aman disimpan sebagai JSON) */
  occurredAt: string;
  counterparty: string;
  counterpartyAccount: string | null;
  kind: ImportKind;
  kindLabel: string;
  note: string | null;
  /** sen, bertanda */
  amount: number;
  balance: number | null;
  balanceOk: boolean;
};

export type ImportPocket = {
  pocketId: string;
  name: string;
  currency: string;
  opening: number;
  closing: number | null;
  consistent: boolean;
  rows: ImportRow[];
};

export type ImportStatement = {
  source: "jago_pdf" | "csv" | "xlsx";
  accountHolder: string | null;
  period: string | null;
  pockets: ImportPocket[];
  warnings: string[];
};
