let observer: MutationObserver | null = null;

type HandlersMap = WeakMap<Node, (() => void)[]>;

let removableNodes = new WeakMap<Node, (() => void)[]>();
let insertableNodes = new WeakMap<Node, (() => void)[]>();

function collectHandleableNodesRecursive(node: Node, map: HandlersMap, destination: Set<Node>): void {
	if(map.has(node)){
		destination.add(node);
	}
	node.childNodes.forEach(child => collectHandleableNodesRecursive(child, map, destination));
}

function dropOrInvokeHandleableNodesRecursive(node: Node, map: HandlersMap, oppositeNodes: Set<Node>): void {
	let handlers = map.get(node);
	if(handlers){
		if(oppositeNodes.has(node)){
			oppositeNodes.delete(node);
		} else {
			map.delete(node)
			for(let i = 0; i < handlers.length; i++){
				handlers[i]();
			}
		}
	}
	node.childNodes.forEach(child => dropOrInvokeHandleableNodesRecursive(child, map, oppositeNodes));
}

/*
Такие сложности с поэтапной обработкой - чтобы обрабатывать ситуацию, когда вставка и удаление произошли синхронно
В таком случае в records придут записи и на вставку, и на удаление
Я считаю, что тогда не нужно вызывать ни то, ни другое, т.к. это может привести к неконсистентности
(подписывающийся код может, наверное, в каких-то случаях иметь неправильное представление о своем стейте)
*/
function doWithRecords(records: MutationRecord[]): void {
	let addedNodes = new Set<Node>();
	for(let i = 0; i < records.length; i++){
		let record = records[i];
		for(let j = 0; j < record.addedNodes.length; j++){
			collectHandleableNodesRecursive(record.addedNodes[j], insertableNodes, addedNodes);
		}
	}

	for(let i = 0; i < records.length; i++){
		let record = records[i];
		for(let j = 0; j < record.removedNodes.length; j++){
			dropOrInvokeHandleableNodesRecursive(record.removedNodes[j], removableNodes, addedNodes);
		}
	}

	addedNodes.forEach(node => {
		let handlers = insertableNodes.get(node);
		if(handlers){
			insertableNodes.delete(node);
			for(let i = 0; i < handlers.length; i++){
				handlers[i]();
			}
		}
	})
}

function init(): void {
	if(observer){
		return;
	}
	observer = new MutationObserver(doWithRecords);
	observer.observe(document.body, {childList: true, subtree: true});
}

function addHandlerToMap(map: WeakMap<Node, (() => void)[]>, node: Node, handler: () => void): () => void {
	{
		let arr = map.get(node);
		if(arr){
			arr.push(handler)
		} else {
			map.set(node, [handler]);
		}
	}

	return () => {
		let arr = map.get(node);
		if(!arr){
			return;
		}
		arr = arr.filter(x => x !== handler);
		if(arr.length > 0){
			map.set(node, arr);
		} else {
			map.delete(node);
		}
	}
}

/** Один раз подергать за handler, когда node удаляется из DOM-дерева */
export function watchNodeRemoved(node: Node, handler: () => void): () => void {
	init();
	return addHandlerToMap(removableNodes, node, handler);
}

/** Один раз подергать за handler, когда node добавляется в DOM-дерево */
export function watchNodeInserted(node: Node, handler: () => void): () => void {
	init();
	return addHandlerToMap(insertableNodes, node, handler);
}