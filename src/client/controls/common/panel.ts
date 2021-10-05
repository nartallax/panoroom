import {MbBoundable} from "boundable/boundable";
import {makeNodeBoundWatcher} from "controls/control";
import {HTMLTagDescription, HtmlTaggable, tag} from "utils/dom_utils";

export interface PanelOptions extends HTMLTagDescription<"div"> {
	hidden?: MbBoundable<boolean>;
}

export function panel(opts: PanelOptions, children: HtmlTaggable[] = []): HTMLElement {
	let hidden = opts.hidden;
	delete opts.hidden;
	let panel = tag(opts, children);
	
	let watch = makeNodeBoundWatcher(panel, {preventDisplayChange: true});
	watch(hidden, hidden => {
		panel.style.display = hidden? "none": "";
	});

	return panel;
}