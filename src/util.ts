const { webContents } = require('@electron/remote') as typeof import('@electron/remote');

export const $: typeof document.querySelector = document.querySelector.bind(document);
export const $$: typeof document.querySelectorAll = document.querySelectorAll.bind(document);

export function getWebContents(view: Electron.WebviewTag): Electron.WebContents | undefined {
    return webContents.fromId(view.getWebContentsId());
}
