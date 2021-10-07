import {SelectedSceneObjectDescription} from "app_state";
import {AppContext} from "context";
import {SettingsController} from "settings_controller";
import {SkyboxController} from "skybox_controller";
import {InteractionLib, THREE} from "threejs_decl";
import {isInteractiveObject} from "threejs_decl";

export class GizmoController extends SkyboxController {
	protected gizmo: THREE.Object3D;

	protected isGizmoMovingNow = false;
	private targetObjectOnMoved: ((pos: {x: number, y: number, z: number}) => void) | null = null
	private targetObjectParent: THREE.Group | undefined = undefined;

	constructor(settings: SettingsController, context: AppContext){
		super(settings, context);

		this.gizmo = this.makeGizmo();
	}

	private makeGizmo(): THREE.Object3D {
		let arrowHeight = 10;
		let arrowWidth = arrowHeight / 5;
		let shaftRadius = arrowWidth / 5;
		let peakHeight = arrowHeight / 5;

		// можно не сохранять. одинфиг диспозить не придется
		let shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, arrowHeight - peakHeight, 3);
		let peakGeom = new THREE.ConeGeometry(arrowWidth / 2, peakHeight, 6);
		let wrapGeom = new THREE.CylinderGeometry(arrowWidth / 1.5, arrowWidth / 1.5, arrowHeight + arrowWidth);
		let wrapMaterial = new THREE.MeshBasicMaterial({
			color: "#000",
			side: THREE.FrontSide,
			opacity: 0,
			transparent: true
		});
		let makeArrow = (direction: "x" | "y" | "z") => {
			let baseMaterial = new THREE.MeshBasicMaterial({
				color: direction === "x"? "#f00": direction === "y"? "#00f": "#0f0",
				side: THREE.FrontSide
			});
			let result = new THREE.Group();

			let shaft = new THREE.Mesh(shaftGeom, baseMaterial);
			shaft.position.y = (arrowHeight - peakHeight) / 2;
			result.add(shaft);

			let peak = new THREE.Mesh(peakGeom, baseMaterial);
			peak.position.y = arrowHeight - (peakHeight / 2);
			result.add(peak);

			let wrap = new THREE.Mesh(wrapGeom, wrapMaterial);
			wrap.position.y = arrowHeight / 2;
			wrap.name = "wrap_" + direction;
			result.add(wrap);
			
			switch(direction){
				case "x":
					result.rotation.z = -Math.PI / 2;
					break;
				case "z":
					result.rotation.x = Math.PI / 2;
					break;
			}
			
			return result;
		}

		let yArrow = makeArrow("y");
		let xArrow = makeArrow("x");
		let zArrow = makeArrow("z");

		let gizmo = new THREE.Group();
		gizmo.add(xArrow);
		gizmo.add(yArrow);
		gizmo.add(zArrow);

		if(isInteractiveObject(gizmo)){
			gizmo.cursor = "pointer";
			gizmo.on("mousedown", evt => this.startMovement(evt));
		}

		return gizmo;
	}

	protected startMovement(evt: InteractionLib.MouseEvent): void {
		let origEvent = evt.data.originalEvent;
		let startX = 0;
		let startY = 0;
		if(origEvent instanceof MouseEvent){
			startX = origEvent.clientX;
			startY = origEvent.clientY;
		} else if(origEvent instanceof TouchEvent){
			let touch = origEvent.touches[0];
			if(!touch){
				return;
			}
			startX = touch.clientX;
			startY = touch.clientY;
		} else {
			return;
		}

		let firstWrapIntersect = evt.intersects.filter(x => x.object.name.startsWith("wrap_"))[0]
		const movedObject = this.context.state.selectedSceneObject();
		if(!firstWrapIntersect || !movedObject){
			return;
		}

		this.isGizmoMovingNow = true;

		let firstWrap = firstWrapIntersect.object;
		let distanceToIntersection = firstWrapIntersect.distance;

		let direction = firstWrap.name.substr(5) as "x" | "y" | "z";
		let startObjValue = movedObject.object.position[direction];
		let startGizmoValue = this.gizmo.position[direction];

		let parent = this.targetObjectParent;
		let camCosX = Math.cos(this.camera.rotation.x - (parent?.rotation?.x ?? 0));
		let camCosY = Math.cos(this.camera.rotation.y - (parent?.rotation?.y ?? 0));
		let camSinY = Math.sin(this.camera.rotation.y - (parent?.rotation?.y ?? 0));
		let vFOV = (this.camera.fov) * (Math.PI / 180);
		let screenHeight = this.canvas.clientHeight;
		let screenWidth = this.canvas.clientWidth;
		let hFOV = Math.atan(Math.tan(vFOV) * this.camera.aspect)
		
		let onMove = (x: number, y: number) => {
			let dx = startX - x;
			let dy = startY - y;
			let dVal: number;
			switch(direction){
				case "y": {
					// в этих формулах еще не на 100% все точно, немного разъезжается курсор и объект
					// можно дошаманить, но мне влом, в целом работает
					// основная идея в том, что у нас есть дистанция, которую курсор прошел по экрану, в пикселях
					// мы её конвертируем в угол, где начало движения (после проекции) - это 0 градусов, а край экрана - это fov градусов
					// а потом с помощью этого угла и расстояния до точки касания считаем, какую инворлд длину прошел объект
					let dPx = dy * camCosX;
					let dAngle = (vFOV * (dPx / screenHeight))
					dVal = distanceToIntersection * Math.tan(dAngle);
					break;
				} case "x": {
					let dPx = (-dx * camCosY) + (-dy * camSinY);
					let dAngle = hFOV * (dPx / screenWidth);
					dVal = distanceToIntersection * Math.tan(dAngle);
					break;
				} case "z": {
					let dPx = (dx * camSinY) + (-dy * camCosY);
					let dAngle = hFOV * (dPx / screenWidth);
					dVal = distanceToIntersection * Math.tan(dAngle);
				} break;
			}
			
			movedObject.object.position[direction] = startObjValue + dVal;
			this.gizmo.position[direction] = startGizmoValue + dVal;
		}

		let onMouseMove = (e: MouseEvent) => {
			onMove(e.clientX, e.clientY)
		}

		let onTouchMove = (e: TouchEvent) => {
			let touch = e.touches[0];
			if(touch){
				onMove(touch.clientX, touch.clientY);
			}
		}

		let onMovementFinish = () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("touchmove", onTouchMove);	
			window.removeEventListener("touchend", onMovementFinish);
			window.removeEventListener("mouseup", onMovementFinish);
			if(this.targetObjectOnMoved){
				this.targetObjectOnMoved.call(null, {
					x: movedObject.object.position.x,
					y: movedObject.object.position.y,
					z: movedObject.object.position.z
				});
			}
			setTimeout(() => {
				// чтобы не обработались хендлеры на клик и гизмо не уехало хер пойми куда после завершения движения
				this.isGizmoMovingNow = false;
			}, 25)
		}
		
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("touchmove", onTouchMove);
		window.addEventListener("touchend", onMovementFinish);
		window.addEventListener("mouseup", onMovementFinish);
	}

	protected addGizmoHandlers(targetObject: THREE.Object3D, movedObject: THREE.Object3D, description: SelectedSceneObjectDescription, onMoved: (pos: {x: number, y: number, z: number}) => void, parent?: THREE.Group): void {
		if(!isInteractiveObject(targetObject)){
			return;
		}
	
		targetObject.on("click", clickEvent => {
			if(!this.context.state.isInEditMode() || this.isGizmoMovingNow){
				return;
			}

			this.context.state.selectedSceneObject({
				...description,
				object: movedObject
			});
			const target = clickEvent.currentTarget || clickEvent.target;
			const intersection = clickEvent.intersects.sort((a, b) => a.distance - b.distance)[0];
			if(!target || !intersection){
				return;
			}

			let scale = intersection.distance / 75;
			this.gizmo.scale.x = this.gizmo.scale.y = this.gizmo.scale.z = scale;
			if(parent){
				intersection.point.x -= parent.position.x;
				intersection.point.y -= parent.position.y;
				intersection.point.z -= parent.position.z;
				intersection.point.applyAxisAngle(new THREE.Vector3(0, 1, 0), -parent.rotation.y);
				this.gizmo.position.x = intersection.point.x + scale;
				this.gizmo.position.y = intersection.point.y + scale;
				this.gizmo.position.z = intersection.point.z + scale;
				parent.add(this.gizmo);
			} else {
				this.gizmo.position.x = intersection.point.x + scale;
				this.gizmo.position.y = intersection.point.y + scale;
				this.gizmo.position.z = intersection.point.z + scale;
				this.scene.add(this.gizmo);
			}
			this.targetObjectOnMoved = onMoved;
			this.targetObjectParent = parent;
		})
	
	}

	protected clearGizmo(): void {
		if(this.gizmo.parent){
			this.gizmo.parent.remove(this.gizmo);
		}
		this.targetObjectParent = undefined;
		this.targetObjectOnMoved = null;
	}
}