import { test } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "../setup/react.mjs";
import React from "react";

test("RTL env renders a div", () => {
  render(React.createElement("div", {}, "hello"));
  assert.equal(screen.getByText("hello").tagName, "DIV");
  cleanup();
});
