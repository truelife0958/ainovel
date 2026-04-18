import { test } from "node:test";
import assert from "node:assert/strict";
import { queryFocusableElements } from "../../lib/ui/focus-trap.js";

test("queryFocusableElements returns [] for null/undefined root", () => {
  assert.deepEqual(queryFocusableElements(null), []);
  assert.deepEqual(queryFocusableElements(undefined), []);
});

test("queryFocusableElements finds enabled buttons, inputs, textareas, selects, links, and [tabindex]", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <button>A</button>
    <button disabled>B</button>
    <a href="#">link</a>
    <a>no-href</a>
    <input type="text" />
    <input disabled />
    <textarea></textarea>
    <select><option>x</option></select>
    <span tabindex="0">focusable-span</span>
    <span tabindex="-1">skip</span>
    <div>no-interact</div>
  `;
  document.body.appendChild(root);
  const items = queryFocusableElements(root);
  // enabled button + href link + text input + textarea + select + tabindex=0 span = 6
  assert.equal(items.length, 6);
  document.body.removeChild(root);
});

test("queryFocusableElements preserves DOM order", () => {
  const root = document.createElement("div");
  root.innerHTML = `<button>first</button><input /><button>third</button>`;
  document.body.appendChild(root);
  const items = queryFocusableElements(root);
  assert.equal(items[0].textContent, "first");
  assert.equal(items[1].tagName, "INPUT");
  assert.equal(items[2].textContent, "third");
  document.body.removeChild(root);
});
