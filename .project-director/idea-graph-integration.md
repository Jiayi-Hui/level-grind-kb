# Idea Graph integration — Quick decision record

## What the reviewed prototype provides

`Jiayi-Hui/investment-graph` at `cc920ca` is a standalone Cytoscape/React
prototype. It has a useful full-width pan/zoom graph, industry/market filters,
timeline, and node inspector. Its current node and edge dataset is explicitly a
candidate extraction from a local research summary; it has no shared-Idea API,
auth boundary, source anchors, or edit/audit contract.

## Safe first integration

- Keep the graph a separate app, opened from both the primary navigation and
  Ideas header through `VITE_IDEA_GRAPH_URL`.
- Default to the reviewed GitHub repository rather than silently presenting
  candidate data as the team's live Idea Book.
- Do not import its curated data into shared Notes/Ideas or duplicate it in
  the Level Grind deployment.

## Required before making the graph a first-class shared view

1. Derive graph nodes from approved shared Idea/Notes records and retain each
   record's stable ID, version, visibility and source links.
2. Store only reviewed graph relations with actor, timestamp, confidence,
   evidence and soft-delete/audit history.
3. Serve graph JSON through the authenticated shared-data API; use a full-width
   graph canvas with a detail drawer, not a narrow embedded card.
4. Add permission-aware filtering and an empty/loading/error state before
   exposing a production graph URL.
