// одна панорама. точка в реальном пространстве
export interface Panoram {
	filename: string;
	label: string;
	position?: FloorPosition;
	links?: {
		type: PanoramLinkType;
		panoramId: string;
		x: number;
		y: number;
	}[];
}

export interface FloorPosition {
	floorId: string;
	x: number;
	z: number;
	rotation: number;
}

export type PanoramLinkType = "door" | "stairs" | "step";

// этаж здания. содержит панорамы
export interface BuildingFloor {
	label: string;
	x: number;
	y: number;
	z: number;
	rotation: number;
	texture?: string;
	width: number;
	length: number;
}

// план здания, он же - главная точка настроек контента
export interface BuildingPlan {
	panorams: {[panoramId: string]: Panoram};
	floors: {[floorId: string]: BuildingFloor};
}