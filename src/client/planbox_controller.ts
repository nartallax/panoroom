import {BuildingFloor} from "building_plan";
import {AppContext} from "context";
import {KeyboardCameraControls, setupKeyboardCameraMovement} from "keyboard_camera_movement";
import {SkyboxController} from "skybox_controller";
import {THREE} from "threejs_decl";
import {defaultViewSettings} from "settings_controller";

interface FloorObject {
	object: THREE.Object3D;
	geometry: THREE.PlaneGeometry;
}

export class PlanboxController extends SkyboxController {

	private keyboardCameraControls: KeyboardCameraControls | null = null;
	private readonly planeMaterial: THREE.Material = new THREE.MeshBasicMaterial({
		color: "#888",
		side: THREE.DoubleSide,
		opacity: 0.5,
		transparent: true
	});
	private readonly ghostMaterial: THREE.Material = new THREE.MeshBasicMaterial({
		color: "#fff",
		side: THREE.DoubleSide,
		opacity: 0.05,
		transparent: true
	});
	private readonly floors: {[floorId: string]: FloorObject} = {};

	constructor(private readonly context: AppContext){
		super(context.settings.clone({
			...defaultViewSettings,
			fov: context.settings.fov(),
			skyboxHeight: 2,
			skyboxRadialSegments: 4
		}));

		this.camera.position.x = 100;
		this.camera.position.z = 100;
		this.camera.position.y = 1100;
		this.camera.lookAt(0, 1000, 0);

		void this.ghostMaterial;
	}

	stop(): void {
		super.stop();
		if(this.keyboardCameraControls){
			this.keyboardCameraControls.clear();
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
		let floors = this.context.settings.floors();
		for(let floorId in floors){
			console.log("Adding floor " + floorId)
			let floor = floors[floorId];
			let obj = this.createFloorObject(floor);
			this.scene.add(obj.object);
			this.floors[floorId] = obj;
		}
	}

	private createFloorObject(floor: BuildingFloor): FloorObject {
		let geometry = new THREE.PlaneGeometry(10, 10);
		let object = new THREE.Mesh(geometry, this.planeMaterial);
		object.position.y = floor.y + 1000;
		object.rotation.x = Math.PI / 2;
		return { geometry, object }
	}

	protected onFrame(timePassed: number): void {
		super.onFrame(timePassed);
		if(this.keyboardCameraControls){
			this.keyboardCameraControls.onFrame(timePassed);
		}
	}

}