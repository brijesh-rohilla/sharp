# Sharp

Chrome extension for highlighting LinkedIn posts by keywords, with popup navigation and infinite scroll support.

## Project structure

```text
sharp/
	manifest.json
	popup.html
	css/
		common.css                # shared popup base styles
		popup.css                 # popup feature styles
		post-highlighter.css      # content feature highlight styles
	js/
		common/
			common.js           # shared helpers used by popup and content
		content/
			post-highlighter.js     # content feature logic (LinkedIn page)
		popup/
			post-highlighter.js     # popup feature logic
	icons/
```

## Runtime wiring

- Popup entry: `popup.html`
- Popup scripts: `js/common.js`, `js/popup.js`
- Content scripts from `manifest.json`: `js/common.js`, `js/post-highlighter.js`

## Notes

- Legacy root-level files `content.js` and `popup.js` were removed after the split.
- Feature behavior remains the same; this cleanup is structural only.