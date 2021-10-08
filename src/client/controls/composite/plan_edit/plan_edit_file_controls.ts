import {AppContext} from "context";
import {HtmlTaggable, tag} from "utils/dom_utils";
import {computable} from "boundable/boundable";
import {button} from "controls/common/button";
import {treeList, TreeListNode} from "controls/common/tree_list";
import {FsTreeNode, logError} from "utils";

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

function fsTreeToPanoramFsPath(fsTree: FsTreeNode[]): {[id: string]: string} {
	let panorams = {} as {[id: string]: string}
	let visit = (node: FsTreeNode, parentPath: string): void => {
		let currentFullPath = (parentPath? parentPath + "/": "") + node.name;
		let panoramId: string | undefined = undefined;
		if(node.children){
			node.children.forEach(node => visit(node, currentFullPath));
		} else {
			panoramId = filenameToPanoramId(currentFullPath);
			panorams[panoramId] = currentFullPath;
		}
	}

	fsTree.forEach(node => visit(node, ""));
	return panorams;
}

async function loadPanoramsFromFs(context: AppContext): Promise<void> {
	try {
		let fsPanoramTree = await context.api.enumeratePanoramFiles();
		context.state.panoramFsTree(fsPanoramTree);

		let allPanoramFsPaths = fsTreeToPanoramFsPath(fsPanoramTree);
		let knownPanorams = context.settings.panorams();
		for(let knownPanoramId in knownPanorams){
			let newPanoramFilename = allPanoramFsPaths[knownPanoramId];
			if(newPanoramFilename){
				knownPanorams[knownPanoramId].filename = newPanoramFilename
			}
		}

		for(let newPanoramId in allPanoramFsPaths){
			if(!(newPanoramId in knownPanorams)){
				knownPanorams[newPanoramId] = { filename: allPanoramFsPaths[newPanoramId] }
			}
		}
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
				context.settings.panorams.notify();
			} else if(panoram.position.floorId !== floorId) {
				panoram.position.floorId = floorId;
				context.settings.panorams.notify();
			}
		}
	});
	
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

	return [
		tag({ class: "button-toolbar" }, [
			tag({ class: "label medium", text: "Панорамы" }),
			addPanoramToFloorButton, removePanoramFromFloorButton
		]),
		tag({ class: "button-toolbar" }, [
			tag({ class: "label medium", text: "Текстура этажа" }),
			setImageBeFloorTexture, clearFloorTexture
		]),
		panoramTreeList
	]

}