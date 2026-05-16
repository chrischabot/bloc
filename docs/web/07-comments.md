# Comments & mentions

## Commenting

- **On a block** — hover the block, click the speech-bubble icon, or use the block menu → Comment.
- **On a text selection** — select text, click Comment in the floating toolbar.
- **On a page** — top bar → Comments → New.

The comment panel opens on the right with the thread anchored to the block. Replies are threaded within the discussion.

## Mentions

Inside a comment (or any rich-text field):

- `@<name>` mentions a user. They get an inbox entry and an email notification (if enabled).
- `@<page>` links a page.
- `@today`, `@Mar 12` mentions a date.

## Reactions

Hover a comment → quick-react palette (👍 ❤️ 🎉 😄 🤔 👀). Reactions are visible to everyone who can read the comment.

## Resolving

The thread header has a **Resolve** button. Resolved discussions are hidden from the page surface but remain in the underlying data — click "Show resolved" to bring them back.

## Notifications

- Mentions appear in your inbox.
- New replies in threads you've participated in or where you're the page owner trigger an inbox entry.
- Email digests for unread inbox entries are sent by the worker (configurable in Settings → Notifications).

## Page-level vs block-level

A comment created without a selection lives on the page; one created with a selection lives on the block or text range. The data model is the same — comments hang off a discussion, which hangs off the most-specific anchor.

## Suggesting mode (review)

`Suggesting` mode is enabled per-page from the page menu. While on, edits are recorded as suggestions instead of direct writes; reviewers see inline diffs and accept/reject each suggestion. Useful for editorial workflows.
