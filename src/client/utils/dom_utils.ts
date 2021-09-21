export interface HTMLTagDescription<K extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> extends Record<string, unknown> {
	tagName?: K;
	text?: string;
	class?: string;
}

type ChildArray = (HTMLElement | HTMLTagDescription)[]

export function tag(): HTMLDivElement;
export function tag<K extends keyof HTMLElementTagNameMap = "div">(description: HTMLTagDescription<K>): HTMLElementTagNameMap[K];
export function tag(children: ChildArray): HTMLDivElement;
export function tag<K extends keyof HTMLElementTagNameMap = "div">(description: HTMLTagDescription<K>, children: ChildArray): HTMLElementTagNameMap[K];

export function tag<K extends keyof HTMLElementTagNameMap = "div">(a?: HTMLTagDescription<K> | ChildArray, b?: ChildArray): HTMLElementTagNameMap[K] {
	let description: HTMLTagDescription<K>;
	let children: ChildArray | undefined = undefined;
	if(!a){
		description = {};
		children = b || undefined;
	} else {
		if(Array.isArray(a)){
			description = {};
			children = a;
		} else {
			description = a;
			children = b || undefined;
		}
	}

	let res = document.createElement(description.tagName || "div");

	for(let k in description){
		let v = description[k]
		switch(k){
			case "tagName":
				break;
			case "text":
				res.textContent = v + "";
				break;
			case "class":
				res.className = v + "";
				break;
			default:
				res.setAttribute(k, v + "");
				break;
		}
	}

	if(children){
		for(let child of children){
			res.appendChild(child instanceof HTMLElement? child: tag(child));
		}
	}

	return res as HTMLElementTagNameMap[K];
}