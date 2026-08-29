import { describe, it, expect } from 'vitest';
import { parseNetscape, serializeNetscape, decodeEntities, escapeHtml, type ImportedFolder, type ImportedBookmark } from './import-export/netscape.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1690000000" LAST_MODIFIED="1690000100" PERSONAL_TOOLBAR_FOLDER="true">书签栏</H3>
    <DL><p>
        <DT><H3 ADD_DATE="1690000000">AI &amp; 开发</H3>
        <DL><p>
            <DT><A HREF="https://github.com/" ADD_DATE="1690000001">GitHub</A>
            <DT><A HREF="https://claude.ai/" ADD_DATE="1690000002" ICON="data:image/png;base64,xxx">Claude &lt;AI&gt;</A>
        </DL><p>
        <DT><A HREF="https://example.com/" ADD_DATE="1690000003">示例 &quot;站点&quot;</A>
    </DL><p>
    <DT><H3>空文件夹</H3>
    <DL><p>
    </DL><p>
</DL><p>
</DL><p>
`;

describe('Netscape HTML 解析', () => {
  it('解析中文、嵌套文件夹、实体与属性', () => {
    const result = parseNetscape(SAMPLE);
    expect(result.skipped).toBe(0);
    expect(result.bookmarkCount).toBe(3);
    expect(result.folderCount).toBe(3);

    const bar = result.roots[0] as ImportedFolder;
    expect(bar.title).toBe('书签栏');
    const ai = bar.children[0] as ImportedFolder;
    expect(ai.title).toBe('AI & 开发');
    const github = ai.children[0] as ImportedBookmark;
    expect(github.title).toBe('GitHub');
    expect(github.url).toBe('https://github.com/');
    expect(github.dateAdded).toBe(1690000001000);

    const claude = ai.children[1] as ImportedBookmark;
    expect(claude.title).toBe('Claude <AI>');

    const example = bar.children[1] as ImportedBookmark;
    expect(example.title).toBe('示例 "站点"');
  });

  it('拒绝 javascript:/data: URL 并计入 skipped', () => {
    const result = parseNetscape(`
      <DL><p>
        <DT><A HREF="javascript:alert(1)">bad</A>
        <DT><A HREF="data:text/html,x">worse</A>
        <DT><A HREF="https://ok.com">good</A>
      </DL><p>`);
    expect(result.skipped).toBe(2);
    expect(result.bookmarkCount).toBe(1);
  });

  it('无标题书签回退为 URL', () => {
    const result = parseNetscape(`<DL><p><DT><A HREF="https://notitle.com"></A></DL><p>`);
    expect(result.roots[0]!.title).toBe('https://notitle.com');
  });
});

describe('Netscape HTML 序列化', () => {
  it('序列化 → 解析 round-trip 保持结构', () => {
    const tree = [
      {
        type: 'folder' as const,
        title: '书签栏',
        children: [
          { type: 'folder' as const, title: '开发', children: [{ type: 'bookmark' as const, title: 'GitHub <PRO>', url: 'https://github.com', dateAdded: 1690000001000 }] },
          { type: 'bookmark' as const, title: '中文 & 特殊"字符"', url: 'https://example.com/?a=1&b=2' },
        ],
      },
    ];
    const html = serializeNetscape(tree);
    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(html).toContain('charset=UTF-8');

    const parsed = parseNetscape(html);
    expect(parsed.bookmarkCount).toBe(2);
    expect(parsed.folderCount).toBe(2);

    const bar = parsed.roots[0] as ImportedFolder;
    expect(bar.title).toBe('书签栏');
    const dev = bar.children[0] as ImportedFolder;
    expect(dev.title).toBe('开发');
    const gh = dev.children[0] as ImportedBookmark;
    expect(gh.url).toBe('https://github.com');
  });

  it('实体编解码', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    expect(decodeEntities('&lt;div&gt; &amp; &quot;q&quot; &#39;s&#39; &#x4e2d;')).toBe(`<div> & "q" 's' 中`);
  });
});
