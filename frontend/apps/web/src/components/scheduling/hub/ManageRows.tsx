"use client";

// A1 — "Manage" group: A14.3-style chevron rows routing to the scheduling
// sub-sections, each previewing its current state. Members without edit
// permission lose the chevrons (read-only).

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Card, Chevron, Overline, Row } from "./ui";

export interface ManageItem {
  icon: LucideIcon;
  label: string;
  href: string;
  value?: string;
  alert?: boolean;
}

export default function ManageRows({
  items,
  readOnly,
}: {
  items: ManageItem[];
  readOnly?: boolean;
}) {
  return (
    <section>
      <Overline className="pb-2 pt-5">Manage</Overline>
      <Card>
        {items.map((it) => (
          <Row
            key={it.href + it.label}
            icon={it.icon}
            label={it.label}
            href={readOnly ? undefined : it.href}
            right={
              <div className="flex items-center gap-2">
                {it.value && (
                  <span
                    className={clsx(
                      "text-xs font-medium",
                      it.alert
                        ? "font-bold text-app-warning"
                        : "text-app-text-secondary",
                    )}
                  >
                    {it.value}
                  </span>
                )}
                {!readOnly && <Chevron />}
              </div>
            }
          />
        ))}
      </Card>
    </section>
  );
}
