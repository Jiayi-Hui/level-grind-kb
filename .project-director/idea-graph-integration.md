# Idea Graph integration — Quick decision record

## What the reviewed prototype provides

`Jiayi-Hui/investment-graph` at `377444abdc1972cecd0a2ceab78d5c9aa65c8bff` is the canonical Cytoscape/React
prototype. It has a useful full-width pan/zoom graph, industry/market filters,
timeline, and node inspector. Its current node and edge dataset is explicitly a
candidate extraction from a local research summary; it has no shared-Idea API,
auth boundary, source anchors, or edit/audit contract.

## Current integration

- The canonical package is mirrored into `vendor/investment-graph` by the
  repeatable sync script; Level Grind does not maintain a second graph UI.
- Idea Graph is the signed-in workspace's default landing view and remains in
  the left navigation so users can return to it from every research module.
- The graph remains a research read model. Its curated data is not silently
  written back into shared Notes or Ideas.

## Required before making the graph a first-class shared view

1. Derive graph nodes from approved shared Idea/Notes records and retain each
   record's stable ID, version, visibility and source links.
2. Store only reviewed graph relations with actor, timestamp, confidence,
   evidence and soft-delete/audit history.
3. Serve graph JSON through the authenticated shared-data API; use a full-width
   graph canvas with a detail drawer, not a narrow embedded card.
4. Add permission-aware filtering and an empty/loading/error state before
   exposing a production graph URL.
