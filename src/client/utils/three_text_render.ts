import {THREE} from "threejs_decl";

export function renderTextToTexture(text: string, worldTextHeight: number, worldFullHeight: number, resolutionHeightPx: number, fgColor: string, bgColor?: string): THREE.Texture {
	let pixelToWorldCoeff = worldTextHeight / resolutionHeightPx;
	let canvasFullHeightPx = Math.ceil(worldFullHeight / pixelToWorldCoeff);
	let canvas = document.createElement("canvas");
	let context2d = canvas.getContext("2d");
	if(!context2d){
		throw new Error("No context 2d, cannot render text.");
	}
	context2d.font = resolutionHeightPx + "px sans-serif";        
	// now get the widths
	let canvasTextWithPx = context2d.measureText(text).width;
	let worldTextWidth = canvasTextWithPx*pixelToWorldCoeff;
	let worldFullWidth = worldTextWidth+(worldFullHeight-worldTextHeight);
	let canvasFullWidthPx = Math.ceil(worldFullWidth/pixelToWorldCoeff);

	canvas.width = canvasFullWidthPx;
	canvas.height = canvasFullHeightPx;
	if(bgColor !== undefined){
		context2d.fillStyle = bgColor
		context2d.fillRect(0, 0, canvasFullWidthPx,canvasFullHeightPx);
	}

	context2d.textAlign = "center";
	context2d.textBaseline = "middle"; 
	context2d.fillStyle = fgColor;
	context2d.font = resolutionHeightPx + "px sans-serif";
	context2d.fillText(text, canvasFullWidthPx / 2, canvasFullHeightPx / 2);
	
	let texture = new THREE.Texture(canvas);
	texture.minFilter = THREE.LinearFilter; // eliminate console message
	texture.needsUpdate = true;
	return texture;
	/*
	// and make the world plane with the texture
	geometry = new THREE.PlaneGeometry(worldFullWidth, worldFullHeight);
	var material = new THREE.MeshBasicMaterial( 
	  { side:THREE.DoubleSide, map:texture, transparent:true, opacity:1.0 } );
	// and finally, the mesh
	var mesh = new THREE.Mesh(geometry, material);
	mesh.wWorldTxt = worldTextWidth; // return the width of the text in the plane
	mesh.wWorldAll = worldFullWidth; //    and the width of the whole plane
	mesh.wPxTxt = canvasTextWithPx;       //    and the width of the text in the texture canvas
								// (the heights of the above items are known)
	mesh.wPxAll = canvasFullWidthPx;       //    and the width of the whole texture canvas
	mesh.hPxAll = canvasFullHeightPx;       //    and the height of the whole texture canvas
	mesh.ctx = context2d;             //    and the 2d texture context, for any glitter
	// console.log(wPxTxt, hPxTxt, wPxAll, hPxAll);
	// console.log(wWorldTxt, hWorldTxt, wWorldAll, hWorldAll);
	return mesh;
	*/
  }