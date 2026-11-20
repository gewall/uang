"use client";

import { usePathname } from "next/navigation";
import { findNavItem } from "./nav-config";

export function HeaderTitle() {
  const item = findNavItem(usePathname());
  return <span className="truncate text-sm font-medium">{item?.title ?? "uang"}</span>;
}
