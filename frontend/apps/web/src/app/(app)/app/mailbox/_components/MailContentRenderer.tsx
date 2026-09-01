import { createElement, Fragment, type ReactNode } from 'react';

const ALLOWED_HTML_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'hr', 'span', 'div'
]);

const sanitizeUrl = (value: string | null | undefined) => {
  if (!value) return '#';
  try {
    const parsed = new URL(value, 'https://pantopus.local');
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:') {
      return value;
    }
    return '#';
  } catch {
    return '#';
  }
};

const renderSanitizedNode = (node: Node, key: string): ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const childNodes = Array.from(element.childNodes)
    .map((child, index) => renderSanitizedNode(child, `${key}-${index}`));

  if (!ALLOWED_HTML_TAGS.has(tag)) {
    return <Fragment key={key}>{childNodes}</Fragment>;
  }

  if (tag === 'a') {
    return (
      <a
        key={key}
        href={sanitizeUrl(element.getAttribute('href'))}
        target="_blank"
        rel="noopener noreferrer"
      >
        {childNodes}
      </a>
    );
  }

  return createElement(tag, { key }, childNodes);
};

export const renderSanitizedHtml = (htmlContent: string): ReactNode => {
  if (typeof window === 'undefined') {
    return htmlContent;
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(htmlContent || '', 'text/html');
  const bodyNodes = Array.from(parsed.body.childNodes);
  return bodyNodes.map((node, index) => renderSanitizedNode(node, `html-${index}`));
};

const renderInlineMarkdown = (text: string, keyPrefix: string): ReactNode[] => {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      out.push(
        <a
          key={`${keyPrefix}-link-${matchIndex}`}
          href={sanitizeUrl(match[3])}
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[2]}
        </a>
      );
    } else if (match[4] || match[5]) {
      out.push(<strong key={`${keyPrefix}-strong-${matchIndex}`}>{match[4] || match[5]}</strong>);
    } else if (match[6] || match[7]) {
      out.push(<em key={`${keyPrefix}-em-${matchIndex}`}>{match[6] || match[7]}</em>);
    } else if (match[8]) {
      out.push(<code key={`${keyPrefix}-code-${matchIndex}`}>{match[8]}</code>);
    }

    lastIndex = pattern.lastIndex;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }

  return out;
};

export const renderMarkdownSafe = (content: string): ReactNode[] => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const rendered: ReactNode[] = [];
  let index = 0;
  let keyIndex = 0;

  const nextKey = (prefix: string) => `${prefix}-${keyIndex++}`;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      rendered.push(
        <pre key={nextKey('codeblock')}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = `h${Math.min(6, level)}`;
      rendered.push(
        createElement(tag, { key: nextKey('heading') }, renderInlineMarkdown(headingMatch[2], nextKey('inline')))
      );
      index += 1;
      continue;
    }

    if (/^(-|\*)\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^(-|\*)\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^(-|\*)\s+/, ''));
        index += 1;
      }
      rendered.push(
        <ul key={nextKey('ul')}>
          {items.map((item, itemIndex) => (
            <li key={nextKey(`ul-li-${itemIndex}`)}>{renderInlineMarkdown(item, nextKey('inline'))}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      rendered.push(
        <ol key={nextKey('ol')}>
          {items.map((item, itemIndex) => (
            <li key={nextKey(`ol-li-${itemIndex}`)}>{renderInlineMarkdown(item, nextKey('inline'))}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quotes: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quotes.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      rendered.push(
        <blockquote key={nextKey('quote')}>
          {quotes.map((quote, quoteIndex) => (
            <p key={nextKey(`quote-p-${quoteIndex}`)}>{renderInlineMarkdown(quote, nextKey('inline'))}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      if (/^(#{1,6})\s+/.test(lines[index].trim())) break;
      if (/^(-|\*)\s+/.test(lines[index].trim())) break;
      if (/^\d+\.\s+/.test(lines[index].trim())) break;
      if (lines[index].trim().startsWith('>')) break;
      if (lines[index].trim().startsWith('```')) break;
      paragraphLines.push(lines[index]);
      index += 1;
    }

    const paragraph = paragraphLines.join(' ');
    rendered.push(
      <p key={nextKey('p')}>
        {renderInlineMarkdown(paragraph, nextKey('inline'))}
      </p>
    );
  }

  return rendered;
};

export default function MailContentRenderer({ content, format }: {
  content: string;
  format?: 'plain_text' | 'markdown' | 'html' | null;
}) {
  if (format === 'html' || (!format && content.includes('<'))) {
    return <div>{renderSanitizedHtml(content)}</div>;
  }

  if (format === 'markdown') {
    return <div>{renderMarkdownSafe(content)}</div>;
  }

  return <div className="whitespace-pre-wrap">{content}</div>;
}
