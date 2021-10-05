import {boundValue, BoundValue, isBoundValue, MbBoundable} from "boundable/boundable";
import {Control, makeNodeBoundWatcher} from "controls/control";
import {tag} from "utils/dom_utils";
import {toFixedNoTrail} from "utils/number_utils";

export interface NumberInputOptions {
	value?: MbBoundable<BoundValue<number>>;
	disabled: MbBoundable<boolean>;
}

export function numberInput(opts: NumberInputOptions): Control & {readonly value: BoundValue<number> }{
	let optsValue: MbBoundable<BoundValue<number>> = opts.value || boundValue(0);

	let input = tag({
		tagName: "input",
		type: "number",
		class: "number-input"
	});

	function getNestedBoundValue(): BoundValue<number>{
		let nestedValue = optsValue();
		return isBoundValue(nestedValue)? nestedValue: optsValue as BoundValue<number>;
	}
	
	let lastKnownValue = input.value;
	function onMaybeChange(){
		if(input.value === lastKnownValue){
			return;
		}
		lastKnownValue = input.value;

		let boundValue = getNestedBoundValue();
		boundValue(parseFloat(input.value));
	}

	input.addEventListener("change", onMaybeChange);
	input.addEventListener("keypress", onMaybeChange);
	input.addEventListener("keydown", onMaybeChange);
	input.addEventListener("keyup", onMaybeChange);

	let watch = makeNodeBoundWatcher(input);

	let onNestedValueChanged = (value: number) => {
		input.value = toFixedNoTrail(value, 5);
	}
	
	{
		let nestedValue = optsValue();
		if(isBoundValue(nestedValue)){
			let clearNestedWatcher: (() => void) | null = null;
			watch(optsValue, nestedValue => {
				if(clearNestedWatcher){
					clearNestedWatcher();
				}
				clearNestedWatcher = watch(nestedValue, onNestedValueChanged);
			});
		} else {
			if(!isBoundValue(optsValue)){
				throw new Error("WUT") // not gonna happen
			}
			watch(optsValue, onNestedValueChanged);
		}
	}

	watch(opts.disabled, disabled => {
		input.disabled = disabled;
	})

	return {
		element: input,
		get value(): BoundValue<number>{
			return getNestedBoundValue()
		}
	}
}