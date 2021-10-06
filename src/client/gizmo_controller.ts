import {SelectedSceneObjectDescription} from "app_state";
import {AppContext} from "context";
import {SettingsController} from "settings_controller";
import {SkyboxController} from "skybox_controller";
import {InteractionLib, THREE} from "threejs_decl";
import {isInteractiveObject} from "threejs_decl";

//const gizmoArrowPath = "./static/arrow.png";


export class GizmoController extends SkyboxController {
	protected gizmo: THREE.Object3D;

	constructor(settings: SettingsController, context: AppContext){
		super(settings, context);

		this.gizmo = this.makeGizmo();
	}

	private makeGizmo(): THREE.Object3D {
		// можно не сохранять. одинфиг диспозить не придется
		/*
		let texture = this.textureRepo.pathToTexture(gizmoArrowPath);
		let material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
		let geometry = new THREE.PlaneGeometry(arrowWidth, arrowHeight)
		*/
		let arrowHeight = 10;
		let arrowWidth = arrowHeight / 5;
		let shaftRadius = arrowWidth / 5;
		let peakHeight = arrowHeight / 5;

		let shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, arrowHeight - peakHeight, 3);
		let peakGeom = new THREE.ConeGeometry(arrowWidth / 2, peakHeight, 6);
		let wrapGeom = new THREE.CylinderGeometry(arrowWidth / 1.5, arrowWidth / 1.5, arrowHeight + arrowWidth);
		let makeArrow = (direction: "x" | "y" | "z") => {
			let wrapMaterial = new THREE.MeshBasicMaterial({
				color: direction === "x"? "#f00": direction === "y"? "#00f": "#0f0",
				side: THREE.FrontSide, // иначе иногда перекрывает стрелочки
				opacity: 0,
				transparent: true
			});

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
					result.rotation.x = -Math.PI / 2;
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

		let firstWrap = firstWrapIntersect.object;
		let distanceToIntersection = firstWrapIntersect.distance;

		let direction = firstWrap.name.substr(5) as "x" | "y" | "z";
		let startObjValue = movedObject.object.position[direction];
		let startGizmoValue = this.gizmo.position[direction];

		let camCosX = Math.cos(this.camera.rotation.x);
		let camSinX = Math.sin(this.camera.rotation.x);
		let camCosY = Math.cos(this.camera.rotation.y);
		let camSinY = Math.sin(this.camera.rotation.y);
		let vFOV = (this.camera.fov) * (Math.PI / 180);
		let screenHeight = document.body.clientHeight;
		//let startVAngle = vFOV * ((((screenHeight / 2) - startY) * camCosX) / screenHeight);
		//let hFOV = Math.atan(Math.tan(vFOV) * camera.aspect)
		
		let onMove = (x: number, y: number) => {
			let dx = startX - x;
			let dy = startY - y;
			let dVal: number;
			switch(direction){
				case "y": {
					let dPx = dy * camCosX;
					let dAngle = (vFOV * (dPx / screenHeight))// + startVAngle;
					dVal = distanceToIntersection * Math.tan(dAngle);
					console.log({dPx, dAngle, dVal})
					break;
				} case "x":
					dVal = ((dx * camCosY) + (dy * camSinY)) * camSinX;
					break;
				case "z":
					dVal = (- (dx * camSinY) + (dy * camCosY)) * camSinX;
					break;
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
		}
		
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("touchmove", onTouchMove);
		window.addEventListener("touchend", onMovementFinish);
		window.addEventListener("mouseup", onMovementFinish);
	}

	protected addGizmoHandlers(obj: THREE.Object3D, description: SelectedSceneObjectDescription, onMoved: (pos: {x: number, y: number, z: number}) => void): void {
		if(!isInteractiveObject(obj)){
			return;
		}
	
		obj.on("click", clickEvent => {
			if(!this.context.state.isInEditMode()){
				return;
			}

			this.context.state.selectedSceneObject({
				...description,
				object: obj
			});
			const target = clickEvent.currentTarget || clickEvent.target;
			const intersection = clickEvent.intersects.sort((a, b) => a.distance - b.distance)[0];
			if(!target || !intersection){
				return;
			}

			let scale = intersection.distance / 75;
	
			this.gizmo.position.x = intersection.point.x + scale;
			this.gizmo.position.y = intersection.point.y + scale;
			this.gizmo.position.z = intersection.point.z + scale;
			this.gizmo.scale.x = this.gizmo.scale.y = this.gizmo.scale.z = scale;
			this.scene.add(this.gizmo);

			void onMoved;
		})
	
	}

	protected clearGizmo(): void {
		this.scene.remove(this.gizmo);
	}

}