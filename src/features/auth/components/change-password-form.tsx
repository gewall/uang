"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "../actions";
import type { FormState } from "../schema";

const FIELDS = [
  { name: "currentPassword", label: "Password lama", autoComplete: "current-password" },
  { name: "newPassword", label: "Password baru", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Ulangi password baru", autoComplete: "new-password" },
] as const;

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid max-w-sm gap-4">
      {FIELDS.map((f) => {
        const error = state.fieldErrors?.[f.name]?.[0];
        return (
          <div key={f.name} className="grid gap-2">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type="password"
              autoComplete={f.autoComplete}
              required
              aria-invalid={error ? true : undefined}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );
      })}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Menyimpan…" : "Ganti password"}
      </Button>
    </form>
  );
}
