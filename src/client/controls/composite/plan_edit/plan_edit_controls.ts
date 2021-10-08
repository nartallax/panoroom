import {AppContext} from "context";
import {getSaveButton} from "controls/specific/save_button";
import {tag} from "utils/dom_utils";
import {getPlanEditFloorControls} from "controls/composite/plan_edit/plan_edit_floor_controls";
import {panel} from "controls/common/panel";
import {computable} from "boundable/boundable";
import {getPlanEditFileControls} from "controls/composite/plan_edit/plan_edit_file_controls";

export function getPlanEditControls(context: AppContext): HTMLElement {

	let result = panel({
		class: "plan-edit-controls-container",
		hidden: computable(() => !context.state.isInEditMode() || !context.state.isPlanActive())
	}, [
		tag({ class: "button-toolbar" }, [
			tag({ class: "label big", text: "Общий план" }),
			getSaveButton(context)
		]),
		...getPlanEditFloorControls(context),
		...getPlanEditFileControls(context)
	]);

	return result;

}