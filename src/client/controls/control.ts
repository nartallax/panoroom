import {Boundable, boundableContentCanBeDifferent, isBoundable, MbBoundable, Subscriber, Unsubscribe} from "boundable/boundable";
import {isInDOM} from "utils/dom_utils";
import {watchNodeInserted, watchNodeRemoved} from "utils/watch_node_inserted_removed";

export type ControlWatchFn = <T>(boundable: MbBoundable<T>, changeHandler: Subscriber<T>) => void;

export interface Control {
	element: HTMLElement;
}

export function isControl(x: unknown): x is Control {
	return !!x && typeof(x) === "object" && (x as Control).element instanceof HTMLElement
}

interface ControlBoundableHandler<T = unknown> {
	lastKnownValue: T;
	handler: Subscriber<T>;
	boundable: Boundable<T>;
	clear: Unsubscribe | null;
}

export function makeNodeBoundWatcher(node: HTMLElement): ControlWatchFn {
	let handlers: ControlBoundableHandler[] = [];
	
	function onNodeInserted(): void {
		watchNodeRemoved(node, onNodeRemoved);
		for(let i = 0; i < handlers.length; i++){
			let handler = handlers[i];
			handler.clear = handler.boundable.subscribe(handler.handler);
			let currentValue = handler.boundable();
			if(boundableContentCanBeDifferent(handler.lastKnownValue, currentValue)){
				handler.lastKnownValue = currentValue;
				handler.handler(currentValue);
			}
		}
		node.style.display = "";
	}

	function onNodeRemoved(): void {
		watchNodeInserted(node, onNodeInserted);
		// мы ставим display=none при удалении её из DOM, и возвращаем после вставки
		// делаем мы это для того, чтобы предотвратить фрейм(ы) "старого" контента
		// т.е. контента до того, как все хендлеры будут вызваны и пропишут какие-то новые свойства элементу
		node.style.display = "none";
		for(let i = 0; i < handlers.length; i++){
			let handler = handlers[i];
			if(handler.clear){
				handler.clear();
				handler.clear = null;
			}
			handler.lastKnownValue = handler.boundable();
		}
	}

	if(isInDOM(node)){
		onNodeInserted();
	} else {
		onNodeRemoved();
	}

	return (boundable, handler) => {
		if(!isBoundable(boundable)){
			handler(boundable);
			return;
		}
		let value = boundable();
		let obj: ControlBoundableHandler<unknown> = {
			boundable,
			handler: handler as Subscriber<unknown>, 
			lastKnownValue: value,
			clear: null
		};
		handlers.push(obj);
		handler(value);
	}
}