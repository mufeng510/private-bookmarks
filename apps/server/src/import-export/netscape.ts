/**
 * Netscape Bookmark HTML（Chrome/Firefox 书签导出格式）的解析与序列化。
 * 支持 UTF-8、中文标题、嵌套文件夹。
 */

export interface ImportedBookmark {
  type: 'bookmark';
  title: string;
  url: string;
  /** 毫秒时间戳（来自 ADD_DATE） */
  dateAdded?: number;
}

export interface ImportedFolder {
  type: 'folder';
  title: string;
  children: ImportedNode[];
}

export type ImportedNode = ImportedBookmark | ImportedFolder;

export interface ParseResult {
  roots: ImportedNode[];
  bookmarkCount: number;
  folderCount: number;
  /** 因协议不安全（如 javascript:）或格式问题被跳过的条目数 */
  skipped: number;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
      return match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractAttrs(tagBody: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrRe = /([a-zA-Z_][\w:-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(tagBody)) !== null) {
    attrs.set(m[1]!.toUpperCase(), decodeEntities(m[2] ?? ''));
  }
  return attrs;
}

const FOLDER_RE = /^<DT><H3([^>]*)>([\s\S]*?)<\/H3>/i;
const BOOKMARK_RE = /^<DT><A\s([^>]*)>([\s\S]*?)<\/A>/i;
const DL_OPEN_RE = /^<DL/i;
const DL_CLOSE_RE = /^<\/DL/i;

/** 解析 Netscape 书签 HTML，只接受 http/https URL */
export function parseNetscape(html: string): ParseResult {
  // 归一化：把 <DL>/<DT> 拆到独立行，兼容各种导出器的换行习惯
  const content = html
    .replace(/^\uFEFF/, '')
    .replace(/<DL[^>]*>/gi, '\n<DL>\n')
    .replace(/<\/DL[^>]*>/gi, '\n</DL>\n')
    .replace(/<DT\b/gi, '\n<DT');
  const lines = content.split(/\r?\n/);

  const roots: ImportedNode[] = [];
  const stack: ImportedFolder[] = [];
  let bookmarkCount = 0;
  let folderCount = 0;
  let skipped = 0;
  let folderPendingDl = false;

  const currentChildren = (): ImportedNode[] => (stack.length > 0 ? stack[stack.length - 1]!.children : roots);
  const pushFolder = (folder: ImportedFolder): void => {
    currentChildren().push(folder);
    stack.push(folder);
    folderPendingDl = true;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const folderMatch = FOLDER_RE.exec(line);
    if (folderMatch) {
      const title = decodeEntities(folderMatch[2] ?? '').trim() || '未命名文件夹';
      pushFolder({ type: 'folder', title, children: [] });
      folderCount++;
      continue;
    }

    const bookmarkMatch = BOOKMARK_RE.exec(line);
    if (bookmarkMatch) {
      // 某些导出器文件夹后没有 <DL>，遇到下一条目时先弹出
      if (folderPendingDl && stack.length > 0) {
        stack.pop();
        folderPendingDl = false;
      }
      const attrs = extractAttrs(bookmarkMatch[1] ?? '');
      const url = attrs.get('HREF') ?? '';
      const title = decodeEntities(bookmarkMatch[2] ?? '').trim() || url;
      if (!url || !isSafeHttpUrl(url)) {
        skipped++;
        continue;
      }
      const addDate = Number(attrs.get('ADD_DATE'));
      currentChildren().push({
        type: 'bookmark',
        title,
        url,
        dateAdded: Number.isFinite(addDate) && addDate > 0 ? addDate * 1000 : undefined,
      });
      bookmarkCount++;
      continue;
    }

    if (DL_OPEN_RE.test(line)) {
      folderPendingDl = false;
      continue;
    }
    if (DL_CLOSE_RE.test(line)) {
      if (stack.length > 0) stack.pop();
      folderPendingDl = false;
      continue;
    }
  }

  return { roots, bookmarkCount, folderCount, skipped };
}

function serializeNode(node: ImportedNode, indent: string, out: string[]): void {
  if (node.type === 'folder') {
    out.push(`${indent}<DT><H3>${escapeHtml(node.title)}</H3>`);
    out.push(`${indent}<DL><p>`);
    for (const child of node.children) serializeNode(child, `${indent}    `, out);
    out.push(`${indent}</DL><p>`);
    return;
  }
  const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';
  out.push(`${indent}<DT><A HREF="${escapeHtml(node.url)}"${addDate}>${escapeHtml(node.title)}</A>`);
}

/** 序列化为 Chrome 兼容的 bookmarks.html（可直接导入 Chrome） */
export function serializeNetscape(roots: ImportedNode[], title = 'Bookmarks'): string {
  const out: string[] = [];
  out.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  out.push('<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->');
  out.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  out.push(`<TITLE>${escapeHtml(title)}</TITLE>`);
  out.push(`<H1>${escapeHtml(title)}</H1>`);
  out.push('<DL><p>');
  for (const node of roots) serializeNode(node, '    ', out);
  out.push('</DL><p>');
  return out.join('\n');
}

/** 统计导入树规模 */
export function countImportedNodes(roots: ImportedNode[]): { bookmarkCount: number; folderCount: number } {
  let bookmarkCount = 0;
  let folderCount = 0;
  const walk = (nodes: ImportedNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'folder') {
        folderCount++;
        walk(node.children);
      } else {
        bookmarkCount++;
      }
    }
  };
  walk(roots);
  return { bookmarkCount, folderCount };
}
