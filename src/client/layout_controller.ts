import {boundValue, computable} from "boundable/boundable";
import {AppContext} from "context";
import {button} from "controls/button";
import {getPlanEditControls} from "controls/plan_edit_controls";
import {getSettingsEditControls} from "controls/settings_edit_controls";
import {tag} from "utils/dom_utils";

export interface LayoutControllerOptions {
	canEdit: boolean;
	root: HTMLElement;
}

export class LayoutController {

	private isPlanActive = boundValue(false);
	private isInEditMode = false;
	private planEditControls: HTMLElement | null = null;
	private settingsEditControls: HTMLElement | null = null;
	private readonly planboxContainer = tag({class: "planbox-container"})
	private readonly planRoot = tag({class: "plan-wrap"}, [this.planboxContainer]);

	constructor(private readonly context: AppContext, private readonly options: LayoutControllerOptions){}

	start(): void {
		this.options.root.appendChild(this.planRoot);
		this.options.root.appendChild(tag({class: "view-control-buttons-container"}, [
			!this.options.canEdit? null: button({ text: "Редактирование", onclick: () => this.toggleEditMode() }),
			button({ 
				text: computable(() => this.isPlanActive()? "Панорама": "План"), 
				onclick: () => this.togglePlanAndPanoram()
			})
		]));
		this.removeLoadingScreen();
		this.updateEverything();
	}

	togglePlanAndPanoram(): void {
		this.isPlanActive(!this.isPlanActive())
		this.updateEverything();
	}

	toggleEditMode(): void {
		this.isInEditMode = !this.isInEditMode;
		this.updateEverything();
	}

	private updateEverything(): void {
		// говнокод некрасивый, переписать
		if(this.isInEditMode){
			if(this.isPlanActive()){
				if(this.settingsEditControls){
					this.settingsEditControls.remove();
					this.settingsEditControls = null;
				}
				if(!this.planEditControls){
					this.planEditControls = getPlanEditControls(this.context);
					this.planRoot.prepend(this.planEditControls)
				}
			} else {
				if(this.planEditControls){
					this.planEditControls.remove();
					this.planEditControls = null;
				}
				if(!this.settingsEditControls){
					this.settingsEditControls = getSettingsEditControls(this.context);
					this.options.root.appendChild(this.settingsEditControls);
				}
			}
		} else {
			if(this.settingsEditControls){
				this.settingsEditControls.remove();
				this.settingsEditControls = null;
			}
			if(this.planEditControls){
				this.planEditControls.remove();
				this.planEditControls = null;
			}
		}
		if(this.isPlanActive()){
			this.context.skybox.stop();
			if(!this.context.planbox.isActive){
				this.context.planbox.start(this.planboxContainer);
			}
		} else {
			this.context.planbox.stop();
			if(!this.context.skybox.isActive){
				this.context.skybox.start(this.options.root);
			}
		}
	}
	
	private removeLoadingScreen(): void {
		let loadingScreen = document.getElementById("loading-screen");
		if(loadingScreen){
			loadingScreen.remove();
		}
	}

}