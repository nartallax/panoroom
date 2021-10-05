import {boundValue, BoundValue, isBoundValue, MbBoundable} from "boundable/boundable";
import {Control, makeNodeBoundWatcher} from "controls/control";
import {tag} from "utils/dom_utils";

export interface DropDownListOption<T extends string = string>{
	label: string;
	value: T;
}

export interface DropDownListOptions<T extends string> {
	options: MbBoundable<DropDownListOption<T>[]>;
	value: T | null | BoundValue<T | null>;
}

export function dropDownList<T extends string = string>(options: DropDownListOptions<T>): Control {
	let select = tag({tagName: "select"});
	let value = isBoundValue(options.value)? options.value: boundValue(options.value);

	let watch = makeNodeBoundWatcher(select);
	watch(options.options, newOptValues => {
		let oldValue = value();
		select.innerHTML = "";
		let hasValue = false;
		newOptValues.forEach(option => {
			hasValue = hasValue || option.value === oldValue;
			select.appendChild(tag({tagName: "option", text: option.label, value: option.value}))
		});
		if(hasValue && oldValue !== null){
			select.value = oldValue;
		} else if(newOptValues.length > 0) {
			select.value = newOptValues[0].value;
			value(newOptValues[0].value);
		} else if(oldValue !== null) {
			select.value = "";
			value(null);
		}
	});

	watch(value, newValue => {
		select.value = newValue !== null? newValue: ""
	});

	select.addEventListener("change", () => value(select.value as T));

	return { element: select }
}