"use client";

import { chooseService } from "@/lib/contactIntent";
import { scrollToId } from "@/lib/utils";

export default function UseTemplateButton({ id, title }: { id: string; title: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        chooseService(id);
        scrollToId("contact");
      }}
      className="inline-flex h-12 items-center gap-2 rounded-full border border-fg/20 px-5 font-mono text-[13px] text-fg transition-colors hover:border-accent hover:text-accent"
    >
      Use template <span aria-hidden>▸</span>
      <span className="sr-only">: {title}, go to the contact form</span>
    </button>
  );
}
