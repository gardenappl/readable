#!/usr/bin/env node

/*

Firefox Reader Mode in your terminal! CLI tool for Mozilla's Readability library

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
//const parseArgs = require("minimist");
//JSDOM, fs, Readability, and Readability-readerable are loaded on-demand.
//To-do: lazy loading?

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




//
//Parsing arguments
//

const Properties = {
	htmlTitle: "html-title",
	title: "title",
	excerpt: "excerpt",
	byline: "byline",
	length: "length",
	dir: "dir",
	htmlContent: "html-content",
	textContent: "text-content"
};

const yargs = require("yargs");

//backwards compat with old, comma-separated values
function yargsCompatProperties(args) { 
	if (args["properties"]) {
		for (var i = 0; i < args["properties"].length; i++) {
			const property = args["properties"][i];
			console.error(property);
			if (property.indexOf(',') > -1) {
				const split = args["properties"][i].split(',');
				args["properties"].splice(i, 1, ...split);
				continue;
			}
			if (!Object.values(Properties).includes(property)) {
				args["properties"].splice(i, 1);
				i--;
				if (!args["--"])
					args["--"] = [ property ];
				else
					args["--"].push(property);
			}
		}
	}
}

//Positional arguments sometimes don't get recognized when they're put
//after other arguments, I think it's an oversight in yargs.
function yargsFixPositional(args) {
	if (args["-"]) {
		if (args["source"])
			args["source"] = args["-"];
		else
			args["source"].push(...args["-"]);
	}
	if (args["--"]) {
		if (args["source"])
			args["source"] = args["--"];
		else
			args["source"].push(...args["--"]);
		delete args["--"];
	}
}

let args = yargs
	.version(false)
	.parserConfiguration({
		"camel-case-expansion": false
	})
	.command("* [source]", "Process HTML input", (yargs) => { 
		yargs.positional("source", {
			desc: "A file, an http(s) URL, or '-' for standard input",
			type: "string"
		});
	})
	.middleware([ yargsCompatProperties, yargsFixPositional ], true) //middleware seems to be buggy
	.option('c', {
		alias: "completion",
		type: "boolean",
		desc: "Print script for bash/zsh completion"
	})
	.option('V', {
		alias: "version",
		type: "boolean",
		desc: "Print version"
	})
	.option('h', {
		alias: "help",
		desc: "Show help"
	})
	.option('o', {
		alias: "output",
		type: "string",
		desc: "The file to which the result should be output"
	})
	.option('l', {
		alias: "low-confidence",
		type: "string",
		desc: "What to do if Readability.js is uncertain about what the core content actually is",
		choices: ["no-op", "force", "exit"],
		default: "no-op"
	})
	.option('p', {
		alias: "properties",
		type: "array",
		desc: "Output specific properties of the parsed article",
		choices: ["html-title", "title", "excerpt", "byline", "length", "dir", "html-content", "text-content"]
	})
	.option('q', {
		alias: "quiet",
		type: "boolean",
		desc: "Don't output extra information to stderr",
		default: false
	})
	.option('u', {
		alias: "url",
		type: "string",
		desc: "Set the document URL when parsing standard input or a local file (this affects relative links)"
	})
	.option('U', {
		alias: "is-url",
		type: "boolean",
		desc: "Interpret SOURCE as a URL rather than file name"
	})
	.epilogue(`The --low-confidence option determines what should be done for documents where Readability can't tell what the core content is:
   no-op   When unsure, don't touch the HTML, output as-is. If the --properties option is used, this will make the program crash.
   force   Process the document even when unsure (may produce really bad output).
   exit    When unsure, exit with an error.

Default value is "no-op".


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
Default value is "html-title,html-content".`) 
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.strict()
	//.wrap(yargs.terminalWidth())
	.parse();


function printUsage() {
	yargs.showHelp();
}

if (args["completion"]) {
	yargs.showCompletionScript();
	process.exit();
}


if (args.version) {
	console.log(`readability-cli v${require("./package.json").version}`);
	console.log(`Node.js ${process.version}`);
	return;
}



let inputArg;
if (!args["source"]) {
	if (process.stdin.isTTY) {
		console.error("No input provided");
		printUsage();
		setErrored(ExitCodes.badUsageCLI);
		return;
	} else {
		inputArg = '-'
	}
} else {
	inputArg = args["source"];
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


const outputArg = args['output'];
const documentURL = args["url"] || inputURL;



let wantedProperties = [];
let justOutputHtml = false;

if (args["properties"]) {
	for (var property of args["properties"].split(',')) {
		if (Object.values(Properties).includes(property)) {
			wantedProperties.push(property);
		} else {
			console.error(`Invalid property: ${property}`);
			setErrored(ExitCodes.badUsageCLI);
		}
	}
} else {
	wantedProperties = [ Properties.htmlTitle, Properties.htmlContent ];
	justOutputHtml = true;
}



const LowConfidenceMode = {
	noOp: "no-op",
	force: "force",
	exit: "exit"
};
if (!Object.values(LowConfidenceMode).includes(args["low-confidence"])) {
	console.error(`Invalid mode: ${args["low-confidence"]}`);
	setErrored(ExitCodes.badUsageCLI);
}



if (errored) {
	printUsage();
	return;
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
		const JSDOM = require("jsdom").JSDOM;
		onLoadDOM(new JSDOM(result, { url: documentURL }));
	});
} else {
	const JSDOM = require("jsdom").JSDOM;
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

	let shouldParseArticle = true;

	if (args["low-confidence"] != LowConfidenceMode.force) {
		const Readerable = require("readability/Readability-readerable");

		shouldParseArticle = Readerable.isProbablyReaderable(document);		
	}

	if (!shouldParseArticle) {
		if (args["low-confidence"] == LowConfidenceMode.exit) {
			console.error("Not sure if this document should be processed, exiting");
			setErrored(ExitCodes.dataError);
			return;
		} else {
			if (!args["quiet"])
				console.error("Not sure if this document should be processed. Not processing");
			if (!justOutputHtml) {
				console.error("Can't output properties");
				setErrored(ExitCodes.dataError);
				return;
			}
			shouldParseArticle = false;
		}
	}

	let writeStream;
	if (outputArg) {
		const fs = require("fs");
		writeStream = fs.createWriteStream(outputArg);
	} else {
		writeStream = process.stdout;
	}


	if (shouldParseArticle) {
		const Readability = require("readability");

		if (!args["quiet"])
			console.error("Processing...");

		const reader = new Readability(document);
		const article = reader.parse();
		if (!article) {
			console.error("Couldn't process document. This error usually means that the input document is empty.");
			setErrored(ExitCodes.dataError);
			return;
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
	} else {
		//Ignore wantedProperties, that should've thrown an error before
		writeStream.write(document.documentElement.outerHTML);
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
