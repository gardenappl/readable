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

## Installation

The best way to install **readability-cli** is through NPM:

`npm install -g @gardenapple/readability-cli`

## Usage

`readable [SOURCE] [options]`

`readable [options] -- [SOURCE]`

where `SOURCE` is a file, an http(s) URL, or '-' for standard input

See `readable --help` for more information.


### Examples

**Read HTML from a file and output the result to the console:**

`readable index.html`

**Fetch a random Wikipedia article, get its title and an excerpt:**

`readable https://en.wikipedia.org/wiki/Special:Random -p title,excerpt`

**Fetch a web page and read it in W3M:**

`readable https://www.nytimes.com/2020/01/18/technology/clearview-privacy-facial-recognition.html | w3m -T text/html`

**Download a web page using [cURL](https://en.wikipedia.org/wiki/CURL), parse it and save it into a file:**

`curl https://github.com/mozilla/readability | readable --url=https://github.com/mozilla/readability`

It's a good idea to supply the --url parameter when piping input, otherwise `readable` won't know the document's URL, and things like relative links won't work.

### Why Node.js? It's so slow!

I know that it's slow, but JavaScript is the most sensible option for this, since Mozilla's Readabilty library is written in JavaScript. [There have been ports of the Readability algorithm to other languages](https://github.com/masukomi/arc90-readability), but Mozilla's version is the only one that's actively maintained as of 2020.
