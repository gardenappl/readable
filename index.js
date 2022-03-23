#!/usr/bin/env node

/*

Firefox Reader Mode in your terminal! CLI tool for Mozilla's Readability library

	Copyright (C) 2022 gardenapple
                                                                                                    
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
                                                                                            	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
                                                                                            	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const fs = require("fs");
const path = require("path");
const process = require("process");

const yargs = require("yargs");
const y18n = require("y18n");

// GNU gettext gives preference to LANGUAGE above all else, but this order is consistent with Yargs:
const locale = (
	process.env.LC_ALL ||
	process.env.LC_MESSAGES ||
	process.env.LANG ||
	process.env.LANGUAGE ||
	"en_US"
).replace(/[.:].*/, '');

const __ = y18n({
	locale: locale,
	updateFiles: false,
	directory: path.resolve(__dirname, "./locales")
}).__;

const { Readability, isProbablyReaderable } = require("@mozilla/readability");

function printVersion() {
	console.log(`readability-cli v${require("./package.json").version}`);
	console.log(`Node.js ${process.version}`);
}

async function parseDOMFromURL(url, proxy, strictSSL, userAgent) {
	const { JSDOM, ResourceLoader } = require("jsdom");
	const resourceLoader = new ResourceLoader({
		proxy: proxy,
		strictSSL: strictSSL,
		userAgent: userAgent
	});

	const dom = await JSDOM.fromURL(url, {
		resources: resourceLoader
	});
	return [dom.window.document, dom.window];
}

function parseDOM(html, url) {
	const { JSDOM } = require("jsdom");
	const dom = new JSDOM(html, { url: url });
	return [dom.window.document, dom.window];
}

async function parseDOMFromFile(file, url) {
	const { JSDOM } = require("jsdom");
	const dom = await JSDOM.fromFile(file, {
		url: url,
		// workaround for https://gitlab.com/gardenappl/readability-cli/-/issues/9
		contentType: "text/html; charset=utf-8"
	});
	return [dom.window.document, dom.window];
}

function sanitizeHTML(html, window) {
	const createDOMPurify = require("dompurify");
	const DOMPurify = createDOMPurify(window);
	return DOMPurify.sanitize(html);
}

function sanitizeDOM(document, window) {
	const createDOMPurify = require("dompurify");
	const DOMPurify = createDOMPurify(window);
	DOMPurify.sanitize(document, {IN_PLACE: true, WHOLE_DOCUMENT: true});
	return document.documentElement.outerHTML;
}



import("./common.mjs").then((module) => {
	const readable = module.default;
	readable(
		Buffer,
		fs,
		process,
		yargs, 
		__,
		Readability,
		isProbablyReaderable,
		printVersion,
		parseDOM,
		parseDOMFromFile,
		parseDOMFromURL,
		sanitizeDOM,
		sanitizeHTML
	);
});
