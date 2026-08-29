import React from 'react';
import type { BookmarkNode } from '@private-bookmarks/shared';

/** favicon 加载失败时回退为默认图标，不影响书签功能 */
export function Favicon({ node }: { node: BookmarkNode }) {
  const [failed, setFailed] = React.useState(false);
  if (node.type === 'folder') {
    return (
      <span className="bookmark-icon" aria-hidden>
        📁
      </span>
    );
  }
  if (failed || !node.faviconUrl) {
    return (
      <span className="bookmark-icon" aria-hidden>
        🌐
      </span>
    );
  }
  return (
    <img
      className="bookmark-icon bookmark-favicon"
      src={node.faviconUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function BookmarkLink({ node }: { node: BookmarkNode }) {
  if (node.type === 'folder') return null;
  return (
    <a
      className="bookmark-link"
      href={node.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => {
        if (!node.url || !(node.url.startsWith('http://') || node.url.startsWith('https://'))) {
          e.preventDefault();
        }
      }}
    >
      {node.title || node.url}
    </a>
  );
}
