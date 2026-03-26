export function createLazySingleton<T extends object>(factory: () => T): T {
	let instance: T | null = null;

	function getInstance(): T {
		if (instance === null) {
			instance = factory();
		}

		return instance;
	}

	return new Proxy(Object.create(null) as T, {
		get(_target, property) {
			const resolved = getInstance();
			const value = Reflect.get(resolved as object, property, resolved);
			return typeof value === 'function' ? value.bind(resolved) : value;
		},
		set(_target, property, value) {
			const resolved = getInstance();
			return Reflect.set(resolved as object, property, value, resolved);
		},
		has(_target, property) {
			return Reflect.has(getInstance() as object, property);
		},
		ownKeys() {
			return Reflect.ownKeys(getInstance() as object);
		},
		getOwnPropertyDescriptor(_target, property) {
			return Reflect.getOwnPropertyDescriptor(getInstance() as object, property);
		},
		defineProperty(_target, property, attributes) {
			return Reflect.defineProperty(getInstance() as object, property, attributes);
		},
		deleteProperty(_target, property) {
			return Reflect.deleteProperty(getInstance() as object, property);
		},
		getPrototypeOf() {
			return Reflect.getPrototypeOf(getInstance() as object);
		},
		isExtensible() {
			return Reflect.isExtensible(getInstance() as object);
		},
		preventExtensions() {
			return Reflect.preventExtensions(getInstance() as object);
		}
	});
}
