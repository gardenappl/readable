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

export default async function(
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
) {
	let errored = false;

	function setErrored(exitCode) {
		process.exitCode = exitCode;
		errored = true;
	}

	const ExitCodes = {
		badUsageCLI: 64,
		dataError: 65,
		noInput: 66,
		noHost: 68,
		serviceUnavailable: 69,
		noPermission: 77
	};

	//
	//Parsing arguments
	//

	const Properties = new Map([
		["html-title", (article, singleLine, document) =>
			`<h1>${escapeHTML(Properties.get("title")(article, singleLine, document), document)}</h1>`
		],
		["title", (article, singleLine) => 
			singleLine ? article.title.replace(/\n+/gm, ' ') : article.title
		],
		["excerpt", (article, singleLine) => 
			singleLine ? article.excerpt.replace(/\n+/gm, ' ') : article.excerpt
		],
		["byline", (article, singleLine) => 
			singleLine ? article.byline.replace(/\n+/gm, ' ') : article.byline
		],
		["length", article => article.length],
		["dir", article => article.dir],
		["text-content", article => article.textContent],
		["html-content", article => article.content]
	]);

	const LowConfidenceMode = {
		keep: "keep",
		force: "force",
		exit: "exit"
	};

	const readabilityOptions = {};

	//backwards compat with old, comma-separated values
	function yargsCompatProperties(args) { 
		if (args["properties"]) {
			let i;
			for (i = 0; i < args["properties"].length; i++) {
				const property = args["properties"][i];
				if (property.indexOf(',') > -1) {
					const split = args["properties"][i].split(',');
					args["properties"].splice(i, 1, ...split);
					continue;
				}
				if (!Properties.has(property)) {
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


	const args = yargs
		.version(false)
		.command("* [source]", __`Process HTML input`, (yargs) => { 
			yargs.positional("source", {
				desc: __`A file, an http(s) URL, or '-' for standard input`,
				type: "string"
			});
		})
		.completion("--completion", false)
		.middleware([ yargsCompatProperties, yargsFixPositional ], true) //middleware seems to be buggy
		.option("help", {
			alias: 'h',
			type: "boolean",
			desc: __`Show help`
		})
		.option("completion", {
			type: "boolean",
			desc: __`Print script for bash/zsh completion`,
			hidden: typeof Deno !== "undefined"
		})
		.option("base", {
			alias: 'b',
			type: "string",
			desc: __`Set the document URL when parsing standard input or a local file (this affects relative links)`
		})
		.option("insane", {
			alias: 'S',
			type: "boolean",
			desc: __`Don't sanitize HTML`
		})
		.option("insecure", {
			alias: 'K',
			type: "boolean",
			desc: __`Allow invalid SSL certificates`,
			hidden: typeof Deno !== "undefined"
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
		.option("low-confidence", {
			alias: 'l',
			type: "string",
			desc: __`What to do if Readability.js is uncertain about what the core content actually is`,
			choices: ["keep", "force", "exit"]
			//default: "no-op", //don't set default because completion won't work
		})
		.option("keep-classes", {
			alias: 'C',
			type: "boolean",
			desc: __`Preserve all CSS classes for input elements, instead of adapting to Firefox's Reader Mode`
		})
		.option("output", {
			alias: 'o',
			type: "string",
			desc: __`The file to which the result should be output`
		})
		.option("properties", {
			alias: 'p',
			type: "array",
			desc: __`Output specific properties of the parsed article`,
			choices: Array.from(Properties.keys())
		})
		.option("proxy", {
			alias: 'x',
			type: "string",
			desc: __`Use specified proxy (can also use HTTPS_PROXY environment variable)`,
			hidden: typeof Deno !== "undefined"
		})
		.option("quiet", {
			alias: 'q',
			type: "boolean",
			desc: __`Don't output extra information to stderr`
		})
		.option("style", {
			alias: 's',
			type: "string",
			desc: __`Specify .css file for stylesheet`
		})
		.option("url", {
			alias: 'u',
			type: "string",
			desc: __`(deprecated) alias for --base`,
			hidden: true,
			//deprecated: true //completion script does not respect this value, so just say it in the description
		})
		.option("user-agent", {
			alias: 'A',
			type: "string",
			desc: __`Set custom user agent string`
		})
		.option("version", {
			alias: 'V',
			type: "boolean",
			desc: __`Print version`
		})
		.fail((msg, _err, _yargs) => {
			console.error(msg);
			setErrored(ExitCodes.badUsageCLI);
		})
		.epilogue(__`See the manual for more info: man readability-cli`)
		.wrap(Math.min(yargs.terminalWidth(), 100))
		.strict()
		.parse();

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
		return;
	}

	if (args["version"]) {
		printVersion();
		return;
	}


	if (typeof Deno !== "undefined") {
		for (const option of ["insecure", "proxy"]) {
			if (args[option]) {
				console.error(__`Warning: option --${option} is not supported in Deno.`);
				setErrored(ExitCodes.badUsageCLI);
				return;
			}
		}
	}


	if (args["keep-classes"]) {
		readabilityOptions["keepClasses"] = true;
	}


	if (!args["low-confidence"]) {
		args["low-confidence"] = LowConfidenceMode.keep;
		args['l'] = LowConfidenceMode.keep;
	} else if (!Object.values(LowConfidenceMode).includes(args["low-confidence"])) {
		console.error(__`Unknown mode: ${args["low-confidence"]}\nPlease use one of: keep, force, exit`);
		console.error(__`Use --help for more info.`);
		setErrored(ExitCodes.badUsageCLI);
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


	const outputArg = args["output"];
	const documentURL = args["base"] || inputURL;
	const outputJSON = args["json"];

	let proxy = args["proxy"];
	if (!proxy && typeof Deno === "undefined")
		proxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy;


	let wantedProperties;
	if (args["properties"]) {
		wantedProperties = args["properties"];
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
		return Buffer.concat(chunks).toString("utf8");
	}



	let document, window
	try {
		if (inputIsFromStdin) {
			if (!args["quiet"]) {
				console.error("Reading...");
				if (!documentURL)
					console.error(__`Warning: piping input with unknown URL. This means that relative links will be broken. Supply the --base parameter to fix.`)
			}
			const input = await read(process.stdin);
			[document, window] = await parseDOM(input, documentURL);
		} else {
			if (!args["quiet"])
				console.error(__`Retrieving...`);

			let parseDOMPromise;
			if (inputURL) {
				parseDOMPromise = parseDOMFromURL(documentURL, proxy, !args["insecure"], args["user-agent"]);
			} else if (inputFile) {
				parseDOMPromise = parseDOMFromFile(inputFile, documentURL);
			}
			[document, window] = await parseDOMPromise;
		}
	} catch (e) {
		let error = e
		if (error.error) {
			//Nested error?
			error = error.error;
		}
		if (error instanceof TypeError && inputURL) {
			console.error(__`Invalid URL: ${inputURL}`);
			setErrored(ExitCodes.badUsageCLI);
		} else if (error.code == "ENOENT") {
			console.error(error.message);
			setErrored(ExitCodes.noInput);
		} else if (error.code == "EACCES") {
			console.error(error.message);
			setErrored(ExitCodes.noPermission);
		} else if (error.code == "ENOTFOUND") {
			console.error(__`Host not found: ${error.hostname}`);
			setErrored(ExitCodes.noHost);
		} else if (error.statusCode) {
			console.error(__`Status error: ${error.response.statusMessage}`);
			setErrored(ExitCodes.serviceUnavailable);
		} else {
			console.error(error.message);
			//console.error(error);
			setErrored(ExitCodes.serviceUnavailable);
		}
		return;
	}



	//Taken from https://stackoverflow.com/a/22706073/5701177
	function escapeHTML(string, document) {
	    const p = document.createElement("p");
	    p.appendChild(document.createTextNode(string));
	    return p.innerHTML;
	}

	async function getHTML(document, window) {
		if (args["insane"])
			return document.documentElement.outerHTML;
		else
			return await sanitizeDOM(document, window);
	}

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
			if (args["json"] || wantedProperties) {
				console.error(__`Can't output properties`);
				setErrored(ExitCodes.dataError);
				return;
			}
			shouldParseArticle = false;
		}
	}

	let writeStream;
	if (outputArg) {
		writeStream = fs.createWriteStream(outputArg);
	} else {
		writeStream = process.stdout;
	}


	if (!shouldParseArticle) {
		//Ignore wantedProperties, that should've thrown an error before
		writeStream.write(await getHTML(document, window));
		return;
	}

	if (!args["quiet"])
		console.error(__`Processing...`);

	const reader = new Readability(document, readabilityOptions);
	const article = reader.parse();
	if (!article) {
		if (args["low-confidence"] == LowConfidenceMode.keep) {
			if (!args["quiet"])
				console.error(__`Couldn't process document.`);
			writeStream.write(await getHTML(document, window));
		} else {
			console.error(__`Couldn't process document.`);
			setErrored(ExitCodes.dataError);
		}
		return;
	}
	if (outputJSON) {
		const result = {};
		if (wantedProperties) {
			for (const propertyName of wantedProperties)
				result[propertyName] = Properties.get(propertyName)(article, false, document);
		} else {
			for (const [name, func] of Properties) {
				result[name] = func(article, false, window);
			}
		}
		writeStream.write(JSON.stringify(result));
	} else {
		if (wantedProperties) {
			for (const propertyName of wantedProperties)
				writeStream.write(Properties.get(propertyName)(article, true, document) + '\n');
		} else {
			writeStream.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">`);
			if (args["style"] || !args["keep-classes"]) {
				const cssHref = args["style"] || "chrome://global/skin/aboutReader.css";
				writeStream.write(`
  <link rel="stylesheet" href="${cssHref}" type="text/css">`);
			}
			writeStream.write(`
  <title>${escapeHTML(Properties.get("title")(article, false, document), document)}</title>
</head>
`
			);

			if (!args["keep-classes"]) {
				//Add a few divs and classes so that Firefox Reader Mode CSS works well
				writeStream.write(`
<body class="light sans-serif loaded" style="--font-size:14pt; --content-width:40em;">
  <div class="container" `
				);
				const contentDir = Properties.get("dir")(article, false, document);
				if (contentDir)
					writeStream.write(`dir="${contentDir}">`);
				else
					writeStream.write('>');

				writeStream.write(`
    <div class="header reader-header reader-show-element">
      <h1 class="reader-title">${escapeHTML(Properties.get("title")(article, false, document), document)}</h1>`);

				const author = Properties.get("byline")(article, false, document);
				if (author) {
					writeStream.write(`
      <div class="credits reader-credits">${escapeHTML(author, document)}</div>`);
				}

				writeStream.write(`
    </div>

    <hr>

    <div class="content">
      <div class="moz-reader-content reader-show-element">
`
				);
				const html = Properties.get("html-content")(article, false, document);
				if (!args["insane"])
					writeStream.write(await sanitizeHTML(html, window));
				else
					writeStream.write(html);
				writeStream.write(`
      </div>
    </div>
  </div>
`
				);
			} else {
				writeStream.write("\n<body>\n");
				writeStream.write(Properties.get("html-title")(article, false, document));
				writeStream.write('\n');

				const author = Properties.get("byline")(article, false, document);
				if (author) {
					writeStream.write(`<p><i>${escapeHTML(author, document)}</i></p>`);
				}
				writeStream.write("\n<hr>\n");
				const html = Properties.get("html-content")(article, false, document);
				if (!args["insane"])
					writeStream.write(await sanitizeHTML(html, window));
				else
					writeStream.write(html);
			}


			writeStream.write("\n</body></html>");
		}
	}
}
