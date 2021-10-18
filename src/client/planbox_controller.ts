import {BuildingFloor, Panoram} from "building_plan";
import {AppContext} from "context";
import {isInteractiveObject, THREE} from "threejs_decl";
import {defaultViewSettings} from "settings_controller";
import {SkyboxController} from "skybox_controller";

export const floorYOffset = 1000;

interface FloorObject {
	group: THREE.Group;
	mesh: THREE.Mesh;
	geometry: THREE.PlaneGeometry;
	textureImageId?: string;
	material: THREE.Material;
	width: number;
	length: number;
}

interface PanoramObject {
	mesh: THREE.Mesh;
	geometry: THREE.BufferGeometry;
	material: THREE.Material;
	floorId: string;
	label: string;
	links: {[panoramIdTo: string]: LinkObject}
}

interface LinkObject {
	mesh: THREE.Object3D;
	fromId: string;
	toId: string;
}

const linkRadius = 0.25;

export class PlanboxController extends SkyboxController {

	private floors: {[floorId: string]: FloorObject} = {};
	private panorams: {[panoramId: string]: PanoramObject} = {};
	
	private linkLineMaterial = new THREE.MeshBasicMaterial({ color: "#FFAE00", side: THREE.FrontSide });
	private linkLineGeometry = new THREE.CylinderGeometry(linkRadius, linkRadius, 1, 4);
	private linkSelectStartPanoramId = null as string | null;
	

	constructor(context: AppContext){
		super(context.settings.clone({
			...defaultViewSettings,
			fov: context.settings.fov(),
			skyboxHeight: 2,
			skyboxRadialSegments: 4
		}), context, null, null, true);

		new THREE.Interaction(this.renderer, this.scene, this.camera);

		this.camera.position.x = 100;
		this.camera.position.z = 100;
		this.camera.position.y = 1100;
		this.camera.lookAt(0, 1000, 0);

		this.watch(context.settings.floors, floors => this.updateFloors(floors));
		this.watch(context.settings.panorams, panorams => this.updatePanorams(panorams));
		this.linkStates();
	}

	stop(): void {
		super.stop();
		for(let floorId in this.floors){
			let obj = this.floors[floorId];
			this.scene.remove(obj.mesh);
			obj.geometry.dispose();
		}
	}

	start(el: HTMLElement): void {
		super.start(el);
	}

	protected getKeyboardCameraMovingSpeed(): number {
		return 0.05;
	}

	private createUpdateFloorObject(floor: BuildingFloor, floorId: string, oldFloorObject?: FloorObject): FloorObject {
		// разбираемся с геометрией
		let geometry: THREE.PlaneGeometry | null = null;
		if(oldFloorObject){
			if(oldFloorObject.width === floor.width && oldFloorObject.length === floor.length){
				geometry = oldFloorObject.geometry
			} else {
				oldFloorObject.geometry.dispose();
			}
		}
		if(!geometry){
			geometry = new THREE.PlaneGeometry(floor.width, floor.length)
		}

		// разбираемся с материалом и текстурами
		let textureImageId: string | undefined = undefined;
		let material: THREE.Material | null = null;
		if(oldFloorObject){
			if(oldFloorObject.textureImageId === floor.texture){
				textureImageId = oldFloorObject.textureImageId;
				material = oldFloorObject.material;
			} else {
				oldFloorObject.material.dispose();
				if(oldFloorObject.textureImageId){
					this.textureRepo.unrefTextureByImageId(oldFloorObject.textureImageId);
				}
			}
		}
		if(!material){
			if(floor.texture){
				textureImageId = floor.texture;
				material = new THREE.MeshBasicMaterial({ 
					map: this.textureRepo.imageIdToTexture(floor.texture),
					side: THREE.DoubleSide,
					transparent: true
				})
			} else {
				material = new THREE.MeshBasicMaterial({
					color: "#aaa",
					side: THREE.DoubleSide
				});
			}
		}

		// разбираемся с группой
		let group: THREE.Group;
		if(oldFloorObject){
			group = oldFloorObject.group;
		} else {
			group = new THREE.Group();
		}

		group.position.x = floor.x;
		group.position.y = floor.y + floorYOffset;
		group.position.z = floor.z;
		group.rotation.y = floor.rotation;

		// разбираемся с объектом плоскости этажа
		let obj: THREE.Mesh;
		if(oldFloorObject){
			obj = oldFloorObject.mesh;
		} else {
			obj = new THREE.Mesh();
			obj.name = "floor_" + floorId;
			group.add(obj);
			this.addGizmoHandlers(obj, point => this.selectFloor(floorId, point));
		}
		obj.geometry = geometry;
		obj.material = material;
		obj.rotation.x = Math.PI / 2; // иначе он будет стоять вертикально
		
		let result = Object.assign(oldFloorObject || {}, { 
			geometry, 
			mesh: obj, 
			group, 
			material, 
			textureImageId: textureImageId, 
			width: floor.width, 
			length: floor.length 
		});
		return result;
	}

	private disposePanoramObject(panoramId: string): void {
		let panoramObject = this.panorams[panoramId];
		let panorams = this.context.settings.panorams();
		let panoram = panorams[panoramId];

		panoramObject.geometry.dispose();
		panoramObject.material.dispose();
		this.textureRepo.unrefTextTexture(panoramObject.label)
		if(panoramObject.mesh.parent){
			panoramObject.mesh.parent.remove(panoramObject.mesh)
		}

		delete panoram.position;
		delete panoram.links;
		for(let otherPanoramId in panoramObject.links){
			let mesh = panoramObject.links[otherPanoramId].mesh;
			if(mesh.parent){
				mesh.parent.remove(mesh);
			}
			delete this.panorams[otherPanoramId].links[panoramId];
			let otherPanoram = panorams[otherPanoramId];
			if(otherPanoram.links){
				otherPanoram.links = otherPanoram.links.filter(x => x.panoramId !== panoramId);
				if(otherPanoram.links.length === 0){
					delete otherPanoram.links;
				}
			}
		}

		delete this.panorams[panoramId]; 
	}

	private updateFloors(floors: {[floorId: string]: BuildingFloor}): void {
		for(let floorId in this.floors){
			let obj = this.floors[floorId];
			if(!(floorId in floors)){
				// FIXME: обновлять this.panorams - удалять оттуда панорамы удаленных этажей
				delete this.floors[floorId];
				this.scene.remove(obj.group);
				obj.geometry.dispose();
				if(obj.textureImageId){
					this.textureRepo.unrefTextureByImageId(obj.textureImageId);
				}
				obj.material.dispose();
			}
		}

		for(let panoramId in this.panorams){
			if(!(this.panorams[panoramId].floorId in this.floors)){
				this.disposePanoramObject(panoramId)
			}
		}

		for(let floorId in floors){
			let floor = floors[floorId];
			if(floorId in this.floors){
				this.createUpdateFloorObject(floor, floorId, this.floors[floorId]);
			} else {
				let obj = this.createUpdateFloorObject(floor, floorId);
				this.scene.add(obj.group);
				this.floors[floorId] = obj;
			}
		}

		this.forEachLink(linkObj => this.calcAndSetRotationScaleForLinkLine(
			this.panorams[linkObj.fromId].mesh,
			this.panorams[linkObj.toId].mesh,
			linkObj.mesh
		));
	}

	private makePanoramMaterialGeometry(text: string): {material: THREE.Material, geometry: THREE.BufferGeometry} {
		let texture = this.textureRepo.textToTexture(text)
		let material = new THREE.MeshBasicMaterial({ map: texture.texture, side: THREE.FrontSide })
		let geometry = new THREE.PlaneGeometry(
			texture.width * this.context.settings.planLabelScale(), 
			texture.height * this.context.settings.planLabelScale()
		);
		return {material, geometry}
	}

	private createUpdatePanoramObject(panoram: Panoram, panoramId: string, floorId: string, oldPanoramObject?: PanoramObject): PanoramObject {
		if(!panoram.position){
			throw new Error("Could not add panoram: no position");
		}

		let mesh: THREE.Mesh | null = null;
		let material: THREE.Material | null = null
		let geometry: THREE.BufferGeometry | null = null
		let label: string | null = null
		if(oldPanoramObject){
			mesh = oldPanoramObject.mesh;
			if(oldPanoramObject.label === panoram.label){
				material = oldPanoramObject.material;
				geometry = oldPanoramObject.geometry;
				label = oldPanoramObject.label;
			} else {
				oldPanoramObject.material.dispose();
				oldPanoramObject.geometry.dispose();
				this.textureRepo.unrefTextTexture(oldPanoramObject.label);
			}
		}
		if(!mesh){
			mesh = new THREE.Mesh();
			this.addLinkageHandlers(mesh, panoramId);
			this.addGizmoHandlers(mesh, point => this.selectPanoram(panoramId, point));
		}
		if(!label || !material || !geometry){
			label = panoram.label;
			let mg = this.makePanoramMaterialGeometry(label);
			mesh.geometry = geometry = mg.geometry;
			mesh.material = material = mg.material;
		}
		mesh.name = "panoram_" + panoramId;
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.x = panoram.position.x;
		mesh.position.z = panoram.position.z;
		mesh.position.y = 0.35;

		let resultFloorId: string | null = null;
		if(oldPanoramObject){
			if(oldPanoramObject.floorId !== floorId){
				let floor = this.floors[oldPanoramObject.floorId];
				if(floor){
					floor.group.remove(mesh);
				}
			} else {
				resultFloorId = oldPanoramObject.floorId;
			}
		}
		if(!resultFloorId){
			resultFloorId = floorId;
			let floor = this.floors[floorId];
			floor.group.add(mesh);
		}

		let oldLinkObjects: {[panoramIdTo: string]: LinkObject} = oldPanoramObject?.links || {};
		let linkObjects: {[panoramIdTo: string]: LinkObject} = {};
		if(oldPanoramObject){
			oldPanoramObject.links = linkObjects;
		}
		(panoram.links || []).forEach(link => {
			if(link.panoramId in oldLinkObjects){
				linkObjects[link.panoramId] = oldLinkObjects[link.panoramId]
				/* 
				// можно не пересчитывать, для ускорения обсчета
				// если мы обновляем позиции линков по мере движения объектов, к которым они привязаны
				this.calcAndSetRotationScaleForLinkLine(
					this.panorams[link.panoramId].mesh, 
					this.panorams[panoramId].mesh,
					oldLinkObjects[link.panoramId].mesh
				);
				*/
			} else {
				// проверка - чтобы при загрузке не пытаться создавать линки между объектами раньше объектов
				// т.е. ничего страшного, если другого объекта нет - когда дойдет очередь до другого объекта, линк будет создан
				if(link.panoramId in this.panorams && mesh){
					let newLink = this.makeLinkObject(mesh, panoramId, this.panorams[link.panoramId].mesh, link.panoramId);
					linkObjects[link.panoramId] = newLink;
					this.panorams[link.panoramId].links[panoramId] = newLink;
					this.scene.add(newLink.mesh);
				}
			}
		});
		for(let otherPanoramId in oldLinkObjects){
			if(!(otherPanoramId in linkObjects)){
				let oldLinkObject = oldLinkObjects[otherPanoramId];
				if(oldLinkObject.mesh.parent){
					oldLinkObject.mesh.parent.remove(oldLinkObject.mesh);
				}
				delete oldLinkObjects[otherPanoramId];
				delete this.panorams[otherPanoramId].links[panoramId];
			}
		}

		let result = Object.assign(oldPanoramObject || {}, {
			mesh, 
			floorId: resultFloorId,
			material, geometry, label,
			links: linkObjects
		});
		return result;
	}

	private makeLinkObject(fromPanoramMesh: THREE.Object3D, fromPanoramId: string, toPanoramMesh: THREE.Object3D, toPanoramId: string): LinkObject {
		let mesh = new THREE.Mesh(this.linkLineGeometry, this.linkLineMaterial);
		this.calcAndSetRotationScaleForLinkLine(fromPanoramMesh, toPanoramMesh, mesh);
		return {
			fromId: fromPanoramId,
			toId: toPanoramId,
			mesh
		}
	}

	private addLinkageHandlers(mesh: THREE.Object3D, panoramId: string): void {
		if(!isInteractiveObject(mesh)){
			return;
		}

		mesh.on("mousedown", () => {
			if(!this.context.state.isInLinkMode() || !this.context.state.isInEditMode()){
				return;
			}

			this.linkSelectStartPanoramId = panoramId;
		});

		mesh.on("mouseup", () => {
			if(!this.context.state.isInLinkMode() || !this.context.state.isInEditMode() || !this.linkSelectStartPanoramId){
				return;
			}

			let fromId = this.linkSelectStartPanoramId;
			let toId = panoramId;
			this.linkSelectStartPanoramId = null;
			if(fromId === toId){
				return;
			}

			let existingLink = this.panorams[fromId].links[toId];
			let panorams = this.context.settings.panorams();
			let toLinks = panorams[toId].links || [];
			let fromLinks = panorams[fromId].links || [];
			if(existingLink){
				toLinks = toLinks.filter(x => x.panoramId !== fromId);
				fromLinks = fromLinks.filter(x => x.panoramId !== toId);
			} else {
				toLinks.push({
					panoramId: fromId,
					type: this.context.state.selectedLinkType(),
					x: Math.random(),
					y: 0.5
				})

				fromLinks.push({
					panoramId: toId,
					type: this.context.state.selectedLinkType(),
					x: Math.random(),
					y: 0.5
				});
			}

			panorams[toId].links = toLinks.length === 0? undefined: toLinks;
			panorams[fromId].links = fromLinks.length === 0? undefined: fromLinks;
			this.context.settings.panorams.notify();
		})
	}

	private updatePanorams(panorams: {[panoramId: string]: Panoram}): void {
		for(let panoramId in this.panorams){
			if(!(panoramId in panorams) || !panorams[panoramId].position){
				this.disposePanoramObject(panoramId)
			}
		}

		for(let panoramId in panorams){
			let panoram = panorams[panoramId];
			if(!panoram.position){
				continue;
			}
			this.panorams[panoramId] = this.createUpdatePanoramObject(panoram, panoramId, panoram.position.floorId, this.panorams[panoramId]);
		}
	}

	// assuming there is such panoram
	private selectPanoram(panoramId: string, point?: THREE.Vector3): void {
		let selectedObj = this.context.state.selectedSceneObject();
		if(selectedObj && selectedObj.type === "panoram" && selectedObj.panoramId === panoramId){
			return;
		}
		let {floorId, mesh, links} = this.panorams[panoramId];
		let floorGroup = this.floors[floorId].group
		if(!point){
			point = new THREE.Vector3();
			mesh.getWorldPosition(point);
		}

		let relatedLinks = Object.keys(links).map(otherPanoramId => {
			return { a: mesh, b: this.panorams[otherPanoramId].mesh, link: links[otherPanoramId].mesh };
		})

		this.context.state.selectedSceneObject({
			type: "panoram",
			object: mesh,
			gizmoPoint: point,
			panoramId: panoramId,
			parent: floorGroup,
			getLimits: dir => this.getPanoramMovementLimits(dir, panoramId),
			links: relatedLinks
		})
	}

	private selectFloor(floorId: string, point?: THREE.Vector3): void {
		let floorObj = this.floors[floorId]

		this.context.state.selectedSceneObject({
			type: "floor",
			floorId: floorId,
			gizmoPoint: point || floorObj.group.position,
			object: floorObj.group,
			links: this.getFloorRelatedLinks(floorId).map(linkObj => ({
				a: this.panorams[linkObj.fromId].mesh,
				b: this.panorams[linkObj.toId].mesh,
				link: linkObj.mesh
			}))
		});
	}

	private getPanoramMovementLimits(direction: "x" | "y" | "z", panoramId: string): [number, number] | null {
		if(direction === "y"){
			return null;
		}

		let floor = this.floors[this.panorams[panoramId].floorId];
		return direction === "x"? [-floor.width / 2, floor.width / 2]: [-floor.length / 2, floor.length / 2];
	}

	private getFloorRelatedLinks(floorId: string): LinkObject[]{
		let result = [] as LinkObject[];
		for(let panoramId in this.panorams){
			let panoramObject = this.panorams[panoramId];
			if(panoramObject.floorId === floorId){
				for(let otherPanoramId in panoramObject.links){
					result.push(panoramObject.links[otherPanoramId]);
				}
			}
		}
		return result;
	}

	private forEachLink(handler: (linkObj: LinkObject) => void): void{
		for(let panoramId in this.panorams){
			let panoramObject = this.panorams[panoramId];
			for(let otherPanoramId in panoramObject.links){
				handler(panoramObject.links[otherPanoramId]);
			}
		}
	}

	// провязка состояния контролов и состояния 3д-сцены
	private linkStates(){
		this.watch(this.context.state.selectedSceneObject, v => {
			if(!v){
				this.context.state.selectedImage(null);
			} else if(v.type === "panoram"){
				let panoram = this.context.settings.panorams()[v.panoramId];
				if(panoram.position){
					this.context.state.selectedFloor(panoram.position.floorId);
				}
				this.context.state.selectedImage(v.panoramId);
			} else if(v.type === "floor"){
				this.context.state.selectedFloor(v.floorId)
				this.context.state.selectedImage(null);
			}
		});
	
		this.watch(this.context.state.selectedFloor, floorId => {
			if(this.context.state.hideInactiveFloors()){
				for(let otherFloorId in this.floors){
					let group = this.floors[otherFloorId].group;
					if(otherFloorId !== floorId && group.parent){
						group.parent.remove(group);
					}
				}

				this.forEachLink(linkObj => {
					if(linkObj.mesh.parent){
						linkObj.mesh.parent.remove(linkObj.mesh);
					}
				})

				if(floorId){
					let currentFloorGroup = this.floors[floorId].group;
					if(!currentFloorGroup.parent){
						this.scene.add(currentFloorGroup);
					}
					this.getFloorRelatedLinks(floorId).forEach(linkObject => {
						this.scene.add(linkObject.mesh);
					})
				}
			}

			let selectedObj = this.context.state.selectedSceneObject();
			if(selectedObj && (selectedObj.type !== "floor" || selectedObj.floorId === floorId)){
				return;
			}
			if(!floorId){
				this.context.state.selectedSceneObject(null);
				return;
			}
	
			this.selectFloor(floorId);
		});

		this.watch(this.context.state.selectedImage, panoramId => {
			let selectedObj = this.context.state.selectedSceneObject();
			
			if(!panoramId){
				if(selectedObj && selectedObj.type === "panoram"){
					this.context.state.selectedSceneObject(null);
				}
				return;
			}

			let panoram = this.context.settings.panorams()[panoramId];
			if(!panoram.position){
				if(selectedObj && selectedObj.type === "panoram"){
					this.context.state.selectedSceneObject(null);
				}
				return;
			} else {
				this.selectPanoram(panoramId);
			}
		})

		// чтоб при добавлении панорамы сразу включался гизмо
		this.watch(this.context.settings.panorams, () => {
			let panoramId = this.context.state.selectedImage();
			if(!panoramId){
				return;
			}

			let panoram = this.context.settings.panorams()[panoramId];
			if(!panoram.position){
				return;
			}

			let selectedObj = this.context.state.selectedSceneObject();
			if(!selectedObj || (selectedObj.type === "floor" && selectedObj.floorId === panoram.position.floorId)){
				this.selectPanoram(panoramId);
			}
		})

		this.watch(this.context.settings.planLabelScale, () => {
			for(let panoramId in this.panorams){
				let p = this.panorams[panoramId];
				p.material.dispose();
				p.geometry.dispose();
				let mg = this.makePanoramMaterialGeometry(p.label);
				p.mesh.material = p.material = mg.material;
				p.mesh.geometry = p.geometry = mg.geometry;
			}
		});

		this.watch(this.context.state.hideInactiveFloors, doHide => {
			let selectedFloorId = this.context.state.selectedFloor();
			if(!selectedFloorId){
				return
			}

			for(let floorId in this.floors){
				if(floorId === selectedFloorId){
					continue;
				}
				let floorObj = this.floors[floorId];
				if(!floorObj.group.parent && !doHide){
					this.scene.add(floorObj.group)
				} else if(floorObj.group.parent && doHide){
					floorObj.group.parent.remove(floorObj.group);
				}
			}

			let floorRelatedLinks = new Set(this.getFloorRelatedLinks(selectedFloorId));
			this.forEachLink(linkObject => {
				if(floorRelatedLinks.has(linkObject)){
					if(!linkObject.mesh.parent){
						this.scene.add(linkObject.mesh);
					}
				} else {
					if(doHide && linkObject.mesh.parent){
						linkObject.mesh.parent.remove(linkObject.mesh);
					} else if(!doHide && !linkObject.mesh.parent){
						this.scene.add(linkObject.mesh);
					}
				}
			});
			
		});

	}

	protected shouldShowCompassOnEdit(): boolean {
		return false;
	}

}