export function logError(err: unknown): void;
export function logError(pretext: string, err: unknown): void;
export function logError(a: string | unknown, b?: unknown): void {
	let err = typeof(a) === "string"? b as unknown: a;
	let pretext = typeof(a) === "string"? a: "";

	let errText: string;
	if(err instanceof Error){
		errText = (err.stack || err.message || err) + "";
	} else {
		errText = err + "";
	}

	console.error(pretext + errText)
}

export function isPathInsidePath(innerPath: string, outerPath: string): boolean {
	let startsWith = innerPath.indexOf(outerPath) === 0;
	if(!startsWith){
		return false;
	}

	let nextChar = innerPath.length === outerPath.length? '': innerPath.charAt(outerPath.length);
	let hasPathTerminator = nextChar === '/' || nextChar === '\\' || nextChar === '';
	return hasPathTerminator;
}