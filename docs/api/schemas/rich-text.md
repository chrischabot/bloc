# Rich text

The `RichText` runs that make up text fields, block contents, and inline mentions.

## Shape

```ts
type RichText = TextRun | MentionRun | EquationRun;

interface TextRun {
  type: 'text';
  text: { content: string; link: { url: string } | null };
  annotations: Annotations;
  plain_text: string;
  href: string | null;
}

interface MentionRun {
  type: 'mention';
  mention:
    | { type: 'user';             user:     { object: 'user'; id: string } }
    | { type: 'page';             page:     { id: string } }
    | { type: 'database';         database: { id: string } }
    | { type: 'date';             date:     { start, end?, time_zone? } }
    | { type: 'link_preview';     link_preview: { url: string } }
    | { type: 'template_mention'; template_mention: { type: 'template_mention_date'|'template_mention_user', ... } };
  annotations: Annotations;
  plain_text: string;
  href: string | null;
}

interface EquationRun {
  type: 'equation';
  equation: { expression: string };  // KaTeX
  annotations: Annotations;
  plain_text: string;
  href: null;
}

interface Annotations {
  bold:          boolean;
  italic:        boolean;
  strikethrough: boolean;
  underline:     boolean;
  code:          boolean;
  color:         'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'
               | 'gray_background' | 'brown_background' | ... ;
}
```

## Writing

When writing rich text:

- `annotations` is optional (defaults to no formatting).
- `plain_text` and `href` are *output only* — Bloc derives them on write.
- For a `text` run, just pass `{ type: 'text', text: { content: 'hi' } }`. Everything else fills in.
- Mentions of pages and users only require the id; the server fills the rest.

## Reading

When reading:

- `plain_text` is the rendered text without formatting; safe to use for snippets, search excerpts.
- `href` is the resolved href (mentions resolve to a URL).

## Length limits

- Single run: 2000 characters.
- Single property value: 100 runs.
- Single block payload: 100 runs.

Bloc enforces these on write — exceeding them returns `validation_error` with the failing path.
