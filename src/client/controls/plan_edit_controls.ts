import {computable} from "boundable/boundable";
import {BuildingFloor} from "building_plan";
import {AppContext} from "context";
import {button} from "controls/button";
import {dropDownList} from "controls/drop_down_list";
import {getSaveButton} from "controls/save_button";
import {treeList, TreeListNode} from "controls/tree_list";
import {FsTreeNode, logError, randomUniqId} from "utils";
import {tag} from "utils/dom_utils";

function filenameToPanoramId(filename: string): string {
	return filename.toLowerCase().replace(/\.[^./\\]$/, "");
}

function fsTreeToTreeListNodes(fsTree: FsTreeNode[]): TreeListNode[] {
	let treeItems: TreeListNode[] = [];
	let visit = (node: FsTreeNode): TreeListNode => {
		let panoramId: string | undefined = undefined;
		if(node.children){
			node.children.forEach(visit);
		} else {
			panoramId = filenameToPanoramId(node.name);
		}

		return {
			label: node.name,
			items: node.children?.map(visit),
			value: panoramId
		}
	}

	fsTree.forEach(node => {
		let treeNode = visit(node);
		treeItems.push(treeNode);
	});
	return treeItems;
}

function fsTreeToPanoramFsPath(fsTree: FsTreeNode[]): {[id: string]: string} {
	let panorams = {} as {[id: string]: string}
	let visit = (node: FsTreeNode): void => {
		let panoramId: string | undefined = undefined;
		if(node.children){
			node.children.forEach(visit);
		} else {
			panoramId = filenameToPanoramId(node.name);
			panorams[panoramId] = node.name
		}
	}

	fsTree.forEach(visit);
	return panorams;
}

async function loadPanoramsFromFs(context: AppContext): Promise<void> {
	try {
		let fsPanoramTree = await context.api.enumeratePanoramFiles();
		context.editorState.panoramFsTree(fsPanoramTree);

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

export function getPlanEditControls(context: AppContext): HTMLElement {

	let floorSelector = dropDownList({
		options: computable(() => {
			let floors = context.settings.floors();
			return Object.keys(floors)
				.map(floorId => {
					let floor = floors[floorId];
					return {label: floor.label, value: floorId};
				})
		}),
		value: context.editorState.selectedFloor
	})

	let addFloorButton = button({
		text: "+",
		onclick: () => {
			let floors = context.settings.floors()
			let id = randomUniqId(floors);
			let floor: BuildingFloor = {label: "Этаж", y: 0};
			floors[id] = (floor);
			context.settings.floors(floors);
			context.editorState.selectedFloor(id);
		}
	});
	
	let renameFloorButton = button({
		text: "Имя",
		disabled: computable(() => {
			return context.editorState.selectedFloor() === null
		}),
		onclick: () => {
			let floorId = context.editorState.selectedFloor();
			if(floorId){
				let newName = prompt("Введите имя этажа:")
				if(newName !== null){
					let floors = context.settings.floors();
					floors[floorId].label = newName;
					context.settings.floors(floors);
				}
			}
		}
	});
	
	let deleteFloorButton = button({
		text: "-",
		disabled: computable(() => context.editorState.selectedFloor() === null),
		onclick: () => {
			let floorId = context.editorState.selectedFloor();
			if(floorId){
				let floors = context.settings.floors();
				delete floors[floorId];
				context.settings.floors(floors);
			}
		}
	});

	let hideInactiveFloorsToggleButton = button({
		text: "Прятать",
		onclick: () => {
			context.editorState.hideInactiveFloors(!context.editorState.hideInactiveFloors());
		}
	});

	let panoramTreeList = treeList({ 
		value: context.editorState.selectedPanoram,
		items: computable(() => fsTreeToTreeListNodes(context.editorState.panoramFsTree()))
	});

	loadPanoramsFromFs(context);

	let addPanoramToFloorButton = button({
		text: "+",
		disabled: computable(() => {
			let panoramId = context.editorState.selectedPanoram();
			let floorId = context.editorState.selectedFloor();
			return floorId === null ||
				panoramId === null ||
				context.settings.panorams()[panoramId].position?.floorId === floorId;
		}),
		onclick: () => {
			let panoramId = context.editorState.selectedPanoram();
			let floorId = context.editorState.selectedFloor();
			if(!panoramId || !floorId){
				return;
			}
			let panorams = context.settings.panorams();
			let panoram = panorams[panoramId];
			if(!panoram.position){
				panoram.position = {floorId, x: 0, y: 0, rotation: 0 }
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
			let panoramId = context.editorState.selectedPanoram();
			let panorams = context.settings.panorams();
			return panoramId === null || !panorams[panoramId].position
		}),
		onclick: () => {
			let panoramId = context.editorState.selectedPanoram();
			if(!panoramId){
				return;
			}
			let panorams = context.settings.panorams();
			let panoram = panorams[panoramId];
			delete panoram.position;
			delete panoram.links;
			context.settings.panorams.notify();
		}
	});

	return tag({class: "plan-edit-controls-container"}, [
		tag({ class: "button-toolbar" }, [
			tag({ class: "label big", text: "Общий план" }),
			getSaveButton(context)
		]),
		tag({ class: "button-toolbar" }, [
			tag({ class: "label medium", text: "Этаж" }),
			addFloorButton, renameFloorButton, deleteFloorButton, hideInactiveFloorsToggleButton
		]),
		floorSelector,
		tag({ class: "button-toolbar" }, [
			tag({ class: "label medium", text: "Панорамы" }),
			addPanoramToFloorButton, removePanoramFromFloorButton
		]),
		panoramTreeList
	])

}