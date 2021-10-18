import {AppContext} from "context";
import {button} from "controls/common/button";
import {collapser} from "controls/common/collapser";
import {getSaveButton} from "controls/specific/save_button";
import {slider} from "controls/common/slider";
import {tag} from "utils/dom_utils";
import {panel} from "controls/common/panel";
import {computable, unwrapBoundable} from "boundable/boundable";
import {makeNodeBoundWatcher} from "controls/control";

export function getSettingsEditControls(context: AppContext): HTMLElement {
	let wireframeButton = button({
		text: "Грани", 
		onclick: () => context.state.skyboxWireframe(!context.state.skyboxWireframe()),
		active: context.state.skyboxWireframe
	});	

	let setDefaultPanoramButton = button({
		text: "Сделать начальной",
		active: computable(() => context.settings.startPanoram() === context.state.currentDisplayedPanoram()),
		onclick: () => {
			context.settings.startPanoram(context.state.currentDisplayedPanoram());
			context.settings.startPanoramRotX(context.skybox.camera.rotation.x);
			context.settings.startPanoramRotY(context.skybox.camera.rotation.y);
		}
	});


	let freelookButton = button({
		text: "Свободная камера",
		active: context.state.skyboxFreelook,
		onclick: () => {
			context.state.skyboxFreelook(!context.state.skyboxFreelook());
		}
	});


	let panoramRotation = slider({
		label: "Поворот",
		min: 0,
		max: 360,
		value: 0
	});
	
	let result = panel({ 
		class: "settings-edit-controls-container",
		hidden: computable(() => !context.state.isInEditMode() || context.state.isPlanActive())
	}, [
		tag({class: "button-toolbar"}, [
			tag({class: "label big", text: "Настройки"}),
			getSaveButton(context)
		]),
		tag({class: "button-toolbar"}, [
			setDefaultPanoramButton, freelookButton
		]),
		collapser({text: "Камера"}, [
			slider({
				label: "FOV",
				min: 30, value: context.settings.fov, max: 180
			}),
			slider({
				label: "Мин.наклон",
				min: -Math.PI / 2, value: context.settings.minPitch, max: 0
			}),
			slider({
				label: "Макс.наклон",
				min: 0, value: context.settings.maxPitch, max: Math.PI / 2
			}),
			slider({
				label: "Высота",
				min: 0, value: context.settings.cameraHeight, max: 2
			}),
			slider({
				label: "Скорость поворота",
				min: 1/2000, value: context.settings.cameraRotationSpeed, max: 1/100
			})
		]),
		collapser({text: "Skybox"}, [
			tag({class: "button-toolbar"}, [
				wireframeButton
			]),
			panoramRotation,
			slider({
				label: "Радиус", units: "м",
				min: 0.5, value: context.settings.skyboxRadius, max: 5
			}),
			slider({
				label: "Высота", units: "м",
				min: 2, value: context.settings.skyboxHeight, max: 10
			}),
			slider({
				label: "Боковые сегменты",
				min: 3, value: context.settings.skyboxRadialSegments, max: 512,
				integer: true
			}),
			slider({
				label: "Вертикальные сегменты",
				min: 1, value: context.settings.skyboxHeightSegments, max: 128,
				integer: true
			}),
			slider({
				label: "Бочкообразность",
				min: 0, value: context.settings.skyboxBarrelness, max: 2
			})
		]),
		collapser({text: "Прочее"}, [
			slider({
				label: "Размер текста (панорамы)",
				min: 0.001 / 5, value: context.settings.panoramLabelScale, max: 0.001 * 2
			})
		])
	])

	let watch = makeNodeBoundWatcher(setDefaultPanoramButton.element);
	watch(context.skybox.targetPanoram, panoramId => {
		if(!panoramId){
			return;
		}

		let panoram = context.settings.panorams()[panoramId];
		if(!panoram.position){
			return;
		}

		panoramRotation.value((panoram.position.rotation * 180) / Math.PI)
	})

	watch(panoramRotation.value, rotationGrad => {
		let panoramId = unwrapBoundable(context.skybox.targetPanoram);
		if(!panoramId){
			return;
		}

		let panoram = context.settings.panorams()[panoramId];
		if(!panoram.position){
			return;
		}

		panoram.position.rotation = (rotationGrad / 180) * Math.PI
		context.settings.panorams.notify();
	})

	return result;
}