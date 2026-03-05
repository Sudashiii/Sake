import fs from 'node:fs';
import path from 'node:path';

const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');

if (!fs.existsSync(journalPath)) {
	console.error(`[journal:normalize] Missing file: ${journalPath}`);
	process.exit(1);
}

const raw = fs.readFileSync(journalPath, 'utf8');
const journal = JSON.parse(raw);

if (!Array.isArray(journal.entries)) {
	console.error('[journal:normalize] Invalid journal: entries must be an array');
	process.exit(1);
}

let changed = false;
let previousWhen = Number.NEGATIVE_INFINITY;

for (let index = 0; index < journal.entries.length; index += 1) {
	const entry = journal.entries[index];
	if (typeof entry?.when !== 'number' || !Number.isFinite(entry.when)) {
		console.error(`[journal:normalize] Invalid "when" at entry index ${index}`);
		process.exit(1);
	}

	if (entry.when <= previousWhen) {
		const nextWhen = previousWhen + 1000;
		console.log(
			`[journal:normalize] bump ${entry.tag}: ${entry.when} -> ${nextWhen}`
		);
		entry.when = nextWhen;
		changed = true;
	}

	previousWhen = entry.when;
}

if (changed) {
	fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, 'utf8');
	console.log('[journal:normalize] Updated drizzle/meta/_journal.json');
} else {
	console.log('[journal:normalize] No changes needed');
}
