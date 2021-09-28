/** Set every property of b in a, if absent
 * Works recursively, that is, if a = {x:{}} and b = {x:{y:5}}, then a will have .x.y === 5
 */
export function deepSet(a: unknown, b: unknown): void {
	if(typeof(b) !== "object" || b === null || typeof(a) !== "object" || a === null){
		throw new Error("Cannot deep set from something that is not non-null object.");
	}

	(Object.keys(b) as ((keyof typeof b) & (keyof typeof a))[]).forEach(key => {
		if(!(key in a)){
			a[key] = b[key];
		} else if(typeof(a[key]) === "object" && !Array.isArray(a[key])){
			deepSet(a[key], b[key]);
		}
	});
}