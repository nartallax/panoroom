import {BuildingFloor, Panoram} from "building_plan";
import {AppContext} from "context";
import {KeyboardCameraControls, setupKeyboardCameraMovement} from "keyboard_camera_movement";
import {THREE} from "threejs_decl";
import {defaultViewSettings} from "settings_controller";
import {GizmoController} from "gizmo_controller";

export const floorYOffset = 1000;

interface FloorObject {
	group: THREE.Group;
	object: THREE.Mesh;
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
}

export class PlanboxController extends GizmoController {

	private keyboardCameraControls: KeyboardCameraControls | null = null;
	private floors: {[floorId: string]: FloorObject} = {};
	private panorams: {[panoramId: string]: PanoramObject} = {};
	
	/*
	private panoramObjectMaterial = new THREE.MeshBasicMaterial({
		color: "#ddd",
		side: THREE.FrontSide
	});	
	private panoramObjectGeometry = new THREE.CylinderGeometry(3, 3, 0.5, 8);
	*/
	

	constructor(context: AppContext){
		super(context.settings.clone({
			...defaultViewSettings,
			fov: context.settings.fov(),
			skyboxHeight: 2,
			skyboxRadialSegments: 4
		}), context);

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
		if(this.keyboardCameraControls){
			this.keyboardCameraControls.clear();
			this.keyboardCameraControls = null;
		}
		for(let floorId in this.floors){
			let obj = this.floors[floorId];
			this.scene.remove(obj.object);
			obj.geometry.dispose();
		}
	}

	start(el: HTMLElement): void {
		super.start(el);
		this.keyboardCameraControls = setupKeyboardCameraMovement(this.camera, 0.05)
	}

	protected onFrame(timePassed: number): void {
		super.onFrame(timePassed);
		if(this.keyboardCameraControls){
			this.keyboardCameraControls.onFrame(timePassed);
		}
	}

	protected updateCamera(): void {
		// ничего. не надо трогать камеру здесь
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
					side: THREE.DoubleSide
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
			obj = oldFloorObject.object;
		} else {
			obj = new THREE.Mesh();
			obj.name = "floor_" + floorId;
			group.add(obj);
			this.addGizmoHandlers(obj, group, {type: "floor", floorId });
		}
		obj.geometry = geometry;
		obj.material = material;
		obj.rotation.x = Math.PI / 2; // иначе он будет стоять вертикально
		
		let result = Object.assign(oldFloorObject || {}, { 
			geometry, 
			object: obj, 
			group, 
			material, 
			textureImageId: textureImageId, 
			width: floor.width, 
			length: floor.length 
		});
		return result;
	}

	private disposePanoramObject(panoramId: string): void {
		let panoram = this.panorams[panoramId];
		panoram.geometry.dispose();
		panoram.material.dispose();
		this.textureRepo.unrefTextTexture(panoram.label)
		if(panoram.mesh.parent){
			panoram.mesh.parent.remove(panoram.mesh)
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
			this.addGizmoHandlers(mesh, mesh, {type: "panoram", panoramId }, 
				this.floors[floorId].group,
				dir => this.getPanoramMovementLimits(dir, panoramId)
			);
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
		mesh.position.y = 0.75;

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

		let result = Object.assign(oldPanoramObject || {}, {
			mesh, 
			floorId: resultFloorId,
			material, geometry, label
		});
		return result;
	}

	private updatePanorams(panorams: {[panoramId: string]: Panoram}): void {
		for(let panoramId in this.panorams){
			if(!(panoramId in panorams) || !panorams[panoramId].position){
				this.disposePanoramObject(panoramId)
			}
		}

		for(let panoramId in panorams){
			let panoram = panorams[panoramId];
			if(!panoram || !panoram.position){
				continue;
			}
			this.panorams[panoramId] = this.createUpdatePanoramObject(panoram, panoramId, panoram.position.floorId, this.panorams[panoramId]);
		}
	}

	// assuming there is such panoram
	private selectPanoram(panoramId: string){
		let selectedObj = this.context.state.selectedSceneObject();
		if(selectedObj && selectedObj.type === "panoram" && selectedObj.panoramId === panoramId){
			return;
		}
		let {floorId, mesh: object} = this.panorams[panoramId];
		let floorGroup = this.floors[floorId].group
		let pos = new THREE.Vector3();
		object.getWorldPosition(pos);
		this.context.state.selectedSceneObject({
			type: "panoram",
			object: object,
			gizmoPoint: pos,
			panoramId: panoramId,
			parent: floorGroup,
			getLimits: dir => this.getPanoramMovementLimits(dir, panoramId)
		})
	}

	private getPanoramMovementLimits(direction: "x" | "y" | "z", panoramId: string): [number, number] | null {
		if(direction === "y"){
			return null;
		}

		let floor = this.floors[this.panorams[panoramId].floorId];
		return direction === "x"? [-floor.width / 2, floor.width / 2]: [-floor.length / 2, floor.length / 2];
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
				if(floorId){
					let currentFloorGroup = this.floors[floorId].group;
					if(!currentFloorGroup.parent){
						this.scene.add(currentFloorGroup);
					}
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
	
			let floorObj = this.floors[floorId].group;
			this.context.state.selectedSceneObject({
				type: "floor",
				floorId: floorId,
				gizmoPoint: floorObj.position,
				object: floorObj
			});
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
			for(let floorId in this.floors){
				if(floorId === this.context.state.selectedFloor()){
					continue;
				}
				let floorObj = this.floors[floorId];
				if(!floorObj.group.parent && !doHide){
					this.scene.add(floorObj.group)
				} else if(floorObj.group.parent && doHide){
					floorObj.group.parent.remove(floorObj.group);
				}
			}
		});
	}

}