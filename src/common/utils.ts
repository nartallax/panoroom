export function logError(err: unknown): void;
export function logError(pretext: string, err: unknown): void;
export function logError(a: string | unknown, b?: unknown): void {
	outputError("error", a, b);
}

export function logWarn(err: unknown): void;
export function logWarn(pretext: string, err: unknown): void;
export function logWarn(a: string | unknown, b?: unknown): void {
	outputError("warn", a, b);
}

function outputError(type: "error" | "warn", a: string | unknown, b?: unknown){
	let err = typeof(a) === "string"? b as unknown: a;
	let pretext = typeof(a) === "string"? a: "";

	let errText: string;
	if(err instanceof Error){
		errText = (err.stack || err.message || err) + "";
	} else {
		errText = err + "";
	}

	console[type](pretext + errText)
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

export interface FsTreeNode {
	name: string;
	children?: FsTreeNode[];
	dimensions?: {width: number, height: number};
}

export function randomNumberString(): string {
	return Math.floor(Math.random() * 0xffffffff) + "";
}

export function randomUniqId(idObject: Record<string, unknown>): string {
	let id: string;
	do {
		id = randomNumberString();
	} while(id in idObject);
	return id;
}

// works only with plain old serializable data. no classes, no fancy shit like symbols etc
export function deepEquals(a: unknown, b: unknown): boolean {
	if(a === b){
		return true;
	}

	if(typeof(a) !== typeof(b)){
		return false;
	}

	if(typeof(a) === "object" && typeof(b) === "object" && a && b){
		if(Array.isArray(a) || Array.isArray(b)){
			if(!Array.isArray(a) || !Array.isArray(b)){
				return false;
			}
			if(a.length !== b.length){
				return false;
			}
			for(let i = 0; i < a.length; i++){
				if(!deepEquals(a[i], b[i])){
					return false;
				}
			}
		} else {
			for(let k in a){
				if(!(k in b) || !deepEquals(a[k as keyof typeof a], b[k as keyof typeof b])){
					return false;
				}
			}
			for(let k in b){
				if(!(k in a)){
					return false;
				}
			}
		}
	}

	return true;
}