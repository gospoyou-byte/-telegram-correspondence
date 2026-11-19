# Cherry Telegram ♡

A plum-pink Telegram-inspired roleplay companion extension for SillyTavern 1.19.0+.

## Current foundation (0.1.0)
- Floating launcher in the SillyTavern top bar and an Extensions settings shortcut.
- Private and group chat UI with persistent local extension settings.
- Manual message sending, emoji/sticker picker, reactions, and image file attachments.
- Quiet AI reply generation through the currently selected SillyTavern connection.
- Stories, channels, posts, comments, reactions, and editable user profile.
- AI-assisted English image-prompt drafting from a Russian or English idea.
- Plum / dusty rose glass-like theme.

## Install
1. Upload this repository to GitHub.
2. In SillyTavern open Extensions -> Install extension.
3. Paste the repository URL.
4. Reload the SillyTavern page if needed.
5. Open Cherry Telegram using the flower icon in the top bar.

## Important limitations of this first build
This is an initial playable foundation, not a finished Telegram clone.
- Separate API provider profiles and IF Blocks integration are not implemented yet. The provider interface must be checked before adding a safe adapter.
- Image generation currently drafts an English prompt using the active SillyTavern model; it does not yet call an image provider or create an image.
- AI replies are manually triggered; autonomous character messages, scheduled posts, story generation, channel-owner agents, calls, voice notes, video bubbles, and cross-chat roleplay event synchronization are future milestones.
- Image attachments are stored as data URLs in extension settings; large images can make settings storage heavy. A later media-storage module should move binary files to SillyTavern's user files.
- No API keys are requested or stored by this extension.

## Development notes
The extension uses the standard SillyTavern manifest format and `SillyTavern.getContext()` APIs. It stores its state under the unique `cherry_telegram` key in `extensionSettings` when available, with localStorage as a fallback.

## License
MIT. See LICENSE.
