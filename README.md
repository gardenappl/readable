# reader-view-cli

**Firefox Reader View in your terminal!**

**reader-view-cli** takes any HTML page and strips out unnecessary bloat by using [Mozilla's Readability library](https://github.com/mozilla/readability). As a result, you get a web page which contains only the core content and nothing more. The resulting HTML is suitable for terminal browsers, text readers, or perhaps other use-cases.

### An example of Reader View in Firefox:

**Standard view in Firefox**

![An article from The Guardian with standard view in Firefox](https://i.imgur.com/6xyyShd.png "Standard view in Firefox")

**Reader View in Firefox**

![An article from The Guardian with Reader View in Firefox](https://i.imgur.com/V27OUch.png "Reader View in Firefox")

#### An example of reader-view-cli with W3M browser:

**Standard view in W3M**

![An article from The Guardian in W3M](https://i.imgur.com/kAeCfh1.png "Standard view in W3M")

**reader-view-cli + W3M**

![An article from The Guardian in W3M using reader-view-cli](https://i.imgur.com/KaSY1JS.png "reader-view-cli with W3M")

## Usage

`readable [SOURCE] [options]`
`readable [options] -- [SOURCE]`
(where SOURCE is a file, an http(s) URL, or '-' for standard input)
	
Options:
```
	    --help                 Print help
	-o  --output OUTPUT_FILE   Output to OUTPUT_FILE
	-p  --properties PROPS...  Output specific properties of the parsed article
	-V  --version              Print version
	-u  --url                  Set the document URL when parsing standard input or a local file (this affects relative links and such)
	-U  --is-url               Interpret SOURCE as a URL rather than file name
	-q  --quiet                Don't output extra information to stderr
```

The --properties option accepts a comma-separated list of values (with no spaces in-between). Suitable values are:
```
	html-title     Outputs the article's title, wrapped in an <h1> tag.
	title          Outputs the title in the format "Title: $TITLE".
	excerpt        Article description, or short excerpt from the content, in the format "Excerpt: $EXCERPT"
	byline         Author metadata, in the format "Author: $AUTHOR"
	length         Length of the article in characters, in the format "Length: $LENGTH"
	dir            Content direction, is either "Direction: ltr" or "Direction: rtl"
	html-content   Outputs the article's main content as HTML.
	text-content   Outputs the article's main content as plain text.
```

Text-content and Html-content are mutually exclusive, and are always printed last.
Default value is "html-title,html-content".


### Usage examples

**Read HTML from a file and output the result to the console:**
`readable index.html`

**Fetch a web page and read it in W3M:**
`readable https://example.com/page | w3m -T text/html`

**Download a web page using cURL, get the title, the content, and an excerpt in plain text:**
`curl https://example.com/page | readable --url https://example.com/page -p title,excerpt,text-content`

It's a good idea to supply the --url parameter when piping input, otherwise `readable` won't know the document's URL, and things like relative links won't work.
