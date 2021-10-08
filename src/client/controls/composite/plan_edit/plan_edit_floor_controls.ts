import {computable} from "boundable/boundable";
import {BuildingFloor} from "building_plan";
import {AppContext} from "context";
import {button} from "controls/common/button";
import {dropDownList} from "controls/common/drop_down_list";
import {numberInput} from "controls/common/number_input";
import {Control, makeNodeBoundWatcher} from "controls/control";
import {randomUniqId} from "utils";
import {HtmlTaggable, tag} from "utils/dom_utils";

export function getPlanEditFloorControls(context: AppContext): HtmlTaggable[] {
	
	let floorSelector = dropDownList({
		options: computable(() => {
			let floors = context.settings.floors();
			return Object.keys(floors)
				.map(floorId => {
					let floor = floors[floorId];
					return {label: floor.label, value: floorId};
				})
		}),
		value: context.state.selectedFloor
	})

	let addFloorButton = button({
		text: "+",
		onclick: () => {
			let floors = context.settings.floors()
			let id = randomUniqId(floors);
			
			let y = -10;
			for(let floorId in floors){
				y = Math.max(y, floors[floorId].y)
			}
			y += 10;

			let floor: BuildingFloor = {label: "Этаж " + id, x: 0, y, z: 0, width: 10, length: 10, rotation: 0};
			floors[id] = (floor);
			context.settings.floors(floors);
			context.state.selectedFloor(id);
		}
	});
	
	let renameFloorButton = button({
		text: "Имя",
		disabled: computable(() => context.state.selectedFloor() === null),
		onclick: () => {
			let floorId = context.state.selectedFloor();
			if(floorId){
				let newName = prompt("Введите имя этажа:")
				if(newName !== null){
					let floors = context.settings.floors();
					floors[floorId].label = newName;
					context.settings.floors(floors);
				}
			}
		}
	});
	
	let deleteFloorButton = button({
		text: "-",
		disabled: computable(() => context.state.selectedFloor() === null),
		onclick: () => {
			let floorId = context.state.selectedFloor();
			if(floorId){
				let floors = context.settings.floors();
				delete floors[floorId];
				context.settings.floors(floors);
				/*
				let selectedObject = context.state.selectedSceneObject();
				if(selectedObject && selectedObject.type === "floor" && selectedObject.floorId === floorId){
					context.state.selectedSceneObject(null);
				}
				*/
			}
		}
	});

	let hideInactiveFloorsToggleButton = button({
		text: "Прятать",
		active: context.state.hideInactiveFloors,
		onclick: () => {
			context.state.hideInactiveFloors(!context.state.hideInactiveFloors());
		}
	});

	let watch = makeNodeBoundWatcher(floorSelector.element);

	let makeFloorBoundNumberInput = (propName: "width" | "length" | "rotation", mult = 1): Control => {
		let input = numberInput({
			disabled: computable(() => context.state.selectedFloor() === null)
		});

		// эта херня здесь нужна для того, чтобы при загрузке значения полей не выставлялись в 0
		// т.е. при вставке в DOM инпута он выставлял выбранному этажу 0, т.к. отрабатывал вотчер на input.value
		// поэтому мы не изменяем значение, пока не отработал вотчер на selectedFloor
		// это можно было бы контрить изменением порядка следования вотчеров, но это слишком ненадежно, поэтому нет
		let lastUpdatedFloorByKey: string | null = null;

		watch(input.value, value => {
			let floorId = context.state.selectedFloor()
			if(floorId && floorId === lastUpdatedFloorByKey){
				let floors = context.settings.floors();
				floors[floorId][propName] = value / mult;
				context.settings.floors(floors);
			}
		});

		watch(context.state.selectedFloor, floorId => {
			if(!floorId){
				input.value(0);
			} else {
				let floor = context.settings.floors()[floorId];
				input.value(floor[propName] * mult);
			}
			lastUpdatedFloorByKey = floorId;
		});

		return input;
	}

	let widthInput = makeFloorBoundNumberInput("width");
	let lengthInput = makeFloorBoundNumberInput("length");
	let rotationInput = makeFloorBoundNumberInput("rotation", 180 / Math.PI);

	return [
		tag({ class: "button-toolbar" }, [
			tag({ class: "label medium", text: "Этаж" }),
			addFloorButton, renameFloorButton, deleteFloorButton, hideInactiveFloorsToggleButton
		]),
		tag({ class: "button-toolbar" }, [
			tag({ class: "label editor", text: "Ширина" }),
			widthInput,
			tag({ class: "label editor", text: "Длина" }),
			lengthInput,
			tag({ class: "label editor", text: "Поворот" }),
			rotationInput
		]),
		floorSelector,
	]

}