import {AppContext} from "context";
import {button} from "controls/common/button";
import {tag} from "utils/dom_utils";
import {panel} from "controls/common/panel";
import {makeNodeBoundWatcher} from "controls/control";
import {getSettingsEditControls} from "controls/composite/settings_edit_controls";
import {getPlanEditControls} from "controls/composite/plan_edit/plan_edit_controls";
import {computable} from "boundable/boundable";

export interface LayoutControllerOptions {
	canEdit: boolean;
	root: HTMLElement;
}

// штука, контролирующая общий layout приложения
export class LayoutController {
	private readonly planboxContainer = tag({class: "planbox-container-nested"})
	private readonly planRoot = tag({class: "planbox-container"}, [this.planboxContainer]);
	private readonly skyboxContainer = panel({ class: "skybox-container" })

	constructor(private readonly context: AppContext, private readonly options: LayoutControllerOptions){}

	start(): void {
		this.options.root.appendChild(this.planRoot);
		this.options.root.appendChild(this.skyboxContainer);

		this.options.root.appendChild(tag({class: "view-control-buttons-container"}, [
			!this.options.canEdit? null: button({ 
				text: "Редактирование", 
				active: this.context.state.isInEditMode,
				onclick: () => this.context.state.isInEditMode(!this.context.state.isInEditMode())
			}),
			panel({
				hidden: computable(() => !this.context.state.isInEditMode())
			}, [
				button({
					text: "План", 
					active: this.context.state.isPlanActive,
					onclick: () => this.context.state.isPlanActive(!this.context.state.isPlanActive())
				})
			]),
		]));

		this.options.root.appendChild(getSettingsEditControls(this.context));
		this.planRoot.insertBefore(getPlanEditControls(this.context), this.planboxContainer);

		let watch = makeNodeBoundWatcher(this.options.root);
		watch(this.context.state.isPlanActive, isPlan => {
			// я бы мог упаковать это в computable и подписываться на него изнутри панели, но не буду
			// т.к. тогда подписки изнутри панели будут отрабатывать не обязательно раньше, чем эта подписка
			// т.е. боксы могут стартануть внутри элементов с display:none
			// а это ломает им размеры
			this.planRoot.style.display = isPlan? "": "none";
			this.skyboxContainer.style.display = isPlan? "none": "";
			if(isPlan){
				this.context.skybox.stop();
				if(!this.context.planbox.isActive){
					this.context.planbox.start(this.planboxContainer);
				}
			} else {
				this.context.planbox.stop();
				if(!this.context.skybox.isActive){
					this.context.skybox.start(this.skyboxContainer);
				}
			}
		});

		this.removeLoadingScreen();
	}

	private removeLoadingScreen(): void {
		let loadingScreen = document.getElementById("loading-screen");
		if(loadingScreen){
			loadingScreen.remove();
		}
	}

}