import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { SyncChange } from '@private-bookmarks/sync-protocol';
import type { Db } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { applySync } from '../sync/service.js';
import { buildTree, listLiveNodes, type BookmarkRecord, type TreeNode } from '../bookmarks/tree.js';
import {
  countImportedNodes,
  parseNetscape,
  serializeNetscape,
  type ImportedFolder,
  type ImportedNode,
} from './netscape.js';

/** 导入数据写入独立的 "import" 客户端命名空间，绝不覆盖浏览器同步数据 */
const IMPORT_CLIENT_ID = 'import';
const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;

function newRemoteId(): string {
  return `imp-${randomBytes(8).toString('hex')}`;
}

interface ImportContext {
  changes: SyncChange[];
  /** 已存在的书签 URL（import 命名空间内去重） */
  existingUrls: Set<string>;
  /** 已存在/本次创建的文件夹 (parentId \u0000 title) → remoteId */
  folderIndex: Map<string, string>;
  createdUrls: Set<string>;
  skipped: number;
}

/**
 * 将导入树转换为 sync changes：
 * - 文件夹按（父 + 同名）合并，重复导入不会产生重复文件夹
 * - 书签按 URL 去重，追加不覆盖
 */
function importedToChanges(roots: ImportedNode[], ctx: ImportContext, parentId: string): void {
  let position = 0;
  for (const node of roots) {
    if (node.type === 'folder') {
      const key = `${parentId}\u0000${node.title}`;
      let folderId = ctx.folderIndex.get(key);
      if (!folderId) {
        folderId = newRemoteId();
        ctx.folderIndex.set(key, folderId);
        ctx.changes.push({
          remoteId: folderId,
          action: 'upsert',
          type: 'folder',
          parentId,
          title: node.title,
          url: null,
          position: position++,
        });
      }
      importedToChanges(node.children, ctx, folderId);
      continue;
    }

    const url = node.url;
    if (ctx.existingUrls.has(url) || ctx.createdUrls.has(url)) {
      ctx.skipped++;
      continue;
    }
    ctx.createdUrls.add(url);
    ctx.changes.push({
      remoteId: newRemoteId(),
      action: 'upsert',
      type: 'bookmark',
      parentId,
      title: node.title,
      url,
      position: position++,
      dateAdded: node.dateAdded,
    });
  }
}

function treeNodeToImported(node: TreeNode): ImportedNode {
  if (node.type === 'folder') {
    const folder: ImportedFolder = {
      type: 'folder',
      title: node.title || '未命名文件夹',
      children: node.children.map(treeNodeToImported),
    };
    return folder;
  }
  return {
    type: 'bookmark',
    title: node.title,
    url: node.url ?? '',
    dateAdded: Date.parse(node.createdAt) || undefined,
  };
}

function rowsToImportedRoots(rows: BookmarkRecord[]): ImportedNode[] {
  return buildTree(rows).map(treeNodeToImported);
}

export function registerImportExportRoutes(app: FastifyInstance, db: Db): void {
  // 第一步：上传 HTML → 解析预览
  app.post('/api/import/preview', {
    preHandler: app.requireSession,
    async handler(request, reply) {
      const file = await request.file({ limits: { fileSize: MAX_IMPORT_FILE_BYTES } });
      if (!file) throw AppError.invalidPayload('multipart file field "file" is required');
      const buffer = await file.toBuffer();
      const result = parseNetscape(buffer.toString('utf-8'));
      const counts = countImportedNodes(result.roots);
      reply.header('Cache-Control', 'no-store');
      return {
        roots: result.roots,
        bookmarkCount: counts.bookmarkCount,
        folderCount: counts.folderCount,
        skipped: result.skipped,
      };
    },
  });

  // 第二步：确认导入（客户端将预览返回的 roots 原样提交）
  app.post('/api/import', {
    preHandler: app.requireSession,
    async handler(request) {
      const body = request.body as { roots?: unknown } | null;
      const roots = body?.roots;
      if (!Array.isArray(roots)) throw AppError.invalidPayload('roots array is required');
      if (roots.length > 10_000) throw AppError.invalidPayload('too many roots');

      // import 命名空间内已有数据，用于去重与文件夹合并
      const existing = listLiveNodes(db, IMPORT_CLIENT_ID);
      const existingUrls = new Set(existing.filter((r) => r.url).map((r) => r.url as string));
      const folderIndex = new Map<string, string>();
      for (const row of existing) {
        if (row.type === 'folder') folderIndex.set(`${row.parentId}\u0000${row.title}`, row.remoteId);
      }

      const ctx: ImportContext = {
        changes: [],
        existingUrls,
        folderIndex,
        createdUrls: new Set(),
        skipped: 0,
      };
      importedToChanges(roots as ImportedNode[], ctx, '0');

      if (ctx.changes.length === 0) {
        return { success: true, created: 0, updated: 0, deleted: 0, unchanged: 0, skipped: ctx.skipped, serverVersion: 0 };
      }
      const stats = applySync(db, { clientId: IMPORT_CLIENT_ID, mode: 'incremental', changes: ctx.changes });
      request.log.info({ created: stats.created, skipped: stats.skipped }, 'import completed');
      return { ...stats, success: true };
    },
  });

  // 导出 bookmarks.html（Chrome 兼容格式）
  app.get('/api/export', {
    preHandler: app.requireSession,
    async handler(request, reply) {
      const query = request.query as Record<string, unknown>;
      const format = query['format'] === 'json' ? 'json' : 'html';
      const client = typeof query['client'] === 'string' && query['client'] !== 'all' ? query['client'].slice(0, 128) : undefined;

      const rows = listLiveNodes(db, client);
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === 'json') {
        const payload = {
          exportedAt: new Date().toISOString(),
          client: client ?? 'all',
          nodes: rows.map((row) => ({
            clientId: row.clientId,
            remoteId: row.remoteId,
            parentId: row.parentId,
            type: row.type,
            title: row.title,
            url: row.url,
            position: row.position,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        };
        reply.header('Content-Type', 'application/json; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="bookmarks-${stamp}.json"`);
        return payload;
      }

      let roots: ImportedNode[];
      if (client) {
        roots = rowsToImportedRoots(rows);
      } else {
        // 导出全部时按客户端分组包装，避免不同设备的同名文件夹互相混淆
        const byClient = new Map<string, BookmarkRecord[]>();
        for (const row of rows) {
          const list = byClient.get(row.clientId) ?? [];
          list.push(row);
          byClient.set(row.clientId, list);
        }
        roots = [];
        for (const [clientId, clientRows] of byClient) {
          const label = clientId === IMPORT_CLIENT_ID ? '导入的书签' : `设备 ${clientId.slice(0, 8)}`;
          roots.push({
            type: 'folder',
            title: label,
            children: rowsToImportedRoots(clientRows),
          });
        }
      }

      const html = serializeNetscape(roots, 'Bookmarks');
      reply.header('Content-Type', 'text/html; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="bookmarks-${stamp}.html"`);
      return html;
    },
  });
}
