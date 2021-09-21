import {AppContext} from "context";
import {addDragListeners} from "utils/drag";

export function setupEventHandlers(context: AppContext): void {
	let canvas = context.skybox.canvas;
	addDragListeners({
		element: canvas,
		rightMouseButton: true,
		lockPointer: true,
		onDrag: ({dx, dy, source}) => {
			if(source === "touch"){
				dx *= -1;
				dy *= -1;
			}
			context.skybox.rotateCamera(dx, dy);
		}
	});
}