import {AppContext} from "context";
import {button} from "controls/common/button";
import {collapser} from "controls/common/collapser";
import {getSaveButton} from "controls/specific/save_button";
import {slider} from "controls/common/slider";
import {tag} from "utils/dom_utils";
import {panel} from "controls/common/panel";
import {computable} from "boundable/boundable";

export function getSettingsEditControls(context: AppContext): HTMLElement {
	let wireframeButton = button({
		text: "Грани", 
		onclick: () => context.settings.skyboxWireframe(!context.settings.skyboxWireframe())
	});	
	
	return panel({ 
		class: "settings-edit-controls-container",
		hidden: computable(() => !context.state.isInEditMode() || context.state.isPlanActive())
	}, [
		tag({class: "button-toolbar"}, [
			tag({class: "label big", text: "Настройки"}),
			getSaveButton(context)
		]),
		collapser({text: "Просмотрщик"}, [
			tag({class: "button-toolbar"}, [
				wireframeButton
			]),
			slider({
				label: "Радиус цилиндра", units: "м",
				min: 0.5, value: context.settings.skyboxRadius, max: 5
			}),
			slider({
				label: "Высота цилиндра", units: "м",
				min: 2, value: context.settings.skyboxHeight, max: 10
			}),
			slider({
				label: "Боковые сегменты",
				min: 3, value: context.settings.skyboxRadialSegments, max: 512,
				integer: true
			}),
			slider({
				label: "FOV",
				min: 30, value: context.settings.fov, max: 150
			}),
			slider({
				label: "Мин.наклон камеры",
				min: -Math.PI / 2, value: context.settings.minPitch, max: 0
			}),
			slider({
				label: "Макс.наклон камеры",
				min: 0, value: context.settings.maxPitch, max: Math.PI / 2
			}),
			slider({
				label: "Высота камеры",
				min: 0, value: context.settings.cameraHeight, max: 2
			}),
			slider({
				label: "Скорость поворота",
				min: 1/2000, value: context.settings.cameraRotationSpeed, max: 1/100
			})
		])
	])
}