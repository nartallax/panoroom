import type * as THREE_type from "three";

// небольшой хак, чтобы бандл не требовал реального модуля THREE, а использовал имеющийся на странице
export const THREE: typeof THREE_type = window.THREE as unknown as typeof THREE_type;