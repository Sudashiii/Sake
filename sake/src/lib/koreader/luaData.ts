import { parse, type Expression, type TableConstructorExpression } from 'luaparse';
import {
	evaluateLuaExpression,
	evaluateLuaKey,
	serializeLuaKey,
	serializeLuaValue,
	type LuaKey,
	type LuaTableEntry,
	type LuaValue
} from './luaValue';
export {
	asLuaTable,
	luaTable,
	luaTableGet,
	luaTableSet,
	serializeLuaValue,
	type LuaKey,
	type LuaTable,
	type LuaTableEntry,
	type LuaValue
} from './luaValue';

type Ranged<T> = T & { range?: [number, number] };
type RangedTable = Ranged<TableConstructorExpression>;

interface LocatedField {
	table: RangedTable;
	value: Ranged<Expression>;
}

function requireRange(node: Ranged<Expression> | RangedTable): [number, number] {
	if (!node.range) {
		throw new Error('Lua parser did not return source ranges');
	}
	return node.range;
}

function findField(table: RangedTable, key: LuaKey): LocatedField | null {
	let nextArrayIndex = 1;
	for (const field of table.fields) {
		let fieldKey: LuaKey;
		if (field.type === 'TableValue') {
			fieldKey = nextArrayIndex;
			nextArrayIndex += 1;
		} else if (field.type === 'TableKeyString') {
			fieldKey = field.key.name;
		} else {
			fieldKey = evaluateLuaKey(field.key);
		}

		if (fieldKey === key) {
			return { table, value: field.value };
		}
	}
	return null;
}

function parseRoot(source: string): RangedTable {
	const chunk = parse(source, {
		luaVersion: '5.1',
		comments: true,
		encodingMode: 'none',
		locations: false,
		ranges: true,
		scope: false
	});
	if (chunk.body.length !== 1 || chunk.body[0].type !== 'ReturnStatement') {
		throw new Error('KOReader sidecar must contain one return statement');
	}
	const returned = chunk.body[0].arguments;
	if (returned.length !== 1 || returned[0].type !== 'TableConstructorExpression') {
		throw new Error('KOReader sidecar must return one table');
	}
	evaluateLuaExpression(returned[0]);
	return returned[0] as RangedTable;
}

function getNestedTable(root: RangedTable, path: LuaKey[]): RangedTable | null {
	let table = root;
	for (const key of path) {
		const field = findField(table, key);
		if (!field || field.value.type !== 'TableConstructorExpression') {
			return null;
		}
		table = field.value as RangedTable;
	}
	return table;
}

export class LuaDataDocument {
	private constructor(
		readonly source: string,
		private readonly root: RangedTable
	) {}

	static parse(source: string): LuaDataDocument {
		return new LuaDataDocument(source, parseRoot(source));
	}

	static create(entries: LuaTableEntry[] = []): LuaDataDocument {
		return LuaDataDocument.parse(`return ${serializeLuaValue({ entries })}\n`);
	}

	get(path: LuaKey[]): LuaValue | undefined {
		if (path.length === 0) {
			return evaluateLuaExpression(this.root);
		}

		let table: RangedTable = this.root;
		for (let index = 0; index < path.length; index += 1) {
			const field = findField(table, path[index]);
			if (!field) {
				return undefined;
			}
			if (index === path.length - 1) {
				return evaluateLuaExpression(field.value);
			}
			if (field.value.type !== 'TableConstructorExpression') {
				return undefined;
			}
			table = field.value as RangedTable;
		}
		return undefined;
	}

	set(path: LuaKey[], value: LuaValue): LuaDataDocument {
		if (path.length === 0) {
			throw new Error('Cannot replace the sidecar root');
		}

		const parentPath = path.slice(0, -1);
		const parent = getNestedTable(this.root, parentPath);
		if (!parent) {
			const rootKey = parentPath[0];
			if (rootKey === undefined) {
				throw new Error('Unable to locate Lua table parent');
			}
			const tableValue = [...parentPath.slice(1), path.at(-1)!]
				.slice()
				.reverse()
				.reduce<LuaValue>((child, key) => ({ entries: [{ key, value: child }] }), value);
			return this.set([rootKey], tableValue);
		}

		const key = path.at(-1)!;
		const existing = findField(parent, key);
		let nextSource: string;
		if (existing) {
			const [start, end] = requireRange(existing.value);
			nextSource =
				this.source.slice(0, start) +
				serializeLuaValue(value, parentPath.length + 1) +
				this.source.slice(end);
		} else {
			const [tableStart, tableEnd] = requireRange(parent);
			const closeBraceIndex = tableEnd - 1;
			const indent = '    '.repeat(parentPath.length + 1);
			const parentIndent = '    '.repeat(parentPath.length);
			const field = `${indent}${serializeLuaKey(key)} = ${serializeLuaValue(
				value,
				parentPath.length + 1
			)},`;
			const tableContents = this.source.slice(tableStart + 1, closeBraceIndex);
			if (tableContents.trim().length === 0) {
				nextSource =
					this.source.slice(0, closeBraceIndex) +
					`\n${field}\n${parentIndent}` +
					this.source.slice(closeBraceIndex);
			} else {
				const closingLineStart = this.source.lastIndexOf('\n', closeBraceIndex - 1) + 1;
				const closingIndent = this.source.slice(closingLineStart, closeBraceIndex);
				const insertionIndex = closingIndent.trim().length === 0 ? closingLineStart : closeBraceIndex;
				const insertion = insertionIndex === closingLineStart ? `${field}\n` : `\n${field}`;
				nextSource =
					this.source.slice(0, insertionIndex) +
					insertion +
					this.source.slice(insertionIndex);
			}
		}

		return LuaDataDocument.parse(nextSource);
	}
}
