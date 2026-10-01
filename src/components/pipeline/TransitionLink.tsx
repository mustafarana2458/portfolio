"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { navigateWithTransition } from "@/lib/transition";

/** next/link with the curtain transition. Modifier-clicks / new tabs behave like normal links. */
export default function TransitionLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigateWithTransition(() => router.push(href));
  };
  return <Link href={href} onClick={handle} {...rest} />;
}
