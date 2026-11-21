"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteConversation } from "../actions";

export function DeleteConversationButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Hapus percakapan"
      disabled={pending}
      className="opacity-60 group-hover:opacity-100"
      onClick={() =>
        start(async () => {
          await deleteConversation(id);
          if (active) router.push("/ai");
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
