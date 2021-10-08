import {SelectedSceneObject, SelectedSceneObjectDescription} from "app_state";
import {AppContext} from "context";
import {floorYOffset} from "planbox_controller";
import {SettingsController} from "settings_controller";
import {SkyboxController} from "skybox_controller";
import {isInteractiveObject, InteractionLib, THREE} from "threejs_decl";
import {movePositionToLocal} from "utils/three_global_pos_to_local";

const gizmoDistanceScaleMultiplier = 1/75;

export class GizmoController extends SkyboxController {
	private gizmo: THREE.Group;
	private arrows = {} as Record<"x" | "y" | "z", THREE.Object3D>

	protected isGizmoMovingNow = false;

	constructor(settings: SettingsController, context: AppContext){
		super(settings, context);

		let {gizmo, arrows} = this.makeGizmo();
		this.gizmo = gizmo;
		this.arrows = arrows;
		this.watch(this.context.state.selectedSceneObject, v => this.onSelectedObjectUpdate(v))
		this.watch(this.context.state.isInEditMode, isInEditMode => {
			if(!isInEditMode){
				this.clearGizmo();
			} else {
				this.onSelectedObjectUpdate(this.context.state.selectedSceneObject());
			}
		})
	}

	private onSelectedObjectUpdate(v: null | SelectedSceneObject): void {
		if(v === null || !this.context.state.isInEditMode()){
			this.clearGizmo();
			return;
		}

		let distance = this.camera.position.distanceTo(v.gizmoPoint);
		let scale = distance * gizmoDistanceScaleMultiplier; 
		this.gizmo.scale.x = this.gizmo.scale.y = this.gizmo.scale.z = scale;
		this.gizmo.position.x = v.gizmoPoint.x + scale;
		this.gizmo.position.y = v.gizmoPoint.y + scale;
		this.gizmo.position.z = v.gizmoPoint.z + scale;

		if(v.parent){
			movePositionToLocal(this.gizmo.position, v.parent);
			v.parent.add(this.gizmo);
		} else {
			this.scene.add(this.gizmo);
		}

		switch(v.type){
			case "floor":
				if(!this.arrows.y.parent){
					this.gizmo.add(this.arrows.y)
				}
				break;
			case "panoram":
				if(this.arrows.y.parent){
					this.gizmo.remove(this.arrows.y)
				}
				break;
		}
	}

	private makeGizmo(): {gizmo: THREE.Group, arrows: Record<"x" | "y" | "z", THREE.Object3D>} {
		let arrowHeight = 10;
		let arrowWidth = arrowHeight / 5;
		let shaftRadius = arrowWidth / 5;
		let peakHeight = arrowHeight / 5;
		let arrows = {} as Record<"x" | "y" | "z", THREE.Object3D>

		// можно не сохранять. одинфиг диспозить не придется
		let shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, arrowHeight - peakHeight, 3);
		let peakGeom = new THREE.ConeGeometry(arrowWidth / 2, peakHeight, 6);
		let wrapGeom = new THREE.CylinderGeometry(arrowWidth / 1.5, arrowWidth / 1.5, arrowHeight + arrowWidth, 8);
		let wrapMaterial = new THREE.MeshBasicMaterial({
			color: "#000",
			side: THREE.FrontSide,
			opacity: 0,
			transparent: true
		});
		let gizmo = new THREE.Group();

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

			arrows[direction] = result;
			gizmo.add(result);
		}

		makeArrow("x");
		makeArrow("y");
		makeArrow("z");

		if(isInteractiveObject(gizmo)){
			gizmo.cursor = "pointer";
			gizmo.on("mousedown", evt => this.startMovement(evt));
		}

		return {gizmo, arrows};
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
				// wtf
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
		let gizmoOffset = this.gizmo.position[direction] - startObjValue;

		let parent = this.context.state.selectedSceneObject()?.parent;
		let camCosX = Math.cos(this.camera.rotation.x - (parent?.rotation?.x ?? 0));
		let camCosY = Math.cos(this.camera.rotation.y - (parent?.rotation?.y ?? 0));
		let camSinY = Math.sin(this.camera.rotation.y - (parent?.rotation?.y ?? 0));
		let vFOV = (this.camera.fov) * (Math.PI / 180);
		let screenHeight = this.canvas.clientHeight;
		let screenWidth = this.canvas.clientWidth;
		let hFOV = Math.atan(Math.tan(vFOV) * this.camera.aspect);

		let minValueLimit = Number.MIN_SAFE_INTEGER;
		let maxValueLimit = Number.MAX_SAFE_INTEGER;
		{
			let limArray = !movedObject.getLimits? null: movedObject.getLimits(direction);
			if(limArray){
				[minValueLimit, maxValueLimit] = limArray;
			}
		}
		
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
			
			movedObject.object.position[direction] = Math.max(minValueLimit, Math.min(maxValueLimit, startObjValue + dVal));
			this.gizmo.position[direction] = movedObject.object.position[direction] + gizmoOffset
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
			this.onMovementFinished();
		}
		
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("touchmove", onTouchMove);
		window.addEventListener("touchend", onMovementFinish);
		window.addEventListener("mouseup", onMovementFinish);
	}

	protected onMovementFinished(): void {
		setTimeout(() => {
			// чтобы не обработались хендлеры на клик и гизмо не уехало хер пойми куда после завершения движения
			this.isGizmoMovingNow = false;
		}, 25);

		let obj = this.context.state.selectedSceneObject();
		if(obj){
			obj.gizmoPoint = this.gizmo.position;
			switch(obj.type){
				case "floor": {
					let floor = this.context.settings.floors()[obj.floorId];
					floor.x = obj.object.position.x;
					floor.y = obj.object.position.y - floorYOffset;
					floor.z = obj.object.position.z;
					this.context.settings.floors.notify();
					break;
				}
				case "panoram": {
					let panoram = this.context.settings.panorams()[obj.panoramId];
					if(panoram.position){
						panoram.position.x = obj.object.position.x;
						panoram.position.z = obj.object.position.z;
					}
					this.context.settings.panorams.notify();
					break;
				}
			}
		}
	}

	/** 
	 * @param targetObject объект, на который вешается хендлер на клик
	 * @param movedObject объект, который будет передвигаться при шевелении гизмо
	 * @param parent объект, который нужен для того, чтобы учитывать вращение/перемещение
	*/
	protected addGizmoHandlers(targetObject: THREE.Object3D, movedObject: THREE.Object3D, description: SelectedSceneObjectDescription, parent?: THREE.Group, getLimits?: (direction: "x" | "y" | "z") => ([number, number] | null)): void {
		if(!isInteractiveObject(targetObject)){
			return;
		}
	
		targetObject.on("click", clickEvent => {
			if(!this.context.state.isInEditMode() || this.isGizmoMovingNow){
				return;
			}

			const intersection = clickEvent.intersects.sort((a, b) => a.distance - b.distance)[0];
			if(!intersection){
				// wtf
				this.clearGizmo();
				return;
			}

			this.context.state.selectedSceneObject({
				...description,
				gizmoPoint: intersection.point,
				object: movedObject,
				parent, getLimits
			});
			
		})
	
	}

	protected clearGizmo(): void {
		if(this.gizmo.parent){
			this.gizmo.parent.remove(this.gizmo);
		}
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
}