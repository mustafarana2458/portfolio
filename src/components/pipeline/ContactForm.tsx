"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { SERVICE_EVENT, readChosenService } from "@/lib/contactIntent";
import { cn } from "@/lib/utils";

type Service = { id: string; title: string };
type Status = "idle" | "sending" | "sent" | "failed";
type Errors = Partial<Record<"name" | "email" | "message", string>>;

const FORM_NAME = "contact";

/**
 * The Output node's input panel. Submits to Netlify Forms (detected via /__forms.html,
 * which is why we POST there, the path that works for static and Next-runtime deploys).
 * While sending, a packet runs across the node header; on success the node flips to
 * "delivered". If the POST fails (local dev, other host, offline) it offers a prefilled
 * mailto: fallback so no message is lost.
 */
export default function ContactForm({ services, email }: { services: Service[]; email: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [service, setService] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [mailto, setMailto] = useState("");

  // Preselect from "Use template" (same page event, or remembered for this tab session).
  useEffect(() => {
    const saved = readChosenService();
    if (saved) setService(saved);
    const onChoose = (e: Event) => setService((e as CustomEvent<string>).detail);
    window.addEventListener(SERVICE_EVENT, onChoose);
    return () => window.removeEventListener(SERVICE_EVENT, onChoose);
  }, []);

  const node = () => formRef.current?.closest("[data-node]");

  const setNode = (state: "idle" | "running" | "success", label?: string) => {
    const n = node();
    if (!n) return;
    n.setAttribute("data-state", state);
    const el = n.querySelector(":scope > .node-header [data-meta-success]");
    if (el && label) el.textContent = label;
  };

  const validate = (fd: FormData): Errors => {
    const e: Errors = {};
    if (!String(fd.get("name") ?? "").trim()) e.name = "Please enter your name.";
    const em = String(fd.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.email = "Please enter a valid email address.";
    if (String(fd.get("message") ?? "").trim().length < 10) e.message = "Tell me a little more (at least 10 characters).";
    return e;
  };

  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const errs = validate(fd);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (fd.get("bot-field")) return; // honeypot

    const serviceTitle = services.find((s) => s.id === fd.get("service"))?.title ?? "General enquiry";
    const subject = `${serviceTitle}: portfolio enquiry from ${fd.get("name")}`;
    const body = `${fd.get("message")}\n\n${fd.get("name")} · ${fd.get("email")}`;
    setMailto(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);

    setStatus("sending");
    setNode("running");
    const started = performance.now();
    try {
      const params = new URLSearchParams();
      params.set("form-name", FORM_NAME);
      fd.forEach((v, k) => params.set(k, String(v)));
      params.set("service", serviceTitle);
      const res = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      // A redirect means this host is not handling the form (Netlify answers 200 directly).
      if (!res.ok || res.redirected) throw new Error(String(res.status));
      // Let the packet finish its run so the state change reads as a result, not a flicker.
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - started))));
      setStatus("sent");
      setNode("success", `delivered · ${((performance.now() - started) / 1000).toFixed(2)}s`);
      form.reset();
      setService("");
    } catch {
      setStatus("failed");
      setNode("idle");
    }
  };

  const field = "w-full rounded-lg border border-line bg-bg/70 px-3.5 py-2.5 text-[15px] text-fg placeholder:text-muted transition-colors focus:border-fg/35 focus:outline-none aria-[invalid=true]:border-accent";
  const label = "mb-1.5 flex items-center justify-between font-mono text-[12px] text-muted";

  return (
    <form
      ref={formRef}
      name={FORM_NAME}
      method="POST"
      data-netlify="true"
      netlify-honeypot="bot-field"
      noValidate
      onSubmit={onSubmit}
      className="relative"
    >
      <input type="hidden" name="form-name" value={FORM_NAME} />
      <p className="hidden" aria-hidden>
        <label>
          Don&apos;t fill this out: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={label}>
            name <span className="text-accent">*</span>
          </label>
          <input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            className={field}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-err` : undefined}
          />
          {errors.name && (
            <p id={`${id}-name-err`} className="mt-1.5 text-sm text-accent">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={label}>
            email <span className="text-accent">*</span>
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            className={field}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? `${id}-email-err` : undefined}
          />
          {errors.email && (
            <p id={`${id}-email-err`} className="mt-1.5 text-sm text-accent">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-service`} className={label}>
          service <span className="text-muted">optional</span>
        </label>
        <select id={`${id}-service`} name="service" value={service} onChange={(e) => setService(e.target.value)} className={cn(field, "appearance-none")}>
          <option value="">Something else / not sure</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-message`} className={label}>
          message <span className="text-accent">*</span>
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={5}
          className={cn(field, "resize-y")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? `${id}-message-err` : undefined}
          placeholder="What are you building, and when do you need it?"
        />
        {errors.message && (
          <p id={`${id}-message-err`} className="mt-1.5 text-sm text-accent">
            {errors.message}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-medium text-bg transition-colors hover:bg-accent-hover disabled:opacity-70"
        >
          {status === "sending" ? "Executing…" : "Execute workflow"} <span aria-hidden>▶</span>
        </button>
        <p role="status" aria-live="polite" className="font-mono text-[12px]">
          {status === "sent" && <span className="text-ok">✓ Delivered to Mustafa&apos;s inbox.</span>}
          {status === "failed" && (
            <span className="text-muted">
              Couldn&apos;t reach the form service.{" "}
              <a href={mailto} className="text-fg underline decoration-accent underline-offset-4">
                Send it by email instead
              </a>
              .
            </span>
          )}
        </p>
      </div>
    </form>
  );
}
