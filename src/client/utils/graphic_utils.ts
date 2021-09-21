// some sources are from here: https://github.com/mrdoob/three.js/blob/master/examples/jsm/WebGL.js

export function isWebGLAvailable(version: 1 | 2): boolean {
	try {
		const canvas = document.createElement("canvas");
		if(version === 1){
			return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext( 'experimental-webgl' )));
		} else {
			return !!(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
		}
	} catch (e) {
		return false;
	}
}

export function getWebglErrorElement(version: 1 | 2): HTMLElement {
	const names = {
		1: "WebGL",
		2: "WebGL 2"
	};

	const contexts = {
		1: window.WebGLRenderingContext,
		2: window.WebGL2RenderingContext
	};
	const result = document.createElement("div");
	result.className = "webgl-error-message";
	let target = contexts[version]? "graphics card": "browser";
	result.textContent = `Your ${target} does not seem to support `

	let link = document.createElement("a");
	link.setAttribute("href", "http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation");
	link.textContent = names[version];
	result.appendChild(link);

	return result;
}

/** Wrapped RequestAnimationFrame, which cycles and gives you actual time passed since last invocation
 * Returns stopper function */
 export function raf(handler: (timePassed: number) => void): () => void {
	let lastInvokeTime = Date.now();
	let stopped = false;

	let wrappedHandler = () => {
		if(stopped){
			return;
		}
		requestAnimationFrame(wrappedHandler);
		let newNow = Date.now();
		let diff = newNow - lastInvokeTime;
		lastInvokeTime = newNow;
		handler(diff);
	}

	requestAnimationFrame(wrappedHandler);

	return () => stopped = true;
}