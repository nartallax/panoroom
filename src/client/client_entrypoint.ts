import {getWebglErrorElement, isWebGLAvailable} from "utils/graphic_utils";
import {SkyboxController} from "skybox_controller";
import {AppContextImpl} from "context";
import {SettingsController} from "settings_controller";
import {ApiClient} from "api_client";
import {PlanboxController} from "planbox_controller";
import {LayoutController} from "layout_controller";
import {AppState} from "app_state";

export async function main(): Promise<void> {
	checkWebglVersion(1);
	let context = new AppContextImpl();
	context.api = new ApiClient("/api/");
	context.state = new AppState();

	let [viewSettings, plan, canEdit] = await Promise.all([
		context.api.loadViewSettings(),
		context.api.loadBuildingPlan(),
		context.api.canEdit()
	])
	
	context.settings = new SettingsController(viewSettings, plan, context);
	
	context.planbox = new PlanboxController(context);
	let initialRotation: {x:number, y: number} | null = null;
	if(context.settings.startPanoram){
		let panoramId = context.settings.startPanoram();
		if(panoramId && context.settings.panorams()[panoramId]){
			context.state.currentDisplayedPanoram(panoramId);
			initialRotation = {
				x: context.settings.startPanoramRotX() || 0,
				y: context.settings.startPanoramRotY() || 0
			}
		}
	}
	context.skybox = new SkyboxController(context.settings, context, context.state.currentDisplayedPanoram, initialRotation, context.state.skyboxFreelook);
	context.layout = new LayoutController(context, {canEdit, root: document.body});

	context.layout.start();
}

function checkWebglVersion(version: 1 | 2): void {
	if(isWebGLAvailable(version)){
		return;
	}

	let container = document.getElementById("loading-screen")
	if(container){
		container.appendChild(getWebglErrorElement(version));
	}
	throw new Error("No webGL, aborted");
}