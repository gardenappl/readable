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

**readability-cli** can run via either [Node.js](https://nodejs.org/en/) or its newer and safer Rust counterpart [Deno](https://deno.land/).

### Node.js

Install the program and its man page:

`npm install -g readability-cli`

*(Note to package maintainers: it might be a good idea to provide a symlink, so the man page can be accessed either as `readability-cli(1)` or as `readable(1)`)*

### Deno

Deno support is still in development, running the script directly with `deno run <URL>` is not supported.

However, you can clone this Git repository and easily run the `readable.ts` script.

```sh
git clone https://gitlab.com/gardenappl/readability-cli/
cd readability-cli
./readable.ts
```

You can use `deno run` with the locally-downloaded script to fine-tune permissions, for example:

`curl https://example.com | deno run --no-check readable.ts`

By default Deno does not allow reading & writing files or accessing the network, meaning you have to rely on piping data in and out.

Read more about Deno permissions [in their manual](https://deno.land/manual/getting_started/permissions).

*(Package maintainers might consider adding a `readable-sandbox` executable which will run `readable` with restrictions)*

### Bun

[Bun](https://bun.sh/) is an experimental JavaScript runtime which is supposedly a faster alternative to Node.js. `readability-cli` has not been thoroughly tested with it, but you can try to run:

```sh
bun install readability-cli
bun run readable
```

...or you can clone this repository and run

```sh
bun run ./index.js
```

### Arch Linux

Arch Linux users may use the "official" AUR packages:

* [nodejs-readability-cli](https://aur.archlinux.org/packages/nodejs-readability-cli/)
* [deno-readability-cli](https://aur.archlinux.org/packages/deno-readability-cli/)

## Usage

`readable [SOURCE] [options]`

`readable [options] -- [SOURCE]`

where `SOURCE` is a file, an http(s) URL, or '-' for standard input

**See [readability-cli(1)](readability-cli.1.md) for more information, and usage examples.**


## Localization

See [locales](locales).

## Why Node.js? It's so slow!

I know that it's slow, but JavaScript is the most sensible option for this, since Mozilla's Readabilty library is written in JavaScript. [There have been ports of the Readability algorithm to other languages](https://github.com/masukomi/arc90-readability), but Mozilla's version is the only one that's actively maintained as of 2020.
