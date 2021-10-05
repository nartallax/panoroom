export type Subscriber<T> = (value: T) => void;
export type Unsubscribe = () => void;

// TODO: тесты!
// воскресить старый тест
// тест на поведение в комментарии к lastKnownValue
// тест на объекты (см. boundableContentCanBeDifferent)
// тест на то, что computable подписывается только на те boundable, из которых сам состоит (но не на boundable, из которых состоят эти boundable); т.е. подписывается не рекурсивно

export interface Boundable<T>{
	(): T;
	subscribe(subscriber: Subscriber<T>): Unsubscribe;
	notify(): void;
}

export type MbBoundable<T> = T | Boundable<T>;

export interface BoundValue<T> extends Boundable<T> {
	(newValue?: T): T;
	isBoundValue: true;
}

export interface BoundComputable<T> extends Boundable<T> {
	isBoundComputable: true;
}

export function isBoundable<T>(x: MbBoundable<T>): x is Boundable<T> {
	return typeof(x) === "function" && (!!(x as BoundValue<T>).isBoundValue || !!(x as BoundComputable<T>).isBoundComputable)
}

export function isBoundValue<T>(x: unknown): x is BoundValue<T> {
	return typeof(x) === "function" && !!(x as BoundValue<T>).isBoundValue;
}

export function unwrapBoundable<T>(x: Boundable<T> | T): T { 
	return isBoundable(x)? x(): x;
}

type BoundableSubscriber = (boundable: Boundable<unknown>) => void;
interface SubscriberInternal<T>{
	fn: Subscriber<T>;
	/* Последнее значение, которое было передано subscriber-у.

	Нужно для того, чтобы избежать двойных вызовов подписчиков.
	Например, если у нас есть значение, и у него есть два подписчика, первый из которых может изменить значение.
	При изменении значения извне (цикл А) сначала вызывается первый подписчик, изменяет значение
	Что приводит к вызову подписчиков по новой (цикл Б), снова вызывается первый подписчик, но на этот раз он выбирает не изменять значение
	Затем вызывается второй подписчик (цикл Б), получает последнее значение.
	Затем цикл Б завершается, и продолжается цикл А, и мы снова пробуем вызвать второго подписчика
	Причем мы хотим его вызвать с последним значением, а не с предпоследним, 
	и поэтому мы не храним то значение, с которым начали цикл (см. имплементацию notify())
	Но теперь нам не нужно вызывать второго подписчика еще раз, т.к. мы ему уже передали это последнее значение.
	Поэтому мы и храним последнее переданное в подписчик значение.

	(пример выше сильно упрощен; в реальном коде это может выглядеть сильно запутаннее, но сводится к той же проблеме)
	*/
	lastKnownValue: T;
}

interface SubscribeNotify<T>{
	subscribers: Set<SubscriberInternal<T>>;
	subscribe(listener: Subscriber<T>): Unsubscribe;
	notify(): void;
}

function createSubscribeNotify<T>(getValue: () => T): SubscribeNotify<T> {
	let subscribers = new Set<SubscriberInternal<T>>();
	
	return {
		subscribe: (listener: Subscriber<T>) => {
			let v = getValue()
			let sub: SubscriberInternal<T> = { fn: listener, lastKnownValue: v };
			subscribers.add(sub);
			return () => subscribers.delete(sub);
		},
		notify: () => {
			// копируем множество подписчиков, чтобы подписки в момент исполнения подписчиков нам не мешали
			// (такое точно случится, например, при вычислении значений computable, которые тоже происходят как часть реакции на изменение значения)
			let subs = [...subscribers];

			for(let i = 0; i < subs.length; i++){
				let sub = subs[i];
				let v = getValue();
				// см. коммент к объявлению lastKnownValue
				let hasDiff = boundableContentCanBeDifferent(v, sub.lastKnownValue)
				sub.lastKnownValue = v;
				if(hasDiff){
					sub.fn(v);
				}
			}
		},
		subscribers: subscribers
	}
}

const notificationStack: BoundableSubscriber[] = [];
function withAccessNotifications<T>(action: () => T, onAccess: (boundable: Boundable<unknown>) => void): T {
	notificationStack.push(onAccess);
	let result: T;
	try {
		result = action();
	} finally {
		notificationStack.pop();
	}
	return result;
}

function notifyOnAccess(v: Boundable<unknown>): void {
	if(notificationStack.length > 0){
		notificationStack[notificationStack.length - 1](v);
	}
}

export function boundableContentCanBeDifferent<T>(oldValue: T, newValue: T): boolean {
	// мы обрабатываем не-null объекты отдельно, т.к. это композитный тип
	// и несмотря на то, что ссылка не поменялась (прямое сравнение покажет равенство), 
	// фактически объект мог измениться
	return newValue !== oldValue || (typeof(oldValue) === "object" && oldValue !== null)
}

export function boundValue<T>(x: T): BoundValue<T>{	
	let value: T = x;
	
	let getterSetter = function(newValue?: T): T {
		if(arguments.length < 1){
			notifyOnAccess(result);
		} else if(boundableContentCanBeDifferent(value, newValue)){
			value = newValue as T;
			result.notify();
		}

		return value;
	}
	
	let {subscribe, notify} = createSubscribeNotify(() => value);
	let result: BoundValue<T> = Object.assign(getterSetter, {
		isBoundValue: true as const,
		subscribe: subscribe,
		notify: notify
	})

	return result;
}

/*
	С computable есть небольшая проблема.
	Срок жизни computable по определению меньше срока жизни значений, от которых он зависит 
	(т.е. computable не дает удалить значения, т.к. они попали в замыкание его computingFn)
	Но когда все ссылки "извне" на computable отмирают, ему нужно как-то тоже уйти из памяти
	Что невозможно, если он подписался на какое-либо значение, ведь подписка держит на него ссылку
	(это, кстати, типичная проблема lapsed listeners)
	
	Чтобы это обойти, мы:
	1. не храним значение, когда на нас никто не подписан (и список подписок тоже не храним)
	2. когда на нас кто-то подписывается - считаем список зависимых значений, сохраняем
	3. когда отписывается последний подписчик - снимаем все подписки, удаляем значение
	Это уменьшает ценность computable в качестве кеша, на который никто не подписывается,
	однако позволяет не думать о ручном его dispose в нужный момент
*/

export function computable<T>(computingFn: () => T): BoundComputable<T>{
	let hasComputedValue = false;
	let value: T | null = null;
	
	let subDisposers: Unsubscribe[] = [];
	let subDispose = () => {
		subDisposers.forEach(x => x());
		subDisposers.length = 0;
	}
	
	let forceRecalculate = () => {
		hasComputedValue = false;
		if(subscribers.size !== 0){
			computeAndSubscribe();
		}
	}
	
	let computeAndSubscribe = () => {
		subDispose();
		
		let valuesAccessed = new Set<Boundable<unknown>>();
		let newValue = withAccessNotifications(computingFn, boundValue => valuesAccessed.add(boundValue));
		
		valuesAccessed.forEach(v => subDisposers.push(v.subscribe(forceRecalculate)));
		
		let hasDiff = !hasComputedValue || boundableContentCanBeDifferent(value, newValue)
		hasComputedValue = true;
		value = newValue;
		if(hasDiff){
			computable.notify();
		}
		
		return value;
	}
	
	let maybeUnsubscribeFromValues = () => {
		if(subscribers.size === 0){
			hasComputedValue = false;
			value = null;
			subDispose();
		}
	}
	
	let computableFn = (): T => {
		notifyOnAccess(computable);
		if(subscribers.size === 0){
			return computingFn();
		}
		if(!hasComputedValue){
			return computeAndSubscribe();
		}
		return value as T;
	}

	let {subscribe, notify, subscribers} = createSubscribeNotify(computableFn);
	let wrappedSubscribe = (listener: Subscriber<T>) => {
		// считаем список зависимостей
		// ведь, если на нас подписались, то ожидается, что мы оповещаем обо всех изменениях тех value, которые используем
		if(!hasComputedValue){
			computeAndSubscribe();
		}
		let disposer = subscribe(listener);
		return () => {
			disposer();
			maybeUnsubscribeFromValues();
		};
	}

	let computable: BoundComputable<T> = Object.assign(computableFn, {
		isBoundComputable: true as const,
		subscribe: wrappedSubscribe,
		notify: notify
	})
	
	return computable;
}