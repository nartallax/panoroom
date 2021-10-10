import {boundValue} from "boundable/boundable";
import {PanoramLinkType} from "building_plan";
import {FsTreeNode} from "utils";

export type SelectedSceneObjectDescription = { type: "floor", floorId: string} | { type: "panoram", panoramId: string }
export type SelectedSceneObject = SelectedSceneObjectDescription & { 
	object: THREE.Object3D;
	gizmoPoint: THREE.Vector3;
	parent?: THREE.Group;
	getLimits?: (direction: "x" | "y" | "z") => [number, number] | null;
	links: { a: THREE.Object3D, b: THREE.Object3D, link: THREE.Object3D }[];
}


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
	readonly isInLinkMode = boundValue(false);
	readonly selectedLinkType = boundValue<PanoramLinkType>("step");
}