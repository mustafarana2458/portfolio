"use client";

// "Use template" on a service card → preselect that service in the contact form.
export const SERVICE_EVENT = "contact:service";
const KEY = "contact-service";

export function chooseService(id: string) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {}
  window.dispatchEvent(new CustomEvent<string>(SERVICE_EVENT, { detail: id }));
}

export function readChosenService(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
