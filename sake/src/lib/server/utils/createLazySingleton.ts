export function createLazySingleton<T extends object>(factory: () => T): T {
	let instance: T | null = null;
	const target = Object.create(null) as T;
	const boundMethods = new WeakMap<Function, Function>();

	function getInstance(): T {
		if (instance === null) {
			instance = factory();
		}

		return instance;
	}

	function getBoundMethod(method: Function, resolved: T): Function {
		const cached = boundMethods.get(method);
		if (cached) {
			return cached;
		}

		const bound = method.bind(resolved);
		boundMethods.set(method, bound);
		return bound;
	}

	// Only proxy direct property access/mutation. Reflecting target shape to the resolved
	// instance causes Proxy invariant issues for non-configurable properties/extensibility.
	return new Proxy(target, {
		get(_target, property) {
			const resolved = getInstance();
			const value = Reflect.get(resolved as object, property, resolved);
			return typeof value === 'function' ? getBoundMethod(value, resolved) : value;
		},
		set(_target, property, value) {
			const resolved = getInstance();
			return Reflect.set(resolved as object, property, value, resolved);
		},
		has(_target, property) {
			return Reflect.has(getInstance() as object, property);
		}
	});
}
