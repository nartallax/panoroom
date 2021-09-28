import {MbBoundable} from "boundable/boundable";
import {makeNodeBoundWatcher} from "controls/control";
import {HtmlTaggable, tag, toHtmlTag} from "utils/dom_utils";

export interface CollapserOptions {
	text: MbBoundable<string>;
}

export function collapser(options: CollapserOptions, children: HtmlTaggable[]): HTMLElement {
	let header = tag({class: "collapser-header"});
	let collapser = tag({class: "collapser"}, [header]);
	let collapsed = true;

	function updateText(){
		header.textContent = options.text + " " + (collapsed? "v":"^");
	}

	header.addEventListener("click", () => {
		collapsed = !collapsed;
		if(collapsed){
			let childNodes = collapser.childNodes;
			for(let i = childNodes.length - 1; i >= 0; i--){
				let node = childNodes[i];
				if(node !== header){
					node.remove();
				}
			}
		} else {
			children.forEach(child => {
				let el = toHtmlTag(child);
				if(el){
					collapser.appendChild(el)
				}
			})
		}
		updateText();
	});

	let watch = makeNodeBoundWatcher(collapser);
	watch(options.text, updateText)

	return collapser;
}