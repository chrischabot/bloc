# Formulas

Bloc's formula language is a faithful implementation of Notion's. Formula expressions are stored on the property schema as `formula.expression` (a string) and evaluated per row.

## Types

A formula evaluates to one of four types:

- `string`
- `number`
- `boolean`
- `date`

Bloc infers the result type from the expression; the inferred type is exposed on the schema as `formula.type`.

## Literals

| Form | Type |
|---|---|
| `"hello"` | string |
| `42` | number |
| `3.14` | number |
| `true`, `false` | boolean |
| `now()`, `start(prop("Date"))` | date |

## Property reference

```
prop("Name")
```

Quotes are required. Property names are case-sensitive.

## Operators

| Operator | Result | Example |
|---|---|---|
| `+`, `-`, `*`, `/`, `%`, `^` | number | `prop("Score") * 2` |
| `==`, `!=`, `<`, `<=`, `>`, `>=` | boolean | `prop("Status") == "Done"` |
| `and`, `or`, `not` | boolean | `prop("A") and not prop("B")` |
| `?:` (ternary) | any | `prop("A") > 10 ? "high" : "low"` |

## Functions

A selection — full set follows Notion's reference at `developers.notion.com/reference/formulas`:

| Function | Returns |
|---|---|
| `if(c, a, b)` | depends on a/b |
| `concat(a, b, ...)` | string |
| `replace(s, pat, rep)` | string |
| `replaceAll(s, pat, rep)` | string |
| `length(s)` | number |
| `slice(s, start, end?)` | string |
| `format(n)` | string |
| `toNumber(s)` | number |
| `abs(n)`, `round(n)`, `ceil(n)`, `floor(n)`, `sign(n)`, `sqrt(n)`, `exp(n)`, `log10(n)`, `ln(n)` | number |
| `min(a, b, …)`, `max(a, b, …)` | number |
| `now()`, `start(d)`, `end(d)` | date |
| `year(d)`, `month(d)`, `day(d)`, `hour(d)`, `minute(d)` | number |
| `date(d)`, `dateAdd(d, n, "days")` | date |
| `dateBetween(a, b, "days")` | number |
| `formatDate(d, "YYYY-MM-DD")` | string |
| `empty(x)`, `isBlank(x)` | boolean |

## Errors

Invalid expressions are rejected on schema update with `validation_error` and a `details[].issue` describing the parse position. Runtime errors (divide-by-zero on a per-row basis) evaluate to the type's empty value (`""`, `0`, `false`, or unset date).

## Limits

- Maximum expression length: 8 KB.
- Maximum AST depth: 32.
- Functions referenced must be in the catalogue; user-defined functions are not supported.
