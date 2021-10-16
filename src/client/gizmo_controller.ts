import {SelectedSceneObject} from "app_state";
import {AppContext} from "context";
import {floorYOffset} from "planbox_controller";
import {SceneController} from "scene_controller";
import {isInteractiveObject, InteractionLib, THREE} from "threejs_decl";
import {movePositionToLocal} from "utils/three_global_pos_to_local";

const gizmoDistanceScaleMultiplier = 1/75;

export class GizmoController extends SceneController {
	private gizmo: THREE.Group;
	private arrows: Record<"x" | "y" | "z", THREE.Object3D>
	private corners: Record<"x" | "y" | "z", THREE.Object3D>

	protected isGizmoMovingNow = false;

	constructor(context: AppContext){
		super(context);

		let {gizmo, arrows, corners} = this.makeGizmo();
		this.gizmo = gizmo;
		this.arrows = arrows;
		this.corners = corners;
		this.watch(this.context.state.selectedSceneObject, v => this.onSelectedObjectUpdate(v))
		this.watch(this.context.state.isInEditMode, () => this.onSelectedObjectUpdate())
		this.watch(this.context.state.isInLinkMode, () => this.onSelectedObjectUpdate())
	}

	private onSelectedObjectUpdate(v: null | SelectedSceneObject = this.context.state.selectedSceneObject()): void {
		if(v === null || !this.context.state.isInEditMode() || this.context.state.isInLinkMode()){
			this.clearGizmo();
			return;
		}

		let distance = this.camera.position.distanceTo(v.gizmoPoint);
		let scale = distance * gizmoDistanceScaleMultiplier; 
		this.gizmo.scale.x = this.gizmo.scale.y = this.gizmo.scale.z = scale;
		this.gizmo.position.x = v.gizmoPoint.x;
		this.gizmo.position.y = v.gizmoPoint.y + scale; // просто чтоб оно не влипало в поверхность
		this.gizmo.position.z = v.gizmoPoint.z;

		if(v.parent){
			movePositionToLocal(this.gizmo.position, v.parent);
			v.parent.add(this.gizmo);
		} else {
			this.scene.add(this.gizmo);
		}

		if(v.type === "link"){
			this.gizmo.position.z += 10;
		}

		let directions = ["x", "y", "z"] as ("x" | "y" | "z")[];
		directions.forEach(dir => {
			this.arrows[dir].parent?.remove(this.arrows[dir]);
			this.corners[dir].parent?.remove(this.corners[dir]);
		});
		switch(v.type){
			case "floor":
				directions.forEach(dir => {
					this.gizmo.add(this.arrows[dir], this.corners[dir]);
				});
				break;
			case "panoram":
				this.gizmo.add(this.arrows.x);
				this.gizmo.add(this.arrows.z)
				this.gizmo.add(this.corners.y);
				break;
			case "link":
				this.gizmo.add(this.arrows.x);
				this.gizmo.add(this.arrows.y)
				this.gizmo.add(this.corners.z);
				break;

		}
	}

	private makeGizmo(): {gizmo: THREE.Group, arrows: Record<"x" | "y" | "z", THREE.Object3D>, corners: Record<"x" | "y" | "z", THREE.Object3D>} {
		let arrowHeight = 10;
		let arrowWidth = arrowHeight / 5;
		let shaftRadius = arrowWidth / 3;
		let peakHeight = arrowHeight / 5;
		let arrows = {} as Record<"x" | "y" | "z", THREE.Object3D>
		let corners = {} as Record<"x" | "y" | "z", THREE.Object3D>


		// можно не сохранять. одинфиг диспозить не придется
		let shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, arrowHeight - peakHeight, 6);
		let peakGeom = new THREE.ConeGeometry(arrowWidth / 2, peakHeight, 6);
		let gizmo = new THREE.Group();
		let cornerSize = arrowHeight / 3
		let cornerGeom = new THREE.PlaneGeometry(cornerSize, cornerSize);

		let makeArrow = (direction: "x" | "y" | "z") => {
			let material = new THREE.MeshBasicMaterial({
				color: direction === "x"? "#f00": direction === "y"? "#00f": "#0f0",
				side: THREE.FrontSide
			});
			let result = new THREE.Group();

			let shaft = new THREE.Mesh(shaftGeom, material);
			shaft.name = "shaft_" + direction
			shaft.position.y = (arrowHeight - peakHeight) / 2;
			result.add(shaft);

			let peak = new THREE.Mesh(peakGeom, material);
			peak.name = "peak_" + direction;
			peak.position.y = arrowHeight - (peakHeight / 2);
			result.add(peak);
			
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

			if(isInteractiveObject(result)){
				result.on("mousedown", evt => this.startMovement(evt, [direction]))
			}
		}

		let makeCorner = (direction: "x" | "y" | "z") => {
			let material = new THREE.MeshBasicMaterial({
				color: direction === "x"? "#0ff": direction === "y"? "#ff0": "#f0f",
				side: THREE.DoubleSide
			})

			let result = new THREE.Mesh(cornerGeom, material);
			result.name = "corner_" + direction;
			let moveDirs: ("x" | "y" | "z")[];

			switch(direction){
				case "x":
					result.rotation.y = Math.PI / 2;
					result.position.z += cornerSize / 2;
					result.position.y += cornerSize / 2;
					moveDirs = ["y", "z"];
					break;
				case "z":
					result.position.y += cornerSize / 2;
					result.position.x += cornerSize / 2;
					moveDirs = ["y", "x"];
					break;
				case "y":
					result.rotation.x = Math.PI / 2;
					result.position.z += cornerSize / 2;
					result.position.x += cornerSize / 2;
					moveDirs = ["z", "x"];
					break;
			}

			corners[direction] = result;
			gizmo.add(result);

			if(isInteractiveObject(result)){
				result.on("mousedown", evt => this.startMovement(evt, moveDirs))
			}
		}

		makeArrow("x");
		makeArrow("y");
		makeArrow("z");
		makeCorner("x");
		makeCorner("y");
		makeCorner("z");

		if(isInteractiveObject(gizmo)){
			gizmo.cursor = "pointer";
		}

		return {gizmo, arrows, corners};
	}

	protected startMovement(evt: InteractionLib.MouseEvent, directions: ("x" | "y" | "z")[]): void {
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

		let firstIntersect = evt.intersects[0]
		const movedObject = this.context.state.selectedSceneObject();
		if(!firstIntersect || !movedObject){
			return;
		}

		this.isGizmoMovingNow = true;
		let distanceToIntersection = firstIntersect.distance;
		
		let isRadialMovement = movedObject.type === "link";
		let parent = this.context.state.selectedSceneObject()?.parent;
		let camCosX = Math.cos(this.camera.rotation.x - (parent?.rotation?.x ?? 0));
		let camCosY = Math.cos(this.camera.rotation.y - (parent?.rotation?.y ?? 0));
		let camSinY = Math.sin(this.camera.rotation.y - (parent?.rotation?.y ?? 0));
		let vFOV = (this.camera.fov) * (Math.PI / 180);
		let screenHeight = this.canvas.clientHeight;
		let screenWidth = this.canvas.clientWidth;
		let hFOV = Math.atan(Math.tan(vFOV) * this.camera.aspect);

		let yMult = directions.find(dir => dir === "y")? 0: 1;

		let makeOnmoveHandler = (direction: "x" | "y" | "z"): ((x: number, y: number) => void) => {
			let usingRadialFormula = isRadialMovement && direction === "x"
			let startObjValue = usingRadialFormula
				? Math.atan(movedObject.object.position.x / movedObject.object.position.z)
				: movedObject.object.position[direction];
			let gizmoOffset = usingRadialFormula
				? Math.atan(this.gizmo.position.x / this.gizmo.position.z) - startObjValue
				: this.gizmo.position[direction] - startObjValue;

			let minValueLimit = Number.MIN_SAFE_INTEGER;
			let maxValueLimit = Number.MAX_SAFE_INTEGER;
			{
				let limArray = !movedObject.getLimits? null: movedObject.getLimits(direction);
				if(limArray){
					[minValueLimit, maxValueLimit] = limArray;
				}
			}

			if(usingRadialFormula){
				if(movedObject.object.position.z < 0){
					startObjValue += Math.PI;
				}
				let startingRotation = movedObject.object.rotation.y;
				let objX = movedObject.object.position.x;
				let objZ = movedObject.object.position.z;
				let objRadialDistance = Math.sqrt((objX * objX) + (objZ * objZ));
				let gizX = this.gizmo.position.x;
				let gizZ = this.gizmo.position.z;
				let gizmoRadialDistance = Math.sqrt((gizX * gizX) + (gizZ * gizZ));
				return (x, y) => {
					void y; // его мы использовать не будем, пожалуй
					let dAngle = hFOV * (startX - x) / screenWidth;
					movedObject.object.position.x = objRadialDistance * Math.sin(startObjValue + dAngle);
					movedObject.object.position.z = objRadialDistance * Math.cos(startObjValue + dAngle);
					movedObject.object.rotation.y = startingRotation + dAngle
					if(movedObject.object !== movedObject.parent){
						// тут возможно есть ошибка, код на самом деле не используется
						this.gizmo.position.x = gizmoRadialDistance * Math.sin(startObjValue + gizmoOffset + dAngle)
						this.gizmo.position.y = gizmoRadialDistance * Math.sin(startObjValue + gizmoOffset + dAngle)
					}
				}
			} else {

				return (x, y) => {
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
							let dPx = (dy * camCosX)
							let dAngle = (vFOV * (dPx / screenHeight))
							dVal = distanceToIntersection * Math.tan(dAngle);
							break;
						} case "x": {
							let dPx = (-dx * camCosY) + (-dy * camSinY * yMult);
							let dAngle = hFOV * (dPx / screenWidth);
							dVal = distanceToIntersection * Math.tan(dAngle);
							break;
						} case "z": {
							let dPx = (dx * camSinY) + (-dy * camCosY * yMult);
							let dAngle = hFOV * (dPx / screenWidth);
							dVal = distanceToIntersection * Math.tan(dAngle);
						} break;
					}
					
					movedObject.object.position[direction] = Math.max(minValueLimit, Math.min(maxValueLimit, startObjValue + dVal));
					if(movedObject.object !== movedObject.parent){
						this.gizmo.position[direction] = movedObject.object.position[direction] + gizmoOffset
					}
	
					if(movedObject.links){
						for(let i = 0; i < movedObject.links.length; i++){
							let link = movedObject.links[i];
							this.calcAndSetRotationScaleForLinkLine(link.a, link.b, link.link);
						}
					}
				}

			}
		}

		let onMoveHandlers = directions.map(dir => makeOnmoveHandler(dir))
		let onMove = (x: number, y: number) => {
			for(let i = 0; i < onMoveHandlers.length; i++){
				onMoveHandlers[i](x, y);
			}
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

		const obj = this.context.state.selectedSceneObject();
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
				case "link": {
					let panoram = this.context.settings.panorams()[obj.fromPanoramId]
					let link = panoram.links?.find(link => link.panoramId === obj.toPanoramId);
					if(link){
						let x = obj.object.position.x
						let z = obj.object.position.z
						let radians = Math.atan(x / z);
						if(z < 0){
							radians += Math.PI;
						}
						link.x = radians / (Math.PI * 2);
						link.y = (obj.object.position.y / 1000) / this.context.settings.skyboxHeight()
						this.context.settings.panorams.notify();
					}
					break;
				}
			}
		}
	}

	protected addGizmoHandlers(targetObject: THREE.Object3D, onSelect: (point: THREE.Vector3) => void): void {
		if(!isInteractiveObject(targetObject)){
			return;
		}
	
		targetObject.on("click", clickEvent => {
			if(!this.context.state.isInEditMode() || this.context.state.isInLinkMode() || this.isGizmoMovingNow){
				return;
			}

			const intersection = clickEvent.intersects.sort((a, b) => a.distance - b.distance)[0];
			if(!intersection){
				// wtf
				this.clearGizmo();
				return;
			}

			onSelect(intersection.point);
			
		})
	
	}

	protected clearGizmo(): void {
		if(this.gizmo.parent){
			this.gizmo.parent.remove(this.gizmo);
		}
	}

	protected calcAndSetRotationScaleForLinkLine(a: THREE.Object3D, b: THREE.Object3D, lineMesh: THREE.Object3D): void {
		let posA = new THREE.Vector3();
		a.getWorldPosition(posA);
		let posB = new THREE.Vector3();
		b.getWorldPosition(posB);
		lineMesh.position.x = (posA.x + posB.x) / 2;
		lineMesh.position.y = ((posA.y + posB.y) / 2) - 0.35;
		lineMesh.position.z = (posA.z + posB.z) / 2;
		lineMesh.scale.y = posA.distanceTo(posB);
		let dx = posA.x - posB.x;
		let dz = posA.z - posB.z;
		let dy = posA.y - posB.y;
		lineMesh.rotation.z = Math.atan((Math.sqrt((dx * dx) + (dz * dz)) * (dx >= 0? 1: -1)) / dy);
		lineMesh.rotation.y = Math.atan(-dz / dx) + Math.PI;
	}
}