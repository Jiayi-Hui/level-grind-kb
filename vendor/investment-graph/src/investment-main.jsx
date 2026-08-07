import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { edges, markets, nodes, nodeTypes, periods, sectors } from "./investment-data";
import "./investment-styles.css";

const positionMeta = {
  LONG: { label: "LONG", color: "#DF5B5B", soft: "#FBE4E2" },
  SHORT: { label: "SHORT", color: "#31936A", soft: "#DDF2E8" },
  NEUTRAL: { label: "NEUTRAL", color: "#9B8660", soft: "#F1E9D9" },
  NONE: { label: "", color: "#8EA1AE", soft: "#EAF0F3" },
};

function graphLabel(node) {
  if (node.type === "security") {
    if (!node.weight) return node.label;
    return `${node.label}\n${node.weight > 0 ? "+" : ""}${node.weight}%`;
  }
  return node.label;
}

const sectorAnchors = {
  ai: { x: 470, y: 165 },
  auto: { x: 770, y: 330 },
  battery: { x: 650, y: 620 },
  consumer: { x: 270, y: 620 },
  machinery: { x: 120, y: 320 },
};

const crossAnchors = {
  "cross-ai-capex": { x: 440, y: 275 },
  "cross-china-demand": { x: 330, y: 390 },
  "cross-export-cycle": { x: 550, y: 390 },
  "cross-cost-cycle": { x: 440, y: 505 },
};

function isBoundaryMembershipEdge(item) {
  return item.relation === "行业覆盖";
}

function graphPositions(visibleNodes) {
  const positions = {};
  const bySector = new Map();
  for (const node of visibleNodes) {
    if (crossAnchors[node.id]) {
      positions[node.id] = crossAnchors[node.id];
      continue;
    }
    if (!bySector.has(node.sector)) bySector.set(node.sector, []);
    bySector.get(node.sector).push(node);
  }

  for (const [sectorId, sectorNodes] of bySector) {
    const anchor = sectorAnchors[sectorId] || { x: 440, y: 390 };
    const theme = sectorNodes.find((node) => node.type === "theme");
    if (theme) positions[theme.id] = anchor;

    const satellites = sectorNodes.filter((node) => node.id !== theme?.id);
    satellites.forEach((node, index) => {
      const ring = index < 7 ? 0 : 1;
      const ringItems = ring === 0 ? Math.min(7, satellites.length) : Math.max(1, satellites.length - 7);
      const ringIndex = ring === 0 ? index : index - 7;
      const angle = ((ringIndex / ringItems) * Math.PI * 2) - Math.PI / 2;
      const radiusX = ring === 0 ? 108 : 166;
      const radiusY = ring === 0 ? 82 : 128;
      positions[node.id] = {
        x: anchor.x + Math.cos(angle) * radiusX,
        y: anchor.y + Math.sin(angle) * radiusY,
      };
    });
  }

  return positions;
}

function focusPositions(visibleNodes, focusedNodeIds, primarySector = "all") {
  const positions = {};
  const center = { x: 440, y: 390 };
  const focused = visibleNodes.filter((node) => focusedNodeIds.has(node.id));
  const themes = focused.filter((node) => node.type === "theme");
  const themeIds = new Set(themes.map((node) => node.id));

  const primaryTheme = primarySector === "all" ? null : themes.find((theme) => theme.sector === primarySector);
  const satelliteThemes = primaryTheme ? themes.filter((theme) => theme.id !== primaryTheme.id) : themes;

  if (primaryTheme) positions[primaryTheme.id] = center;

  satelliteThemes.forEach((theme, index) => {
    if (primaryTheme) {
      const angle = (index / Math.max(1, satelliteThemes.length)) * Math.PI * 2 - Math.PI / 2;
      positions[theme.id] = {
        x: center.x + Math.cos(angle) * 292,
        y: center.y + Math.sin(angle) * 205,
      };
      return;
    }
    if (themes.length === 1) {
      positions[theme.id] = center;
      return;
    }
    const angle = (index / themes.length) * Math.PI * 2 - Math.PI / 2;
    positions[theme.id] = {
      x: center.x + Math.cos(angle) * 205,
      y: center.y + Math.sin(angle) * 128,
    };
  });

  for (const theme of themes) {
    const members = focused.filter((node) => node.type === "security" && node.sector === theme.sector);
    const anchor = positions[theme.id];
    const isPrimary = primaryTheme?.id === theme.id;
    const radiusX = themes.length === 1 || isPrimary ? 132 : members.length > 6 ? 98 : 78;
    const radiusY = themes.length === 1 || isPrimary ? 94 : members.length > 6 ? 76 : 62;
    members.forEach((node, index) => {
      const angle = (index / Math.max(1, members.length)) * Math.PI * 2 - Math.PI / 2;
      positions[node.id] = {
        x: anchor.x + Math.cos(angle) * radiusX,
        y: anchor.y + Math.sin(angle) * radiusY,
      };
    });
  }

  const ungrouped = focused.filter((node) => !themeIds.has(node.id) && !positions[node.id]);
  ungrouped.forEach((node, index) => {
    const angle = (index / Math.max(1, ungrouped.length)) * Math.PI * 2 - Math.PI / 2;
    positions[node.id] = {
      x: center.x + Math.cos(angle) * 125,
      y: center.y + Math.sin(angle) * 90,
    };
  });

  return positions;
}

function edgeCurveDistance(id) {
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 2 === 0 ? 52 : -52;
}

function crossIndustryBridgeIds(visibleNodes, visibleEdges, selectedThemeIds) {
  const themeIds = [...selectedThemeIds];
  if (themeIds.length < 2) return new Set();

  const nonSecurityIds = new Set(visibleNodes.filter((node) => node.type !== "security").map((node) => node.id));
  const adjacency = new Map([...nonSecurityIds].map((id) => [id, []]));
  visibleEdges.forEach((edge) => {
    if (!nonSecurityIds.has(edge.source) || !nonSecurityIds.has(edge.target)) return;
    adjacency.get(edge.source).push(edge.target);
    adjacency.get(edge.target).push(edge.source);
  });

  const bridgeIds = new Set();
  for (let left = 0; left < themeIds.length; left += 1) {
    for (let right = left + 1; right < themeIds.length; right += 1) {
      const target = themeIds[right];
      const walk = (current, path) => {
        if (path.length > 4) return;
        if (current === target) {
          path.forEach((id) => bridgeIds.add(id));
          return;
        }
        (adjacency.get(current) || []).forEach((next) => {
          if (!path.includes(next)) walk(next, [...path, next]);
        });
      };
      walk(themeIds[left], [themeIds[left]]);
    }
  }
  return bridgeIds;
}

export function InvestmentGraph() {
  const graphRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [period, setPeriod] = useState(periods.length - 1);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("byd");

  function toggleSelection(id, setter) {
    if (id === "all") {
      setter([]);
      return;
    }
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const visible = useMemo(() => {
    const eligibleNodeIds = new Set(
      nodes
        .filter((node) => node.start <= period)
        .map((node) => node.id),
    );
    const visibleEdges = edges.filter(
      (item) => item.views.includes("portfolio")
        && !isBoundaryMembershipEdge(item)
        && item.start <= period
        && eligibleNodeIds.has(item.source)
        && eligibleNodeIds.has(item.target),
    );
    return {
      nodes: nodes.filter((node) => eligibleNodeIds.has(node.id)),
      edges: visibleEdges,
    };
  }, [period]);

  const hasActiveFilter = selectedSectors.length > 0 || selectedMarkets.length > 0;
  const primaryNodeIds = useMemo(() => {
    if (!hasActiveFilter) return new Set(visible.nodes.map((node) => node.id));
    const matchingSecurities = visible.nodes.filter((node) => node.type === "security"
      && (!selectedSectors.length || selectedSectors.includes(node.sector))
      && (!selectedMarkets.length || selectedMarkets.includes(node.market)));
    const matchingSectors = new Set(matchingSecurities.map((node) => node.sector));
    return new Set([
      ...matchingSecurities.map((node) => node.id),
      ...visible.nodes.filter((node) => node.type === "theme" && matchingSectors.has(node.sector)).map((node) => node.id),
    ]);
  }, [hasActiveFilter, selectedMarkets, selectedSectors, visible.nodes]);

  const focusedNodeIds = useMemo(() => {
    if (selectedSectors.length < 2) return primaryNodeIds;
    const selectedThemeIds = new Set(
      visible.nodes
        .filter((node) => node.type === "theme" && primaryNodeIds.has(node.id))
        .map((node) => node.id),
    );
    return new Set([
      ...primaryNodeIds,
      ...crossIndustryBridgeIds(visible.nodes, visible.edges, selectedThemeIds),
    ]);
  }, [primaryNodeIds, selectedSectors.length, visible.edges, visible.nodes]);

  const displayed = useMemo(() => {
    if (!hasActiveFilter) return visible;
    return {
      nodes: visible.nodes.filter((node) => focusedNodeIds.has(node.id)),
      edges: visible.edges.filter((edge) => focusedNodeIds.has(edge.source) && focusedNodeIds.has(edge.target)),
    };
  }, [focusedNodeIds, hasActiveFilter, visible]);

  const effectiveSelectedId = displayed.nodes.some((node) => node.id === selectedId)
    ? selectedId
    : displayed.nodes.find((node) => node.type === "security")?.id || displayed.nodes[0]?.id || selectedId;
  const selected = nodes.find((node) => node.id === effectiveSelectedId) || nodes[0];
  const selectedConnections = displayed.edges
    .filter((item) => item.source === selected.id || item.target === selected.id)
    .map((item) => ({
      ...item,
      peer: nodes.find((node) => node.id === (item.source === selected.id ? item.target : item.source)),
      direction: item.source === selected.id ? "out" : "in",
    }));

  const visibleLongs = displayed.nodes.filter((node) => node.position === "LONG").length;
  const visibleShorts = displayed.nodes.filter((node) => node.position === "SHORT").length;
  const visibleObservations = displayed.nodes.filter((node) => node.type === "security" && node.position === "NONE").length;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setPeriod((value) => (value >= periods.length - 1 ? 0 : value + 1)), 1250);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!graphRef.current) return undefined;

    const cy = cytoscape({
      container: graphRef.current,
      elements: [
        ...visible.nodes.map((node) => ({
          data: {
            ...node,
            graphLabel: graphLabel(node),
          },
        })),
        ...visible.edges.map((item) => ({ data: { ...item, curveDistance: edgeCurveDistance(item.id) } })),
      ],
      minZoom: 0.35,
      maxZoom: 2.5,
      style: [
        {
          selector: "node",
          style: {
            width: "data(size)",
            height: "data(size)",
            shape: "ellipse",
            "background-color": "#E4EBE5",
            "border-color": "#B8C7BF",
            "border-width": 1.5,
            label: "data(graphLabel)",
            color: "#24352F",
            "font-size": 10,
            "font-family": "Arial, PingFang SC, Microsoft YaHei, sans-serif",
            "font-weight": 700,
            "text-wrap": "wrap",
            "text-max-width": 104,
            "text-valign": "bottom",
            "text-margin-y": 10,
            "overlay-opacity": 0,
            "z-index": 5,
            "z-index-compare": "manual",
            "transition-property": "opacity, text-opacity, border-width, border-color, background-color",
            "transition-duration": 420,
          },
        },
        ...Object.entries(nodeTypes).map(([type, meta]) => ({
          selector: `node[type = "${type}"]`,
          style: {
            shape: meta.shape,
            "background-color": meta.color,
            "border-color": meta.color,
          },
        })),
        {
          selector: "node[type = 'security']",
          style: {
            width: 62,
            height: 62,
            shape: "ellipse",
            color: "#18201D",
            "font-size": 10,
            "font-weight": 700,
            "text-valign": "center",
            "text-halign": "center",
            "text-margin-y": 0,
            "text-max-width": 56,
          },
        },
        {
          selector: "node[type = 'theme']",
          style: {
            shape: "ellipse",
            width: 330,
            height: 250,
            "font-size": 13,
            "font-family": "Georgia, serif",
            "font-weight": 500,
            "text-valign": "top",
            "text-margin-y": -12,
            "background-opacity": 0.09,
            "border-width": 1.5,
            "border-style": "dashed",
            events: "no",
            "z-index": 0,
            "z-index-compare": "manual",
          },
        },
        { selector: "node[type = 'theme'][sector = 'ai']", style: { width: 390, height: 300, "background-color": "#DCE8F2", "border-color": "#9BB3C5" } },
        { selector: "node[type = 'theme'][sector = 'auto']", style: { width: 360, height: 270, "background-color": "#F2E3DE", "border-color": "#CDA99D" } },
        { selector: "node[type = 'theme'][sector = 'machinery']", style: { width: 360, height: 285, "background-color": "#E4E9E1", "border-color": "#A9B7A5" } },
        { selector: "node[type = 'theme'][sector = 'consumer']", style: { width: 360, height: 290, "background-color": "#F1EBDC", "border-color": "#C9B98E" } },
        { selector: "node[type = 'theme'][sector = 'battery']", style: { width: 310, height: 250, "background-color": "#E5E1ED", "border-color": "#B2A6C4" } },
        {
          selector: "node[id ^= 'cross-']",
          style: { width: 58, height: 58, "background-color": "#F0D995", "border-color": "#D5BA69", "font-size": 9 },
        },
        {
          selector: "node[position = 'LONG']",
          style: { "background-color": "#FFF9F7", "border-color": "#DF5B5B", "border-width": 3 },
        },
        {
          selector: "node[position = 'SHORT']",
          style: { "background-color": "#F7FBF8", "border-color": "#31936A", "border-width": 3 },
        },
        {
          selector: "node[type = 'security'][position = 'NONE']",
          style: { "background-color": "#FFFEFA", "border-color": "#8B9690", "border-width": 3 },
        },
        {
          selector: "node[position = 'NEUTRAL']",
          style: { "background-color": "#B19B72", "border-color": "#8A7651", "border-width": 3 },
        },
        {
          selector: "edge",
          style: {
            width: 0.9,
            "line-color": "#AAB8B0",
            "target-arrow-color": "#82968B",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "unbundled-bezier",
            "control-point-distances": "data(curveDistance)",
            "control-point-weights": 0.5,
            opacity: 0.16,
            label: "",
            color: "#607269",
            "font-size": 7,
            "font-weight": 600,
            "text-background-color": "#FFFEFA",
            "text-background-opacity": 0.92,
            "text-background-padding": 2,
            "text-rotation": "autorotate",
            "overlay-opacity": 0,
            "transition-property": "opacity, width, line-color, target-arrow-color",
            "transition-duration": 420,
          },
        },
        {
          selector: "edge[impact = 'positive']",
          style: { "line-color": "#D99B97", "target-arrow-color": "#CF7C77" },
        },
        {
          selector: "edge[impact = 'negative']",
          style: { "line-color": "#79B69A", "target-arrow-color": "#4E9C77" },
        },
        {
          selector: "edge[impact = 'reference']",
          style: { "line-color": "#555C59", "target-arrow-color": "#555C59", opacity: 0.24 },
        },
        {
          selector: "edge[relationType]",
          style: {
            label: "",
            "font-size": 7,
            "text-rotation": "autorotate",
            "text-background-opacity": 1,
            "text-background-padding": 3,
            width: 1.2,
            opacity: 0.34,
          },
        },
        { selector: "edge[relationType = 'competitor']", style: { "line-color": "#555C59", "target-arrow-color": "#555C59", "line-style": "dashed" } },
        { selector: "edge[relationType = 'supplier']", style: { "line-color": "#4F7890", "target-arrow-color": "#4F7890" } },
        { selector: "edge[relationType = 'partnership']", style: { "line-color": "#B46A47", "target-arrow-color": "#B46A47" } },
        { selector: "edge[relationType = 'ownership']", style: { "line-color": "#76648E", "target-arrow-color": "#76648E", width: 2.2 } },
        {
          selector: "edge[id ^= 'root']",
          style: { width: 2.4, opacity: 0.72, "line-color": "#6F9385", "target-arrow-color": "#527565" },
        },
        {
          selector: "edge[id ^= 'cross']",
          style: { width: 1.35, opacity: 0.3 },
        },
        {
          selector: "edge[id ^= 'crossSector']",
          style: {
            width: 1.5,
            opacity: 0.38,
            "line-style": "dashed",
            "line-dash-pattern": [7, 5],
            "line-color": "#708F82",
            "target-arrow-color": "#708F82",
            label: "",
            "font-size": 8,
            "text-rotation": "none",
            "text-margin-y": -9,
            "text-background-opacity": 1,
            "text-background-padding": 4,
          },
        },
        {
          selector: "node:selected",
          style: { "border-width": 5, "overlay-color": "#214A3D", "overlay-opacity": 0.12, "overlay-padding": 8, "z-index": 20 },
        },
        {
          selector: ".neighbor",
          style: { "overlay-color": "#214A3D", "overlay-opacity": 0.07, "overlay-padding": 5, opacity: 1 },
        },
        {
          selector: "edge.neighbor",
          style: {
            "line-color": "#3E765F",
            "target-arrow-color": "#3E765F",
            width: 3,
            opacity: 1,
            label: "data(relation)",
          },
        },
        { selector: ".dimmed", style: { opacity: 0.1 } },
        { selector: ".hover-dimmed", style: { opacity: 0.075, "text-opacity": 0.08 } },
        { selector: "node.hover-neighbor", style: { opacity: 1, "text-opacity": 1, "overlay-color": "#214A3D", "overlay-opacity": 0.08, "overlay-padding": 5, "z-index": 30 } },
        { selector: "edge.hover-neighbor", style: { opacity: 1, width: 3, label: "data(relation)", "font-size": 8, "z-index": 29 } },
        { selector: "node.filter-faded", style: { display: "none", opacity: 0, "text-opacity": 0, events: "no", "transition-duration": 0 } },
        { selector: "edge.filter-faded", style: { display: "none", opacity: 0, events: "no", "transition-duration": 0 } },
        { selector: "node.filter-focused", style: { display: "element", opacity: 1, "text-opacity": 1, "transition-duration": 0, "z-index": 12 } },
        { selector: "node.filter-context", style: { display: "element", opacity: 0.72, "text-opacity": 1, "transition-duration": 0, "border-style": "dashed", "z-index": 10 } },
        { selector: "edge.filter-focused", style: { display: "element", opacity: 0.8, width: 1.8, "transition-duration": 0, "z-index": 11 } },
        { selector: "edge[id ^= 'crossSector'].filter-focused", style: { opacity: 1, width: 2.5, "z-index": 13 } },
        { selector: ".search-hit", style: { "border-color": "#C75C35", "border-width": 6, "background-blacken": -0.12 } },
      ],
      layout: {
        name: "preset",
        animate: false,
        positions: graphPositions(visible.nodes),
        fit: true,
        padding: 52,
      },
    });

    const focusNode = (node) => {
      cy.elements().removeClass("dimmed neighbor");
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass("dimmed");
      neighborhood.addClass("neighbor");
      node.removeClass("neighbor").select();
      setSelectedId(node.id());
    };

    cy.on("tap", "node", (event) => focusNode(event.target));
    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const neighborhood = node.closedNeighborhood();
      cy.elements().removeClass("hover-dimmed hover-neighbor");
      cy.elements().difference(neighborhood).addClass("hover-dimmed");
      neighborhood.addClass("hover-neighbor");
      node.removeClass("hover-neighbor");
    });
    cy.on("mouseout", "node", () => {
      cy.elements().removeClass("hover-dimmed hover-neighbor");
    });
    cy.on("mouseover", "edge", (event) => {
      const edge = event.target;
      const related = edge.source().closedNeighborhood().union(edge.target().closedNeighborhood());
      cy.elements().removeClass("hover-dimmed hover-neighbor");
      cy.elements().difference(related).addClass("hover-dimmed");
      related.addClass("hover-neighbor");
      edge.addClass("hover-neighbor");
    });
    cy.on("mouseout", "edge", () => {
      cy.elements().removeClass("hover-dimmed hover-neighbor");
    });
    cy.on("tap", (event) => {
      if (event.target !== cy) return;
      cy.elements().removeClass("dimmed neighbor");
      cy.$(":selected").unselect();
    });

    const preferred = visible.nodes.some((node) => node.id === effectiveSelectedId)
      ? effectiveSelectedId
      : visible.nodes.find((node) => node.position === "LONG" || node.position === "SHORT")?.id || visible.nodes[0]?.id;
    const initial = preferred ? cy.getElementById(preferred) : null;
    if (initial?.length) {
      initial.select();
    }

    cyRef.current = cy;
    const resizeObserver = new ResizeObserver(() => cy.resize());
    resizeObserver.observe(graphRef.current);
    const settleTimer = window.setTimeout(() => {
      cy.resize();
      cy.fit(cy.elements(), 52);
    }, 120);

    return () => {
      window.clearTimeout(settleTimer);
      resizeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [effectiveSelectedId, visible]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const basePositions = graphPositions(visible.nodes);
    const primarySector = selectedSectors.length === 1 ? selectedSectors[0] : "all";
    const pulledPositions = hasActiveFilter ? focusPositions(visible.nodes, focusedNodeIds, primarySector) : {};
    const nextPositions = { ...basePositions, ...pulledPositions };

    cy.elements().removeClass("dimmed neighbor filter-faded filter-focused filter-context");
    cy.$(":selected").unselect();

    if (hasActiveFilter) {
      cy.nodes().forEach((node) => {
        if (!focusedNodeIds.has(node.id())) node.addClass("filter-faded");
        else if (primaryNodeIds.has(node.id())) node.addClass("filter-focused");
        else node.addClass("filter-context");
      });
      cy.edges().forEach((edge) => edge.addClass(
        focusedNodeIds.has(edge.source().id()) && focusedNodeIds.has(edge.target().id())
          ? "filter-focused"
          : "filter-faded",
      ));
    }

    cy.nodes().forEach((node) => {
      const position = nextPositions[node.id()];
      if (!position) return;
      node.stop(true, false).animate(
        { position },
        { duration: 680, easing: "ease-in-out-cubic" },
      );
    });

    const eligibleSelection = hasActiveFilter
      ? displayed.nodes.find((node) => node.id === effectiveSelectedId)
      : visible.nodes.find((node) => node.id === effectiveSelectedId);
    if (eligibleSelection) {
      cy.getElementById(eligibleSelection.id).select();
    }
  }, [displayed.nodes, effectiveSelectedId, focusedNodeIds, hasActiveFilter, primaryNodeIds, selectedSectors, visible.nodes]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("search-hit");
    const term = query.trim().toLowerCase();
    if (!term) return;
    const hits = cy.nodes().filter((node) => `${node.data("label")} ${node.data("sublabel")}`.toLowerCase().includes(term));
    hits.addClass("search-hit");
    if (hits.length) cy.animate({ fit: { eles: hits, padding: 170 }, duration: 300 });
  }, [query]);

  function fitGraph() {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("dimmed neighbor");
    cy.fit(cy.elements(), 52);
  }

  function rerunLayout() {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("dimmed neighbor");
    const positions = {
      ...graphPositions(visible.nodes),
      ...(hasActiveFilter ? focusPositions(visible.nodes, focusedNodeIds, selectedSectors.length === 1 ? selectedSectors[0] : "all") : {}),
    };
    cy.layout({
      name: "preset",
      animate: true,
      animationDuration: 550,
      positions,
      fit: true,
      padding: 52,
    }).run();
  }

  function changeZoom(delta) {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: Math.max(0.35, Math.min(2.5, cy.zoom() + delta)), duration: 180 });
  }

  const selectedPosition = positionMeta[selected.position] || positionMeta.NONE;

  return (
    <main className="atlas-shell">
      <header className="atlas-topbar">
        <div className="atlas-brand">
          <div className="atlas-brandmark"><i /><i /><i /></div>
          <div><span>LEVEL GRIND · RESEARCH OS</span><strong>Investment Graph</strong></div>
        </div>
        <div className="atlas-context"><span>研究工作台</span><b>/</b><strong>组合图谱</strong></div>
        <div className="atlas-source"><i /> 候选关系 · 0803–0806 研究笔记</div>
        <button className="outline-button" onClick={fitGraph}>重置视图</button>
      </header>

      <section className="atlas-workspace">
        <aside className="atlas-controls">
          <div className="atlas-intro">
            <p className="atlas-eyebrow">PORTFOLIO INTELLIGENCE</p>
            <h1>组合知识图谱</h1>
          </div>

          <div className="book-summary">
            <article><i className="long" /><span>Long</span><strong>{visibleLongs}</strong></article>
            <article><i className="short" /><span>Short</span><strong>{visibleShorts}</strong></article>
            <article><i className="relations" /><span>Observations</span><strong>{visibleObservations}</strong></article>
          </div>

          <label className="atlas-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索证券、主题或驱动" />
            {query && <button onClick={() => setQuery("")}>×</button>}
          </label>

          <div className="atlas-control-section">
            <div className="atlas-control-heading"><span>行业筛选</span><em>01</em></div>
            <div className="atlas-sector-grid">
              {sectors.map(([id, label]) => <button key={id} className={(id === "all" ? selectedSectors.length === 0 : selectedSectors.includes(id)) ? "active" : ""} onClick={() => toggleSelection(id, setSelectedSectors)}>{label}</button>)}
            </div>
          </div>

          <div className="atlas-control-section">
            <div className="atlas-control-heading"><span>上市市场</span><em>02</em></div>
            <div className="atlas-market-grid">
              {markets.map(([id, label]) => <button key={id} className={(id === "all" ? selectedMarkets.length === 0 : selectedMarkets.includes(id)) ? "active" : ""} onClick={() => toggleSelection(id, setSelectedMarkets)}>{label}</button>)}
            </div>
          </div>

          <div className="position-legend">
            <div className="atlas-control-heading"><span>投资方向</span><em>03</em></div>
            <div><span><i className="long" />Long · 红边</span><span><i className="short" />Short · 绿边</span></div>
          </div>

          <div className="relation-legend">
            <div className="atlas-control-heading"><span>公司关系</span><em>04</em></div>
            <div>
              <span><i className="ownership" />股权 / 同一集团</span>
              <span><i className="supplier" />供应链</span>
              <span><i className="partnership" />合作 / 合资</span>
              <span><i className="competitor" />竞争</span>
            </div>
          </div>

          <div className="type-legend">
            <div className="atlas-control-heading"><span>Node类型</span><em>05</em></div>
            <div>{Object.entries(nodeTypes).filter(([id]) => id !== "security").map(([id, meta]) => <span key={id}><i style={{ background: meta.color }} />{meta.label}</span>)}</div>
          </div>
        </aside>

        <section className="atlas-stage">
          <div className="atlas-stage-meta">
            <div><span>当前网络</span><strong>产业逻辑网络</strong><small>{selectedSectors.length ? selectedSectors.map((id) => sectors.find(([sectorId]) => sectorId === id)?.[1]).join(" + ") : "全部行业"} · {selectedMarkets.length ? selectedMarkets.map((id) => markets.find(([marketId]) => marketId === id)?.[1]).join(" + ") : "全部市场"} · {periods[period]}</small></div>
            <div className="atlas-kpis">
              <article><strong>{displayed.nodes.length}</strong><span>节点</span></article>
              <article><strong>{displayed.edges.length}</strong><span>关系</span></article>
              <article><strong>{new Set(displayed.nodes.map((node) => node.type)).size}</strong><span>类型</span></article>
            </div>
          </div>

          <div ref={graphRef} className="atlas-canvas" aria-label="Interactive long-short investment knowledge graph" />

          <div className="atlas-tools">
            <button onClick={() => changeZoom(0.18)} title="放大">＋</button>
            <button onClick={() => changeZoom(-0.18)} title="缩小">−</button>
            <button onClick={fitGraph} title="适应画布">⌗</button>
            <button onClick={rerunLayout} title="重新布局">↻</button>
          </div>

          <div className="atlas-hint"><span>{hasActiveFilter ? "主体居中；虚线主题框 = 直接关联行业" : "虚线弧 = 行业间传导；节点大小 = |仓位|"}</span><i />拖动节点<i />点击聚焦一度关系</div>

          <div className="atlas-timeline">
            <button className={playing ? "playing" : ""} onClick={() => setPlaying(!playing)}>{playing ? "Ⅱ" : "▶"}</button>
            <div>
              <div><strong>逐日观点演进</strong><span>{periods[period]}</span></div>
              <input type="range" min="0" max={periods.length - 1} value={period} onChange={(event) => { setPlaying(false); setPeriod(Number(event.target.value)); }} />
              <div className="atlas-timeline-labels">{periods.map((item, index) => <span key={item} className={index === period ? "active" : ""}>{`${Number(item.slice(5, 7))}月${Number(item.slice(8, 10))}日`}</span>)}</div>
            </div>
          </div>
        </section>

        <aside className="atlas-detail">
          <div className="atlas-detail-top"><span>NODE INSPECTOR</span><em>{selected.type.toUpperCase()}</em></div>
          <div className="atlas-node-head">
            <i style={{
              background: selected.type === "security" && selected.position === "NONE" ? "#FFFEFA" : selected.position !== "NONE" ? selectedPosition.soft : nodeTypes[selected.type].color,
              border: `2px solid ${selected.type === "security" && selected.position === "NONE" ? "#8B9690" : selected.position !== "NONE" ? selectedPosition.color : nodeTypes[selected.type].color}`,
            }} />
            <div>
              <span>{nodeTypes[selected.type].label}</span>
              <h2>{selected.label}</h2>
              <p>{selected.sublabel}{selected.type === "security" && selected.market !== "OTHER" ? ` · ${markets.find(([id]) => id === selected.market)?.[1]}` : ""}</p>
            </div>
          </div>

          {selected.position !== "NONE" && (
            <div className="position-card" style={{ background: selectedPosition.soft, borderColor: selectedPosition.color }}>
              <span style={{ color: selectedPosition.color }}>{selected.positionLabel}</span>
              <strong>{selected.weightLabel}</strong>
              <small>{selected.horizon}</small>
            </div>
          )}

          <p className="atlas-description">{selected.description}</p>

          {!!selected.metrics.length && <div className="atlas-metrics">{selected.metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}

          {selected.thesis && <div className="thesis-card"><span>CORE THESIS</span><p>{selected.thesis}</p></div>}
          {selected.invalidation && <div className="invalidation-card"><span>INVALIDATION</span><p>{selected.invalidation}</p></div>}

          <div className="atlas-connection-head"><div><span>VISIBLE CONNECTIONS</span><strong>{selectedConnections.length}</strong></div><small>点击切换Node</small></div>
          <div className="atlas-connections">
            {selectedConnections.length ? selectedConnections.map((item) => (
              <button key={item.id} onClick={() => {
                const target = cyRef.current?.getElementById(item.peer?.id);
                if (target?.length) { target.emit("tap"); cyRef.current.animate({ center: { eles: target }, duration: 250 }); }
              }}>
                <i className={item.impact} />
                <div><span>{item.direction === "out" ? selected.label : item.peer?.label}</span><em>{item.relation}</em><strong>{item.direction === "out" ? item.peer?.label : selected.label}</strong></div>
                <b>›</b>
              </button>
            )) : <div className="atlas-empty">当前筛选下没有可见关系。</div>}
          </div>

          {selectedConnections[0] && <div className="relation-note">
            <span>RELATION LOGIC</span>
            <p>{selectedConnections[0].note}</p>
            {selectedConnections[0].sourceUrl
              ? <a href={selectedConnections[0].sourceUrl} target="_blank" rel="noreferrer">来源：{selectedConnections[0].sourceLabel}</a>
              : <small>Candidate extraction · 0803–0806 research notes</small>}
          </div>}
        </aside>
      </section>
    </main>
  );
}
