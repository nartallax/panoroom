import {Boundable} from "boundable/boundable";
import {AppContext} from "context";
import {ControlWatchFn, makeNodeBoundWatcher} from "controls/control";
import {SettingsController} from "settings_controller";
import {TextureRepository} from "texture_repo";
import {THREE} from "threejs_decl";
import {addDragListeners} from "utils/drag";
import {raf} from "utils/graphic_utils";
import {watchNodeResized} from "utils/watch_node_resized";

interface Skybox {
	geometry: THREE.CylinderGeometry;
	texture: THREE.Texture;
	material: THREE.Material;
	object: THREE.Object3D;
}

const defaultSkyboxPath = "./static/default_skybox.png";

export class SkyboxController {
	protected readonly scene = new THREE.Scene();
	protected readonly camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
	protected readonly renderer = new THREE.WebGLRenderer();
	protected readonly textureRepo;
	private readonly skybox: Skybox;
	private stopRaf: (() => void) | null = null;
	private stopResizeWatch: (() => void) | null = null;
	protected watch: ControlWatchFn;

	constructor(private readonly settings: SettingsController, protected readonly context: AppContext){
		this.textureRepo = new TextureRepository(this.context, {
			textBgColor: "#444",
			textFgColor: "#ccc",
			textHeight: 64,
			textMargin: 10
		});
		this.skybox = this.createSkybox();
		this.scene.add(this.skybox.object);
		this.camera.fov = this.settings.fov();
		this.camera.rotation.order = "ZYX";
		this.camera.position.set(0, this.settings.cameraHeight() * 1000, 0);
		this.camera.lookAt(-1, this.settings.cameraHeight() * 1000, 0);
		this.camera.lookAt(1, this.settings.cameraHeight() * 1000, 0);

		this.watch = makeNodeBoundWatcher(this.canvas);
		[settings.fov, settings.cameraHeight, settings.minPitch, settings.maxPitch]
			.forEach(boundable => {
				this.watch(boundable, () => this.updateCamera());
			});

		[settings.skyboxHeight, settings.skyboxRadius, settings.skyboxWireframe, settings.skyboxRadialSegments]
			.forEach((boundable: Boundable<unknown>) => {
				this.watch(boundable, () => this.updateSkyboxShape());
			});

		this.setupUserControls();
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

	get canvas(): HTMLCanvasElement {
		return this.renderer.domElement;
	}

	private onResize(container: HTMLElement): void {
		let w = container.clientWidth;
		let h = container.clientHeight
		this.renderer.setSize(w, h);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}
	
	start(container: HTMLElement): void {
		if(this.stopRaf){
			throw new Error("Already running");
		}
		this.onResize(container);
		container.appendChild(this.canvas);
		this.stopRaf = raf(timePassed => {
			this.renderer.render(this.scene, this.camera);
			this.onFrame(timePassed);
		});
		this.stopResizeWatch = watchNodeResized(container, () => this.onResize(container));
	}

	stop(): void {
		if(this.stopRaf){
			this.stopRaf();
			this.stopRaf = null;
		}
		if(this.stopResizeWatch){
			this.stopResizeWatch();
			this.stopResizeWatch = null;
		}
		this.canvas.remove();
	}

	protected onFrame(timePassed: number): void {
		// nothing. to be overriden
		void timePassed
	}

	get isActive(): boolean {
		return !!this.stopRaf;
	}

	private createSkybox(): Skybox {
		let texture = this.textureRepo.pathToTexture(defaultSkyboxPath)
		let material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
		let {geometry, object: mesh} = this.createSkyboxObject(material);
		return {texture, material, object: mesh, geometry};
	}
	
	protected createSkyboxObject(material: THREE.Material): {geometry: THREE.CylinderGeometry, object: THREE.Object3D} {
		let geometry = new THREE.CylinderGeometry(
			this.settings.skyboxRadius() * 1000, 
			this.settings.skyboxRadius() * 1000, 
			this.settings.skyboxHeight() * 1000, 
			this.settings.skyboxRadialSegments()
		);
		patchCylinderUV(geometry);
		let object: THREE.Object3D;
		if(this.settings.skyboxWireframe()){
			object = new THREE.Line(geometry, material);
		} else {
			object = new THREE.Mesh(geometry, material);
		}
		object.name = "skybox";
		
		object.position.y = (this.settings.skyboxHeight() / 2) * 1000;
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
		let {geometry, object} = this.createSkyboxObject(this.skybox.material);
		this.scene.add(object);
		this.scene.remove(this.skybox.object);
		this.skybox.geometry.dispose();
		this.skybox.object = object;
		this.skybox.geometry = geometry;
	}

	protected updateCamera(): void {
		this.camera.fov = this.settings.fov();
		this.camera.position.y = this.settings.cameraHeight() * 1000;
		this.camera.rotation.x = this.clampPitch(this.camera.rotation.x)
		this.camera.updateProjectionMatrix();
	}

}

/* меняем UV-маппинг у цилиндра так, чтобы на верхнюю и нижнюю крышку растягивались края панорамы
ориентируемся мы при этом на нормали, так что если когда-то threejs поменяет логику их генерации - то тут сломается */
function patchCylinderUV(geom: THREE.BufferGeometry): void {
	let cylinderSideUVs = new Map<string, {x: number, y: number}>(); 
	let pos = geom.attributes.position;
	let uv = geom.attributes.uv;
	let norm = geom.attributes.normal;
	
	function makePosKey(i: number): string {
		return pos.getX(i).toFixed(3) + "|" + pos.getY(i).toFixed(3) + "|" + pos.getZ(i).toFixed(3);
	}

	for(let i = 0; i < uv.count; i++){
		let normY = norm.getY(i)
		if(normY < 0.0001 && normY > -0.0001){
			// если нормаль к поверхности в данной точки горизонтальна, т.е. имеет y = 0
			// то этот вертекс относится к боку цилиндра, и нам нужно сохранить его uv
			// TODO: как-то более изящно хранить? по ключу из трех значений
			cylinderSideUVs.set(makePosKey(i), {x: uv.getX(i), y: uv.getY(i)});
		}
	}

	// лютый хак, некрасиво, сломается, нужно как-нибудь переделать, но не знаю, как
	// сначала считаем количество сторон из количества вертексов
	// потом используем его, чтобы понять, с каких индексов начинаются "центральные" вертексы
	// чтобы потом прописать им правильные uv-мапы
	let sideCount = (uv.count - 4) / 6
	let topCenterVertexIndexStart = (sideCount * 2) + 2;
	let bottomCenterVertexIndexStart = (sideCount * 4) + 3;
	for(let i = 0; i < uv.count; i++){
		let normY = norm.getY(i)
		if(normY > 0.0001 || normY < -0.0001){
			// если нормаль к поверхности в данной точки НЕ горизонтальна, т.е. имеет y != 0
			// то этот вертекс относится к одной из крышек цилиндра, и нам нужно перезаписать его UV
			// значение UV мы возьмем с вертекса бока цилиндра с теми же координатами
			let posX = pos.getX(i), posZ = pos.getZ(i);
			if(posX < 0.0001 && posX > -0.0001 && posZ < 0.0001 && posZ > -0.0001){
				// особый случай - центр крышки. аналогичного вертекса на боку нет
				let isTop = normY > 0;
				let indexStart = isTop? topCenterVertexIndexStart: bottomCenterVertexIndexStart;
				let offset = ((i - indexStart) + 0.5) / sideCount;
				uv.setX(i, offset);
				uv.setY(i, isTop? 1: 0);
			} else {
				let goodUV = cylinderSideUVs.get(makePosKey(i));
				if(goodUV){
					uv.setX(i, goodUV.x);
					uv.setY(i, goodUV.y);
				} else {
					// щито поделать десу
					console.warn(`Found NO good UV for position ${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`);
				}
			}
		}
	}

	uv.needsUpdate = true;
}