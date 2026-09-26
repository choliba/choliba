import { indexDiff, parseDiffBlock } from '../../git/index-diff';

const SAMPLE = `diff --git a/packages/foo.ts b/packages/foo.ts
index 111..222 100644
--- a/packages/foo.ts
+++ b/packages/foo.ts
@@ -1 +1,2 @@
 const x = 1;
+const y = 2;
diff --git a/docs/new.md b/docs/new.md
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/docs/new.md
@@ -0,0 +1 @@
+# New
diff --git a/old.txt b/old.txt
deleted file mode 100644
index 4444444..0000000
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-gone
diff --git a/a.txt b/b.txt
similarity index 100%
rename from a.txt
rename to b.txt
`;

describe('indexDiff', () => {
  it('indexes each file block with status, line and size', () => {
    const entries = indexDiff(SAMPLE);

    expect(entries).toEqual([
      { status: 'M', path: 'packages/foo.ts', line: 1, lines: 7 },
      { status: 'A', path: 'docs/new.md', line: 8, lines: 7 },
      { status: 'D', path: 'old.txt', line: 15, lines: 7 },
      { status: 'R', path: 'a.txt -> b.txt', line: 22, lines: 5 },
    ]);
  });

  it('returns an empty list for an empty diff', () => {
    expect(indexDiff('')).toEqual([]);
  });

  it('handles malformed diff headers with empty paths', () => {
    expect(indexDiff('diff --git broken\n+++ b/foo.ts\n')).toEqual([{ status: 'M', path: '', line: 1, lines: 3 }]);
  });

  it('falls back to the old path when the new path is missing from the header', () => {
    expect(indexDiff('diff --git a/legacy b/legacy\n')).toEqual([{ status: 'M', path: 'legacy', line: 1, lines: 2 }]);
  });
});

describe('parseDiffBlock', () => {
  it('returns empty paths when the block has no header line', () => {
    expect(parseDiffBlock([], 4, 4)).toEqual({ status: 'M', path: '', line: 5, lines: 0 });
  });
});
