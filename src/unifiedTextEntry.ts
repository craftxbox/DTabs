import { activetab } from "./index.js";
import { dirtyTabAddedListeners } from "./listeners.js";
import { $ } from "./util.js";
import { savetabs, tabtokens } from "./token.js";

let tabproxies: {[key: string]: RegExp} = {};

const injectUTE = $(`#injectUTE`) as HTMLInputElement;
const injectVencord = $(`#injectVencord`) as HTMLInputElement;
const experimentalSection = $(`#experimental`) as HTMLDivElement;

if (injectUTE.checked) {
    dirtyTabAddedListeners.push((tab) => {
        let tabView = $(`.${tab} webview`) as Electron.WebviewTag;
        if (injectVencord.checked) {
            tabView.addEventListener("dom-ready", function inject() {
                tabView.executeJavaScript(`
					setTimeout(() => {
						Vencord.Api.MessageEvents.addMessagePreSendListener(async (id,content,extra) => {
							window.ipcRenderer.sendToHost('uteIntercept', "${tab}",id,JSON.stringify(content), JSON.stringify(extra))
							let response = await (new Promise((resolve,reject) => {
								window.ipcRenderer.once('uteInterceptResponse', (event, data) => {
									if(data.cancel && extra.uploads.length > 0){
										content.content = ""
										extra.content = ""
										resolve()
									} 
									else if(data.clear) {
										content.content = ""
										extra.content = ""
										resolve()
									} else {
										resolve(data)
									}
								})
							}))
							return response
						})
					}, 3000)
					`);
            });
        } else {
            tabView.addEventListener("dom-ready", function inject() {
                tabView.executeJavaScript(`
					setTimeout(() => {
						window.uteHandlePreSend = async (id,content,extra,replyOptions) => {
							extra.replyOptions = replyOptions;
							window.ipcRenderer.sendToHost('uteIntercept', "${tab}",id,JSON.stringify(content), JSON.stringify(extra))
							let response = await (new Promise((resolve,reject) => {
								window.ipcRenderer.once('uteInterceptResponse', (event, data) => {
									if(data.cancel && extra.uploads.length > 0){
										content.content = ""
										extra.content = ""
										resolve()
									} 
									else if(data.clear) {
										content.content = ""
										extra.content = ""
										resolve()
									} else {
										resolve(data)
									}
								})
							}))
							if(response?.cancel) {
								return true;
							} else return false;
						}
					}, 2000)
					`);
            });
        }
        tabView.addEventListener("ipc-message", (event) => {
            if (!(event.channel == "uteIntercept")) return;
            let data = event.args;
            let tab = data[0];
            let chanId = data[1];
            let content = JSON.parse(data[2]);
            let extra = JSON.parse(data[3]);

            let proxyMatch: string | false = false;
            let newContent = content;
            for (let i in tabproxies) {
                if (!tabtokens[i].proxy) continue;
                if (tabtokens[i].proxy.length == 0) continue;
                if (!tabtokens[i].proxy.includes("text")) continue;

                let match = tabproxies[i].exec(content.content);
                if (match) {
                    newContent.content = match[1];
                    proxyMatch = i;
                    break;
                }
            }

            if (newContent.length == 0) {
                tabView.send("uteInterceptResponse", { cancel: true });
                return;
            }

            if (!proxyMatch) {
                tabView.send("uteInterceptResponse", { cancel: false });
            } else {
                handleUteMatch(tab, chanId, newContent, extra, proxyMatch);
                tabView.send("uteInterceptResponse", { cancel: true, clear: true });
            }
        });
    });

    async function handleUteMatch(_tab: string, channelId:string , content:{content:string}, extra: object, proxyMatch: string) {
        let proxyMatchWebview = $(`.${proxyMatch} webview`) as Electron.WebviewTag;
        let activeTabWebview = $(`.tab.active webview`) as Electron.WebviewTag;
        proxyMatchWebview
            .executeJavaScript(
                `
				{
					let channel = uteChanStore.getChannel('${channelId}')
					let can = false;
					if(channel) {
						can = utePermStore.can(3072n, channel)
					}
					[channel, can]
				}
			`
            )
            .then((hasChannel) => {
                if (!hasChannel[0] || !hasChannel[1]) {
                    console.log(hasChannel);
                    activeTabWebview.executeJavaScript(`uteMsgActions.sendBotMessage('${channelId}',"Proxy doesn't have access to that channel.")`);
                    return;
                } else {
                    let newExtra = extra;
                    Object.defineProperty(newExtra, "utePreProcessed", {
                        value: true,
                        writable: false,
                    });
                    proxyMatchWebview.executeJavaScript(`
						uteTransitionTo("/channels/${hasChannel[0].guild_id || "@me"}/${channelId}")
					`);
                    if (content.content == "/focus") {
                        activetab(proxyMatch);
                    } else {
                        proxyMatchWebview.executeJavaScript(`
                            uteMsgActions.sendMessage('${channelId}', ${JSON.stringify(content)},true, ${JSON.stringify(extra)}?.replyOptions)
                        `);
                    }
                }
            });
    }

    function escapeRegex(string: string): string {
        return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
    }

    experimentalSection.innerHTML += `
			<h2> Unified Text Entry settings </h2>
		`;

    for (let i in tabtokens) {
        if (i == "_version") continue;
        let tab = tabtokens[i];
        let container = document.createElement("div");
        container.textContent = tab.title + " Proxy: ";
        let input = document.createElement("input");
        input.type = "text";
        input.id = i + "proxy";
        input.setAttribute("tabindex", i);
        if (tab.proxy) {
            input.value = tab.proxy;
            tabproxies[i] = new RegExp(`^${escapeRegex(tab.proxy).replace("text", "(.*)")}$`);
        }
        input.addEventListener("change", (e) => {
            try {
                if (input.value.includes("text") == false) {
                    alert("Your proxy must include 'text' to be a valid proxy.\nExample: for a proxy that uses []'s you would write [text]");
                }

                let tabindex = (e.target as HTMLElement).getAttribute("tabindex") as string;

                tabproxies[tabindex] = new RegExp(`^${escapeRegex(input.value).replace("text", "(.*)")}$`);
                tabtokens[tabindex].proxy = input.value;
                savetabs();
            } catch (e: any) {
                alert(e.getMessage());
            }
        });
        container.appendChild(input);
        experimentalSection.appendChild(container);
    }
}
