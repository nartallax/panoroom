import {BuildingFloor} from "building_plan";
import {AppContext} from "context";
import {KeyboardCameraControls, setupKeyboardCameraMovement} from "keyboard_camera_movement";
import {isInteractiveObject, THREE} from "threejs_decl";
import {defaultViewSettings} from "settings_controller";
import {GizmoController} from "gizmo_controller";

interface FloorObject {
	object: THREE.Object3D;
	geometry: THREE.PlaneGeometry;
	texture?: string;
	material: THREE.Material;
}

export class PlanboxController extends GizmoController {

	private keyboardCameraControls: KeyboardCameraControls | null = null;
	private readonly floors: {[floorId: string]: FloorObject} = {};

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

	private createFloorObject(floor: BuildingFloor, floorId: string): FloorObject {
		let geometry = new THREE.PlaneGeometry(floor.width, floor.length);
		let texture: string | undefined = undefined;
		let material: THREE.Material;
		if(floor.texture){
			texture = floor.texture;
			material = new THREE.MeshBasicMaterial({ 
				map: this.textureRepo.imageIdToTexture(floor.texture),
				side: THREE.DoubleSide
			})
		} else {
			material = new THREE.MeshBasicMaterial({
				color: "#888",
				side: THREE.DoubleSide,
				opacity: 0.5,
				transparent: true
			});
		}
		let obj = new THREE.Mesh(geometry, material);
		obj.position.y = floor.y + 1000;
		obj.position.x = floor.x;
		obj.position.z = floor.z;
		obj.rotation.x = Math.PI / 2; // иначе он будет стоять вертикально
		// почему z, а не y? вероятно, из-за того, что сначала применяется поворот по x
		obj.rotation.z = floor.rotation;

		this.addGizmoHandlers(obj, {type: "floor", floorId }, x => console.log("Moved!", x));

		return { geometry, object: obj, material, texture }
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

	private updateFloors(floors: {[floorId: string]: BuildingFloor}): void {
		for(let floorId in this.floors){
			let obj = this.floors[floorId];
			delete this.floors[floorId];
			this.scene.remove(obj.object);
			obj.geometry.dispose();
			if(obj.texture){
				this.textureRepo.unrefTextureByImageId(obj.texture);
			}
			obj.material.dispose();
		}

		for(let floorId in floors){
			let floor = floors[floorId];
			let obj = this.createFloorObject(floor, floorId);
			this.scene.add(obj.object);
			this.floors[floorId] = obj;
		}
	}

	protected createSkyboxObject(material: THREE.Material): {geometry: THREE.CylinderGeometry, object: THREE.Object3D} {
		let result = super.createSkyboxObject(material);
		if(isInteractiveObject(result.object)){
			result.object.on("click", () => {
				this.context.state.selectedSceneObject(null);
				this.clearGizmo();
			})
		}
		return result;
	}

}