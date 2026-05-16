# Comments UI

## Anchors

- **Page comment** — anchored to the page root; appears in the comments panel at the top.
- **Inline comment** — anchored to a selection inside a block; renders as a highlighted yellow span; clicking opens the thread.

## Composer

- Rich text input with mention support (@user, @page, @date).
- Buttons: Send, "@" mention shortcut, paperclip (attach), emoji.
- Cmd+Enter sends.

## Thread

- First message + replies; threaded by `discussion_id`.
- Reactions row (emoji); add reaction button.
- Resolve / Reopen toggle at the thread header.
- More menu: edit, delete, copy link, mark as unread.

## Page comments panel

- Slide-over from the right (480 px wide).
- Tabs: Open / Resolved / All.
- Each thread card: anchor preview (block excerpt), author, timestamp, message, reaction count, reply count.

## Inline highlight

- Selection turns light yellow (--bg-yellow at 30%).
- Marker icon at the right margin shows comment count for the block.

## Inbox

Accessible from sidebar's Updates icon.

- Slide-over from right (480 px) or full-page view at `/inbox`.
- Tabs: All / Mentions / Following.
- Each item: avatar, actor, action, target (page + snippet), timestamp, reactions.
- Read / unread state; mark as read on view, Cmd+Shift+U to mark all read.

## Notifications

- Bell icon shows unread count badge.
- Real-time delivery via WebSocket (server pushes inbox events on the user channel).

## Tests

- Unit: composer keyboard handling.
- Playwright: create thread on selection, reply, resolve, react.
- Visual: each state per theme.