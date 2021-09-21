import {getWebglErrorElement, isWebGLAvailable} from "utils/graphic_utils";
import {setupEventHandlers} from "event_listeners";
import {getEditControls} from "controls/edit_controls";
import {SkyboxController} from "skybox_controller";
import {AppContextImpl} from "context";
import {defaultViewSettings, SettingsController} from "settings_controller";

export function main(): void {
	checkWebglVersion(1);
	let context = new AppContextImpl();
	context.settings = new SettingsController(defaultViewSettings, context);
	context.skybox = new SkyboxController(context, "./img/test_pano.jpg");
	context.skybox.start();

	setupEventHandlers(context);
	document.body.appendChild(getEditControls(context));
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