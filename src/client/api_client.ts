import {BuildingPlan} from "building_plan";
import {FrontHtmlSourceData} from "front_html";
import {ViewSettings} from "settings_controller";
import {FsTreeNode, logWarn} from "utils";

const viewSettingsFilename = "view_settings.json";
const buildingPlanFilename = "building_plan.json";

export class ApiClient {

	constructor(private readonly apiUrlBase: string){}
	
	private async callApi<T = void>(name: string, body: unknown = null): Promise<T>{
		let resp = await fetch(this.apiUrlBase + name, {
			headers: {
				"Content-Type": "application/json"
			},
			method: "POST",
			body: JSON.stringify(body)
		});

		let result = await resp.json();
		if(result.ok !== true){
			throw new Error("Response is not OK")
		}

		return result.result;
	}

	private async getJson<T>(path: string): Promise<T>{
		let resp = await fetch("./static/" + path, { method: "GET" });
		return await resp.json();
	}

	private saveSettings(filename: string, settings: unknown): Promise<void>{
		return this.callApi("saveSettings", [filename, settings]);
	}

	saveViewSettings(settings: ViewSettings): Promise<void>{
		return this.saveSettings(viewSettingsFilename, settings);
	}

	async loadViewSettings(): Promise<ViewSettings | null>{
		try {
			return await this.getJson(viewSettingsFilename);
		} catch(e){
			logWarn("Failed to load view settings: ", e);
			return null;
		}
	}

	saveBuildingPlan(settings: BuildingPlan): Promise<void>{
		return this.saveSettings(buildingPlanFilename, settings);
	}

	async loadBuildingPlan(): Promise<BuildingPlan | null>{
		try {
			return await this.getJson(buildingPlanFilename);
		} catch(e){
			logWarn("Failed to load building plan: ", e)
			return null;
		}
	}

	enumeratePanoramFiles(): Promise<FsTreeNode[]>{
		return this.callApi("enumeratePanoramFiles");
	}

	async canEdit(): Promise<boolean>{
		try {
			return await this.callApi("canEdit")
		} catch(e){
			logWarn("Got error trying to determine if I am allowed to edit. Guess not. ", e);
			return false;
		}
	}

	updateHtml(params: FrontHtmlSourceData): Promise<void>{
		return this.callApi("updateHtml", [params]);
	}

}