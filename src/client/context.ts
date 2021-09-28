import {ApiClient} from "api_client";
import {EditorState} from "editor_state";
import {LayoutController} from "layout_controller";
import {PlanboxController} from "planbox_controller";
import {SettingsController} from "settings_controller";
import {SkyboxController} from "skybox_controller";

export interface AppContext {
	skybox: SkyboxController;
	planbox: PlanboxController;
	settings: SettingsController;
	editorState: EditorState;
	api: ApiClient;
	layout: LayoutController;
}

const emptyAppContext: {[k in keyof AppContext]: null} = {
	skybox: null,
	planbox: null,
	settings: null,
	editorState: null,
	api: null,
	layout: null
}

function wrapWithGetterSetters<T>(names: (keyof T)[]): { new(): T } {
	let result = class WrappedWithGettersSetters {

		constructor(){
			names.forEach(name => {
				let value: unknown = null;
				Object.defineProperty(this, name, {
					get: () => {
						if(value === null){
							throw new Error("No " + name + " is defined yet.")
						} else {
							return value;
						}
					},
					set: newValue => {
						value = newValue;
					}
				});
			});
		}

	}

	return result as unknown as { new(): T }
}

export class AppContextImpl extends wrapWithGetterSetters<AppContext>(Object.keys(emptyAppContext) as (keyof AppContext)[]) {}