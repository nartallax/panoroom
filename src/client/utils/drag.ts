export interface DragListenerParameters {
	element: HTMLElement;
	onDragStart?: () => void;
	onDrag: (event: {x: number, y: number, dx: number, dy: number, source: "pointer" | "touch"}) => void;
	onDragEnd?: () => void;
	rightMouseButton?: boolean;
	lockPointer?: boolean;
}

export function addDragListeners(params: DragListenerParameters): void {
	let pointerIsLocked = false;

	let prevX = 0, prevY = 0;
	function onTouchMove(evt: TouchEvent): void {
		let firstTouch = evt.touches[0];
		if(!firstTouch){
			onTouchEnd();
			return;
		}
		params.onDrag({
			x: firstTouch.clientX,
			y: firstTouch.clientY,
			dx: prevX - firstTouch.clientX, 
			dy: prevY - firstTouch.clientY,
			source: "touch"
		});
		prevX = firstTouch.clientX;
		prevY = firstTouch.clientY;
	}

	function onMouseMove(evt: MouseEvent): void {
		if(pointerIsLocked){
			params.onDrag({
				x: evt.clientX,
				y: evt.clientX,
				dx: -evt.movementX, 
				dy: -evt.movementY,
				source: "pointer"
			});
		} else {
			params.onDrag({
				x: evt.clientX,
				y: evt.clientX,
				dx: prevX - evt.clientX,
				dy: prevY - evt.clientY,
				source: "pointer"
			});
			prevX = evt.clientX;
			prevY = evt.clientY;
		}
	}
	
	function onTouchEnd(): void {
		window.removeEventListener("touchmove", onTouchMove);
		window.removeEventListener("touchend", onTouchEnd)
		params.onDragEnd && params.onDragEnd();
	}

	function onMouseUp(): void {
		window.removeEventListener("mousemove", onMouseMove);
		window.removeEventListener("mouseup", onMouseUp);
		if(pointerIsLocked){
			document.exitPointerLock();
		}
		params.onDragEnd && params.onDragEnd();
	}

	function installDragListeners(evt: MouseEvent | TouchEvent): void {
		evt.preventDefault();
		evt.stopPropagation();
		params.onDragStart && params.onDragStart();
		if(evt instanceof TouchEvent){
			let firstTouch = evt.touches[0];
			prevX = firstTouch.clientX;
			prevY = firstTouch.clientY;

			window.addEventListener("touchmove", onTouchMove);
			window.addEventListener("touchend", onTouchEnd);
		} else {
			prevX = evt.clientX;
			prevY = evt.clientY;

			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
		}
	}

	params.element.addEventListener("mousedown", evt => {
		let expectedButton = params.rightMouseButton? 2: 0;
		if(evt.button !== expectedButton){
			return;
		}
		if(params.lockPointer && params.element instanceof HTMLCanvasElement){
			pointerIsLocked = lockPointer(params.element);
		}
		installDragListeners(evt);
	})

	params.element.addEventListener("touchstart", evt => {
		installDragListeners(evt);
	});

	if(params.rightMouseButton){
		params.element.addEventListener("contextmenu", evt => {
			evt.preventDefault();
			evt.stopPropagation();
		})
	}

	if(params.lockPointer){
		document.addEventListener("pointerlockchange", () => {
			pointerIsLocked = document.pointerLockElement === params.element;
		}, false);
	}
}

function lockPointer(canvas: HTMLCanvasElement): boolean {
	if(!canvas.requestPointerLock){
		return false;
	}

	canvas.requestPointerLock();
	return true;
}