import {AppContext} from "context";
import {THREE} from "threejs_decl";

export class TextureRepository {
	private readonly textureLoader = new THREE.TextureLoader();
	private readonly textures = {} as {[path: string]: {texture: THREE.Texture, refCount: number }}
	private readonly cleanupList = new Set<string>();
	private cleanupHandler: (NodeJS.Timeout | number) | null = null;

	constructor(private readonly context: AppContext){}

	pathToTexture(path: string): THREE.Texture {
		if(!this.textures[path]){
			this.textures[path] = {
				texture: this.textureLoader.load(path),
				refCount: 1
			}
		} else {
			this.textures[path].refCount++;
		}
		return this.textures[path].texture;
	}

	private imageIdToPath(imageId: string): string {
		let panorams = this.context.settings.panorams();
		let panoram = panorams[imageId];
		return "./img/" + panoram.filename;
	}

	imageIdToTexture(imageId: string): THREE.Texture {
		return this.pathToTexture(this.imageIdToPath(imageId));
	}

	unrefTextureByImageId(imageId: string): void {
		this.unrefTextureByPath(this.imageIdToPath(imageId))
	}

	unrefTextureByPath(path: string): void {
		let descr = this.textures[path];
		descr.refCount--;
		if(descr.refCount < 1){
			this.cleanupList.add(path);
			this.initCleanup();
		}
	}

	private initCleanup(): void {
		if(!this.cleanupHandler){
			this.cleanupHandler = setTimeout(() => {
				this.cleanupHandler = null;
				this.cleanupList.forEach(path => {
					let item = this.textures[path];
					if(item.refCount === 0){
						delete this.textures[path];
						item.texture.dispose();
					}
				})
				this.cleanupList.clear();
			}, 1000);
		}
	}



}