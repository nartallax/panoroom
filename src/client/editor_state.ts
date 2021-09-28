import {boundValue} from "boundable/boundable";
import {FsTreeNode} from "utils";

export class EditorState {
	readonly selectedFloor = boundValue(null as string | null);
	readonly selectedPanoram = boundValue(null as string | null);
	readonly hideInactiveFloors = boundValue(false);
	readonly panoramFsTree = boundValue([] as FsTreeNode[])
}