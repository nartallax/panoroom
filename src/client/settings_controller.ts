import {AppContext} from "context";

export interface ViewSettings {
	fov: number;
	cameraHeight: number;
	skyboxHeight: number;
	skyboxRadius: number;
	minPitch: number;
	maxPitch: number;
	cameraRotationSpeed: number;
}

export const defaultViewSettings = {
	cameraHeight: 1.8,
	fov: 75,
	maxPitch: Math.PI / 2,
	minPitch: -(Math.PI / 2),
	skyboxHeight: 3.5,
	skyboxRadius: 1.5,
	cameraRotationSpeed: 1 / 350
}

export class SettingsController implements ViewSettings {

	haveUnsavedChanges = false;
	
	private readonly viewSettings: ViewSettings;

	constructor(
		viewSettings: ViewSettings,
		private readonly context: AppContext
	){
		this.viewSettings = JSON.parse(JSON.stringify(viewSettings));
	}

	get cameraHeight(): number { return this.viewSettings.cameraHeight }
	set cameraHeight(v: number){
		this.viewSettings.cameraHeight = v;
		this.context.skybox.onCameraHeightUpdated();
		this.haveUnsavedChanges = true;
	}

	get cameraRotationSpeed(): number { return this.viewSettings.cameraRotationSpeed }
	set cameraRotationSpeed(v: number){
		this.viewSettings.cameraRotationSpeed = v;
		this.haveUnsavedChanges = true;
	}

	get skyboxHeight(): number { return this.viewSettings.skyboxHeight }
	set skyboxHeight(v: number){
		this.viewSettings.skyboxHeight = v;
		this.context.skybox.onSkyboxGeometrySourceParametersUpdated();
		this.haveUnsavedChanges = true;
	}

	get skyboxRadius(): number { return this.viewSettings.skyboxRadius }
	set skyboxRadius(v: number){
		this.viewSettings.skyboxRadius = v;
		this.context.skybox.onSkyboxGeometrySourceParametersUpdated();
		this.haveUnsavedChanges = true;
	}

	get fov(): number { return this.viewSettings.fov }
	set fov(v: number){
		this.viewSettings.fov = v;
		this.context.skybox.onFovUpdated();
		this.haveUnsavedChanges = true;
	}

	get minPitch(): number { return this.viewSettings.minPitch }
	set minPitch(v: number){
		this.viewSettings.minPitch = v;
		this.context.skybox.onPitchLimitUpdated();
		this.haveUnsavedChanges = true;
	}

	get maxPitch(): number { return this.viewSettings.maxPitch }
	set maxPitch(v: number){
		this.viewSettings.maxPitch = v;
		this.context.skybox.onPitchLimitUpdated();
		this.haveUnsavedChanges = true;
	}

}