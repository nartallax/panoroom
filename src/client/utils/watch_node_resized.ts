/** функция, позволяющая подписаться на изменение размера произвольного элемента
 * возвращает функцию отписки. вызывать её необязательно.
 * может вызвать проблемы, связанные с css-свойством position у элемента
 * all credit goes to https://github.com/marcj/css-element-queries/blob/master/src/ResizeSensor.js
 * если вызвано в момент, когда el не в DOM или спрятан через display, работать не будет
 */
export function watchNodeResized(el: HTMLElement, handler: () => unknown): () => void {
	// RAF здесь используется для предотвращения спама событиями
	// с его помощью мы удостовериваемся, что происходит не более одного события за кадр
	let requestAnimationFrame = window.requestAnimationFrame || ((cb: () => unknown) => window.setTimeout(cb, ~~(1000 / 60)));

	let style = "position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; z-index: -1; visibility: hidden;";
	let styleChild = "position: absolute; left: 0; top: 0; transition: 0s;";

	let wrap = document.createElement("div");
	wrap.classList.add("resize-sensor"); // просто чтобы в просмотре DOM-дерева было понятнее, что это вообще такое
	wrap.style.cssText = style;

	let expandWrap = document.createElement("div");
	expandWrap.style.cssText = style;
	let expandChild = document.createElement("div");
	expandChild.style.cssText = styleChild;
	expandWrap.appendChild(expandChild);
	wrap.appendChild(expandWrap);

	let shrinkWrap = document.createElement("div");
	shrinkWrap.style.cssText = style;
	let shrinkChild = document.createElement("div");
	shrinkChild.style.cssText = styleChild + "width: 200%; height: 200%;";
	shrinkWrap.appendChild(shrinkChild);
	wrap.appendChild(shrinkWrap);

	el.appendChild(wrap);

	// вероятно, это какой-то хитрый хак, которого я не понял. может вызвать проблемы. 
	if(wrap.offsetParent !== el){
		el.style.position = "relative";
	}

	let dirty: boolean, rafId: number, newWidth: number, newHeight: number;
	let lastWidth = el.offsetWidth;
	let lastHeight = el.offsetHeight;

	let reset = () => {
		expandChild.style.width = "100000px";
		expandChild.style.height = "100000px";

		expandWrap.scrollLeft = 100000;
		expandWrap.scrollTop = 100000;

		shrinkWrap.scrollLeft = 100000;
		shrinkWrap.scrollTop = 100000;
	};

	reset();

	let onScroll = () => {
		newWidth = el.offsetWidth;
		newHeight = el.offsetHeight;
		dirty = newWidth != lastWidth || newHeight != lastHeight;

		if(dirty && !rafId){
			rafId = requestAnimationFrame(() => {
				rafId = 0;

				if(!dirty) return;

				lastWidth = newWidth;
				lastHeight = newHeight;

				handler();
			});
		}

		reset();
	};

	expandWrap.addEventListener("scroll", onScroll, {passive: true});
	shrinkWrap.addEventListener("scroll", onScroll, {passive: true});

	return () => {
		wrap.remove();
		expandWrap.removeEventListener("scroll", onScroll);
		shrinkWrap.removeEventListener("scroll", onScroll);
	};
}