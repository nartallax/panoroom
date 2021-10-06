import type * as THREE_type from "three";

// небольшой хак, чтобы бандл не требовал реального модуля THREE, а использовал имеющийся на странице
type resultingThreejsType = typeof THREE_type & typeof InteractionLib;
export const THREE: resultingThreejsType = window.THREE as unknown as resultingThreejsType;

// это такой мерзкий способ типизировать three.interaction
// своих типов он не поставляет, а внедряться в существующие у меня не вышло

// it shoult return true for any object of scene that is patched by Interaction object
export function isInteractiveObject(x: THREE.Object3D): x is InteractionLib.InteractiveObject3D {
	return typeof((x as InteractionLib.InteractiveObject3D).on) === "function";
}

export namespace InteractionLib {
	export declare class Interaction {
		constructor(renderer: THREE.Renderer, scene: THREE.Scene, camera: THREE.Camera);
	}

	export interface InteractiveObject3D extends THREE.Object3D {
		cursor?: string;
		// "unknown" here means "I don't yet wrote down a type"
		// also note that I did not included actually every property in event objects
		// that is, if you feel that something is absent - look at value for yourself
		on(name: "click", handler: (evt: MouseEvent) => void): void;
		on(name: "mousedown", handler: (evt: MouseEvent) => void): void;
		on(name: "mouseup", handler: (evt: MouseEvent) => void): void;
		on(name: "mouseover", handler: (evt: MouseEvent) => void): void;
		on(name: "mouseout", handler: (evt: MouseEvent) => void): void;
		on(name: "mousemove", handler: (evt: MouseEvent) => void): void;
		on(name: "touchstart", handler: (evt: unknown) => void): void;
		on(name: "touchend", handler: (evt: unknown) => void): void;
		on(name: "touchmove", handler: (evt: unknown) => void): void;
	}

	export interface MouseEvent {
		// why two targets? it's a mystery!
		// sometimes they change AFTER the handler is invoked, which is big WTF
		// seems like interaction lib is reusing event object (and possibly other temporary objects?)
		// that is, values in event object are only correct synchronously within handler invocation
		target: THREE.Object3D | null;
		currentTarget: THREE.Object3D | null; 
		intersects: THREE.Intersection[];
		type: string; // mouseout, mouseover, click and so on
		data: InteractionEventData
	}

	export interface InteractionEventData {
		// incomplete! more here
		originalEvent: unknown; // some event
	}
}

