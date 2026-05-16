const MAX_BYTES = 1_048_576; // 1 MB cap

interface ParsedBlock {
  type: string;
  [key: string]: unknown;
}

interface InlineNode {
  type: 'text';
  text: { content: string; link: { url: string } | null };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: 'default';
  };
  plain_text: string;
  href: string | null;
}

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: 'default' as const,
};

function makeText(content: string, link: string | null = null): InlineNode {
  return {
    type: 'text',
    text: { content, link: link === null ? null : { url: link } },
    annotations: { ...DEFAULT_ANNOTATIONS },
    plain_text: content,
    href: link,
  };
}

/**
 * Parse inline markdown into a rich-text array. Supports **bold**, *italic*,
 * `code`, [text](url). Simple greedy tokenizer; not a full CommonMark parser.
 */
function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;
  while (i < line.length) {
    // [link](url)
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)/.exec(line.slice(i));
    if (linkMatch) {
      const [whole, label = '', href = ''] = linkMatch;
      nodes.push(makeText(label, href));
      i += whole.length;
      continue;
    }
    // **bold**
    const boldMatch = /^\*\*([^*]+)\*\*/.exec(line.slice(i));
    if (boldMatch) {
      const [whole, body = ''] = boldMatch;
      const node = makeText(body);
      node.annotations.bold = true;
      nodes.push(node);
      i += whole.length;
      continue;
    }
    // *italic*
    const italicMatch = /^\*([^*]+)\*/.exec(line.slice(i));
    if (italicMatch) {
      const [whole, body = ''] = italicMatch;
      const node = makeText(body);
      node.annotations.italic = true;
      nodes.push(node);
      i += whole.length;
      continue;
    }
    // `code`
    const codeMatch = /^`([^`]+)`/.exec(line.slice(i));
    if (codeMatch) {
      const [whole, body = ''] = codeMatch;
      const node = makeText(body);
      node.annotations.code = true;
      nodes.push(node);
      i += whole.length;
      continue;
    }
    // Plain text up to next markup char.
    let j = i;
    while (j < line.length && !'`*['.includes(line[j] ?? '')) j += 1;
    if (j === i) j = i + 1;
    nodes.push(makeText(line.slice(i, j)));
    i = j;
  }
  // Coalesce adjacent unstyled text nodes.
  const merged: InlineNode[] = [];
  for (const n of nodes) {
    const last = merged.at(-1);
    if (
      last &&
      JSON.stringify(last.annotations) === JSON.stringify(n.annotations) &&
      last.text.link === null &&
      n.text.link === null
    ) {
      last.text.content += n.text.content;
      last.plain_text += n.plain_text;
    } else {
      merged.push(n);
    }
  }
  return merged;
}

/**
 * Parse a Markdown document into block inputs.
 * Returns `{ blocks }` where each block is `{ type, <type>: { ... } }` shape
 * accepted by the Blocks API's `AnyBlockInputSchema`.
 */
export function parseMarkdown(markdown: string): ParsedBlock[] {
  if (Buffer.byteLength(markdown, 'utf8') > MAX_BYTES) {
    throw new Error(`Markdown document exceeds ${MAX_BYTES} byte cap`);
  }
  const lines = markdown.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    // Code fence
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'plain text';
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // consume closing fence
      const codeText = body.join('\n');
      blocks.push({
        type: 'code',
        code: {
          rich_text: codeText.length > 0 ? [makeText(codeText)] : [],
          caption: [],
          language: lang,
        },
      });
      continue;
    }
    // Headings
    const h1 = /^# +(.*)$/.exec(line);
    if (h1) {
      blocks.push({
        type: 'heading_1',
        heading_1: { rich_text: parseInline(h1[1] ?? ''), color: 'default', is_toggleable: false },
      });
      i += 1;
      continue;
    }
    const h2 = /^## +(.*)$/.exec(line);
    if (h2) {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: parseInline(h2[1] ?? ''), color: 'default', is_toggleable: false },
      });
      i += 1;
      continue;
    }
    const h3 = /^### +(.*)$/.exec(line);
    if (h3) {
      blocks.push({
        type: 'heading_3',
        heading_3: { rich_text: parseInline(h3[1] ?? ''), color: 'default', is_toggleable: false },
      });
      i += 1;
      continue;
    }
    // Divider
    if (/^---+$/.test(line)) {
      blocks.push({ type: 'divider', divider: {} });
      i += 1;
      continue;
    }
    // To-do
    const todo = /^- \[( |x)\] +(.*)$/.exec(line);
    if (todo) {
      blocks.push({
        type: 'to_do',
        to_do: {
          rich_text: parseInline(todo[2] ?? ''),
          checked: todo[1] === 'x',
          color: 'default',
        },
      });
      i += 1;
      continue;
    }
    // Bulleted list
    const bullet = /^[-*] +(.*)$/.exec(line);
    if (bullet) {
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseInline(bullet[1] ?? ''), color: 'default' },
      });
      i += 1;
      continue;
    }
    // Numbered list
    const numbered = /^\d+\. +(.*)$/.exec(line);
    if (numbered) {
      blocks.push({
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseInline(numbered[1] ?? ''), color: 'default' },
      });
      i += 1;
      continue;
    }
    // Quote
    if (line.startsWith('> ')) {
      const body: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('> ')) {
        body.push((lines[i] ?? '').slice(2));
        i += 1;
      }
      blocks.push({
        type: 'quote',
        quote: { rich_text: parseInline(body.join('\n')), color: 'default' },
      });
      continue;
    }
    // Blank line — skip.
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    // Default: paragraph (one line).
    blocks.push({
      type: 'paragraph',
      paragraph: { rich_text: parseInline(line), color: 'default' },
    });
    i += 1;
  }
  return blocks;
}
