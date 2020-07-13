#!/usr/bin/env node

const Readability = require('readability');
const JSDOM = require('jsdom').JSDOM;
const parseArgs = require('minimist');
const fs = require('fs');


const ExitCodes = {
	badUsageCLI: 64
};

let errored = false;

function error(exitCode) {
	process.exitCode = exitCode;
	errored = true;
}

function printUsage() {
	console.error(`
Usage:
	readable SOURCE [options]
	readable [options] -- SOURCE
	(where SOURCE is a file, an http(s) URL, or '-' for standard input)
	
Options:
	-h  --help                Print help
	-o  --output OUTPUT_FILE  Output to OUTPUT_FILE`);
}



const stringArgParams = ['_', '--', "output"];
const boolArgParams = ["help"];
const alias = {
	"output": 'o',
	"help": 'h'
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
		error(ExitCodes.badUsageCLI);

	} else if (stringArgParams.includes(key) && args[key] === "") {
		console.error(`Error: no value given for --${key}`);
		error(ExitCodes.badUsageCLI);
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

const inputCount = args['_'].length + args['--'].length;
if (inputCount > 1) {
	console.error("Too many input arguments");
	printUsage();
	error(ExitCodes.badUsageCLI);
	return;
} else if (inputCount == 0) {
	console.error("No input argument given. Use 'readable -' to read standard input");
	printUsage();
	error(ExitCodes.badUsageCLI);
	return;
}

//Get input parameter, remove inputArg from args
let inputFile;
let inputURL;
let inputIsFromStdin = false;

const inputArg = (args['_'].length > 0) ? args['_'][0] : args['--'][0];

if (inputArg.startsWith("https://") || inputArg.startsWith("http://"))
	inputURL = inputArg;
else if (args['_'] == '-')
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

	promiseGetHTML.then(onLoadDOM);
}

function onLoadDOM(dom) {
	let reader = new Readability(dom.window.document);
	let article = reader.parse();

	if (outputArg) {
		fs.writeFileSync(outputArg, article.content);
	} else {
		console.log(article.content);
	}
//	console.log(chalk.blue(article.textContent));
}
