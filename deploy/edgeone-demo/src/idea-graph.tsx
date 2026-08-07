import { InvestmentGraph } from "@jiayi-hui/investment-graph";
import "@jiayi-hui/investment-graph/styles.css";
import "./idea-graph-host.css";

/**
 * Level Grind host adapter only. The graph component, data, styles, layout,
 * timeline, filters, and interactions are owned by the canonical
 * Jiayi-Hui/investment-graph package mirrored with source commit + checksums.
 */
export function IdeaGraphView() {
  return <InvestmentGraph />;
}
