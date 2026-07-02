// Tiny DOM utilities for the webview: escaping, delegated events, hover.

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape for use inside a double-quoted HTML attribute. */
export function escAttr(s: unknown): string {
  return esc(s);
}

export interface ActionCtx {
  arg?: string;
  arg2?: string;
  value: string;
  event: Event;
  el: HTMLElement;
}

export type ActionHandler = (ctx: ActionCtx) => void;
export type HandlerMap = Record<string, ActionHandler>;

function ctxFrom(el: HTMLElement, event: Event): ActionCtx {
  const value =
    (el as HTMLInputElement | HTMLTextAreaElement).value ?? "";
  return {
    arg: el.getAttribute("data-arg") ?? undefined,
    arg2: el.getAttribute("data-arg2") ?? undefined,
    value,
    event,
    el,
  };
}

function dispatch(
  root: HTMLElement,
  handlers: HandlerMap,
  attr: string,
  event: Event
): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const el = target.closest<HTMLElement>(`[${attr}]`);
  if (!el || !root.contains(el)) return;
  const name = el.getAttribute(attr);
  if (!name) return;
  const fn = handlers[name];
  if (fn) fn(ctxFrom(el, event));
}

/**
 * Attach delegated listeners to a persistent root element (call once at boot).
 * Children are matched by data-* attributes; innerHTML can be replaced freely.
 */
export function delegate(root: HTMLElement, handlers: HandlerMap): void {
  root.addEventListener("click", (e) => dispatch(root, handlers, "data-click", e));
  root.addEventListener("input", (e) => dispatch(root, handlers, "data-input", e));
  root.addEventListener("change", (e) => dispatch(root, handlers, "data-change", e));
  root.addEventListener("mousedown", (e) =>
    dispatch(root, handlers, "data-mousedown", e)
  );
  root.addEventListener("focusin", (e) => dispatch(root, handlers, "data-focus", e));
  root.addEventListener("focusout", (e) => dispatch(root, handlers, "data-blur", e));
}

/** Re-attach hover behavior after each render (elements are recreated). */
export function wireHover(root: HTMLElement): void {
  const nodes = root.querySelectorAll<HTMLElement>("[data-hover]");
  nodes.forEach((el) => {
    const hover = el.getAttribute("data-hover") || "";
    const base = el.getAttribute("style") || "";
    el.addEventListener("mouseenter", () => {
      el.setAttribute("style", base + ";" + hover);
    });
    el.addEventListener("mouseleave", () => {
      el.setAttribute("style", base);
    });
  });
}
