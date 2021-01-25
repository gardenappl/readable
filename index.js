#!/usr/bin/env node

/*

Firefox Reader Mode in your terminal! CLI tool for Mozilla's Readability library

	Copyright (C) 2021 gardenapple
                                                                                                    
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

const path = require("path");

// GNU gettext gives preference to LANGUAGE, but this order is consistent with Yargs:
const locale = (
	process.env.LC_ALL ||
	process.env.LC_MESSAGES ||
	process.env.LANG ||
	process.env.LANGUAGE ||
	'en_US'
).replace(/[.:].*/, '');

const yargs = require("yargs");
const __ = require("y18n")({
	locale: locale,
	updateFiles: false,
	directory: path.resolve(__dirname, 'locales')
}).__;

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

const LowConfidenceMode = {
	noOp: "no-op",
	force: "force",
	exit: "exit"
};


//backwards compat with old, comma-separated values
function yargsCompatProperties(args) { 
	if (args["properties"]) {
		for (var i = 0; i < args["properties"].length; i++) {
			const property = args["properties"][i];
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

//Positional sometimes don't get recognized when they're put
//after other arguments, I think it's an oversight in yargs.
function yargsFixPositional(args) {
	if (args["--"]) {
		if (!args["source"])
			args["source"] = args["--"].shift();
		args["_"] = args["--"];
	}
}


let args = yargs
	.version(false)
	.command("* [source]", __`Process HTML input`, (yargs) => { 
		yargs.positional("source", {
			desc: __`A file, an http(s) URL, or '-' for standard input`,
			type: "string"
		});
	})
	.completion('--completion', false, function(current, args, defaultCompletion, done) {
		if (args["properties"] !== undefined) {
			const properties = args["properties"];
			let possibleProperties = [];
			for (var possibleProperty of Object.values(Properties)) {
				if (possibleProperty.startsWith(properties[properties.length - 1])
						&& !properties.includes(possibleProperty))
					possibleProperties.push(possibleProperty);
			}
			if (possibleProperties.length > 0)
				done(possibleProperties);
		}
		if (args["low-confidence"] !== undefined) {
			const currentMode = args["low-confidence"];
			let possibleModes = [];
			for (var possibleMode of Object.values(LowConfidenceMode)) {
				if (possibleMode.startsWith(currentMode)
						&& possibleMode != currentMode)
					possibleModes.push(possibleMode);
					
			}
			if (possibleModes.length > 0)
				done(possibleModes);
		}
		defaultCompletion();
	})
	.middleware([ yargsCompatProperties, yargsFixPositional ], true) //middleware seems to be buggy
	.option("completion", {
		type: "boolean",
		desc: __`Print script for bash/zsh completion`
	})
	.option("version", {
		alias: 'V',
		type: "boolean",
		desc: __`Print version`
	})
	.option("help", {
		alias: 'h',
		desc: __`Show help`
	})
	.option("output", {
		alias: 'o',
		type: "string",
		desc: __`The file to which the result should be output`
	})
	.option("low-confidence", {
		alias: 'l',
		type: "string",
		desc: __`What to do if Readability.js is uncertain about what the core content actually is`,
		//default: "no-op", //don't set default because completion won't work
		choices: ["no-op", "force", "exit"]
	})
	.option("properties", {
		alias: 'p',
		type: "array",
		desc: __`Output specific properties of the parsed article`,
		choices: ["html-title", "title", "excerpt", "byline", "length", "dir", "html-content", "text-content"]
	})
	.option("quiet", {
		alias: 'q',
		type: "boolean",
		desc: __`Don't output extra information to stderr`,
		default: false 
	})
	.option("base", {
		alias: 'b',
		type: "string",
		desc: __`Set the document URL when parsing standard input or a local file (this affects relative links)`
	})
	.option("url", {
		alias: 'u',
		type: "string",
		desc: __`(deprecated) alias for --base`,
		hidden: true,
		//deprecated: true //completion script does not respect this value, so just say it in the description
	})
	.option("is-file", {
		alias: 'f',
		type: "boolean",
		desc: __`Interpret SOURCE as a file name rather than a URL`,
		default: false,
		hidden: true,
		//deprecated: true
	})
	.option("is-url", {
		alias: 'U',
		type: "boolean",
		desc: __`(deprecated) Interpret SOURCE as a URL rather than file name`,
		hidden: true,
		//deprecated: true
	})
	.option("json", {
		alias: 'j',
		type: "boolean",
		desc: __`Output properties as a JSON payload`
	})
	.epilogue(__`The --low-confidence option determines what should be done for documents where Readability can't tell what the core content is:\n` +
__`   no-op   When unsure, don't touch the HTML, output as-is. This is incompatible with the --properties and --json options.\n` +
__`   force   Process the document even when unsure (may produce really bad output).\n` +
__`   exit    When unsure, exit with an error.\n` +
  '\n' +
__`Default value is "no-op".\n` +
  '\n' +
  '\n' +
__`The --properties option accepts a list of values, separated by spaces. Suitable values are:\n` +
__`   html-title     Outputs the article's title, wrapped in an <h1> tag.\n` +
__`   title          Outputs the title in the format "Title: $TITLE".\n` +
__`   excerpt        Article description, or short excerpt from the content, in the format "Excerpt: $EXCERPT".\n` +
__`   byline         Author metadata, in the format "Author: $AUTHOR".\n` +
__`   length         Length of the article in characters, in the format "Length: $LENGTH".\n` +
__`   dir            Content direction, is either "Direction: ltr" or "Direction: rtl".\n` +
__`   html-content   Outputs the article's main content as HTML.\n` +
__`   text-content   Outputs the article's main content as plain text.\n` +
  '\n' +
__`Text-content and Html-content are mutually exclusive, and are always printed last.\n` +
__`Default value is "html-title html-content".\n`)
	.wrap(Math.min(yargs.terminalWidth(), 120))
	.strict()
	.parse();

if (!args["low-confidence"]) {
	args["low-confidence"] = LowConfidenceMode.noOp;
	args['l'] = LowConfidenceMode.noOp;
}

if (args["is-url"]) {
	console.error(__`Note: --is-url option is deprecated.`);
}
if (args["url"]) {
	console.error(__`Note: --url option is deprecated, please use --base instead.`);
	args["base"] = args["url"];
}


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
		console.error(__`No input provided`);
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

if (args["is-url"] && inputArg.search(/^\w+:\/\//) == -1)
	inputArg = "https://" + inputArg;
if (!args["is-file"] && inputArg.search(/^\w+:\/\//) != -1)
	inputURL = inputArg;
else if (inputArg == '-')
	inputIsFromStdin = true;
else
	inputFile = inputArg;


const outputArg = args['output'];
const documentURL = args["base"] || inputURL;
const outputJSON = args['json'];


let wantedProperties = [];
let wantedPropertiesCustom = false;

if (args["properties"]) {
	wantedProperties = args["properties"];
	wantedPropertiesCustom = true;
} else {
	wantedProperties = [ Properties.htmlTitle, Properties.htmlContent ];
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
			console.error(__`Warning: piping input with unknown URL. This means that relative links will be broken. Supply the --base parameter to fix.`)
	}
	read(process.stdin).then(result => {
		const JSDOM = require("jsdom").JSDOM;
		onLoadDOM(new JSDOM(result, { url: documentURL }));
	});
} else {
	const JSDOM = require("jsdom").JSDOM;
	if (!args["quiet"])
		console.error(__`Retrieving...`);
	let promiseGetHTML;
	if (inputURL) {
		promiseGetHTML = JSDOM.fromURL(inputURL)
	} else if (inputFile) {
		promiseGetHTML = JSDOM.fromFile(inputFile, {
			url: documentURL
		});
	}

	promiseGetHTML.then(onLoadDOM, onLoadDOMError)
}

const { Readability, isProbablyReaderable } = require("@mozilla/readability");

//Taken from https://stackoverflow.com/a/22706073/5701177
function escapeHTML(string, document){
    var p = document.createElement("p");
    p.appendChild(document.createTextNode(string));
    return p.innerHTML;
}

function onLoadDOM(dom) {
	const document = dom.window.document;

	let shouldParseArticle = true;
	if (args["low-confidence"] != LowConfidenceMode.force)
		shouldParseArticle = isProbablyReaderable(document);		

	if (!shouldParseArticle) {
		if (args["low-confidence"] == LowConfidenceMode.exit) {
			console.error(__`Not sure if this document should be processed, exiting`);
			setErrored(ExitCodes.dataError);
			return;
		} else {
			if (!args["quiet"])
				console.error(__`Not sure if this document should be processed. Not processing`);
			if (args["json"] || wantedPropertiesCustom) {
				console.error(__`Can't output properties`);
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
		if (!args["quiet"])
			console.error(__`Processing...`);

		const reader = new Readability(document);
		const article = reader.parse();
		if (!article) {
			console.error(__`Couldn't process document.`);
			setErrored(ExitCodes.dataError);
			return;
		}
		if (outputJSON) {
			let result = {};
			const jsonProperties = ["title", "excerpt", "byline", "length", "dir"];
			for (jsonProperty of jsonProperties) {
				if (!wantedPropertiesCustom || wantedProperties.includes(jsonProperty))
					result[jsonProperty] = article[jsonProperty];
			}
			if (!wantedPropertiesCustom || wantedProperties.includes(Properties.textContent)) {
				result[Properties.textContent] = article.textContent;
			}
			if (!wantedPropertiesCustom || wantedProperties.includes(Properties.htmlContent)) {
				result[Properties.htmlContent] = article.content;
			}
			if (!wantedPropertiesCustom || wantedProperties.includes(Properties.htmlTitle)) {
				result[Properties.htmlTitle] = `<h1>${escapeHTML(article.title, document)}</h1>`
			}
			writeStream.write(JSON.stringify(result));
			return;
		}

		if (wantedProperties.includes(Properties.title)) {
			writeStream.write(__`Title: ${article.title}\n`);
		}
		if (wantedProperties.includes(Properties.excerpt)) {
			writeStream.write(__`Excerpt: ${article.excerpt}\n`);
		}
		if (wantedProperties.includes(Properties.byline)) {
			writeStream.write(__`Author: ${article.byline}\n`);
		}
		if (wantedProperties.includes(Properties.length)) {
			writeStream.write(__`Length: ${article.length}\n`);
		}
		if (wantedProperties.includes(Properties.dir)) {
			if (article.dir == 'ltr')
				writeStream.write(__`Direction: ltr\n`);
			else if (article.dir == 'rtl')
				writeStream.write(__`Direction: rtl\n`);
			else
				writeStream.write(__`Direction: ${article.dir}\n`);
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
	if (error instanceof TypeError && inputURL) {
		console.error(__`Invalid URL: ${inputURL}`);
		setErrored(ExitCodes.dataError);
	} else if (error.code == "ENOENT") {
		console.error(error.message);
		setErrored(ExitCodes.noInput);
	} else if (error.code == "EACCES") {
		console.error(error.message);
		setErrored(ExitCodes.noPermission);
	} else if (error.error && error.error.code == "ENOTFOUND") {
		console.error(__`Host not found: '${error.error.hostname}'`);
		setErrored(ExitCodes.noHost);
	} else if (error.statusCode) {
		console.error(__`Status error: ${error.response.statusMessage}`);
		setErrored(ExitCodes.noHost);
	} else {
		console.error(error.message);
//		if (error.stack)
//			console.error(error.stack)
		setErrored(ExitCodes.dataError);
	}
}
