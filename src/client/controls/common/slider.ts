import {boundValue, BoundValue, isBoundValue} from "boundable/boundable";
import {Control, makeNodeBoundWatcher} from "controls/control";
import {tag} from "utils/dom_utils";
import {addDragListeners} from "utils/drag";
import {toFixedNoTrail} from "utils/number_utils";

export interface SliderOptions {
	label: string;
	units?: string;
	min: number;
	max: number;
	value: number | BoundValue<number>;
	integer?: boolean;
	fractionalPositions?: number;
}

export interface Slider extends Control {
	value: BoundValue<number>;
}

export function slider(options: SliderOptions): Slider {
	let toFixed = (x: number) => toFixedNoTrail(x, options.fractionalPositions || 5);

	let valueContainer = isBoundValue(options.value)? options.value: boundValue(options.value);
	let input = tag({tagName: "input", type: "number"});
	input.value = toFixed(valueContainer());
	let notch = tag({class: "slider-notch", style: "left: 0"});
	let notchContainer = tag({class: "slider-notch-container"}, [notch]);

	let dragging = false;
	let oldValue = input.value;
	function onInputMaybeChanged(): void {
		if(dragging){
			oldValue = input.value;
			return;
		}
		if(oldValue === input.value){
			return;
		}
		oldValue = input.value;

		let value = Math.max(options.min, Math.min(options.max, parseFloat(input.value)));
		if(options.integer){
			value = Math.round(value);
		}
		valueContainer(value);
	}

	function setNotchPos(value: number): void {
		notch.style.left = (((value - options.min) / (options.max - options.min)) * 100) + "%";
	}
	setNotchPos(valueContainer());

	function setInputValue(value: number): void {
		if(options.integer){
			value = Math.round(value);
		}
		input.value = toFixed(value);
	}

	input.addEventListener("change", onInputMaybeChanged, {passive: true});
	input.addEventListener("keyup", onInputMaybeChanged, {passive: true});
	input.addEventListener("keypress", onInputMaybeChanged, {passive: true});
	input.addEventListener("mouseup", onInputMaybeChanged, {passive: true});
	input.addEventListener("click", onInputMaybeChanged, {passive: true});

	let minX = 0, maxX = 0;
	addDragListeners({
		element: notch,
		onDragStart: () => {
			let rect = notchContainer.getBoundingClientRect();
			minX = rect.left;
			maxX = rect.right;
			dragging = true;
		},
		onDragEnd: () => {
			dragging = false;
		},
		onDrag: ({x}) => {
			let percent = Math.max(0, Math.min(1, (x - minX) / (maxX - minX)));
			let value = options.min + ((options.max - options.min) * percent);
			if(options.integer){
				value = Math.round(value);
			}
			valueContainer(value);
		}
	})

	let el = tag({class: "slider"}, [
		tag({class: "slider-top"}, [
			tag({class: "editor label", text: options.label}),
			input,
			tag({class: "slider-units", text: options.units || ""}),
		]),
		tag({class: "slider-bottom"}, [
			tag({class: "slider-min", text: toFixed(options.min)}),
			tag({class: "slider-notch-container-container"}, [
				notchContainer
			]),
			tag({class: "slider-max", text: toFixed(options.max)})
		])
	]);

	let watch = makeNodeBoundWatcher(el);
	watch(valueContainer, newValue => {
		setNotchPos(newValue);
		if(input.value !== toFixed(newValue)){
			setInputValue(newValue);
		}
	})

	return {
		element: el,
		value: valueContainer
	}
}