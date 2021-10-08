import {THREE} from "threejs_decl";

export interface TextToTextureRenderResult {
	readonly width: number;
	readonly height: number;
	readonly texture: THREE.Texture;
}

// сделать из текста текстуру
// все размеры в пикселях, цвета - #rgb
// source: https://discourse.threejs.org/t/an-example-of-text-to-canvas-to-texture-to-material-to-mesh-not-too-difficult/13757
export function renderTextToTexture(text: string, height: number, marginX: number, marginY: number, fgColor: string, bgColor: string): TextToTextureRenderResult {
	// по-хорошему не создавать элемент каждый раз, а реюзать
	// но тогда несколько боязно на тему конкарренси (текстура не успеет загрузить данные с канваса до реюза)
	// раньше можно было в текстуру передавать context2d.getImageData(0, 0, canvas.width, canvas.height)
	// но теперь почему-то нельзя
	let canvas = document.createElement("canvas");
	let context2d = canvas.getContext("2d");
	if(!context2d){
		throw new Error("No context 2d, cannot render text.");
	}

	context2d.font = height + "px sans-serif";
	let width = context2d.measureText(text).width;

	canvas.width = width + (marginX * 2);
	canvas.height = height + (marginY * 2);
	context2d.fillStyle = bgColor
	context2d.fillRect(0, 0, canvas.width, canvas.height);

	context2d.textAlign = "center";
	context2d.textBaseline = "middle";
	context2d.fillStyle = fgColor;
	// почему тут нужно второй раз назначать font? я не понял, но без этого не работает
	context2d.font = height + "px sans-serif";
	context2d.fillText(text, canvas.width / 2, canvas.height / 2);
	
	let texture = new THREE.Texture(canvas);
	texture.minFilter = THREE.LinearFilter; // eliminate console message
	texture.needsUpdate = true;
	return { 
		texture, 
		width: canvas.width,
		height: canvas.height
	};
}