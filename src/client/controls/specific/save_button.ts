import {computable} from "boundable/boundable";
import {AppContext} from "context";
import {button} from "controls/common/button";
import {Control} from "controls/control";

export function getSaveButton(context: AppContext): Control {
	let saveButton = button({
		disabled: computable(() => !context.settings.hasUnsavedChanges()),
		onclick: () => context.settings.save(),
		text: "Сохранить"
	});

	return saveButton;
}