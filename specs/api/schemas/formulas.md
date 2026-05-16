# Formula Grammar

Mirrors Notion's Formula 2.0.

## Top-level

A formula is a single expression that evaluates to a value of type `string`, `number`, `boolean`, or `date` (Notion's exposed Formula type union).

## Lexical grammar

- Identifiers: `prop("Name")` is the canonical accessor for a property.
- Literals: numeric (`42`, `3.14`, `1e3`), string (`"text"` — double quotes only), boolean (`true`, `false`), date via `dateBetween` or function literal.
- Comments: `//` to end of line.

## Operators

Arithmetic: `+`, `-`, `*`, `/`, `%`, `^`
Comparison: `==`, `!=`, `<`, `<=`, `>`, `>=`
Logical: `and`, `or`, `not`
Ternary: `condition ? a : b`
String concat: `+` between strings (implicit coercion via `format()`).

## Functions

### Arithmetic
`abs(n)`, `ceil(n)`, `floor(n)`, `round(n)`, `sign(n)`, `sqrt(n)`, `cbrt(n)`, `log10(n)`, `ln(n)`, `exp(n)`, `pow(a,b)`, `max(...n)`, `min(...n)`, `mod(a,b)`

### String
`length(s)`, `substring(s, start, end?)`, `concat(...s)`, `format(value)`, `replace(s, pat, rep)`, `replaceAll(s, pat, rep)`, `contains(s, sub)`, `test(s, regex)`, `match(s, regex)`, `slice(s, a, b?)`, `lower(s)`, `upper(s)`

### Boolean
`if(cond, a, b)`, `and(...b)`, `or(...b)`, `not(b)`, `empty(v)`

### Date
`now()`, `today()`
`date(year, month, day)`, `dateBetween(a, b, unit)` where unit is `"years"|"months"|"weeks"|"days"|"hours"|"minutes"|"seconds"|"milliseconds"`
`dateAdd(d, n, unit)`, `dateSubtract(d, n, unit)`, `dateRange(start, end)`
`formatDate(d, fmt)`, `start(range)`, `end(range)`
`year(d)`, `month(d)`, `day(d)`, `hour(d)`, `minute(d)`, `second(d)`, `timestamp(d)`, `fromTimestamp(ms)`

### List / array (rollup return)
`length(arr)`, `at(arr, i)`, `first(arr)`, `last(arr)`, `slice(arr, a, b?)`, `map(arr, fn)`, `filter(arr, fn)`, `find(arr, fn)`, `every(arr, fn)`, `some(arr, fn)`, `unique(arr)`, `sort(arr)`, `reverse(arr)`, `flat(arr)`, `sum(arr)`, `mean(arr)`, `median(arr)`, `min(arr)`, `max(arr)`

### Type
`type(v)` → `"string"|"number"|"boolean"|"date"|"list"`

## `prop(name)`

Returns the property value of the page evaluated. For non-scalar properties (`relation`, `rollup`, `people`, `files`, `multi_select`), returns the structured list; functions like `length`, `at`, `map` are appropriate.

## Evaluation semantics

- Eager evaluation.
- Type coercion: explicit only — use `format()` to stringify numbers/dates.
- Errors during eval (divide-by-zero, type mismatch) produce a `formula.type = "string"` value with the value `""` and surface an `evaluation_error` annotation in the property item retrieve endpoint.

## Compilation

- Parser: PEG grammar in `packages/db/src/formula/parser.ts`.
- Compiler: AST → typed IR with type inference; rejects expressions whose top-level type is ambiguous (400 at database-property-create time).
- Executor: stateless evaluator in `packages/db/src/formula/eval.ts`.
- Tests: golden suite of ≥ 200 expressions covering every function, including failure modes.