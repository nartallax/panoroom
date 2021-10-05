import {boundValue} from "boundable/boundable";
import {FsTreeNode} from "utils";

// набор каких-то значений, которые не имеет смысла постоянно хранить
// (они имеют смысл в пределах одного запуска приложения)
export class AppState {
	readonly isPlanActive = boundValue(false);
	readonly isInEditMode = boundValue(false);
	readonly selectedFloor = boundValue(null as string | null);
	readonly selectedImage = boundValue(null as string | null);
	readonly hideInactiveFloors = boundValue(false);
	readonly panoramFsTree = boundValue([] as FsTreeNode[])
}