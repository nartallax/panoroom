import type * as THREE_type from "three";

// небольшой хак, чтобы бандл не требовал реального модуля THREE, а использовал имеющийся на странице
export const THREE: typeof THREE_type = window.THREE as unknown as typeof THREE_type;

// это такой мерзкий способ типизировать three.interaction
// своих типов он не поставляет, а внедряться в существующие у меня не вышло
export interface InteractiveObject3D extends THREE.Object3D {
	on(name: string): void;
}