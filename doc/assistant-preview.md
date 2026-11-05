# PSL assistant preview

Standalone route: `frontend/ai-chat.html`. Uses the same product IDs and `product.html?id=…` routes as the storefront. No model credentials or server writes are used. The local catalog adapter is explicitly identified as a preview in the UI.

## Visual response contract

`assets/js/assistant-catalog.js` supplies the local `PSLChatCatalog.reply(text, previousMessages)` adapter. A future server adapter can return the same structure:

```json
{
  "text": "Нашёл материал в каталоге.",
  "blocks": [{ "type": "products", "ids": ["wiron"] }],
  "followups": ["Покажи промышленную плитку"]
}
```

Registered renderers in `assets/js/assistant.js`:

- `products`: 1–3 product cards with real catalog images and product links.
- `comparison`: two catalog products compared by existing metadata.
- `floor`: an SVG demonstration with clickable layers; explicitly an illustration, not a validated construction specification.

Components are rendered from trusted frontend code, with all dynamic text escaped. IDs resolve against the catalog; unknown products and block types are ignored. Images resolve to same-origin URLs. Raw model HTML or JavaScript is never executed. Add further visual components to the renderer registry when their behavior is defined.

The visual toggle affects new responses. Text-only responses retain product links. No invented commercial prices or availability are supplied.

## Local behavior

The browser stores up to 40 chats and 100 messages per chat under `psl_assistant_chats_v1`. New chat, history search, reopen, repeat, stop, copy, local usefulness marking, and recoverable deletion are implemented. Deletion can be undone with Ctrl/Cmd+Z outside a text input during the same page session. History is browser-local, not synchronized or associated with a server account.

The page does not load the old `app.js` chat implementation. Mobile layout uses a sidebar drawer and an independent scrollable message area.

Validation: `node tests/assistant-catalog.cjs` and `node --check frontend/assets/js/assistant.js`.
