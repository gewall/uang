"use client";

import { useActionState, useEffect, useState } from "react";
import { EntityIcon } from "@/components/entity-icon";
import { ColorPicker, Field, IconPicker } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, CategoryKind } from "@/db/schema";
import type { FormState } from "@/lib/form";
import { saveCategory } from "../actions";
import type { CategoryNode } from "../queries";

export function CategoryForm({
  kind,
  category,
  defaultParentId,
  parents,
  onDone,
}: {
  kind: CategoryKind;
  category?: Category;
  defaultParentId?: string;
  /** kandidat induk: kategori utama dengan jenis yang sama */
  parents: CategoryNode[];
  onDone: (message?: string) => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCategory, {});
  const initialParent = category?.parentId ?? defaultParentId ?? "none";
  const parentDefault = parents.find((p) => p.id === initialParent);
  const [parentId, setParentId] = useState(initialParent);
  const [icon, setIcon] = useState(category?.icon ?? parentDefault?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? parentDefault?.color ?? "slate");
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) onDone(state.message);
  }, [state, onDone]);

  // kategori yang punya anak tidak boleh jadi subkategori → sembunyikan pilihan induk
  const hasChildren = parents.some((p) => p.id === category?.id && p.children.length > 0);
  const parentItems = [
    { value: "none", label: "— Tidak ada (kategori utama) —" },
    ...parents.filter((p) => p.id !== category?.id && !p.archivedAt).map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <form action={action} className="grid gap-4">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="kind" value={kind} />
      {state.message && !state.ok && <p className="text-sm text-destructive">{state.message}</p>}

      <Field label="Nama" htmlFor="category-name" error={err("name")}>
        <div className="flex items-center gap-2">
          <EntityIcon icon={icon} color={color} />
          <Input
            id="category-name"
            name="name"
            defaultValue={category?.name}
            maxLength={40}
            required
            autoFocus={!category}
            aria-invalid={err("name") ? true : undefined}
          />
        </div>
      </Field>

      {!hasChildren && (
        <Field label="Induk" error={err("parentId")} hint="Opsional. Subkategori ikut dijumlahkan ke induknya di laporan.">
          <Select
            name="parentId"
            items={parentItems}
            value={parentId}
            onValueChange={(v) => {
              if (!v) return;
              setParentId(v);
              const p = parents.find((x) => x.id === v);
              if (p && !category) {
                setIcon(p.icon);
                setColor(p.color);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {parentItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="Warna">
        <ColorPicker name="color" value={color} onChange={setColor} />
      </Field>
      <Field label="Ikon">
        <IconPicker name="icon" value={icon} color={color} onChange={setIcon} />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : category ? "Simpan perubahan" : "Tambah kategori"}
        </Button>
      </div>
    </form>
  );
}
