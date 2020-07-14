# readability-cli

### Firefox Reader View in your terminal!

**readability-cli** takes any HTML page and strips out unnecessary bloat by using [Mozilla's Readability library](https://github.com/mozilla/readability). As a result, you get a web page which contains only the core content and nothing more. The resulting HTML is suitable for terminal browsers, text readers, and other uses.

Here is a before-and-after comparison, using [an article from The Guardian](https://www.theguardian.com/technology/2018/jul/23/tech-industry-wealth-futurism-transhumanism-singularity) as a test subject.

#### Standard view in W3M

![An article from The Guardian in W3M](https://i.imgur.com/yRQ2ryz.png "Standard view in W3M")

*So much useless stuff that the main article does not even fit on the screen!*

#### readability-cli + W3M
![An article from The Guardian in W3M using readability-cli](https://i.imgur.com/Es9QNpI.png "readability-cli with W3M")

*Ah, much better.*

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
