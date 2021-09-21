import {AppContext} from "context";
import {THREE} from "threejs_decl";
import {raf} from "utils/graphic_utils";

interface Skybox {
	geometry: THREE.CylinderGeometry;
	texture: THREE.Texture;
	material: THREE.Material;
	mesh: THREE.Mesh;
}

export class SkyboxController {
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
	private readonly renderer = new THREE.WebGLRenderer();
	private readonly skybox: Skybox;

	constructor(private readonly context: AppContext, private skyboxTexturePath: string){
		this.skybox = this.createSkybox();
		this.scene.add(this.skybox.mesh);
		this.camera.fov = this.context.settings.fov;
		this.camera.rotation.order = "ZYX";
		this.camera.position.set(0, this.context.settings.cameraHeight * 1000, 0);
		this.camera.lookAt(-1, this.context.settings.cameraHeight * 1000, 0);
		this.camera.lookAt(1, this.context.settings.cameraHeight * 1000, 0);
	}

	get canvas(): HTMLCanvasElement {
		return this.renderer.domElement;
	}
	
	start(): void {
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		document.body.appendChild(this.canvas);
		raf(() => {
			this.renderer.render(this.scene, this.camera);
		});
	}

	private createSkybox(): Skybox {
		let texture = new THREE.TextureLoader().load(this.skyboxTexturePath)
		let material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
		let {geometry, mesh} = this.createSkyboxMesh(material);
		return {texture, material, mesh, geometry};
	}
	
	private createSkyboxMesh(material: THREE.Material): {geometry: THREE.CylinderGeometry, mesh: THREE.Mesh} {
		let geometry = new THREE.CylinderGeometry(
			this.context.settings.skyboxRadius * 1000, 
			this.context.settings.skyboxRadius * 1000, 
			this.context.settings.skyboxHeight * 1000, 
			256
		);
		patchCylinderUV(geometry);
		let mesh = new THREE.Mesh(geometry, material);
		mesh.position.y = (this.context.settings.skyboxHeight / 2) * 1000;
		return {geometry, mesh}
	}

	private clampPitch(pitch: number): number {
		return Math.max(this.context.settings.minPitch, Math.min(this.context.settings.maxPitch, pitch));
	}

	rotateCamera(dx: number, dy: number): void {
		let pitch = this.camera.rotation.x + (dy * this.context.settings.cameraRotationSpeed);
		this.camera.rotation.x = this.clampPitch(pitch)
		this.camera.rotation.y += dx * this.context.settings.cameraRotationSpeed;
	}

	onSkyboxGeometrySourceParametersUpdated(): void {
		let {geometry, mesh} = this.createSkyboxMesh(this.skybox.material);
		this.scene.add(mesh);
		this.scene.remove(this.skybox.mesh);
		this.skybox.geometry.dispose();
		this.skybox.mesh = mesh;
		this.skybox.geometry = geometry;
	}

	onCameraHeightUpdated(): void {
		this.camera.position.y = this.context.settings.cameraHeight * 1000;
	}

	onFovUpdated(): void {
		this.camera.fov = this.context.settings.fov;
		this.camera.updateProjectionMatrix();
	}

	onPitchLimitUpdated(): void {
		this.camera.rotation.x = this.clampPitch(this.camera.rotation.x)
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