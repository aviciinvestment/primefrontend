import { type ReactNode } from 'react';

/**
 * Minimal, safe markdown renderer.
 * Renders: bold, italic, headings (as bold), bullet lists, links, inline code.
 * Handles the AI analysis content without showing raw asterisks.
 */

// The assistant sometimes replies with HTML tags (e.g. <a href>, <b>, <br>,
// <li>) mixed with markdown. Convert the common HTML patterns into equivalent
// markdown tokens so the renderer below shows clean formatting — never raw tags.
// Text is only ever rendered as React nodes (no dangerouslySetInnerHTML), so
// any tag we fail to recognise is simply stripped.
const stripTags = (s: string): string => s.replace(/<[^>]*>/g, '');

const normalizeHtml = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<a\s+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
      const label = stripTags(inner.trim());
      return label ? `[${label}](${href})` : href;
    })
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_m, inner) => `**${stripTags(inner)}**`)
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_m, inner) => `**${stripTags(inner)}**`)
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_m, inner) => `*${stripTags(inner)}*`)
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_m, inner) => `*${stripTags(inner)}*`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner) => `\`${stripTags(inner)}\``)
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_m, inner) => `**${stripTags(inner)}**`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(ul|ol|div)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');
const inline = (segment: string, keyPrefix: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  const regex =
    /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|`[^`]+`|#{1,6}\s[^#\n]+)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let innerKey = 0;

  while ((match = regex.exec(segment)) !== null) {
    if (match.index > lastIdx) {
      parts.push(segment.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-b${innerKey++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={`${keyPrefix}-i${innerKey++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={`${keyPrefix}-a${innerKey++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#84cc16] underline underline-offset-2 hover:text-white transition-colors break-all"
          >
            {linkMatch[1]}
          </a>
        );
      }
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={`${keyPrefix}-c${innerKey++}`} className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-[#84cc16]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('#')) {
      // Headings: render as bold line
      parts.push(
        <strong key={`${keyPrefix}-h${innerKey++}`} className="block mt-3 mb-1">
          {token.replace(/^#+\s*/, '')}
        </strong>
      );
    }
    lastIdx = match.index + token.length;
  }
  if (lastIdx < segment.length) parts.push(segment.slice(lastIdx));
  return parts;
};

export default function MarkdownView({ text, className = '' }: { text: string; className?: string }) {
  const paragraphs = normalizeHtml(text).split('\n');
  const nodes: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length > 0) {
      nodes.push(
        <ul key={`ul-${key++}`} className="my-2 space-y-1 pl-4 list-disc text-[13px] leading-relaxed">
          {listBuffer}
        </ul>
      );
      listBuffer = [];
    }
  };

  for (const line of paragraphs) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listBuffer.push(
        <li key={`li-${key++}`}>{inline(trimmed.slice(2), `li-${key}`)}</li>
      );
    } else if (trimmed === '') {
      flushList();
    } else {
      flushList();
      nodes.push(
        <p key={`p-${key++}`} className="mb-2 text-[13px] leading-relaxed">
          {inline(line, `p-${key}`)}
        </p>
      );
    }
  }
  flushList();

  return <div className={className}>{nodes}</div>;
}