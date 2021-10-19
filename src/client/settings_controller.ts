import {BoundValue, boundValue, isBoundValue} from "boundable/boundable";
import {BuildingPlan} from "building_plan";
import {AppContext} from "context";

export interface ViewSettings {
	fov: number;
	cameraHeight: number;
	skyboxHeight: number;
	skyboxRadius: number;
	skyboxRadialSegments: number;
	skyboxHeightSegments: number;
	skyboxBarrelness: number;
	minPitch: number;
	maxPitch: number;
	cameraRotationSpeed: number;
	planLabelScale: number;
	panoramLabelScale: number;
}



export const defaultViewSettings: ViewSettings = {
	cameraHeight: 1.8,
	fov: 75,
	maxPitch: Math.PI / 2,
	minPitch: -(Math.PI / 2),
	skyboxHeight: 3.5,
	skyboxRadius: 1.5,
	skyboxRadialSegments: 64,
	skyboxHeightSegments: 1,
	skyboxBarrelness: 0,
	cameraRotationSpeed: 1 / 350,
	planLabelScale: 1 / 20,
	panoramLabelScale: 1 / 100
}

const defaultBuildPlan: BuildingPlan = {
	panorams: {},
	floors: {},
	startPanoram: null,
	startPanoramRotX: null,
	startPanoramRotY: null
}

const defaultSettingsPack: ViewSettings & BuildingPlan = {
	...defaultViewSettings,
	...defaultBuildPlan
}

type WrapWithBoundables<T> = { 
	readonly [k in keyof T]: BoundValue<T[k]>
} & {
	setToValues: (values: Partial<T>) => void;
	extractByKeys(keys: (keyof T)[]): { [k in keyof T]: unknown }
}

type WrapWithBoundablesClass<T> = {
	new(): WrapWithBoundables<T>;
}

function wrapWithBoundables<T>(defaultValues: T): WrapWithBoundablesClass<T> {
	let result = class WrappedWithBoundables {

		constructor(){
			let that = this as unknown as { [k in keyof T]: BoundValue<T[k]> };
			(Object.keys(defaultValues) as (keyof T)[]).forEach(key => {
				that[key] = boundValue(defaultValues[key]);
			});
		}

		setToValues(values: Partial<T>): void {
			let that = this as unknown as { [k in keyof T]: BoundValue<T[k]> };
			(Object.keys(values) as (keyof T)[]).forEach(key => {
				if(!isBoundValue(that[key])){
					console.warn("Cannot assign value of " + key + ": unknown key")
				} else {
					that[key](values[key]);
				}
			});
		}

		extractByKeys(keys: (keyof T)[]): { [k in keyof T]: unknown }{
			let that = this as unknown as { [k in keyof T]: BoundValue<T[k]> };
			let result = {} as { [k in keyof T]: unknown };
			keys.forEach(key => result[key] = that[key]());
			return result;
		}

	}

	return result as unknown as WrapWithBoundablesClass<T>
}

export class SettingsController extends wrapWithBoundables(defaultSettingsPack) {

	readonly hasUnsavedChanges = boundValue(false);

	constructor(viewSettings: ViewSettings | null, plan: BuildingPlan | null, private readonly context: AppContext){
		super();
		if(viewSettings){
			this.setToValues(viewSettings);
		}
		if(plan){
			this.setToValues(plan);
		}

		let notifyUnsavedChanges = () => {
			this.hasUnsavedChanges(true)
		}
		(Object.keys(defaultSettingsPack) as (keyof typeof defaultSettingsPack)[]).forEach(key => {
			this[key].subscribe(notifyUnsavedChanges);
		});
		this.context.state.htmlDescription.subscribe(notifyUnsavedChanges)
		this.context.state.htmlTitle.subscribe(notifyUnsavedChanges)
	}

	clone(viewSettings: Partial<ViewSettings> | null = null, plan: Partial<BuildingPlan> | null = null): SettingsController {
		return new SettingsController({
			...this.viewSettings,
			...(viewSettings || {})
		}, {
			...this.buildingPlan,
			...(plan || {})
		}, this.context);
	}

	get viewSettings(): ViewSettings {
		return this.extractByKeys(Object.keys(defaultViewSettings) as (keyof ViewSettings)[]) as ViewSettings;
	}

	get buildingPlan(): BuildingPlan {
		return this.extractByKeys(Object.keys(defaultBuildPlan) as (keyof BuildingPlan)[]) as BuildingPlan;
	}

	async save(): Promise<void>{

		// перед сохранением выкидываем неиспользуемые панорамы
		// конечный пользователь не сможет до них дойти никаким образом, а значит, и видеть ему их не надо
		let buildingPlan = this.buildingPlan;
		let panorams = {...buildingPlan.panorams};
		for(let panoramId in panorams){
			let panoram = panorams[panoramId];
			if(!panoram.links && !panoram.position){
				delete panorams[panoramId];
			}
		}
		buildingPlan.panorams = panorams;

		await Promise.all([
			this.context.api.saveViewSettings(this.viewSettings),
			this.context.api.saveBuildingPlan(buildingPlan),
			this.context.api.updateHtml({
				title: this.context.state.htmlTitle(),
				description: this.context.state.htmlDescription()
			})
		]);

		this.hasUnsavedChanges(false);
	}

}