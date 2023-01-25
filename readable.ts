#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env=HTTPS_PROXY,LC_ALL,LC_MESSAGES,LANG,LANGUAGE --no-prompt --no-check --

const version = "2.4.4"

import * as path from "https://deno.land/std@0.173.0/path/mod.ts"

import { Buffer } from "https://deno.land/std@0.173.0/node/buffer.ts"
import fs from "https://deno.land/std@0.173.0/node/fs.ts"
import process from "https://deno.land/std@0.173.0/node/process.ts"

import yargs from "https://deno.land/x/yargs@v17.6.2-deno/deno.ts"
import y18n from "https://deno.land/x/y18n@v5.0.8-deno/deno.ts"

import { initParser, DOMParser, DOMParserMimeType, Document, Element } from "https://deno.land/x/deno_dom@v0.1.36-alpha/deno-dom-wasm-noinit.ts"
import * as ammonia from "https://deno.land/x/ammonia@0.3.1/mod.ts"

import { Readability, isProbablyReaderable } from "https://esm.sh/@mozilla/readability@0.4.2?no-check"
import UserAgent from "https://esm.sh/user-agents@1.0"

// GNU gettext gives preference to LANGUAGE above all else, but this order is consistent with Yargs:
const locale = (
	Deno.env.get("LC_ALL") ||
	Deno.env.get("LC_MESSAGES") ||
	Deno.env.get("LANG") ||
	Deno.env.get("LANGUAGE") ||
	"en_US"
).replace(/[.:].*/, '')

const __ = y18n({
	locale: locale,
	updateFiles: false,
	directory: path.join(path.dirname(path.fromFileUrl(import.meta.url)), "locales")
}).__


function printVersion() {
	console.log(`readability-cli v${version}`)
	console.log(`Deno ${Deno.version.deno}`)
}

async function parseDOMFromURL(url: string, _proxy: string, _strictSSL: boolean, userAgent: string) {
	const initParserPromise = initParser()

	const userAgentString = userAgent ?? new UserAgent({ deviceCategory: "desktop" }).toString()
	const response = await fetch(url, {
		headers: {
			"User-Agent": userAgentString
		}
	})
	if (!response.ok) {
		throw {
			statusCode: response.status,
			response: {
				statusMessage: response.statusText
			}
		}
	}
	const text = await response.text()
	await initParserPromise
	
	const contentType = response.headers.get("Content-Type")!
	let mimeType = contentType.slice(0, contentType.indexOf(';'))
	if (mimeType == "text/htm")
		mimeType = "text/html"
	return parseDOM(text, url, mimeType as DOMParserMimeType)
}

async function parseDOM(html: string, url?: string, mimeType?: DOMParserMimeType) {
	await initParser()
	const document = new DOMParser().parseFromString(html, mimeType ?? "text/html")!

	const baseURLString = document.getElementsByTagName("base")[0]?.getAttribute("href") ?? url
	if (baseURLString) {
		const baseURL = new URL(baseURLString)
		const nodes: Element[] = []
		nodes.push(document.documentElement!)

		while (nodes.length > 0) {
			const element = nodes.pop()!
			const href = element.getAttribute("href")
			if (href) {
				try {
					// Try to parse absolute URL
					new URL(href)
				} catch {
					// Assume href is a relative URL
					element.setAttribute("href", new URL(href, baseURL))
				}
			}

			nodes.push(...element.children)
		}
	}
	return [document]
}

async function parseDOMFromFile(file: string, url: string) {
	const data = await Deno.readFile(file)
	return parseDOM(new TextDecoder().decode(data), url)
}

async function sanitizeHTML(html: string) {
	await ammonia.init()
	return ammonia.clean(html)
}

async function sanitizeDOM(document: Document) {
	return await sanitizeHTML(document.documentElement!.outerHTML)
}


import readable from "./common.mjs"
await readable(
	Buffer,
	fs,
	process,
	yargs(Deno.args),
	__,
	Readability,
	isProbablyReaderable,
	printVersion,
	parseDOM,
	parseDOMFromFile,
	parseDOMFromURL,
	sanitizeDOM,
	sanitizeHTML
)

if (process.exitCode) {
	process.exit()
}
