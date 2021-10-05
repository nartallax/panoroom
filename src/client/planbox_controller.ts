import {BuildingFloor} from "building_plan";
import {AppContext} from "context";
import {KeyboardCameraControls, setupKeyboardCameraMovement} from "keyboard_camera_movement";
import {SkyboxController} from "skybox_controller";
import {THREE} from "threejs_decl";
import {defaultViewSettings} from "settings_controller";

interface FloorObject {
	object: THREE.Object3D;
	geometry: THREE.PlaneGeometry;
	texture?: string;
	material: THREE.Material;
}

export class PlanboxController extends SkyboxController {

	private keyboardCameraControls: KeyboardCameraControls | null = null;
	private readonly floors: {[floorId: string]: FloorObject} = {};

	constructor(context: AppContext){
		super(context.settings.clone({
			...defaultViewSettings,
			fov: context.settings.fov(),
			skyboxHeight: 2,
			skyboxRadialSegments: 4
		}), context);

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

	private createFloorObject(floor: BuildingFloor): FloorObject {
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
		let object = new THREE.Mesh(geometry, material);
		object.position.y = floor.y + 1000;
		object.position.x = floor.x;
		object.position.z = floor.z;
		object.rotation.x = Math.PI / 2; // иначе он будет стоять вертикально
		// почему z, а не y? вероятно, из-за того, что сначала применяется поворот по x
		object.rotation.z = floor.rotation;
		return { geometry, object, material, texture }
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
			let obj = this.createFloorObject(floor);
			this.scene.add(obj.object);
			this.floors[floorId] = obj;
		}
	}

}