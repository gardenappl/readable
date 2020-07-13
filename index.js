#!/usr/bin/env node

const Readability = require("readability");
const JSDOM = require("jsdom").JSDOM;
const parseArgs = require("minimist");
const fs = require("fs");
const he = require("he");


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
	    --help                            Print help
	-o  --output OUTPUT_FILE              Output to OUTPUT_FILE
	-p  --properties PROP1,[PROP2,...]    Output specific properties of the parsed article
	-V  --version                         Print version

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



const stringArgParams = ['_', "--", "output", "properties"];
const boolArgParams = ["help", "version"];
const alias = {
	"output": 'o',
	"properties": 'p',
	"version": 'V'
}

let args = parseArgs(process.argv.slice(2), {
	string: stringArgParams,
	boolean: boolArgParams,
	default: {
		"properties": "html-title,html-content"
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

if (inputArg.startsWith("https://") || inputArg.startsWith("http://"))
	inputURL = inputArg;
else if (inputArg == '-')
	inputIsFromStdin = true;
else
	inputFile = inputArg;

delete args['_'];
delete args['--'];


const outputArg = args['output'];



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



if (inputIsFromStdin) {
	onLoadDOM(new JSDOM(fs.readFileSync(0, 'utf-8')));
} else {
	console.error("Retrieving...");
	let promiseGetHTML;
	if (inputURL)
		promiseGetHTML = JSDOM.fromURL(inputURL);
	else if (inputFile)
		promiseGetHTML = JSDOM.fromFile(inputFile);

	promiseGetHTML.then(onLoadDOM)
		.catch(onLoadDOMError);
}

function onLoadDOM(dom) {
	console.error("Parsing...");
	let reader = new Readability(dom.window.document);
	let article = reader.parse();
	if (!article) {
		console.error("Couldn't parse document");
		setErrored(ExitCodes.dataError);
		return;
	}

	let writeStream;
	if (outputArg) {
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
		const encodedTitle = he.encode(article.title, {
			useNamedReferences: true
		});
		writeStream.write(`<h1>${encodedTitle}</h1>\n`);
	}
	if (wantedProperties.includes(Properties.htmlContent)) {
		writeStream.write(article.content);
	} else if (wantedProperties.includes(Properties.textContent)) {
		writeStream.write(article.textContent);
	}
}

function onLoadDOMError(error) {
	if (error.code == "ENOENT") {
		console.error(error.message);
		setErrored(ExitCodes.noInput);
	} else if (error.code ="EACCES") {
		console.error(error.message);
		setErrored(ExitCodes.noPermission);
	} else if (error.error && error.error.code == "ENOTFOUND") {
		console.error(`Host not found: '${error.hostname}'`);
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
