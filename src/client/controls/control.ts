import {Boundable, boundableContentCanBeDifferent, isBoundable, MbBoundable, Subscriber, Unsubscribe} from "boundable/boundable";
import {isInDOM} from "utils/dom_utils";
import {watchNodeInserted, watchNodeRemoved} from "utils/watch_node_inserted_removed";

export type ControlWatchFn = <T>(boundable: MbBoundable<T>, changeHandler: Subscriber<T>) => (() => void);

export interface Control {
	element: HTMLElement;
}

export function isControl(x: unknown): x is Control {
	return !!x && typeof(x) === "object" && (x as Control).element instanceof HTMLElement
}

// значение, которое нужно, чтобы обозначать "это пустое значение"
// нужно в случаях, когда результат makeNodeBoundWatcher вызывается в момент, когда нода вне DOM-дерева
// т.е. при вставке в DOM нам нужно вызвать хендлер
// но мы не будем его вызывать, если значение не менялось с момента последнего вызова
// но при этом еще ни одного вызова не было - и это значение нужно, чтобы обозначать именно такое состояние
const emptyValue = {};

interface ControlBoundableHandler<T = unknown> {
	lastKnownValue: T | typeof emptyValue;
	handler: Subscriber<T>;
	boundable: Boundable<T>;
	clear: Unsubscribe | null;
}

export interface NodeBoundWatcherOptions {
	// имеет смысл передавать true, если display контрола меняется чем-то еще
	preventDisplayChange?: boolean;
}

export function makeNodeBoundWatcher(node: HTMLElement, opts: NodeBoundWatcherOptions = {}): ControlWatchFn {
	let handlers: ControlBoundableHandler[] = [];
	let inDomNow = isInDOM(node);
	
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
		if(!opts.preventDisplayChange){
			node.style.display = "";
		}
	}

	function onNodeRemoved(): void {
		watchNodeInserted(node, onNodeInserted);
		// мы ставим display=none при удалении её из DOM, и возвращаем после вставки
		// делаем мы это для того, чтобы предотвратить фрейм(ы) "старого" контента
		// т.е. контента до того, как все хендлеры будут вызваны и пропишут какие-то новые свойства элементу
		if(!opts.preventDisplayChange){
			node.style.display = "none";
		}
		for(let i = 0; i < handlers.length; i++){
			let handler = handlers[i];
			if(handler.clear){
				handler.clear();
				handler.clear = null;
			}
			handler.lastKnownValue = handler.boundable();
		}
	}

	if(inDomNow){
		onNodeInserted();
	} else {
		onNodeRemoved();
	}

	return (boundable, handler) => {
		if(!isBoundable(boundable)){
			handler(boundable);
			return () => {
				// nop
			}
		}

		let obj: ControlBoundableHandler = {
			boundable,
			handler: handler as Subscriber<unknown>, 
			lastKnownValue: !inDomNow? emptyValue: boundable(),
			clear: !inDomNow? null: boundable.subscribe(handler)
		}

		handlers.push(obj);
		
		if(inDomNow){
			handler(boundable())
		}

		return () => {
			handlers = handlers.filter(x => x !== obj);
			if(obj.clear){
				obj.clear();
				obj.clear = null;
			}
		}
	}
}