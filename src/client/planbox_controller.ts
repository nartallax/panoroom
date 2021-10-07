import {BuildingFloor, Panoram} from "building_plan";
import {AppContext} from "context";
import {KeyboardCameraControls, setupKeyboardCameraMovement} from "keyboard_camera_movement";
import {isInteractiveObject, THREE} from "threejs_decl";
import {defaultViewSettings} from "settings_controller";
import {GizmoController} from "gizmo_controller";

const yOffset = 1000;

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
	object: THREE.Mesh;
	floorId: string;
}

export class PlanboxController extends GizmoController {

	private keyboardCameraControls: KeyboardCameraControls | null = null;
	private floors: {[floorId: string]: FloorObject} = {};
	private panorams: {[panoramId: string]: PanoramObject} = {};
	private panoramObjectMaterial = new THREE.MeshBasicMaterial({
		color: "#ddd",
		side: THREE.FrontSide
	});	
	private panoramObjectGeometry = new THREE.CylinderGeometry(3, 3, 1, 8);

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

	protected createSkyboxObject(material: THREE.Material): {geometry: THREE.CylinderGeometry, object: THREE.Object3D} {
		let result = super.createSkyboxObject(material);
		if(isInteractiveObject(result.object)){
			result.object.on("click", () => {
				if(!this.isGizmoMovingNow){
					this.context.state.selectedSceneObject(null);
					this.clearGizmo();
				}
			})
		}
		return result;
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
		group.position.y = floor.y + yOffset;
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
			this.addGizmoHandlers(obj, group, {type: "floor", floorId }, pos => {
				let floors = this.context.settings.floors();
				let floor = floors[floorId];
				floor.x = pos.x;
				floor.y = pos.y - yOffset;
				floor.z = pos.z;
				this.context.settings.floors(floors);
			});
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
			let panoramObj = this.panorams[panoramId];
			if(!(panoramObj.floorId in this.floors)){
				// объект уже выкинут, когда из сцены удален obj.group, можно не диспозить дополнительно
				delete this.panorams[panoramId]; 
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

	private createUpdatePanoramObject(panoram: Panoram, panoramId: string, floorId: string, oldPanoramObject?: PanoramObject): PanoramObject {
		if(!panoram.position){
			throw new Error("Could not add panoram: no position");
		}

		let obj: THREE.Mesh;
		if(oldPanoramObject){
			obj = oldPanoramObject.object;
		} else {
			obj = new THREE.Mesh(this.panoramObjectGeometry, this.panoramObjectMaterial);
			obj.name = "panoram_" + panoramId;
			//obj.rotation.x = Math.PI / 2;
			this.addGizmoHandlers(obj, obj, {type: "panoram", panoramId }, pos => {
				let panorams = this.context.settings.panorams();
				let panoram = panorams[panoramId];
				if(panoram.position){
					panoram.position.x = pos.x;
					panoram.position.z = pos.z;
					this.context.settings.panorams(panorams);
				}
			}, this.floors[floorId].group);
		}
		obj.position.x = panoram.position.x;
		obj.position.z = panoram.position.z;

		let resultFloorId: string | null = null;
		if(oldPanoramObject){
			if(oldPanoramObject.floorId !== floorId){
				let floor = this.floors[oldPanoramObject.floorId];
				if(floor){
					floor.group.remove(obj);
				}
			} else {
				resultFloorId = oldPanoramObject.floorId;
			}
		}
		if(!resultFloorId){
			resultFloorId = floorId;
			let floor = this.floors[floorId];
			floor.group.add(obj);
		}

		let result = Object.assign(oldPanoramObject || {}, {object: obj, floorId: resultFloorId});
		return result;
	}

	private updatePanorams(panorams: {[panoramId: string]: Panoram}): void {
		for(let panoramId in this.panorams){
			if(!(panoramId in panorams) || !panorams[panoramId].position){
				let panoramObj = this.panorams[panoramId]
				let floorObj = this.floors[panoramObj.floorId];
				if(floorObj){
					floorObj.group.remove(panoramObj.object);
				}
				delete this.panorams[panoramId]
			}
		}

		for(let panoramId in panorams){
			let panoram = panorams[panoramId];
			if(!panoram || !panoram.position){
				continue;
			}
			if(panoramId in this.panorams){
				this.createUpdatePanoramObject(panoram, panoramId, panoram.position.floorId, this.panorams[panoramId])
			} else {
				let panoramObj = this.createUpdatePanoramObject(panoram, panoramId, panoram.position.floorId);
				this.panorams[panoramId] = panoramObj;
			}
		}
	}

}