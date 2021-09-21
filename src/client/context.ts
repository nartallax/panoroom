import {ViewSettings} from "settings_controller";
import {SkyboxController} from "skybox_controller";

export interface AppContext {
	skybox: SkyboxController;
	settings: ViewSettings;
}

export class AppContextImpl implements AppContext {
	private _skybox: SkyboxController | null = null;
	get skybox(): SkyboxController {
		if(!this._skybox){
			throw new Error("No skybox yet!");
		}
		return this._skybox;
	}
	set skybox(v: SkyboxController){
		this._skybox = v;
	}

	private _settings: ViewSettings | null = null;
	get settings(): ViewSettings {
		if(!this._settings){
			throw new Error("No settings yet!");
		}
		return this._settings
	}
	set settings(v: ViewSettings) {
		this._settings = v;
	}

}