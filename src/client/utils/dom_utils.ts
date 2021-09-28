import {Control, isControl} from "controls/control";

export interface HTMLTagDescription<K extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> extends Record<string, unknown> {
	tagName?: K;
	text?: string;
	class?: string | (string | null | undefined)[];
}

export type HtmlTaggable = HTMLElement | HTMLTagDescription | Control | null | undefined;

type ChildArray = HtmlTaggable[]

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
				res.className = Array.isArray(v)? v.filter(x => !!x).join(" "): v + "";
				break;
			default:
				res.setAttribute(k, v + "");
				break;
		}
	}

	if(children){
		for(let child of children){
			if(!child){
				continue;
			}
			res.appendChild(child instanceof HTMLElement? child: isControl(child)? child.element: tag(child));
		}
	}

	return res as HTMLElementTagNameMap[K];
}

export function toHtmlTag(taggable: HtmlTaggable): HTMLElement | null {
	return !taggable? null
		: taggable instanceof HTMLElement? taggable
		: isControl(taggable)? taggable.element
		: tag(taggable);
}

export function isInDOM(node: Node): boolean {
	do {
		if(node === document.body){
			return true;
		}
		if(!node.parentNode){
			return false;
		}
		node = node.parentNode;
	} while(true);
}