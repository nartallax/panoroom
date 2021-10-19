import {boundValue, BoundValue, MbBoundable} from "boundable/boundable";
import {Control, makeNodeBoundWatcher} from "controls/control";
import {tag} from "utils/dom_utils";

export interface TextInputOptions {
	value?: BoundValue<string>;
	disabled?: MbBoundable<boolean>;
}

export function textInput(opts: TextInputOptions): Control & {readonly value: BoundValue<string> }{
	let value = opts.value || boundValue("");

	let input = tag({
		tagName: "input",
		type: "text",
		class: "number-input"
	});

	let lastKnownValue = input.value;
	function onMaybeChange(){
		if(input.value === lastKnownValue){
			return;
		}
		lastKnownValue = input.value;

		value(lastKnownValue);
	}

	input.addEventListener("change", onMaybeChange);
	input.addEventListener("keypress", onMaybeChange);
	input.addEventListener("keydown", onMaybeChange);
	input.addEventListener("keyup", onMaybeChange);

	let watch = makeNodeBoundWatcher(input);

	let onValueChanged = (value: string) => {
		input.value = value;
	}
	
	watch(value, onValueChanged);

	watch(opts.disabled, disabled => {
		input.disabled = !!disabled;
	})

	return {
		element: input,
		value
	}
}