"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const NEW_TRANSACTION_EVENT = "uang:new-transaction";

/** Membuka form tambah transaksi di TransactionsView (tanpa round-trip ke server). */
export function NewTransactionButton() {
  return (
    // di mobile disembunyikan: sudah ada tombol + di bottom nav
    <Button className="max-md:hidden" onClick={() => window.dispatchEvent(new Event(NEW_TRANSACTION_EVENT))}>
      <Plus /> Tambah transaksi
      <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 text-[10px] font-normal opacity-80 lg:inline">
        N
      </kbd>
    </Button>
  );
}
