import { type ClientHandle, listChildren } from '@bloc/db';

interface RichTextLike {
  type: 'text' | 'mention' | 'equation';
  plain_text?: string;
  text?: { content: string; link?: { url: string } | null };
  equation?: { expression: string };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
}

function renderRichText(nodes: RichTextLike[]): string {
  return nodes
    .map((n) => {
      let content =
        n.type === 'equation'
          ? `$${n.equation?.expression ?? ''}$`
          : (n.text?.content ?? n.plain_text ?? '');
      if (n.annotations?.code) content = `\`${content}\``;
      if (n.annotations?.bold) content = `**${content}**`;
      if (n.annotations?.italic) content = `*${content}*`;
      if (n.annotations?.strikethrough) content = `~~${content}~~`;
      if (n.annotations?.underline) content = `<u>${content}</u>`;
      if (n.text?.link?.url) content = `[${content}](${n.text.link.url})`;
      return content;
    })
    .join('');
}

interface ExportRowLike {
  id: string;
  type: string;
  content: Record<string, unknown>;
  parentId: string;
}

function payloadOf(block: { type: string; content: Record<string, unknown> }): Record<
  string,
  unknown
> {
  const inner = block.content[block.type];
  if (inner !== undefined && inner !== null && typeof inner === 'object') {
    return inner as Record<string, unknown>;
  }
  return block.content;
}

function escapeTableCell(text: string): string {
  // Markdown table cells: escape pipes and collapse newlines.
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Render a table block by fetching its table_row children and emitting markdown rows. */
async function renderTable(handle: ClientHandle, tableBlock: ExportRowLike): Promise<string> {
  const payload = payloadOf(tableBlock);
  const width = Number(payload['table_width'] ?? 0) || 0;
  const hasHeader = payload['has_column_header'] === true;
  const rows = (await listChildren(handle.db, tableBlock.id, { limit: 500 })) as ExportRowLike[];
  const tableRows = rows.filter((r) => r.type === 'table_row');
  if (tableRows.length === 0) return '';
  const firstRow = tableRows[0];
  const colCount =
    width > 0
      ? width
      : firstRow !== undefined
        ? ((payloadOf(firstRow)['cells'] as unknown[] | undefined)?.length ?? 0)
        : 0;
  if (colCount === 0) return '';
  const cellLines: string[][] = [];
  for (const row of tableRows) {
    const cells = (payloadOf(row)['cells'] as RichTextLike[][] | undefined) ?? [];
    const line: string[] = [];
    for (let i = 0; i < colCount; i++) {
      line.push(escapeTableCell(renderRichText(cells[i] ?? [])));
    }
    cellLines.push(line);
  }
  const headerRow =
    hasHeader && cellLines[0] !== undefined
      ? cellLines[0]
      : Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
  const dataRows = hasHeader ? cellLines.slice(1) : cellLines;
  const lines: string[] = [];
  lines.push(`| ${headerRow.join(' | ')} |`);
  lines.push(`| ${headerRow.map(() => '---').join(' | ')} |`);
  for (const r of dataRows) lines.push(`| ${r.join(' | ')} |`);
  return lines.join('\n');
}

/** Render a single block to a Markdown string (excluding children — caller recurses). */
async function renderBlock(
  handle: ClientHandle,
  block: ExportRowLike,
  numberedCounters: Map<string, number>,
  parentKey: string,
): Promise<string> {
  const t = block.type;
  const p = payloadOf(block);
  const text = renderRichText((p['rich_text'] as RichTextLike[] | undefined) ?? []);
  switch (t) {
    case 'paragraph':
      return text === '' ? '' : text;
    case 'heading_1':
      return `# ${text}`;
    case 'heading_2':
      return `## ${text}`;
    case 'heading_3':
      return `### ${text}`;
    case 'bulleted_list_item':
      return `- ${text}`;
    case 'numbered_list_item': {
      const n = (numberedCounters.get(parentKey) ?? 0) + 1;
      numberedCounters.set(parentKey, n);
      return `${n}. ${text}`;
    }
    case 'to_do':
      return `- [${p['checked'] ? 'x' : ' '}] ${text}`;
    case 'toggle':
      return `<details><summary>${text}</summary></details>`;
    case 'quote':
      return text
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    case 'divider':
      return '---';
    case 'callout': {
      // GitHub-flavored alert: `> [!NOTE]` with body on the next line.
      return `> [!NOTE]\n> ${text}`;
    }
    case 'code': {
      const lang = (p['language'] as string) ?? '';
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }
    case 'equation':
      return `$$${(p['expression'] as string) ?? ''}$$`;
    case 'image': {
      const url =
        (p['external'] as { url?: string } | undefined)?.url ??
        (p['file'] as { url?: string } | undefined)?.url ??
        '';
      const caption = renderRichText((p['caption'] as RichTextLike[] | undefined) ?? []);
      return `![${caption}](${url})`;
    }
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = (p['url'] as string) ?? '';
      return `[${url}](${url})`;
    }
    case 'link_to_page': {
      const id = (p['page_id'] as string) ?? (p['database_id'] as string) ?? '';
      return `[→ ${id}](#${id})`;
    }
    case 'breadcrumb':
      return '_(breadcrumb)_';
    case 'table_of_contents':
      return '_(table of contents)_';
    case 'child_page':
      return `[📄 ${(p['title'] as string) ?? 'Untitled'}](#)`;
    case 'child_database':
      return `[⌗ ${(p['title'] as string) ?? 'Untitled'}](#)`;
    case 'table':
      return renderTable(handle, block);
    case 'table_row': {
      const cells = (p['cells'] as RichTextLike[][] | undefined) ?? [];
      return `| ${cells.map((c) => escapeTableCell(renderRichText(c))).join(' | ')} |`;
    }
    default:
      return `<!-- unsupported block: ${t} -->`;
  }
}

export interface MarkdownExportOptions {
  /** Maximum depth to recurse into block children. Defaults to 6. */
  maxDepth?: number;
}

/** Recursively serialise a page (or block) subtree to Markdown. */
export async function exportPageAsMarkdown(
  handle: ClientHandle,
  pageId: string,
  options: MarkdownExportOptions = {},
): Promise<string> {
  const maxDepth = options.maxDepth ?? 6;
  const lines: string[] = [];
  const numberedCounters = new Map<string, number>();
  await walk(handle, pageId, 0, lines, numberedCounters, maxDepth);
  return lines.join('\n\n');
}

async function walk(
  handle: ClientHandle,
  parentId: string,
  depth: number,
  out: string[],
  counters: Map<string, number>,
  maxDepth: number,
): Promise<void> {
  if (depth > maxDepth) return;
  // Reset numbered list counter when crossing parent boundaries.
  counters.set(parentId, 0);
  const children = (await listChildren(handle.db, parentId, { limit: 500 })) as ExportRowLike[];
  for (const child of children) {
    const rendered = await renderBlock(handle, child, counters, parentId);
    const indent = '  '.repeat(Math.max(0, depth));
    if (rendered !== '') {
      out.push(
        rendered
          .split('\n')
          .map((l) => (indent !== '' ? indent + l : l))
          .join('\n'),
      );
    }
    // Recurse into children for container blocks. Skip `table` — renderTable
    // already consumed its table_row children.
    const container = [
      'paragraph',
      'bulleted_list_item',
      'numbered_list_item',
      'to_do',
      'toggle',
      'quote',
      'callout',
      'column_list',
      'column',
      'synced_block',
      'template',
    ];
    if (container.includes(child.type)) {
      await walk(handle, child.id, depth + 1, out, counters, maxDepth);
    }
  }
}
