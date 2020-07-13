#!/usr/bin/env node

const Readability = require('readability');
const JSDOM = require('jsdom').JSDOM;
const parseArgs = require('minimist');
const fs = require('fs');


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
	    --help                Print help
	-o  --output OUTPUT_FILE  Output to OUTPUT_FILE`);
}



const stringArgParams = ['_', '--', "output"];
const boolArgParams = ["help"];
const alias = {
	"output": 'o',
}

let args = parseArgs(process.argv.slice(2), {
	"string": stringArgParams,
	"boolean": boolArgParams,
	"alias": alias,
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



if (inputIsFromStdin) {
	onLoadDOM(new JSDOM(fs.readFileSync(0, 'utf-8')));
} else {
	let promiseGetHTML;
	if (inputURL)
		promiseGetHTML = JSDOM.fromURL(inputURL);
	else if (inputFile)
		promiseGetHTML = JSDOM.fromFile(inputFile);

	promiseGetHTML.then(onLoadDOM)
		.catch(onLoadDOMError);
}

function onLoadDOM(dom) {
	let reader = new Readability(dom.window.document);
	let article = reader.parse();
	if (!article) {
		console.error("Couldn't parse document");
		setErrored(ExitCodes.dataError);
		return;
	}

	if (outputArg) {
		fs.writeFileSync(outputArg, article.content);
	} else {
		console.log(article.content);
	}
//	console.log(chalk.blue(article.textContent));
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
	}
}
