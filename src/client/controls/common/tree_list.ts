import {Boundable, boundValue, BoundValue, isBoundValue} from "boundable/boundable";
import {Control, makeNodeBoundWatcher} from "controls/control";
import {tag} from "utils/dom_utils";

export interface TreeListNode<T extends string = string> {
	label: string;
	value?: T;
	items?: this[];
}

interface RenderedTreeElement {
	element: HTMLElement;
	toggleExpanded(): void;
	expanded: boolean;
}

interface TreeListNodeInternal<T extends string> extends TreeListNode<T>{
	element?: RenderedTreeElement;
	parent?: this;
	depth?: number;
}

export interface TreeListOptions<T extends string = string> {
	value: T | null | BoundValue<T | null>
	items: TreeListNode<T>[] | Boundable<TreeListNode<T>[]>;
}

export function treeList<T extends string = string>(options: TreeListOptions<T>): Control {
	let treeListRoot = tag({class: "tree-list"});
	let itemsByValue = new Map<T, TreeListNodeInternal<T>>();
	let value = isBoundValue(options.value)? options.value: boundValue(options.value);

	function renderItem(item: TreeListNodeInternal<T>): RenderedTreeElement {
		let el: HTMLElement = tag({ 
			class: [
				"tree-list-item",
				item.items? "has-children collapsed": null,
			],
			text: item.label,
			style: `margin-left: ${item.depth}em`,
			"data-depth": item.depth
		});

		function tryToggleExpanded(): void {
			if(item.items){
				el.classList.toggle("collapsed");
				el.classList.toggle("expanded");
				if(result.expanded){
					while(true){
						let next = el.nextElementSibling;
						if(!next){
							break;
						}
						let depth = parseInt(next.getAttribute("data-depth") || "0");
						if(depth <= (item.depth || 0)){
							break;
						}
						next.remove();
					}
				} else {
					let lastAddedElem = el;
					let addAll = (items: TreeListNodeInternal<T>[]): void => {
						items.forEach(item => {
							let el = item.element = (item.element || renderItem(item));
							lastAddedElem.after(el.element);
							lastAddedElem = el.element;
							if(item.items && el.expanded){
								addAll(item.items);
							}
						});
					}

					addAll(item.items)
				}
				result.expanded = !result.expanded;
			}
		}

		el.addEventListener("click", () => {
			tryToggleExpanded();
			if(item.value !== undefined){
				value(value() === item.value? null: item.value);
			}
		}, {passive: true})

		let result: RenderedTreeElement = {
			expanded: false,
			element: el,
			toggleExpanded: tryToggleExpanded
		}

		return result;
	}

	function setItems(newItems: TreeListNode<T>[]): void {
		value(null);
		treeListRoot.innerHTML = "";
		itemsByValue = new Map<T, TreeListNodeInternal<T>>();
		
		let visit = (newItems: TreeListNodeInternal<T>[], parent?: TreeListNodeInternal<T>, depth = 0): void => {
			newItems.forEach(item => {
				item.parent = parent;
				item.depth = depth;
				if(item.value){
					itemsByValue.set(item.value, item);
				}
				if(item.items){
					visit(item.items, item, depth + 1);
				}
			})
		}

		visit(newItems);

		newItems.forEach((item: TreeListNodeInternal<T>) => {
			let el = item.element = (item.element || renderItem(item));
			treeListRoot.appendChild(el.element);
		})
	}

	function chainExpand(item: TreeListNodeInternal<T>): void {
		if(item.parent){
			chainExpand(item.parent);
		}

		if(!item.items || !item.element || item.element.expanded){
			return;
		}

		item.element.toggleExpanded();
	}

	function toggleSelectionOn(value: T | null): void {
		if(value !== null){
			let item = itemsByValue.get(value)
			if(!item){
				return;
			}

			chainExpand(item);
			if(item.element){ // должен уже появиться к этому моменту
				item.element.element.classList.toggle("selected");
			}
		}
	}

	let watch = makeNodeBoundWatcher(treeListRoot);
	let oldValue = value();
	watch(value, newValue => {
		toggleSelectionOn(oldValue);
		toggleSelectionOn(newValue);
		oldValue = newValue;
	});

	watch(options.items, newItems => setItems(newItems));

	return { element: treeListRoot }

}
