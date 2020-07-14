# reader-view-cli

#### Firefox Reader View in your terminal!

**reader-view-cli** takes any HTML page and strips out unnecessary bloat by using [Mozilla's Readability library](https://github.com/mozilla/readability). As a result, you get a web page which contains only the core content and nothing more. The resulting HTML is suitable for terminal browsers, text readers, and other uses.

### An example of Reader View in Firefox:

#### Standard view

![An article from The Guardian with standard view in Firefox](https://i.imgur.com/6xyyShd.png "Standard view in Firefox")

#### Reader View

![An article from The Guardian with Reader View in Firefox](https://i.imgur.com/V27OUch.png "Reader View in Firefox")

### An example of reader-view-cli with W3M browser:

#### Standard view

![An article from The Guardian in W3M](https://i.imgur.com/yRQ2ryz.png "Standard view in W3M")

#### reader-view-cli
![An article from The Guardian in W3M using reader-view-cli](https://i.imgur.com/Es9QNpI.png "reader-view-cli with W3M")

## Usage

`readable [SOURCE] [options]`

`readable [options] -- [SOURCE]`

where `SOURCE` is a file, an http(s) URL, or '-' for standard input

See `readable --help` for more information.


### Examples

**Read HTML from a file and output the result to the console:**

`readable index.html`

**Fetch a web page and read it in W3M:**

`readable https://example.com/page | w3m -T text/html`

**Download a web page using cURL, get the title, the content, and an excerpt in plain text:**

`curl https://example.com/page | readable --url=https://example.com/page -p title,excerpt,text-content`

It's a good idea to supply the --url parameter when piping input, otherwise `readable` won't know the document's URL, and things like relative links won't work.
