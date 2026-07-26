"use client";

import { Fragment, ReactNode } from "react";

function inlineMarkdown(value: string): ReactNode[] {
  const tokens = value.split(/(\*\*[^*]+\*\*|\[[0-9]+\]|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return tokens.filter(Boolean).map((token, index) => {
    const strong = token.match(/^\*\*(.+)\*\*$/);
    if (strong) return <strong key={index}>{strong[1]}</strong>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) {
      return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    }
    const citation = token.match(/^\[([0-9]+)\]$/);
    if (citation) return <span key={index} className="inline-citation">[{citation[1]}]</span>;
    return <Fragment key={index}>{token}</Fragment>;
  });
}

export function MarkdownAnswer({ value }: { value: string }) {
  const blocks: ReactNode[] = [];
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  let list: Array<{ text: string; ordered: boolean }> = [];

  function flushList() {
    if (!list.length) return;
    const ordered = list[0].ordered;
    const ListTag = ordered ? "ol" : "ul";
    blocks.push(
      <ListTag key={`list-${blocks.length}`}>
        {list.map((item, index) => <li key={index}>{inlineMarkdown(item.text)}</li>)}
      </ListTag>,
    );
    list = [];
  }

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || ordered) {
      list.push({ text: (bullet?.[1] || ordered?.[1] || "").trim(), ordered: Boolean(ordered) });
      return;
    }
    flushList();
    if (!line.trim()) return;
    if (heading) {
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      blocks.push(<Tag key={`heading-${blocks.length}`}>{inlineMarkdown(heading[2])}</Tag>);
      return;
    }
    blocks.push(<p key={`p-${blocks.length}`}>{inlineMarkdown(line.trim())}</p>);
  });
  flushList();

  return <div className="markdown-answer">{blocks}</div>;
}
