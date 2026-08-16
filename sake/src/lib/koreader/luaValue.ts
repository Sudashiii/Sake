import type { Expression } from 'luaparse';

export type LuaKey = string | number;
export type LuaValue = string | number | boolean | null | LuaTable;

export interface LuaTableEntry {
	key: LuaKey;
	value: LuaValue;
}

export interface LuaTable {
	entries: LuaTableEntry[];
}

function decodeLuaString(raw: string): string {
	const quote = raw[0];
	if ((quote !== '"' && quote !== "'") || raw.at(-1) !== quote) {
		throw new Error('Unsupported Lua string literal');
	}

	let decoded = '';
	for (let index = 1; index < raw.length - 1; index += 1) {
		if (raw[index] !== '\\') {
			decoded += raw[index];
			continue;
		}

		index += 1;
		const escaped = raw[index];
		const simpleEscapes: Record<string, string> = {
			a: '\x07',
			b: '\b',
			f: '\f',
			n: '\n',
			r: '\r',
			t: '\t',
			v: '\v',
			'\\': '\\',
			'"': '"',
			"'": "'"
		};
		if (simpleEscapes[escaped] !== undefined) {
			decoded += simpleEscapes[escaped];
			continue;
		}

		if (/\d/.test(escaped)) {
			let decimal = escaped;
			while (decimal.length < 3 && /\d/.test(raw[index + 1] ?? '')) {
				index += 1;
				decimal += raw[index];
			}
			decoded += String.fromCharCode(Number.parseInt(decimal, 10));
			continue;
		}

		decoded += escaped;
	}
	return decoded;
}

export function evaluateLuaKey(expression: Expression): LuaKey {
	const value = evaluateLuaExpression(expression);
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw new Error('Lua table keys must be strings or numbers');
	}
	return value;
}

export function evaluateLuaExpression(expression: Expression): LuaValue {
	switch (expression.type) {
		case 'StringLiteral':
			return decodeLuaString(expression.raw);
		case 'NumericLiteral':
		case 'BooleanLiteral':
		case 'NilLiteral':
			return expression.value;
		case 'UnaryExpression':
			if (expression.operator === '-' && expression.argument.type === 'NumericLiteral') {
				return -expression.argument.value;
			}
			throw new Error(`Unsupported Lua unary expression: ${expression.operator}`);
		case 'TableConstructorExpression': {
			let nextArrayIndex = 1;
			const entries: LuaTableEntry[] = [];
			for (const field of expression.fields) {
				if (field.type === 'TableValue') {
					entries.push({ key: nextArrayIndex, value: evaluateLuaExpression(field.value) });
					nextArrayIndex += 1;
					continue;
				}
				const key =
					field.type === 'TableKeyString' ? field.key.name : evaluateLuaKey(field.key);
				entries.push({ key, value: evaluateLuaExpression(field.value) });
				if (typeof key === 'number' && Number.isInteger(key) && key >= nextArrayIndex) {
					nextArrayIndex = key + 1;
				}
			}
			return { entries };
		}
		default:
			throw new Error(`Unsupported executable Lua expression: ${expression.type}`);
	}
}

function escapeLuaString(value: string): string {
	return `"${value
		.replaceAll('\\', '\\\\')
		.replaceAll('"', '\\"')
		.replaceAll('\n', '\\n')
		.replaceAll('\r', '\\r')
		.replaceAll('\t', '\\t')}"`;
}

export function serializeLuaKey(key: LuaKey): string {
	return typeof key === 'number' ? `[${key}]` : `[${escapeLuaString(key)}]`;
}

export function serializeLuaValue(value: LuaValue, indentLevel = 0): string {
	if (value === null) return 'nil';
	if (typeof value === 'string') return escapeLuaString(value);
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Lua numbers must be finite');
		return String(value);
	}
	if (typeof value === 'boolean') return String(value);
	if (value.entries.length === 0) return '{}';

	const indent = '    '.repeat(indentLevel);
	const childIndent = '    '.repeat(indentLevel + 1);
	const fields = value.entries.map(
		(entry) =>
			`${childIndent}${serializeLuaKey(entry.key)} = ${serializeLuaValue(entry.value, indentLevel + 1)},`
	);
	return `{\n${fields.join('\n')}\n${indent}}`;
}

export function luaTable(entries: LuaTableEntry[] = []): LuaTable {
	return { entries };
}

export function luaTableGet(table: LuaTable, key: LuaKey): LuaValue | undefined {
	return table.entries.find((entry) => entry.key === key)?.value;
}

export function luaTableSet(table: LuaTable, key: LuaKey, value: LuaValue): LuaTable {
	const existingIndex = table.entries.findIndex((entry) => entry.key === key);
	if (existingIndex < 0) {
		return { entries: [...table.entries, { key, value }] };
	}
	const entries = table.entries.slice();
	entries[existingIndex] = { key, value };
	return { entries };
}

export function asLuaTable(value: LuaValue | undefined): LuaTable | null {
	return value !== undefined &&
		typeof value === 'object' &&
		value !== null &&
		'entries' in value
		? value
		: null;
}
