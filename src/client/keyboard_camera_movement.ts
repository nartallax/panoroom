export interface KeyboardCameraControls {
	onFrame(timePassed: number): void;
	clear(): void;
}

export function setupKeyboardCameraMovement(camera: THREE.Camera, speed: number): KeyboardCameraControls {
	let directMovement = 0;
	let strafeMovement = 0;
	let yMovement = 0;

	let shouldHandle = () => {
		if(document.activeElement){
			let name = document.activeElement.tagName.toUpperCase();
			if(name === "INPUT" || name === "SELECT"){
				return false;
			}
		}

		return true;
	}

	let handleKeydown = (e: KeyboardEvent): void => {
		if(!shouldHandle()){
			return;
		}
		switch(e.key.toLowerCase()){
			case "a": strafeMovement = -1; break;
			case "d": strafeMovement = +1; break;
			case "s": directMovement = -1; break;
			case "w": directMovement = +1; break;
			case "shift": yMovement = -1; break;
			case " ": yMovement = +1; break;
		}
	}

	let handleKeyup = (e: KeyboardEvent): void => {
		if(!shouldHandle()){
			return;
		}
		switch(e.key.toLowerCase()){
			case "a": if(strafeMovement === -1){ strafeMovement = 0 } break;
			case "d": if(strafeMovement === +1){ strafeMovement = 0 } break;
			case "s": if(directMovement === -1){ directMovement = 0 } break;
			case "w": if(directMovement === +1){ directMovement = 0 } break;
			case "shift": if(yMovement === -1){ yMovement = 0 } break;
			case " ": if(yMovement === +1){ yMovement = 0 } break;
		}
	}

	window.addEventListener("keydown", handleKeydown);
	window.addEventListener("keyup", handleKeyup);

	return {
		clear(){
			window.removeEventListener("keydown", handleKeydown);
			window.removeEventListener("keyup", handleKeyup);
		},
		onFrame(timePassed){
			if(yMovement){
				camera.position.y += yMovement * speed * timePassed;
			}
			if(directMovement || strafeMovement){
				let direct = directMovement * speed * timePassed;
				let strafe = strafeMovement * speed * timePassed;
				let sin = Math.sin(camera.rotation.y);
				let cos = Math.cos(camera.rotation.y)
				camera.position.x -= (sin * direct) - (cos * strafe);
				camera.position.z -= (cos * direct) + (sin * strafe);
			}
			
		}
	}
}