import {AppContext} from "context";
import {slider} from "controls/slider";
import {tag} from "utils/dom_utils";

export function getEditControls(context: AppContext): HTMLElement {
	void context;
	return tag({ class: "edit-controls-container" }, [
		slider({
			label: "Радиус цилиндра", units: "м",
			min: 0.5, value: context.settings.skyboxRadius, max: 5,
			onChange: v => context.settings.skyboxRadius = v
		}),
		slider({
			label: "Высота цилиндра", units: "м",
			min: 2, value: context.settings.skyboxHeight, max: 10,
			onChange: v => context.settings.skyboxHeight = v
		}),
		slider({
			label: "FOV",
			min: 30, value: context.settings.fov, max: 150,
			onChange: v => context.settings.fov = v
		}),
		slider({
			label: "Мин.наклон камеры",
			min: -Math.PI / 2, value: context.settings.minPitch, max: 0,
			onChange: v => context.settings.minPitch = v
		}),
		slider({
			label: "Макс.наклон камеры",
			min: 0, value: context.settings.maxPitch, max: Math.PI / 2,
			onChange: v => context.settings.maxPitch = v
		}),
		slider({
			label: "Высота камеры",
			min: 0, value: context.settings.cameraHeight, max: 2,
			onChange: v => context.settings.cameraHeight = v
		}),
		slider({
			label: "Скорость поворота камеры",
			min: 1/2000, value: context.settings.cameraRotationSpeed, max: 1/100,
			onChange: v => context.settings.cameraRotationSpeed = v
		}),
	])
}