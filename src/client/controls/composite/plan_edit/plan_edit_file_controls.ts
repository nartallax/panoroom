import {AppContext} from "context";
import {HtmlTaggable, tag} from "utils/dom_utils";
import {computable} from "boundable/boundable";
import {button} from "controls/common/button";
import {treeList, TreeListNode} from "controls/common/tree_list";
import {FsTreeNode, logError} from "utils";
import {Panoram, PanoramLinkType} from "building_plan";
import {movePositionToLocal} from "utils/three_global_pos_to_local";
import {slider} from "controls/common/slider";
import {dropDownList} from "controls/common/drop_down_list";

function filenameToPanoramId(filename: string): string {
	return filename.toLowerCase().replace(/\.[^./\\]*$/, "");
}

function fsTreeToTreeListNodes(fsTree: FsTreeNode[]): TreeListNode[] {
	let treeItems: TreeListNode[] = [];
	let visit = (node: FsTreeNode, parentPath: string): TreeListNode => {
		let currentFullPath = (parentPath? parentPath + "/": "") + node.name;
		let panoramId = node.children? undefined: filenameToPanoramId(currentFullPath);

		let label = node.name;
		if(panoramId){
			label = filenameToPanoramId(label);
		}
		if(node.dimensions){
			label += ` (${node.dimensions.width} x ${node.dimensions.height})`;
		}

		return {
			label: label,
			items: node.children?.map(node => visit(node, currentFullPath)),
			value: panoramId
		}
	}

	fsTree.forEach(node => {
		let treeNode = visit(node, "");
		treeItems.push(treeNode);
	});
	return treeItems;
}

function updatePanoramsByFsTree(fsTree: FsTreeNode[], knownPanorams: { [panoramId:string]: Panoram}): void {
	let visit = (node: FsTreeNode, parentPath: string): void => {
		let currentFullPath = (parentPath? parentPath + "/": "") + node.name;
		let panoramId: string | undefined = undefined;
		if(node.children){
			node.children.forEach(node => visit(node, currentFullPath));
		} else {
			panoramId = filenameToPanoramId(currentFullPath);
			if(!(panoramId in knownPanorams)){
				knownPanorams[panoramId] = {filename: "", label: ""}
			}
			knownPanorams[panoramId].filename = currentFullPath
			knownPanorams[panoramId].label = filenameToPanoramId(node.name)
		}
	}

	fsTree.forEach(node => visit(node, ""));
}

async function loadPanoramsFromFs(context: AppContext): Promise<void> {
	try {
		let fsPanoramTree = await context.api.enumeratePanoramFiles();
		context.state.panoramFsTree(fsPanoramTree);

		let knownPanorams = context.settings.panorams();
		updatePanoramsByFsTree(fsPanoramTree, knownPanorams);
		context.settings.panorams(knownPanorams)
	} catch(e){
		logError(e);
	}
}

export function getPlanEditFileControls(context: AppContext): HtmlTaggable[] {

	let panoramTreeList = treeList({ 
		value: context.state.selectedImage,
		items: computable(() => fsTreeToTreeListNodes(context.state.panoramFsTree()))
	});

	loadPanoramsFromFs(context);

	let addPanoramToFloorButton = button({
		text: "+",
		disabled: computable(() => {
			let panoramId = context.state.selectedImage();
			let floorId = context.state.selectedFloor();
			return floorId === null ||
				panoramId === null ||
				context.settings.panorams()[panoramId].position?.floorId === floorId;
		}),
		onclick: () => {
			let panoramId = context.state.selectedImage();
			let floorId = context.state.selectedFloor();
			if(!panoramId || !floorId){
				return;
			}
			let panorams = context.settings.panorams();
			let panoram = panorams[panoramId];
			if(!panoram.position){
				panoram.position = {floorId, x: 0, z: 0, rotation: 0 }
			} else if(panoram.position.floorId !== floorId) {
				panoram.position.floorId = floorId;
			}

			let selectedObj = context.state.selectedSceneObject();
			if(selectedObj && selectedObj.type === "floor"){
				let vec = selectedObj.gizmoPoint.clone()
				movePositionToLocal(vec, selectedObj.object);
				panoram.position.x = vec.x;
				panoram.position.z = vec.z;
			}

			context.settings.panorams.notify();
		}
	});

	let toggleLinkModeButton = button({
		text: "Связи",
		active: context.state.isInLinkMode,
		onclick: () => {
			context.state.isInLinkMode(!context.state.isInLinkMode());
		}
	});

	let linkTypeSelector = dropDownList<PanoramLinkType>({
		options: [{
			value: "door",
			label: "Дверь",
		}, {
			value: "stairs",
			label: "Лестница"
		}, {
			value: "step",
			label: "Шаг"
		}],
		value: context.state.selectedLinkType
	})
	
	let removePanoramFromFloorButton = button({
		text: "-",
		disabled: computable(() => {
			let panoramId = context.state.selectedImage();
			let panorams = context.settings.panorams();
			return panoramId === null || !panorams[panoramId].position
		}),
		onclick: () => {
			let panoramId = context.state.selectedImage();
			if(!panoramId){
				return;
			}
			let panorams = context.settings.panorams();
			let panoram = panorams[panoramId];
			delete panoram.position;
			delete panoram.links;
			context.settings.panorams.notify();

			let selectedObj = context.state.selectedSceneObject();
			if(selectedObj && selectedObj.type === "panoram" && selectedObj.panoramId === panoramId){
				context.state.selectedSceneObject(null);
			}
		}
	});

	let setImageBeFloorTexture = button({
		text: "+",
		disabled: computable(() => {
			let imgId = context.state.selectedImage();
			let floorId = context.state.selectedFloor();
			let floors = context.settings.floors();
			return !imgId || !floorId || floors[floorId].texture === imgId;
		}),
		onclick: () => {
			let imgId = context.state.selectedImage();
			let floorId = context.state.selectedFloor();
			if(!imgId || !floorId){
				return;
			}
			let floors = context.settings.floors();
			floors[floorId].texture = imgId;
			context.settings.floors(floors);
		}
	});

	let clearFloorTexture = button({
		text: "-",
		disabled: computable(() => {
			let floorId = context.state.selectedFloor();
			let floors = context.settings.floors();
			return !floorId || !floors[floorId].texture
		}),
		onclick: () => {
			let floorId = context.state.selectedFloor();
			if(!floorId){
				return;
			}
			let floors = context.settings.floors();
			delete floors[floorId].texture;
			context.settings.floors(floors);
		}
	});

	let goIntoPanoramButton = button({
		text: "В панораму",
		disabled: computable(() => {
			let panoramId = context.state.selectedImage();
			return !panoramId || !context.settings.panorams()[panoramId].position
		}),
		onclick: () => {
			let panoramId = context.state.selectedImage();
			if(panoramId){
				let panoram = context.settings.panorams()[panoramId];
				if(panoram.position){
					context.state.currentDisplayedPanoram(panoramId);
					context.state.isPlanActive(false);
				}
			}
		}
	})

	let planLabelScaleInput = slider({
		label: "Масштаб текста на плане",
		value: context.settings.planLabelScale,
		min: 1/200,
		max: 1/10
	})

	return [
		tag({ class: "button-toolbar" }, [
			tag({ class: "label medium", text: "Текстура этажа" }),
			setImageBeFloorTexture, clearFloorTexture
		]),
		planLabelScaleInput,
		tag({ class: "button-toolbar" }, [
			tag({ class: "label medium", text: "Панорамы" }),
			addPanoramToFloorButton, removePanoramFromFloorButton, goIntoPanoramButton
		]),
		tag({ class: "button-toolbar" }, [
			toggleLinkModeButton, linkTypeSelector
		]),
		panoramTreeList
	]

}