import JSZip from 'jszip';

const outputPath = process.argv[2];
if (!outputPath) {
	throw new Error('Usage: bun scripts/create-reader-interop-epub.ts <output.epub>');
}

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file(
	'META-INF/container.xml',
	`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles>
		<rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml"/>
	</rootfiles>
</container>`
);
zip.file(
	'OPS/content.opf',
	`<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf">
	<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
		<dc:identifier id="book-id">sake-reader-interop</dc:identifier>
		<dc:title>Sake Reader Interoperability Fixture</dc:title>
		<dc:language>en</dc:language>
	</metadata>
	<manifest>
		<item id="one" href="one.xhtml" media-type="application/xhtml+xml"/>
		<item id="two" href="two.xhtml" media-type="application/xhtml+xml"/>
	</manifest>
	<spine>
		<itemref idref="one"/>
		<itemref idref="two"/>
	</spine>
</package>`
);
zip.file(
	'OPS/one.xhtml',
	`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
	<head><title>One</title></head>
	<body><section><p>First paragraph.</p><p>Start nested <em>markup</em> end.</p><p>Repeat same same.</p></section></body>
</html>`
);
zip.file(
	'OPS/two.xhtml',
	`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
	<head><title>Two</title></head>
	<body><section><p>A😀BC second chapter.</p></section></body>
</html>`
);

const epub = await zip.generateAsync({
	type: 'uint8array',
	compression: 'DEFLATE',
	mimeType: 'application/epub+zip'
});
await Bun.write(outputPath, epub);
