type Listener<T> = (args:T) => unknown | Promise<unknown>;

export interface Event<T = void>{
	(listener: Listener<T>): void;
	remove(listener: Listener<T>): void;
	fire(args: T): Promise<void>;
}

export function makeEvent<T = void>(): Event<T> {
	let listeners = [] as Listener<T>[];
	let result = ((listener: Listener<T>) => {
		listeners.push(listener);
	}) as Partial<Event<T>>;

	result.remove = listener => listeners = listeners.filter(x => x !== listener);
	result.fire = async args => {
		let oldListeners = [...listeners];
		await Promise.all(oldListeners.map(listener => Promise.resolve(listener(args))));
	}

	return result as Event<T>;
}