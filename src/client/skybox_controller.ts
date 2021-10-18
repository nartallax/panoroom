import {Boundable, MbBoundable, unwrapBoundable} from "boundable/boundable";
import {PanoramLink} from "building_plan";
import {AppContext} from "context";
import {makeBarrelWarper, stretchCylinderTopBottom, warpCylinderWalls} from "cylinder_stretching";
import {GizmoController} from "gizmo_controller";
import {KeyboardCameraControls, setupKeyboardCameraMovement} from "keyboard_camera_movement";
import {SettingsController} from "settings_controller";
import {isInteractiveObject, THREE} from "threejs_decl";
import {addDragListeners} from "utils/drag";
import {TextToTextureRenderResult} from "utils/three_text_render";

const defaultSkyboxPath = "./static/default_skybox.png";

interface LinkObject {
	group: THREE.Group;
	mesh: THREE.Mesh;
	label: string;
	scale: number;
	geometry: THREE.BufferGeometry;
	material: THREE.Material;
}

export class SkyboxController extends GizmoController {
	private currentSkyboxTextureId: string | null = null;
	private currentSkyboxMaterial: THREE.Material | null = null;
	private currentSkyboxGeometry: THREE.BufferGeometry;
	private currentSkyboxObject: THREE.Mesh | THREE.Line;
	private skyboxGroup: THREE.Group;
	private linkObjects = {} as {[panoramId: string]: LinkObject}
	private keyboardCameraControls: KeyboardCameraControls | null = null;

	constructor(private readonly settings: SettingsController, context: AppContext, readonly targetPanoram: MbBoundable<string | null> = null, initialCameraRotation: {x: number, y: number} | null = null, private freelook: MbBoundable<boolean | null> = null){
		super(context);
		new THREE.Interaction(this.renderer, this.scene, this.camera);
		let {object, geometry} = this.createSkybox();
		this.skyboxGroup = new THREE.Group();
		this.skyboxGroup.name = "skybox_group";
		this.currentSkyboxObject = object;
		this.currentSkyboxGeometry = geometry;
		this.skyboxGroup.add(object);
		this.scene.add(this.skyboxGroup);
		this.camera.fov = this.settings.fov();
		this.camera.rotation.order = "ZYX";
		this.camera.position.set(0, this.settings.cameraHeight() * 1000, 0);

		if(initialCameraRotation){
			this.camera.rotation.x = initialCameraRotation.x;
			this.camera.rotation.y = initialCameraRotation.y;
		} else {
			this.camera.lookAt(1, this.settings.cameraHeight() * 1000, 0);
		}

		[settings.fov, settings.cameraHeight, settings.minPitch, settings.maxPitch]
			.forEach(boundable => {
				this.watch(boundable, () => this.updateCamera());
			});

		[settings.skyboxHeight, settings.skyboxRadius, context.state.skyboxWireframe, settings.skyboxRadialSegments, settings.skyboxHeightSegments, settings.skyboxBarrelness]
			.forEach((boundable: Boundable<unknown>) => {
				this.watch(boundable, () => {
					this.updateSkyboxShape()
					this.updateLinkObjects()
				});
			});
		
		this.watch(this.targetPanoram, () => {
			this.updateSkyboxTexture()
			// если не удалять кнопки - то иногда случаются странные баги, если сохраняются старые
			// лучше лишний раз пересоздать
			for(let panoramId in this.linkObjects){
				this.deleteLinkObject(this.linkObjects[panoramId]);
			}
			this.linkObjects = {};
			this.updateLinkObjects();
		});

		[settings.panorams, settings.panoramLabelScale].forEach((boundable: Boundable<unknown>) => {
			this.watch(boundable, () => {
				this.updateLinkObjects();
				this.updatePanoramRotation();
			});
		});

		let compass = this.makeArrow("x");
		compass.position.x = 0;
		compass.position.y = 0
		compass.position.z = 0;
		compass.scale.x = compass.scale.y = compass.scale.z = 100;
		this.watch(context.state.isInEditMode, isEditing => {
			if(isEditing && this.shouldShowCompassOnEdit()){
				if(!compass.parent){
					this.scene.add(compass);
				}
			} else {
				compass.parent?.remove(compass);
			}
		})

		this.setupUserControls();

		this.watch(freelook, () => {
			if(!this.isActive){
				return;
			}
			this.updateFreelooking();
		})
	}

	private updateFreelooking(): void {
		if(unwrapBoundable(this.freelook)){
			if(!this.keyboardCameraControls){
				this.keyboardCameraControls = setupKeyboardCameraMovement(this.camera, this.getKeyboardCameraMovingSpeed())
			}
		} else {
			if(this.keyboardCameraControls){
				this.keyboardCameraControls.clear();
				this.keyboardCameraControls = null;
			}
			this.updateCamera();
		}
	}

	protected onFrame(timePassed: number): void {
		super.onFrame(timePassed);
		if(this.keyboardCameraControls){
			this.keyboardCameraControls.onFrame(timePassed);
		}
	}

	protected getKeyboardCameraMovingSpeed(): number {
		return 5;
	}

	protected setupUserControls(): void {
		addDragListeners({
			element: this.canvas,
			rightMouseButton: true,
			lockPointer: true,
			onDrag: ({dx, dy, source}) => {
				if(source === "touch"){
					dx *= -1;
					dy *= -1;
				}
				this.rotateCamera(dx, dy);
			},
			onDragStart: () => {
				let focused = document.activeElement;
				if(focused && focused instanceof HTMLElement){
					focused.blur();
				}
			}
		});
	}

	start(container: HTMLElement): void {
		super.start(container);
		this.updateFreelooking();
	}

	stop(): void {
		super.stop();
		if(this.keyboardCameraControls){
			this.keyboardCameraControls.clear();
			this.keyboardCameraControls = null;
		}
	}

	private createSkybox(): {object: THREE.Mesh | THREE.Line, geometry: THREE.BufferGeometry} {
		let {geometry, object} = this.createSkyboxObject();
		return {object, geometry};
	}

	private createUpdateLinkObject(link: PanoramLink, panoramId: string, linkObject?: LinkObject): void {
		let label: string | null = null;
		let texture: TextToTextureRenderResult | null = null;
		let material: THREE.Material | null = null;
		let labelFromData = this.settings.panorams()[link.panoramId].label
		if(linkObject){
			if(linkObject.label === labelFromData){
				label = labelFromData;
				texture = this.textureRepo.textToTexture(linkObject.label, true);
				material = linkObject.material;
			} else {
				this.textureRepo.unrefTextTexture(linkObject.label);
				linkObject.material.dispose()
			}
		}
		if(!label || !texture || !material){
			label = labelFromData;
			texture = this.textureRepo.textToTexture(label)
			material = new THREE.MeshBasicMaterial({ map: texture.texture, side: THREE.DoubleSide })
		}

		let geometry: THREE.BufferGeometry | null = null
		let scale: number | null = null;
		let scaleFromData = this.context.settings.panoramLabelScale();
		if(linkObject){
			if(linkObject.label === labelFromData && linkObject.scale === scaleFromData){
				scale = scaleFromData;
				geometry = linkObject.geometry
			} else {
				linkObject.geometry.dispose();
			}
		}
		if(!scale || !geometry){
			scale = scaleFromData;
			geometry = new THREE.PlaneGeometry(
				texture.width * this.context.settings.panoramLabelScale() * 1000, 
				texture.height * this.context.settings.panoramLabelScale() * 1000
			);
		}

		let mesh: THREE.Mesh;
		if(linkObject){
			mesh = linkObject.mesh;
		} else {
			mesh = new THREE.Mesh;
		}
		mesh.geometry = geometry;
		mesh.material = material;

		let group: THREE.Group;
		if(linkObject){
			group = linkObject.group;
		} else {
			group = new THREE.Group()
			group.name = "link_to_" + link.panoramId + "_group"
			group.add(mesh);

			if(isInteractiveObject(group)){
				group.cursor = "pointer";
				group.on("click", evt => {
					if(this.context.state.isInEditMode()){
						if(this.isGizmoMovingNow){
							return;
						}
						this.context.state.selectedSceneObject({
							type: "link",
							fromPanoramId: panoramId,
							toPanoramId: link.panoramId,
							gizmoPoint: evt.intersects[0].point,
							object: group,
							parent: group,
							getLimits: (dir) => dir !== "y"? null: [0, this.settings.skyboxHeight() * 1000]
						})
					} else {
						this.context.state.currentDisplayedPanoram(link.panoramId);
					}
				})
			}

			this.skyboxGroup.add(group);
		}

		let radians = link.x * Math.PI * 2;
		let distance = this.context.settings.skyboxRadius() * 0.9
		group.position.x = Math.sin(radians) * distance * 1000;
		group.position.z = Math.cos(radians) * distance * 1000;
		group.position.y = link.y * this.context.settings.skyboxHeight() * 1000;
		group.rotation.y = radians + Math.PI;

		this.linkObjects[link.panoramId] = { geometry, material, group, label, scale, mesh }
	}
	
	private deleteLinkObject(link: LinkObject): void {
		link.group.parent?.remove(link.group);
		link.material.dispose();
		link.geometry.dispose();
		this.textureRepo.unrefTextTexture(link.label);
	}

	private updateLinkObjects(): void {
		const panoramId = unwrapBoundable(this.targetPanoram);
		let knownLinks = new Set<string>();

		if(panoramId){
			let panorams = this.context.settings.panorams();
			let panoram = panorams[panoramId];
			panoram.links?.forEach(link => {
				knownLinks.add(link.panoramId)
				this.createUpdateLinkObject(link, panoramId, this.linkObjects[link.panoramId])
			});
		}

		for(let otherPanoramId in this.linkObjects){
			if(!knownLinks.has(otherPanoramId)){
				this.deleteLinkObject(this.linkObjects[otherPanoramId])
				delete this.linkObjects[otherPanoramId]
			}
		}

	}

	private updateSkyboxTexture(): void {
		if(this.currentSkyboxMaterial){
			if(this.currentSkyboxTextureId){
				this.textureRepo.unrefTextureByImageId(this.currentSkyboxTextureId)
			} else {
				this.textureRepo.unrefTextureByPath(defaultSkyboxPath)
			}
			this.currentSkyboxMaterial.dispose();
		}

		this.currentSkyboxTextureId = unwrapBoundable(this.targetPanoram);
		let texture = this.currentSkyboxTextureId
			? this.textureRepo.imageIdToTexture(this.currentSkyboxTextureId)
			: this.textureRepo.pathToTexture(defaultSkyboxPath);
		this.currentSkyboxMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
		if(this.currentSkyboxObject){
			this.currentSkyboxObject.material = this.currentSkyboxMaterial;
		}
	}
	
	protected createSkyboxObject(): {geometry: THREE.BufferGeometry, object: THREE.Mesh | THREE.Line} {
		let geometry = new THREE.CylinderGeometry(
			this.settings.skyboxRadius() * 1000, 
			this.settings.skyboxRadius() * 1000, 
			this.settings.skyboxHeight() * 1000, 
			this.settings.skyboxRadialSegments(),
			this.settings.skyboxHeightSegments()
		);
		stretchCylinderTopBottom(geometry, this.settings.skyboxRadialSegments(), this.settings.skyboxHeightSegments());
		warpCylinderWalls(geometry, makeBarrelWarper(this.settings.skyboxBarrelness()));
		let object: THREE.Mesh | THREE.Line;
		if(this.context.state.skyboxWireframe()){
			object = new THREE.Line(geometry);
		} else {
			object = new THREE.Mesh(geometry);
		}
		object.name = "skybox";
		if(this.currentSkyboxMaterial){
			object.material = this.currentSkyboxMaterial;
		}
		
		object.position.y = (this.settings.skyboxHeight() / 2) * 1000;

		if(isInteractiveObject(object)){
			object.on("click", () => {
				if(!this.isGizmoMovingNow){
					this.context.state.selectedSceneObject(null);
					this.clearGizmo();
				}
			})
		}

		return {geometry, object}
	}

	private clampPitch(pitch: number): number {
		return Math.max(this.settings.minPitch(), Math.min(this.settings.maxPitch(), pitch));
	}

	rotateCamera(dx: number, dy: number): void {
		let pitch = this.camera.rotation.x + (dy * this.settings.cameraRotationSpeed());
		this.camera.rotation.x = this.clampPitch(pitch)
		this.camera.rotation.y += dx * this.settings.cameraRotationSpeed();
	}

	private updateSkyboxShape(): void {
		let {geometry, object} = this.createSkyboxObject();
		this.skyboxGroup.add(object);
		if(this.currentSkyboxObject){
			this.currentSkyboxObject.parent?.remove(this.currentSkyboxObject);
		}
		if(this.currentSkyboxGeometry){
			this.currentSkyboxGeometry.dispose();
		}
		
		this.currentSkyboxObject = object;
		this.currentSkyboxGeometry = geometry;
	}

	protected updateCamera(): void {
		this.camera.fov = this.settings.fov();
		if(!unwrapBoundable(this.freelook)){
			this.camera.position.x = this.camera.position.z = 0;
			this.camera.position.y = this.settings.cameraHeight() * 1000;
			this.camera.rotation.x = this.clampPitch(this.camera.rotation.x)
		}
		this.camera.updateProjectionMatrix();
	}

	protected shouldShowCompassOnEdit(): boolean {
		return true;
	}

	private updatePanoramRotation(): void {
		let panoramId = unwrapBoundable(this.targetPanoram);
		if(!panoramId){
			return
		}

		let panoram = this.context.settings.panorams()[panoramId]
		if(!panoram.position){
			return;
		}

		this.skyboxGroup.rotation.y = panoram.position.rotation;
	}

}