# 1. Single-page modal shell

Date: 2026-04-16

## Status

Accepted

## Context

The original prototype used Next.js routes (`/editor`, `/settings`,
`/projects`, etc.). Every feature surface was a page transition, which
meant lost editor state, flicker between transitions, and an awkward
modal system layered on top of route changes.

## Decision

Collapse every feature surface into a modal that mounts inside
`components/app-shell.tsx` at path `/`. Projects, Ideation, Review,
Connection, Batch, Scaffold, Reference, and Export are all modals
(or menus). The editor keeps its `useState` tree live for the whole
session.

## Consequences

- **Positive:** no route-transition flicker; editor never loses focus
  or unsaved state; keyboard shortcuts work globally; bundle stays
  small because we don't ship multiple route chunks.
- **Negative:** deep-linking to individual surfaces isn't possible
  (modal open/close is URL-less). We accept this because the target
  user is a single author on one machine.
- **Neutral:** SSR still renders `/` normally; modals hydrate on the
  client.
