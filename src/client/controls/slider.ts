import {tag} from "utils/dom_utils";
import {addDragListeners} from "utils/drag";
import {toFixedNoTrail} from "utils/number_utils";

export function slider(options: {label: string, units?: string; min: number, max: number, value: number, onChange: (v: number) => void}): HTMLElement {
	let input = tag({tagName: "input", type: "number"});
	input.value = toFixedNoTrail(options.value, 3);
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
		setNotchPos(value);
		options.onChange(value);
	}

	function setNotchPos(value: number): void {
		notch.style.left = (((value - options.min) / (options.max - options.min)) * 100) + "%";
	}
	setNotchPos(options.value);

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
			notch.style.left = (percent * 100) + "%";
			let value = options.min + ((options.max - options.min) * percent);
			input.value = toFixedNoTrail(value, 3);
			options.onChange(value);
		}
	})

	return tag({class: "slider"}, [
		tag({class: "slider-top"}, [
			tag({class: "slider-label", text: options.label}),
			input,
			tag({class: "slider-units", text: options.units || ""}),
		]),
		tag({class: "slider-bottom"}, [
			tag({class: "slider-min", text: toFixedNoTrail(options.min, 3)}),
			tag({class: "slider-notch-container-container"}, [
				notchContainer
			]),
			tag({class: "slider-max", text: toFixedNoTrail(options.max, 3)})
		])
	])
}