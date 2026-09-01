"use client";

// W16 · H5 — Message Template Editor route. `new` → create; a UUID → edit.

import { useParams } from "next/navigation";
import TemplateEditor from "@/components/scheduling/automations/TemplateEditor";

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : (raw ?? "new");

  return <TemplateEditor id={id} />;
}
