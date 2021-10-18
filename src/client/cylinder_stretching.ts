/* меняем UV-маппинг у цилиндра так, чтобы на верхнюю и нижнюю крышку растягивались края панорамы
ориентируемся мы при этом на нормали, так что если когда-то threejs поменяет логику их генерации - то тут сломается */
export function stretchCylinderTopBottom(geom: THREE.BufferGeometry, sideSegmentCount: number, heightSegmentCount: number): void {
	let cylinderSideUVs = new Map<string, {x: number, y: number}>(); 
	let pos = geom.attributes.position;
	let uv = geom.attributes.uv;
	let norm = geom.attributes.normal;
	
	function makePosKey(i: number): string {
		return pos.getX(i).toFixed(3) + "|" + pos.getY(i).toFixed(3) + "|" + pos.getZ(i).toFixed(3);
	}

	for(let i = 0; i < uv.count; i++){
		let normY = norm.getY(i)
		if(normY < 0.0001 && normY > -0.0001){
			// если нормаль к поверхности в данной точки горизонтальна, т.е. имеет y = 0
			// то этот вертекс относится к боку цилиндра, и нам нужно сохранить его uv
			// TODO: как-то более изящно хранить? по ключу из трех значений
			cylinderSideUVs.set(makePosKey(i), {x: uv.getX(i), y: uv.getY(i)});
		}
	}

	// лютый хак, некрасиво, сломается, нужно как-нибудь переделать, но не знаю, как
	// сначала считаем количество сторон из количества вертексов
	// потом используем его, чтобы понять, с каких индексов начинаются "центральные" вертексы
	// чтобы потом прописать им правильные uv-мапы
	let topCenterVertexIndexStart = (sideSegmentCount * (1 + heightSegmentCount)) + (1 + heightSegmentCount);
	let bottomCenterVertexIndexStart = (sideSegmentCount * (3 + heightSegmentCount)) + (2 + heightSegmentCount);
	for(let i = 0; i < uv.count; i++){
		let normY = norm.getY(i)
		if(normY > 0.0001 || normY < -0.0001){
			// если нормаль к поверхности в данной точки НЕ горизонтальна, т.е. имеет y != 0
			// то этот вертекс относится к одной из крышек цилиндра, и нам нужно перезаписать его UV
			// значение UV мы возьмем с вертекса бока цилиндра с теми же координатами
			let posX = pos.getX(i), posZ = pos.getZ(i);
			if(posX < 0.0001 && posX > -0.0001 && posZ < 0.0001 && posZ > -0.0001){
				// особый случай - центр крышки. аналогичного вертекса на боку нет
				let isTop = normY > 0;
				let indexStart = isTop? topCenterVertexIndexStart: bottomCenterVertexIndexStart;
				let offset = ((i - indexStart) + 0.5) / sideSegmentCount;
				uv.setX(i, offset);
				uv.setY(i, isTop? 1: 0);
			} else {
				let goodUV = cylinderSideUVs.get(makePosKey(i));
				if(goodUV){
					uv.setX(i, goodUV.x);
					uv.setY(i, goodUV.y);
				} else {
					// щито поделать десу
					console.warn(`Found NO good UV for position ${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`);
				}
			}
		}
	}

	uv.needsUpdate = true;
}

/* изменить геометрию стенок цилиндра с помощью функции от её высоты
используются те же хаки, что и в функции про растягивание крышек
warper: на входе от 0 до 1, где 1 - самая высокая точка, 0 - самая низкая; на выходе - сдвиг наружу, 0 = нет сдвига, 1 = сдвиг равен радиусу итд */
export function warpCylinderWalls(geom: THREE.BufferGeometry, warper: (y: number) => number): void {
	let pos = geom.attributes.position;
	let uv = geom.attributes.uv;
	let norm = geom.attributes.normal;

	for(let i = 0; i < uv.count; i++){
		let normY = norm.getY(i)
		if(normY > 0.0001 || normY < -0.0001){
			continue; // скипаем крышки
		}

		let warpMult = warper(uv.getY(i));

		let x = pos.getX(i);
		x += x * warpMult
		pos.setX(i, x);

		let z = pos.getZ(i)
		z += z * warpMult;
		pos.setZ(i, z);
	}

	pos.needsUpdate = true;
}

// варпер-функция для warpCylinderWalls. делает из цилиндра бочку.
export function makeBarrelWarper(factor: number): (y: number) => number {
	return y => {
		// делаем из линейного изменения y параболу
		let dist = (Math.max(1 - y, y) - 0.5) * 2;
		return (1 - (dist * dist)) * factor;
	}
}