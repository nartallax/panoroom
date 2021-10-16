import {THREE} from "threejs_decl";
import {AppContext} from "context";
import {TextureRepository} from "texture_repo";
import {ControlWatchFn, makeNodeBoundWatcher} from "controls/control";
import {watchNodeResized} from "utils/watch_node_resized";
import {raf} from "utils/graphic_utils";

// базовые штуки для работы со сценой - создание, отрисовка фреймов, контроль размера экрана, репозиторий текстур
export class SceneController {
	protected readonly scene = new THREE.Scene();
	readonly camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
	protected readonly renderer = new THREE.WebGLRenderer();
	protected readonly textureRepo: TextureRepository;
	private stopRaf: (() => void) | null = null;
	private stopResizeWatch: (() => void) | null = null;
	protected watch: ControlWatchFn;

	constructor(protected readonly context: AppContext){
		this.textureRepo = new TextureRepository(this.context, {
			textBgColor: "#444",
			textFgColor: "#ccc",
			textHeight: 64,
			textMargin: 15
		});

		this.watch = makeNodeBoundWatcher(this.canvas);
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
}