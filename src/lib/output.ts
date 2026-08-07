export type OutputFormat = "json" | "table";

export function getOutputFormat(value: string | undefined): OutputFormat {
  if (value === "json") return "json";
  return "table";
}

export function printOutput(data: unknown, format: OutputFormat): void {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log("(no rows)");
      return;
    }
    printTable(data as Record<string, unknown>[]);
    return;
  }
  if (data && typeof data === "object") {
    printKeyValue(data as Record<string, unknown>);
    return;
  }
  console.log(String(data));
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function printTable(rows: Record<string, unknown>[]): void {
  const cols = Array.from(
    rows.reduce((set, row) => {
      for (const k of Object.keys(row)) set.add(k);
      return set;
    }, new Set<string>()),
  );
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => fmt(r[c]).length)),
  );
  const header = cols.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  const sep = cols.map((_, i) => "-".repeat(widths[i]!)).join("  ");
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    console.log(cols.map((c, i) => fmt(row[c]).padEnd(widths[i]!)).join("  "));
  }
}

function printKeyValue(obj: Record<string, unknown>): void {
  const keys = Object.keys(obj);
  const width = Math.max(...keys.map((k) => k.length));
  for (const k of keys) {
    console.log(`${k.padEnd(width)}  ${fmt(obj[k])}`);
  }
}
