import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createLazySingleton } from '$lib/server/utils/createLazySingleton';

describe('createLazySingleton', () => {
	test('defers initialization and keeps method references stable', () => {
		let factoryCalls = 0;

		class ExampleService {
			value = 7;

			getValue() {
				return this.value;
			}
		}

		const singleton = createLazySingleton(() => {
			factoryCalls += 1;
			return new ExampleService();
		});

		assert.equal(factoryCalls, 0);

		const firstMethod = singleton.getValue;
		assert.equal(factoryCalls, 1);

		const secondMethod = singleton.getValue;
		assert.equal(firstMethod, secondMethod);
		assert.equal(firstMethod(), 7);
		assert.equal(factoryCalls, 1);
	});

	test('keeps reflection operations safe on the inert proxy target', () => {
		let factoryCalls = 0;

		const singleton = createLazySingleton(() => {
			factoryCalls += 1;
			return Object.defineProperty({} as { fixed?: number }, 'fixed', {
				value: 3,
				enumerable: true,
				configurable: false
			});
		});

		assert.deepEqual(Object.keys(singleton), []);
		assert.equal(Object.getOwnPropertyDescriptor(singleton, 'fixed'), undefined);
		assert.equal(factoryCalls, 0);

		Object.preventExtensions(singleton);
		assert.equal(factoryCalls, 0);
		assert.equal(singleton.fixed, 3);
		assert.equal(factoryCalls, 1);
	});
});
