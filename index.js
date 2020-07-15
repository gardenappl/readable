#!/usr/bin/env node

/*
	Firefox Reader Mode in your terminal! - CLI tool for Mozilla's Readability library
        Copyright (C) 2020 gardenapple
                                                                                                    
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
const Readability = require("readability");
const JSDOM = require("jsdom").JSDOM;
const parseArgs = require("minimist");


const ExitCodes = {
	badUsageCLI: 64,
	dataError: 65,
	noInput: 66,
	noHost: 68,
	noPermission: 77
};

let errored = false;

function setErrored(exitCode) {
	process.exitCode = exitCode;
	errored = true;
}

function printUsage() {
	console.error(`
Usage:
	readable [SOURCE] [options]
	readable [options] -- [SOURCE]
	(where SOURCE is a file, an http(s) URL, or '-' for standard input)
	
Options:
	    --help                 Print help
	-o  --output OUTPUT_FILE   Output to OUTPUT_FILE
	-p  --properties PROPS...  Output specific properties of the parsed article
	-V  --version              Print version
	-u  --url                  Set the document URL when parsing standard input or a local file (this affects relative links and such)
	-U  --is-url               Interpret SOURCE as a URL rather than file name
	-q  --quiet                Don't output extra information to stderr

The --properties option accepts a comma-separated list of values (with no spaces in-between). Suitable values are:
	html-title     Outputs the article's title, wrapped in an <h1> tag.
	title          Outputs the title in the format "Title: $TITLE".
	excerpt        Article description, or short excerpt from the content, in the format "Excerpt: $EXCERPT"
	byline         Author metadata, in the format "Author: $AUTHOR"
	length         Length of the article in characters, in the format "Length: $LENGTH"
	dir            Content direction, is either "Direction: ltr" or "Direction: rtl"
	html-content   Outputs the article's main content as HTML.
	text-content   Outputs the article's main content as plain text.

Text-content and Html-content are mutually exclusive, and are always printed last.
Default value is "html-title,html-content".`); 
}



const stringArgParams = ['_', "--", "output", "properties", "url"];
const boolArgParams = ["quiet", "help", "version", "is-url"];
const alias = {
	"output": 'o',
	"properties": 'p',
	"version": 'V',
	"url": 'u',
	"is-url": 'U',
	"quiet": 'q'
}

let args = parseArgs(process.argv.slice(2), {
	string: stringArgParams,
	boolean: boolArgParams,
	default: {
		"properties": "html-title,html-content",
		"quiet": false
	},
	alias: alias,
	"--": true
});


//Minimist's parseArgs accepts a function for handling unknown parameters,
//but it works in a stupid way, so I'm writing my own.

for (var key of Object.keys(args)) {
	if (!stringArgParams.includes(key) && !boolArgParams.includes(key) &&
			!Object.values(alias).includes(key)) {
		console.error(`Unknown argument: ${key}`);
		setErrored(ExitCodes.badUsageCLI);

	} else if (stringArgParams.includes(key) && args[key] === "") {
		console.error(`Error: no value given for --${key}`);
		setErrored(ExitCodes.badUsageCLI);
	}

}
if (errored) {
	printUsage();
	return;
}

if (args.help) {
	printUsage();
	return;
} else if (args.version) {
	console.log(`readability-cli v${require("./package.json").version}`);
	console.log(`Node.js ${process.version}`);
	return;
}



let inputArg;
const inputCount = args['_'].length + args['--'].length;
if (inputCount > 1) {
	console.error("Too many input arguments");
	printUsage();
	setErrored(ExitCodes.badUsageCLI);
	return;
} else if (inputCount == 0) {
	if (process.stdin.isTTY) {
		console.error("No input provided");
		printUsage();
		setErrored(ExitCodes.badUsageCLI);
		return;
	} else {
		inputArg = '-'
	}
} else {
	inputArg = (args['_'].length > 0) ? args['_'][0] : args['--'][0];
}

//Get input parameter, remove inputArg from args
let inputFile;
let inputURL;
let inputIsFromStdin = false;

if (args["is-url"] || inputArg.startsWith("https://") || inputArg.startsWith("http://"))
	inputURL = inputArg;
else if (inputArg == '-')
	inputIsFromStdin = true;
else
	inputFile = inputArg;

delete args['_'];
delete args['--'];


const outputArg = args['output'];
const documentURL = args["url"] || inputURL;


const Properties = {
	htmlTitle: "html-title",
	title: "title",
	excerpt: "excerpt",
	byline: "byline",
	length: "length",
	dir: "dir",
	htmlContent: "html-content",
	textContent: "text-content"
}
let wantedProperties = [];

if (args.properties) {
	for (var property of args.properties.split(',')) {
		if (Object.values(Properties).includes(property)) {
			wantedProperties.push(property);
		} else {
			console.error(`Invalid property: ${property}`);
			setErrored(ExitCodes.badUsageCLI);
		}
	}
	if (errored) {
		printUsage();
		return;
	}
}

async function read(stream) {
	const chunks = [];
	for await (const chunk of stream){
		chunks.push(chunk); 
	}
	return Buffer.concat(chunks).toString('utf8');
}

if (inputIsFromStdin) {
	if (!args["quiet"]) {
		console.error("Reading...");
		if (!documentURL)
			console.error("Note: piping input with unknown " +
				"URL. This means that relative links will " +
				"be broken. Supply the --url parameter to fix.")
	}
	read(process.stdin).then(result => {
		onLoadDOM(new JSDOM(result, { url: documentURL }));
	});
} else {
	if (!args["quiet"])
		console.error("Retrieving...");
	let promiseGetHTML;
	if (inputURL) {
		promiseGetHTML = JSDOM.fromURL(inputURL).catch(error => {
			if (error instanceof TypeError) {
				console.error(`Invalid URL: ${inputURL}`);
				setErrored(ExitCodes.dataError);
			}

			return Promise.reject();
		});
	} else if (inputFile) {
		promiseGetHTML = JSDOM.fromFile(inputFile, {
			url: documentURL
		});
	}

	promiseGetHTML.then(onLoadDOM, onLoadDOMError)
}

//Taken from https://stackoverflow.com/a/22706073/5701177
function escapeHTML(string, document){
    var p = document.createElement("p");
    p.appendChild(document.createTextNode(string));
    return p.innerHTML;
}

function onLoadDOM(dom) {
	const document = dom.window.document;
	if (!args["quiet"])
		console.error("Parsing...");
	let reader = new Readability(document);
	let article = reader.parse();
	if (!article) {
		console.error("Couldn't parse document");
		setErrored(ExitCodes.dataError);
		return;
	}

	let writeStream;
	if (outputArg) {
		const fs = require("fs");
		writeStream = fs.createWriteStream(outputArg);
	} else {
		writeStream = process.stdout;
	}

	if (wantedProperties.includes(Properties.title)) {
		writeStream.write(`Title: ${article.title}\n`);
	}
	if (wantedProperties.includes(Properties.excerpt)) {
		writeStream.write(`Excerpt: ${article.excerpt}\n`);
	}
	if (wantedProperties.includes(Properties.byline)) {
		writeStream.write(`Author: ${article.byline}\n`);
	}
	if (wantedProperties.includes(Properties.length)) {
		writeStream.write(`Length: ${article.length}\n`);
	}
	if (wantedProperties.includes(Properties.dir)) {
		writeStream.write(`Direction: ${article.dir}\n`);
	}
	if (wantedProperties.includes(Properties.htmlTitle)) {
		writeStream.write(`<h1>${escapeHTML(article.title, document)}</h1>\n`);
	}
	if (wantedProperties.includes(Properties.htmlContent)) {
		writeStream.write(article.content);
	} else if (wantedProperties.includes(Properties.textContent)) {
		writeStream.write(article.textContent);
	}
}

function onLoadDOMError(error) {
	//resolved earlier
	if (!error) 
		return;

	if (error.code == "ENOENT") {
		console.error(error.message);
		setErrored(ExitCodes.noInput);
	} else if (error.code == "EACCES") {
		console.error(error.message);
		setErrored(ExitCodes.noPermission);
	} else if (error.error && error.error.code == "ENOTFOUND") {
		console.error(`Host not found: '${error.error.hostname}'`);
		setErrored(ExitCodes.noHost);
	} else if (error.statusCode) {
		console.error(`Status error: ${error.response.statusMessage}`);
		setErrored(ExitCodes.noHost);
	} else {
		console.error(error);
		if (error.stack)
			console.error(error.stack);
	}
}
