import {boundValue} from "boundable/boundable";
import {FsTreeNode} from "utils";

export type SelectedSceneObjectDescription = { type: "floor", floorId: string} | { type: "panoram", panoramId: string }
export type SelectedSceneObject = SelectedSceneObjectDescription & { object: THREE.Object3D }


// набор каких-то значений, которые не имеет смысла постоянно хранить
// (они имеют смысл в пределах одного запуска приложения)
export class AppState {
	readonly isPlanActive = boundValue(false);
	readonly isInEditMode = boundValue(false);
	readonly selectedFloor = boundValue(null as string | null);
	readonly selectedImage = boundValue(null as string | null);
	readonly hideInactiveFloors = boundValue(false);
	readonly panoramFsTree = boundValue([] as FsTreeNode[])
	readonly selectedSceneObject = boundValue(null as null | SelectedSceneObject);
}