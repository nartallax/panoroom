import {AppContext} from "context";
import {THREE} from "threejs_decl";
import {renderTextToTexture, TextToTextureRenderResult} from "utils/three_text_render";

export interface TextureRepositoryOptions {
	textMargin: number;
	textHeight: number;
	textFgColor: string;
	textBgColor: string;
}

export class TextureRepository {
	private readonly textureLoader = new THREE.TextureLoader();
	private readonly imageTextures = {} as {[path: string]: {texture: THREE.Texture, refCount: number }}
	private readonly textTextures = {} as {[text: string]: { rendered: TextToTextureRenderResult, refCount: number }}
	private readonly imageCleanupList = new Set<string>();
	private readonly textCleanupList = new Set<string>();
	private cleanupHandler: (NodeJS.Timeout | number) | null = null;

	constructor(private readonly context: AppContext, private readonly options: TextureRepositoryOptions){}

	pathToTexture(path: string): THREE.Texture {
		if(!this.imageTextures[path]){
			this.imageTextures[path] = {
				texture: this.textureLoader.load(path),
				refCount: 1
			}
		} else {
			this.imageTextures[path].refCount++;
		}
		return this.imageTextures[path].texture;
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
		let descr = this.imageTextures[path];
		descr.refCount--;
		if(descr.refCount < 1){
			this.imageCleanupList.add(path);
			this.initCleanup();
		}
	}

	textToTexture(text: string, skipReferenceIncrement = false): TextToTextureRenderResult {
		if(!this.textTextures[text]){
			this.textTextures[text] = {
				rendered: renderTextToTexture(text, 
					this.options.textHeight,
					this.options.textMargin,
					this.options.textMargin,
					this.options.textFgColor,
					this.options.textBgColor
				),
				refCount: 1
			}
		} else {
			if(!skipReferenceIncrement){
				this.textTextures[text].refCount++;
			}
		}
		return this.textTextures[text].rendered;
	}

	unrefTextTexture(text: string): void {
		let descr = this.textTextures[text];
		descr.refCount--;
		if(descr.refCount < 1){
			this.textCleanupList.add(text);
			this.initCleanup();
		}
	}

	private initCleanup(): void {
		if(!this.cleanupHandler){
			this.cleanupHandler = setTimeout(() => {
				this.cleanupHandler = null;

				this.imageCleanupList.forEach(path => {
					let item = this.imageTextures[path];
					if(item.refCount === 0){
						delete this.imageTextures[path];
						item.texture.dispose();
					}
				})
				this.imageCleanupList.clear();

				this.textCleanupList.forEach(text => {
					let item = this.textTextures[text];
					if(item.refCount === 0){
						delete this.textTextures[text];
						item.rendered.texture.dispose();
					}
				})
				this.textCleanupList.clear();

			}, 1000);
		}
	}



}