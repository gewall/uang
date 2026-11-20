"use client";

import {
  Archive,
  ArchiveRestore,
  CornerDownRight,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntityIcon } from "@/components/entity-icon";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Category, CategoryKind } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { cn } from "@/lib/utils";
import { addDefaultCategories, deleteCategory, setCategoryArchived } from "../actions";
import type { CategoryNode } from "../queries";
import { CATEGORY_KIND_LABEL } from "../schema";
import { CategoryForm } from "./category-form";

type DialogState = { mode: "create"; parentId?: string } | { mode: "edit"; category: Category } | null;

export function CategoriesView({ tree }: { tree: CategoryNode[] }) {
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [pending, startTransition] = useTransition();

  const ofKind = tree.filter((c) => c.kind === kind);
  const visible = ofKind
    .filter((c) => showArchived || !c.archivedAt)
    .map((c) => ({ ...c, children: c.children.filter((k) => showArchived || !k.archivedAt) }));
  const archivedCount = ofKind.reduce(
    (n, c) => n + (c.archivedAt ? 1 : 0) + c.children.filter((k) => k.archivedAt).length,
    0,
  );
  const countOf = (k: CategoryKind) =>
    tree
      .filter((c) => c.kind === k && !c.archivedAt)
      .reduce((n, c) => n + 1 + c.children.filter((x) => !x.archivedAt).length, 0);

  const closeDialog = useCallback((message?: string) => {
    setDialog(null);
    if (message) toast.success(message);
  }, []);

  const run = (fn: () => Promise<FormState>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message ?? "Gagal memproses.");
      after?.();
    });

  const row = (c: Category, isChild: boolean, childCount = 0) => (
    <li
      key={c.id}
      className={cn(
        "flex items-center gap-3 py-2.5 pr-1",
        isChild ? "pl-6 sm:pl-10" : "pl-1",
        c.archivedAt && "opacity-60",
      )}
    >
      {isChild && <CornerDownRight className="-ml-4 size-3.5 shrink-0 text-muted-foreground sm:-ml-5" />}
      <EntityIcon icon={c.icon} color={c.color} size={isChild ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate", isChild ? "text-sm" : "font-medium")}>{c.name}</p>
        {(c.isSystem || c.archivedAt || childCount > 0) && (
          <p className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {childCount > 0 && <span>{childCount} subkategori</span>}
            {c.isSystem && <Badge variant="outline">sistem</Badge>}
            {c.archivedAt && <Badge variant="secondary">diarsipkan</Badge>}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${c.name}`} />}>
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem render={<Link href={`/transaksi?kategori=${c.id}`} />}>
            <ReceiptText /> Lihat transaksi
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog({ mode: "edit", category: c })}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {!isChild && !c.archivedAt && (
            <DropdownMenuItem onClick={() => setDialog({ mode: "create", parentId: c.id })}>
              <Plus /> Tambah subkategori
            </DropdownMenuItem>
          )}
          {!c.isSystem && (
            <>
              <DropdownMenuItem onClick={() => run(() => setCategoryArchived(c.id, !c.archivedAt))}>
                {c.archivedAt ? (
                  <>
                    <ArchiveRestore /> Aktifkan lagi
                  </>
                ) : (
                  <>
                    <Archive /> Arsipkan
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setToDelete(c)}>
                <Trash2 /> Hapus
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={kind} onValueChange={(v) => setKind(v as CategoryKind)}>
          <TabsList className="w-full sm:w-auto">
            {(["expense", "income"] as const).map((k) => (
              <TabsTrigger key={k} value={k} className="px-3">
                {CATEGORY_KIND_LABEL[k]}
                <span className="text-xs text-muted-foreground tabular-nums">{countOf(k)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2 *:max-sm:flex-1">
          {archivedCount > 0 && (
            <Button variant="outline" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
              <Archive /> {showArchived ? "Sembunyikan arsip" : `Arsip (${archivedCount})`}
            </Button>
          )}
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus /> Tambah
          </Button>
        </div>
      </div>

      {tree.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Tags className="size-6" />
            </span>
            <p className="font-medium">Belum ada kategori</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Mulai dengan set kategori umum (makan, transportasi, tagihan, gaji, …) lalu sesuaikan.
            </p>
            <Button disabled={pending} onClick={() => run(addDefaultCategories)}>
              <Sparkles /> Tambahkan kategori default
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card size="sm">
          <CardContent>
            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada kategori {CATEGORY_KIND_LABEL[kind].toLowerCase()}.
              </p>
            ) : (
              <ul className="divide-y">
                {visible.map((c) => (
                  <li key={c.id}>
                    <ul>
                      {row(c, false, c.children.length)}
                      {c.children.map((k) => row(k, true))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tree.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Kategori yang hilang?{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            disabled={pending}
            onClick={() => run(addDefaultCategories)}
          >
            Lengkapi dengan kategori default
          </button>
        </p>
      )}

      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={
          dialog?.mode === "edit"
            ? "Edit kategori"
            : dialog?.parentId
              ? "Tambah subkategori"
              : `Tambah kategori ${CATEGORY_KIND_LABEL[kind].toLowerCase()}`
        }
      >
        {dialog && (
          <CategoryForm
            key={dialog.mode === "edit" ? dialog.category.id : `new-${dialog.parentId ?? ""}`}
            kind={dialog.mode === "edit" ? dialog.category.kind : kind}
            category={dialog.mode === "edit" ? dialog.category : undefined}
            defaultParentId={dialog.mode === "create" ? dialog.parentId : undefined}
            parents={tree.filter((c) => c.kind === (dialog.mode === "edit" ? dialog.category.kind : kind))}
            onDone={closeDialog}
          />
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus "${toDelete?.name}"?`}
        description="Subkategorinya akan menjadi kategori utama. Kalau kategori sudah dipakai transaksi, arsipkan saja."
        pending={pending}
        onConfirm={() =>
          toDelete &&
          run(
            () => deleteCategory(toDelete.id),
            () => setToDelete(null),
          )
        }
      />
    </>
  );
}
