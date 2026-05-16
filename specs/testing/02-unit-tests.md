# Unit Tests

## Tool

Vitest with `vitest.workspace.ts` discovering per-package configs.

## Conventions

- File naming: `<module>.test.ts` colocated with the module.
- One `describe` per module, nested `describe`s per function.
- Tests are independent; no order dependence.
- Use `vi.fn()` for spies; avoid `vi.mock` of large modules — refactor for injectability instead.

## Coverage gate

- Threshold on touched files: 90% lines, 80% branches.
- Coverage tool: `vitest --coverage` using `@vitest/coverage-v8`.
- CI gate enforced via `tools/coverage-gate.ts` that diffs touched files against `main` and applies the threshold.

## Forbidden

- `expect(true).toBe(true)` placeholder tests.
- Tests that assert internal implementation rather than behaviour (e.g. spying on a private function).
- Tests that read or write files outside `tests/__fixtures__` or `tests/tmp/`.

## Examples

### Service test (good)

```ts
describe('blocks.createMany', () => {
  it('assigns fractional positions in document order', async () => {
    const db = inMemoryDb();
    const blocks = await createMany(db, [{...}, {...}]);
    expect(blocks[0].position < blocks[1].position).toBe(true);
  });

  it('rolls back on invalid child type', async () => {
    const db = inMemoryDb();
    await expect(
      createMany(db, [{ type: 'column', /* under a paragraph */ }])
    ).rejects.toThrow(/parent_type_violation/);
    expect(await db.blocks.count()).toBe(0);
  });
});
```

### Pure function test (good)

```ts
describe('fractionalIndex.between', () => {
  it('returns a key strictly between inputs', () => {
    const k = between('a0', 'a1');
    expect(k > 'a0' && k < 'a1').toBe(true);
  });

  it('handles same-prefix neighbours', () => {
    expect(between('aaa', 'aab').startsWith('aa')).toBe(true);
  });

  it('throws on inverted inputs', () => {
    expect(() => between('a1', 'a0')).toThrow();
  });
});
```