import { parseHTML } from "linkedom";

const { window, document, HTMLElement, Event, CustomEvent, Node, Element } =
  parseHTML("<!doctype html><html><head></head><body></body></html>");

globalThis.window = window;
globalThis.document = document;
globalThis.HTMLElement = HTMLElement;
globalThis.Element = Element;
globalThis.Node = Node;
globalThis.Event = Event;
globalThis.CustomEvent = CustomEvent;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
});

// linkedom omits location; RTL/React-DOM reads window.location.protocol.
if (!window.location) {
  window.location = new URL("http://localhost/");
}
globalThis.location = window.location;

// Node has a read-only `navigator` global; override via defineProperty if possible.
try {
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    writable: true,
    configurable: true,
  });
} catch {
  // Fall through: node's built-in navigator is adequate for RTL.
}

