# readability-cli(1) -- get useful text from a web page

## SYNOPSYS

**readable** *[SOURCE]* *[options]...*

## DESCRIPTION

**readability-cli** takes any HTML page and strips out unnecessary bloat, leaving only the core text content. The resulting HTML may be suitable for terminal browsers, text readers, and other uses.

This package provides the **readable** command, which uses Mozilla's Readability library. The same library is used in Firefox's Reader View.

The *SOURCE* can be a URL, a file, or '-' for standard input.

## OPTIONS

`--help`

* Show help message, and exit.

`-b`, `--base` *URL*

* Specify the document's URL. This affects relative links: they will not work if **readability-cli** does not know the base URL. You only need this option if you read HTML from a local file, or from standard input.

`-i`, `--insane`

* Don't sanitize HTML.

`-K`, `--insecure`

* Allow invalid SSL certificates.

`-j`, `--json`

* Output all known properties of the document as JSON (see **Properties** subsection).

`-l`, `--low-confidence` *MODE*

* What to do if Readability is uncertain about what the core content actually is. The possible modes are:

  * **keep** - When unsure, don't touch the HTML, output as-is.
  * **force** - Process the document even when unsure (may produce really bad output).
  * **exit** - When unsure, exit with an error.

* The default value is **keep**. If the `--properties` or `--json` options are set, the program will always run in **exit** mode.

`-C`, `--keep-classes`

* Preserve CSS classes for input elements. By default, CSS classes are stripped, and the input is adapted for Firefox's Reader View.

`-o`, `--output` *FILE*

* Output the result to FILE.

`-p`, `--properties` *PROPERTIES*...

* Output specific properties of the document (see **Properties** subsection).

`-x`, `--proxy` *URL*

* Use specified proxy (can also use `HTTPS_PROXY` environment variable).

`-q`, `--quiet`

* Don't print extra information.

`-s`, `--style`

* Specify *.css* file for stylesheet.

`-A`, `--user-agent` *STRING*

* Set custom user agent string.

`-V`, `--version`

* Print **readability-cli** and Node.js version, then exit.

`--completion`

* Print script for shell completion, and exit. Provides Zsh completion if the current shell is zsh, otherwise provides Bash completion.

### Properties

The `--properties` option accepts a list of values, separated by spaces. Suitable values are:

* **title** - The title of the article.
* **html-title** - The title of the article, wrapped in an `<h1>` tag.
* **excerpt** - Article description, or short excerpt from the content.
* **byline** - Data about the page's author.
* **length** - Length of the article in characters.
* **dir** - Text direction, is either "ltr" for left-to-right or "rtl" for right-to-left.
* **text-content** - Output the article's main content as plain text.
* **html-content** - Output the article's main content as an HTML body.

Properties are printed line by line, in the order specified by the user. Only "text-content" and "html-content" is printed as multiple lines.

## EXIT STATUS

As usual, exit code 0 indicates success, and anything other than 0 is an error. **readability-cli** uses standard\* error codes:

| Error code | Meaning |
|     --:    |   :--   |
|   **64**   | Bad CLI arguments |
|   **65**   | Data format error: can't parse document using Readability. |
|   **66**   | No input |
|   **68**   | Unknown host name for URL |
|   **77**   | Permission denied: can't read file |

\* By "standard error codes" I mean "close to a standard". And by that I mean: I don't remember any command line tools which actually use this convention. You may find more info in **sysexits**(3), or maybe just *sysexits.h*.

## ENVIRONMENT

**readability-cli** supports localization, using the environment variables `LC_ALL`, `LC_MESSAGES`, `LANG` and `LANGUAGE`, in that order. Only one language at a time is supported.

`HTTPS_PROXY` will set the HTTPS proxy, as previously stated, however the `--proxy` option overrides this. Lowercase `https_proxy` and `http_proxy` are also recognized.

## EXAMPLE

**Read HTML from a file and output the result to the console:**

```
readable index.html
```

**Fetch a random Wikipedia article, get its title and an excerpt:**

```
readable https://en.wikipedia.org/wiki/Special:Random -p title,excerpt
```

**Fetch a web page and read it in W3M:**

```
readable https://www.nytimes.com/2020/01/18/technology/clearview-privacy-facial-recognition.html | w3m -T text/html
```

**Download a web page using cURL, parse it and output as JSON:**

```
curl https://github.com/mozilla/readability | readable --base=https://github.com/mozilla/readability --json
```

## SEE ALSO

**curl**(1), **w3m**(1), **sysexits**(3)

Source code, license, bug tracker and merge requests may be found on [GitLab](https://gitlab.com/gardenappl/readability-cli).
