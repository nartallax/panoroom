import {MbBoundable, unwrapBoundable} from "boundable/boundable";
import {Control, makeNodeBoundWatcher} from "controls/control";
import {tag} from "utils/dom_utils";

export interface ButtonOptions {
	class?: MbBoundable<string | undefined>;
	disabled?: MbBoundable<boolean | undefined>;
	active?: MbBoundable<boolean | undefined>;
	text: MbBoundable<string>;
	onclick: () => unknown | Promise<unknown>;
}

export function button(options: ButtonOptions): Control {
	let button = tag({});

	let watch = makeNodeBoundWatcher(button);

	function recalcClass(){
		button.className = "button " + 
			(unwrapBoundable(options.class) || "") + " " + 
			(unwrapBoundable(options.active)? "active": "") + " " + 
			(unwrapBoundable(options.disabled)? "disabled": "");
	}

	watch(options.class, recalcClass);
	watch(options.disabled, recalcClass);
	watch(options.active, recalcClass);
	watch(options.text, text => button.textContent = text);

	let isRunning = false;
	button.addEventListener("click", async () => {
		if(isRunning){
			return;
		}
		isRunning = true;

		try {
			await Promise.resolve(options.onclick.call(null));
		} finally {
			isRunning = false;
		}
	});

	return { element: button }
}