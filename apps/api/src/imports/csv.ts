const MAX_BYTES = 10_485_760; // 10 MB cap
const MAX_ROWS = 10_000;

export interface CsvParsed {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(csv: string): CsvParsed {
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) {
    throw new Error(`CSV exceeds ${MAX_BYTES} byte cap`);
  }
  const rows: string[][] = [];
  let i = 0;
  let cur: string[] = [];
  let cell = '';
  let inQuotes = false;
  while (i < csv.length) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      cur.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      cur.push(cell);
      cell = '';
      if (cur.length > 0 && !(cur.length === 1 && cur[0] === '')) {
        rows.push(cur);
        if (rows.length > MAX_ROWS) {
          throw new Error(`CSV exceeds ${MAX_ROWS} row cap`);
        }
      }
      cur = [];
      // CRLF
      if (ch === '\r' && csv[i + 1] === '\n') i += 2;
      else i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Final cell
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell);
    if (cur.length > 0 && !(cur.length === 1 && cur[0] === '')) {
      rows.push(cur);
    }
  }
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const out: Record<string, string>[] = [];
  for (const r of dataRows) {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    out.push(obj);
  }
  return { headers, rows: out };
}
