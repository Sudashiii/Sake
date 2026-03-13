/**
 * Result type for type-safe error handling.
 * Use this instead of throwing exceptions for expected failure states.
 */

export type Result<T, E = Error> = Ok<T> | Err<E>;

export interface Ok<T> {
	readonly ok: true;
	readonly value: T;
}

export interface Err<E> {
	readonly ok: false;
	readonly error: E;
}

/**
 * Creates a successful Result containing the given value.
 */
export function ok<T>(value: T): Ok<T> {
	return { ok: true, value };
}

/**
 * Creates a failed Result containing the given error.
 */
export function err<E>(error: E): Err<E> {
	return { ok: false, error };
}

/**
 * Unwraps a Result, returning the value if Ok, or throwing the error if Err.
 * Use sparingly - prefer pattern matching with if/else.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
	if (result.ok) {
		return result.value;
	}
	throw result.error;
}

/**
 * Unwraps a Result, returning the value if Ok, or a default value if Err.
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
	if (result.ok) {
		return result.value;
	}
	return defaultValue;
}

/**
 * Maps a Result<T, E> to Result<U, E> by applying a function to the Ok value.
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	if (result.ok) {
		return ok(fn(result.value));
	}
	return result;
}

/**
 * Maps a Result<T, E> to Result<T, F> by applying a function to the Err value.
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
	if (!result.ok) {
		return err(fn(result.error));
	}
	return result;
}

/**
 * Chains Result operations. If the Result is Ok, applies the function.
 * The function itself returns a Result, enabling chained operations.
 */
export function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
	if (result.ok) {
		return fn(result.value);
	}
	return result;
}
