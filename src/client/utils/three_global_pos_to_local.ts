// изменить глобальный position так, чтобы он стал локальным относительно parent
export function movePositionToLocal(position: THREE.Vector3, parent: THREE.Object3D): void{
	position.x -= parent.position.x;
	position.y -= parent.position.y;
	position.z -= parent.position.z;
	let rot = parent.rotation.clone();
	rot.x = -rot.x;
	rot.y = -rot.y;
	rot.z = -rot.z;
	position.applyEuler(rot);
}