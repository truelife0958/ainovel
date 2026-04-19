import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdownToHtml } from "../../components/markdown-preview.render.js";

test("h1/h2/h3 heading", () => {
  assert.equal(renderMarkdownToHtml("# hi"), "<h1>hi</h1>");
  assert.equal(renderMarkdownToHtml("## hi"), "<h2>hi</h2>");
  assert.equal(renderMarkdownToHtml("### hi"), "<h3>hi</h3>");
});

test("bold and italic inside paragraph", () => {
  const out = renderMarkdownToHtml("**bold** and *italic*");
  assert.equal(out, "<p><strong>bold</strong> and <em>italic</em></p>");
});

test("unordered list", () => {
  const out = renderMarkdownToHtml("- a\n- b\n- c");
  assert.equal(out, "<ul><li>a</li><li>b</li><li>c</li></ul>");
});

test("ordered list", () => {
  const out = renderMarkdownToHtml("1. a\n2. b");
  assert.equal(out, "<ol><li>a</li><li>b</li></ol>");
});

test("blockquote", () => {
  assert.equal(renderMarkdownToHtml("> quoted"), "<blockquote>quoted</blockquote>");
});

test("hr", () => {
  assert.equal(renderMarkdownToHtml("---"), "<hr>");
});

test("link", () => {
  assert.equal(
    renderMarkdownToHtml("[text](https://example.com)"),
    '<p><a href="https://example.com" rel="noopener noreferrer">text</a></p>',
  );
});

test("link with unsafe protocol is neutralized", () => {
  assert.equal(
    renderMarkdownToHtml("[x](javascript:alert)"),
    '<p><a href="#" rel="noopener noreferrer">x</a></p>',
  );
});

test("escapes HTML to prevent injection", () => {
  const out = renderMarkdownToHtml("<script>alert(1)</script>");
  assert.ok(out.includes("&lt;script&gt;"));
  assert.ok(!out.includes("<script>"));
});

test("paragraph separation on double newline", () => {
  assert.equal(renderMarkdownToHtml("foo\n\nbar"), "<p>foo</p><p>bar</p>");
});

test("empty input returns empty string", () => {
  assert.equal(renderMarkdownToHtml(""), "");
  assert.equal(renderMarkdownToHtml(null), "");
  assert.equal(renderMarkdownToHtml(undefined), "");
});
