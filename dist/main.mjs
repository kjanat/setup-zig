import { C as __commonJSMin, S as which, _ as exec, a as addPath, b as mkdirP, c as getBooleanInput, d as info, f as isDebug, g as warning, h as setOutput, i as require_semver, l as getInput, m as setFailed, n as restoreCache, o as debug, p as saveState, r as saveCache, s as exportVariable, t as isFeatureAvailable, v as getExecOutput, w as __toESM, x as rmRF, y as cp } from "./cache-BNgf87Wy.mjs";
import * as os$1 from "os";
import * as crypto$1 from "crypto";
import * as fs$1 from "fs";
import * as path$1 from "path";
import { ok } from "assert";
import { Readable } from "node:stream";
import * as crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import * as os from "node:os";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import fs$3, * as fs from "node:fs/promises";
import { pipeline } from "node:stream/promises";
// node_modules/@actions/tool-cache/lib/manifest.js
var import_semver = /* @__PURE__ */ __toESM(require_semver(), 1);
// node_modules/@actions/tool-cache/lib/tool-cache.js
var __awaiter = function(thisArg, _arguments, P, generator) {
	function adopt(value) {
		return value instanceof P ? value : new P(function(resolve) {
			resolve(value);
		});
	}
	return new (P || (P = Promise))(function(resolve, reject) {
		function fulfilled(value) {
			try {
				step(generator.next(value));
			} catch (e) {
				reject(e);
			}
		}
		function rejected(value) {
			try {
				step(generator["throw"](value));
			} catch (e) {
				reject(e);
			}
		}
		function step(result) {
			result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
		}
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};
const IS_WINDOWS = process.platform === "win32";
process.platform;
/**
* Extract a compressed tar archive
*
* @param file     path to the tar
* @param dest     destination directory. Optional.
* @param flags    flags for the tar command to use for extraction. Defaults to 'xz' (extracting gzipped tars). Optional.
* @returns        path to the destination directory
*/
function extractTar(file_1, dest_1) {
	return __awaiter(this, arguments, void 0, function* (file, dest, flags = "xz") {
		if (!file) throw new Error("parameter 'file' is required");
		dest = yield _createExtractFolder(dest);
		debug("Checking tar --version");
		let versionOutput = "";
		yield exec("tar --version", [], {
			ignoreReturnCode: true,
			silent: true,
			listeners: {
				stdout: (data) => versionOutput += data.toString(),
				stderr: (data) => versionOutput += data.toString()
			}
		});
		debug(versionOutput.trim());
		const isGnuTar = versionOutput.toUpperCase().includes("GNU TAR");
		let args;
		if (flags instanceof Array) args = flags;
		else args = [flags];
		if (isDebug() && !flags.includes("v")) args.push("-v");
		let destArg = dest;
		let fileArg = file;
		if (IS_WINDOWS && isGnuTar) {
			args.push("--force-local");
			destArg = dest.replace(/\\/g, "/");
			fileArg = file.replace(/\\/g, "/");
		}
		if (isGnuTar) {
			args.push("--warning=no-unknown-keyword");
			args.push("--overwrite");
		}
		args.push("-C", destArg, "-f", fileArg);
		yield exec(`tar`, args);
		return dest;
	});
}
/**
* Extract a zip
*
* @param file     path to the zip
* @param dest     destination directory. Optional.
* @returns        path to the destination directory
*/
function extractZip(file, dest) {
	return __awaiter(this, void 0, void 0, function* () {
		if (!file) throw new Error("parameter 'file' is required");
		dest = yield _createExtractFolder(dest);
		if (IS_WINDOWS) yield extractZipWin(file, dest);
		else yield extractZipNix(file, dest);
		return dest;
	});
}
function extractZipWin(file, dest) {
	return __awaiter(this, void 0, void 0, function* () {
		const escapedFile = file.replace(/'/g, "''").replace(/"|\n|\r/g, "");
		const escapedDest = dest.replace(/'/g, "''").replace(/"|\n|\r/g, "");
		const pwshPath = yield which("pwsh", false);
		if (pwshPath) {
			const args = [
				"-NoLogo",
				"-NoProfile",
				"-NonInteractive",
				"-ExecutionPolicy",
				"Unrestricted",
				"-Command",
				[
					`$ErrorActionPreference = 'Stop' ;`,
					`try { Add-Type -AssemblyName System.IO.Compression.ZipFile } catch { } ;`,
					`try { [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}', $true) }`,
					`catch { if (($_.Exception.GetType().FullName -eq 'System.Management.Automation.MethodException') -or ($_.Exception.GetType().FullName -eq 'System.Management.Automation.RuntimeException') ){ Expand-Archive -LiteralPath '${escapedFile}' -DestinationPath '${escapedDest}' -Force } else { throw $_ } } ;`
				].join(" ")
			];
			debug(`Using pwsh at path: ${pwshPath}`);
			yield exec(`"${pwshPath}"`, args);
		} else {
			const args = [
				"-NoLogo",
				"-Sta",
				"-NoProfile",
				"-NonInteractive",
				"-ExecutionPolicy",
				"Unrestricted",
				"-Command",
				[
					`$ErrorActionPreference = 'Stop' ;`,
					`try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { } ;`,
					`if ((Get-Command -Name Expand-Archive -Module Microsoft.PowerShell.Archive -ErrorAction Ignore)) { Expand-Archive -LiteralPath '${escapedFile}' -DestinationPath '${escapedDest}' -Force }`,
					`else {[System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}', $true) }`
				].join(" ")
			];
			const powershellPath = yield which("powershell", true);
			debug(`Using powershell at path: ${powershellPath}`);
			yield exec(`"${powershellPath}"`, args);
		}
	});
}
function extractZipNix(file, dest) {
	return __awaiter(this, void 0, void 0, function* () {
		const unzipPath = yield which("unzip", true);
		const args = [file];
		if (!isDebug()) args.unshift("-q");
		args.unshift("-o");
		yield exec(`"${unzipPath}"`, args, { cwd: dest });
	});
}
/**
* Caches a directory and installs it into the tool cacheDir
*
* @param sourceDir    the directory to cache into tools
* @param tool          tool name
* @param version       version of the tool.  semver format
* @param arch          architecture of the tool.  Optional.  Defaults to machine architecture
*/
function cacheDir(sourceDir, tool, version, arch) {
	return __awaiter(this, void 0, void 0, function* () {
		version = import_semver.clean(version) || version;
		arch = arch || os$1.arch();
		debug(`Caching tool ${tool} ${version} ${arch}`);
		debug(`source dir: ${sourceDir}`);
		if (!fs$1.statSync(sourceDir).isDirectory()) throw new Error("sourceDir is not a directory");
		const destPath = yield _createToolPath(tool, version, arch);
		for (const itemName of fs$1.readdirSync(sourceDir)) {
			const s = path$1.join(sourceDir, itemName);
			yield cp(s, destPath, { recursive: true });
		}
		_completeToolPath(tool, version, arch);
		return destPath;
	});
}
/**
* Finds the path to a tool version in the local installed tool cache
*
* @param toolName      name of the tool
* @param versionSpec   version of the tool
* @param arch          optional arch.  defaults to arch of computer
*/
function find(toolName, versionSpec, arch) {
	if (!toolName) throw new Error("toolName parameter is required");
	if (!versionSpec) throw new Error("versionSpec parameter is required");
	arch = arch || os$1.arch();
	if (!isExplicitVersion(versionSpec)) versionSpec = evaluateVersions(findAllVersions(toolName, arch), versionSpec);
	let toolPath = "";
	if (versionSpec) {
		versionSpec = import_semver.clean(versionSpec) || "";
		const cachePath = path$1.join(_getCacheDirectory(), toolName, versionSpec, arch);
		debug(`checking cache: ${cachePath}`);
		if (fs$1.existsSync(cachePath) && fs$1.existsSync(`${cachePath}.complete`)) {
			debug(`Found tool in cache ${toolName} ${versionSpec} ${arch}`);
			toolPath = cachePath;
		} else debug("not found");
	}
	return toolPath;
}
/**
* Finds the paths to all versions of a tool that are installed in the local tool cache
*
* @param toolName  name of the tool
* @param arch      optional arch.  defaults to arch of computer
*/
function findAllVersions(toolName, arch) {
	const versions = [];
	arch = arch || os$1.arch();
	const toolPath = path$1.join(_getCacheDirectory(), toolName);
	if (fs$1.existsSync(toolPath)) {
		const children = fs$1.readdirSync(toolPath);
		for (const child of children) if (isExplicitVersion(child)) {
			const fullPath = path$1.join(toolPath, child, arch || "");
			if (fs$1.existsSync(fullPath) && fs$1.existsSync(`${fullPath}.complete`)) versions.push(child);
		}
	}
	return versions;
}
function _createExtractFolder(dest) {
	return __awaiter(this, void 0, void 0, function* () {
		if (!dest) dest = path$1.join(_getTempDirectory(), crypto$1.randomUUID());
		yield mkdirP(dest);
		return dest;
	});
}
function _createToolPath(tool, version, arch) {
	return __awaiter(this, void 0, void 0, function* () {
		const folderPath = path$1.join(_getCacheDirectory(), tool, import_semver.clean(version) || version, arch || "");
		debug(`destination ${folderPath}`);
		const markerPath = `${folderPath}.complete`;
		yield rmRF(folderPath);
		yield rmRF(markerPath);
		yield mkdirP(folderPath);
		return folderPath;
	});
}
function _completeToolPath(tool, version, arch) {
	const markerPath = `${path$1.join(_getCacheDirectory(), tool, import_semver.clean(version) || version, arch || "")}.complete`;
	fs$1.writeFileSync(markerPath, "");
	debug("finished caching tool");
}
/**
* Check if version string is explicit
*
* @param versionSpec      version string to check
*/
function isExplicitVersion(versionSpec) {
	const c = import_semver.clean(versionSpec) || "";
	debug(`isExplicit: ${c}`);
	const valid = import_semver.valid(c) != null;
	debug(`explicit? ${valid}`);
	return valid;
}
/**
* Get the highest satisfiying semantic version in `versions` which satisfies `versionSpec`
*
* @param versions        array of versions to evaluate
* @param versionSpec     semantic version spec to satisfy
*/
function evaluateVersions(versions, versionSpec) {
	let version = "";
	debug(`evaluating ${versions.length} versions`);
	versions = versions.sort((a, b) => {
		if (import_semver.gt(a, b)) return 1;
		return -1;
	});
	for (let i = versions.length - 1; i >= 0; i--) {
		const potential = versions[i];
		if (import_semver.satisfies(potential, versionSpec)) {
			version = potential;
			break;
		}
	}
	if (version) debug(`matched: ${version}`);
	else debug("match not found");
	return version;
}
/**
* Gets RUNNER_TOOL_CACHE
*/
function _getCacheDirectory() {
	const cacheDirectory = process.env["RUNNER_TOOL_CACHE"] || "";
	ok(cacheDirectory, "Expected RUNNER_TOOL_CACHE to be defined");
	return cacheDirectory;
}
/**
* Gets RUNNER_TEMP
*/
function _getTempDirectory() {
	const tempDirectory = process.env["RUNNER_TEMP"] || "";
	ok(tempDirectory, "Expected RUNNER_TEMP to be defined");
	return tempDirectory;
}
// node_modules/@tabnas/parser/dist/types.js
var require_types = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.asTin = exports.MAX_RULE_HISTORY = exports.STRING = exports.SKIP = exports.INSPECT = exports.EMPTY = exports.AFTER = exports.BEFORE = exports.CLOSE = exports.OPEN = void 0;
	exports.OPEN = "o";
	exports.CLOSE = "c";
	exports.BEFORE = "b";
	exports.AFTER = "a";
	exports.EMPTY = "";
	exports.INSPECT = Symbol.for("nodejs.util.inspect.custom");
	exports.SKIP = Symbol.for("tabnas.SKIP");
	exports.STRING = "string";
	exports.MAX_RULE_HISTORY = 16;
	const asTin = (n) => n;
	exports.asTin = asTin;
}));
// node_modules/@tabnas/parser/dist/error.js
var require_error = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.TabnasError = void 0;
	exports.errdesc = errdesc;
	exports.errexcerpt = errexcerpt;
	exports.errinject = errinject;
	exports.errsite = errsite;
	exports.errmsg = errmsg;
	exports.trimstk = trimstk;
	exports.strinject = strinject;
	exports.prop = prop;
	const types_1 = require_types();
	const utility_1 = require_utility();
	const S = {
		function: "function",
		object: "object",
		string: "string",
		unexpected: "unexpected",
		Object: "Object",
		Array: "Array",
		gap: "  ",
		no_re_flags: types_1.EMPTY
	};
	function errexcerpt(ctx) {
		try {
			const lex = ctx?.lex;
			if (null != lex && true === lex.windowed && S.function === typeof lex.excerpt) return lex.excerpt();
			const src = S.function === typeof ctx?.src ? ctx.src() : void 0;
			return types_1.STRING === typeof src ? {
				text: src,
				row: 1,
				col: 1,
				off: 0
			} : void 0;
		} catch (e) {
			return;
		}
	}
	var TabnasError = class extends SyntaxError {
		constructor(code, details, token, rule, ctx) {
			details = (0, utility_1.deep)({}, details);
			const excerpt = errexcerpt(ctx);
			let desc = errdesc(code, details, token, rule, ctx, excerpt);
			super(desc.message);
			(0, utility_1.assign)(this, desc);
			Object.defineProperty(this, "internal", {
				value: {
					token,
					rule,
					ctx,
					excerpt
				},
				enumerable: false
			});
			try {
				const errs = ctx?.errs;
				if (Array.isArray(errs)) errs.push(this);
			} catch (e) {}
		}
		toJSON() {
			const out = {
				status: "failure",
				code: types_1.STRING === typeof this.code ? this.code : "unknown",
				message: types_1.EMPTY,
				hint: types_1.EMPTY,
				row: 1,
				col: 1,
				pos: 0,
				len: 0,
				rule: types_1.EMPTY,
				ruleStack: [],
				token: {
					name: types_1.EMPTY,
					src: types_1.EMPTY
				},
				expected: [],
				src: types_1.EMPTY,
				plugins: [],
				version: types_1.EMPTY
			};
			try {
				const txts = S.function === typeof this.txts ? this.txts() : void 0;
				if (txts && "string" === typeof txts.msg) out.message = txts.msg;
				if (txts && "string" === typeof txts.hint) out.hint = txts.hint.split("\n").map((s) => S.gap === s.substring(0, 2) ? s.substring(2) : s).join("\n").trim();
			} catch (e) {}
			try {
				const internal = this.internal;
				const token = internal?.token;
				const ctx = internal?.ctx;
				if (null != token) {
					out.row = 1 <= token.rI ? token.rI : 1;
					out.col = 1 <= token.cI ? token.cI : 1;
					out.pos = 0 <= token.sI ? token.sI : 0;
					const tsrc = types_1.STRING === typeof token.src ? token.src : types_1.EMPTY;
					out.len = Array.from(tsrc).length;
					out.token = {
						name: types_1.STRING === typeof token.name ? token.name : types_1.EMPTY,
						src: tsrc
					};
				}
				const named = (r) => null != r && r !== ctx?.NORULE && types_1.STRING === typeof r.name && types_1.EMPTY !== r.name;
				let failing = internal?.rule;
				if (!named(failing)) failing = ctx?.rule;
				if (!named(failing)) failing = void 0;
				if (null != failing) out.rule = failing.name;
				const stack = [];
				if (null != ctx && Array.isArray(ctx.rs) && "number" === typeof ctx.rsI) {
					for (const r of ctx.rs.slice(0, Math.max(0, ctx.rsI))) if (named(r)) stack.push(r.name);
				}
				if (null != failing) stack.push(failing.name);
				out.ruleStack = stack;
				const tcol = failing?.spec?.def?.tcol;
				if (null != tcol && null != ctx?.cfg) {
					const tins = tcol[types_1.OPEN === failing.state ? 0 : 1]?.[0] ?? [];
					out.expected = [...new Set(tins.map((tin) => "" + (0, utility_1.tokenize)(tin, ctx.cfg)))].sort();
				}
				const ex = internal?.excerpt ?? errexcerpt(ctx);
				if (void 0 !== ex && types_1.STRING === typeof ex.text) {
					const at = out.row - ex.row;
					const line = 0 <= at ? ex.text.split("\n")[at] : void 0;
					if (void 0 !== line) out.src = line.endsWith("\r") ? line.substring(0, line.length - 1) : line;
				}
				if (S.function === typeof ctx?.plgn) out.plugins = ctx.plgn().map((p) => "" + p?.name);
			} catch (e) {}
			try {
				out.version = require_tabnas().VERSION;
			} catch (e) {}
			return out;
		}
	};
	exports.TabnasError = TabnasError;
	function errinject(s, code, details, token, rule, ctx) {
		return strinject(s, {
			...ctx || {},
			...ctx.cfg || {},
			...ctx.opts || {},
			...token || {},
			...null == token ? {} : { src: token.src },
			...rule || {},
			...ctx.meta || {},
			...details || {},
			code,
			details,
			token,
			rule,
			ctx
		}, { indent: "  " });
	}
	function trimstk(err) {
		if (err.stack) err.stack = err.stack.split("\n").filter((s) => !s.includes("tabnas/tabnas")).map((s) => s.replace(/    at /, "at ")).join("\n");
	}
	function errsite(spec) {
		let { src, sub, msg, cline, row, col, pos, first } = spec;
		row = null != row && 0 < row ? row : 1;
		col = null != col && 0 < col ? col : 1;
		const tint = cline ? cline : types_1.EMPTY;
		const untint = cline ? "\x1B[0m" : types_1.EMPTY;
		pos = void 0 !== first ? Math.max(0, null == pos ? 0 : pos) : null != pos && 0 < pos ? pos : null == src ? 0 : src.split("\n").reduce((pos, line, i) => (pos += i < row - 1 ? line.length + 1 : i === row - 1 ? col : 0, pos), 0);
		let tsrc = null == sub ? types_1.EMPTY : sub;
		let behind = src.substring(Math.max(0, pos - 333), pos).split("\n");
		let ahead = src.substring(pos, pos + 333).split("\n");
		let blen = behind.length;
		let pad = 2 + (types_1.EMPTY + (row + 2)).length;
		let rc = void 0 === first ? row < 3 ? 1 : row - 2 : row - Math.min(2, blen - 1);
		let caret = void 0 === first ? col - 1 : behind[blen - 1].length;
		let ln = (s) => tint + (types_1.EMPTY + rc++).padStart(pad, " ") + " | " + untint + (null == s ? types_1.EMPTY : s);
		return [
			2 < blen ? ln(behind[blen - 3]) : null,
			1 < blen ? ln(behind[blen - 2]) : null,
			ln(behind[blen - 1] + ahead[0]),
			" ".repeat(pad) + "   " + " ".repeat(caret) + tint + "^".repeat(tsrc.length || 1) + " " + msg + untint,
			ln(ahead[1]),
			ln(ahead[2])
		].filter((line) => null != line).join("\n");
	}
	function errmsg(spec) {
		const color = {
			active: false,
			reset: "",
			hi: "",
			lo: "",
			line: ""
		};
		if (spec.color && spec.color.active) Object.assign(color, spec.color);
		const txts = {
			msg: null,
			hint: null,
			site: null,
			...spec.txts || {}
		};
		return [
			null == spec.prefix ? null : "function" === typeof spec.prefix ? spec.prefix(color, spec) : "" + spec.prefix,
			(null == spec.code ? "" : color.hi + "[" + (null == spec.name ? "" : spec.name + "/") + spec.code + "]:") + color.reset + " " + (null == txts.msg ? "" : txts.msg),
			null != spec.row && null != spec.col || null != spec.file ? "  " + color.line + "-->" + color.reset + " " + (null == spec.file ? "<no-file>" : spec.file) + (null == spec.row || null == spec.col ? "" : ":" + spec.row + ":" + spec.col) : null,
			null == spec.src ? "" : null == txts.site ? "" : errsite({
				src: spec.src,
				sub: spec.sub,
				msg: spec.smsg || spec.txts?.msg,
				cline: color.line,
				row: spec.row,
				col: spec.col,
				pos: spec.pos,
				first: spec.first
			}),
			"",
			null == txts.hint ? "" : txts.hint,
			null == spec.suffix ? null : "function" === typeof spec.suffix ? spec.suffix(color, spec) : "" + spec.suffix
		].filter((n) => null != n).join("\n");
	}
	function errdesc(code, details, token, rule, ctx, excerpt) {
		try {
			const ex = void 0 === excerpt ? errexcerpt(ctx) : excerpt;
			const src = void 0 === ex ? ctx.src() : ex.text;
			const off = void 0 === ex ? 0 : ex.off;
			const first = void 0 !== ex && 0 < ex.off ? {
				row: ex.row,
				col: ex.col
			} : void 0;
			const cfg = ctx.cfg;
			const meta = ctx.meta;
			const txts = errinject({
				msg: cfg.error[code] || details?.use?.err && (details.use.err.code || details.use.err.message) || cfg.error.unknown,
				hint: (cfg.hint[code] || details.use?.err?.message || cfg.hint.unknown || "").trim().split("\n").map((s) => "  " + s).join("\n"),
				site: ""
			}, code, details, token, rule, ctx);
			txts.site = errsite({
				src,
				msg: txts.msg,
				cline: cfg.color.active ? cfg.color.line : "",
				row: token.rI,
				col: token.cI,
				pos: token.sI - off,
				sub: token.src,
				first
			});
			const suffix = true === cfg.errmsg.suffix ? (color) => [
				"",
				...cfg.errmsg.link ? ["  " + color.lo + cfg.errmsg.link + color.reset] : [],
				"  " + color.lo + "--internal: tag=" + (ctx.opts.tag || "") + "; rule=" + rule.name + "~" + rule.state + "; token=" + (0, utility_1.tokenize)(token.tin, ctx.cfg) + (null == token.why ? "" : "~" + token.why) + "; plugins=" + ctx.plgn().map((p) => p.name).join(",") + "--" + color.reset
			].join("\n") : "string" === typeof cfg.errmsg.suffix || "function" === typeof cfg.errmsg.suffix ? cfg.errmsg.suffix : void 0;
			let message = errmsg({
				code,
				name: cfg.errmsg.name,
				txts,
				src,
				file: meta ? meta.fileName : void 0,
				row: token.rI,
				col: token.cI,
				pos: token.sI - off,
				sub: token.src,
				first,
				color: cfg.color,
				suffix
			});
			let desc = { internal: {
				token,
				ctx
			} };
			desc = {
				...Object.create(desc),
				message,
				code,
				details,
				meta,
				fileName: meta ? meta.fileName : void 0,
				lineNumber: token.rI,
				columnNumber: token.cI,
				txts: () => txts
			};
			return desc;
		} catch (e) {
			console.log(e);
			return {};
		}
	}
	function strinject(s, m, f) {
		let st = typeof s;
		let t = Array.isArray(s) ? "array" : null == s ? "string" : "object" === st ? st : "string";
		let so = "object" === t ? s : "array" === t ? s.reduce((a, n, i) => (a[i] = n, a), {}) : { _: s };
		let mo = null == m ? {} : m;
		Object.entries(so).map((n) => so[n[0]] = null == n[1] ? "" : ("" + n[1]).replace(/\{([\w_0-9.]+)}/g, (match, keypath) => {
			let inject = prop(mo, keypath);
			inject = void 0 === inject ? match : inject;
			if ("object" === typeof inject) {
				let cn = inject?.constructor?.name;
				if ("Object" === cn || "Array" === cn) inject = JSON.stringify(inject).replace(/([^"])"/g, "$1");
				else inject = inject.toString();
			} else inject = "" + inject;
			if (f) {
				if ("string" === typeof f.indent) inject = inject.replace(/\n/g, "\n" + f.indent);
			}
			return inject;
		}));
		return "string" === t ? so._ : "array" === t ? Object.values(so) : so;
	}
	function prop(obj, path, val) {
		let root = obj;
		try {
			let parts = path.split(".");
			let pn;
			for (let pI = 0; pI < parts.length; pI++) {
				pn = parts[pI];
				if ("__proto__" === pn) throw new Error(pn);
				if (pI < parts.length - 1) obj = obj[pn] = obj[pn] || {};
			}
			if (void 0 !== val) {
				if ("__proto__" === pn) throw new Error(pn);
				obj[pn] = val;
			}
			return obj[pn];
		} catch (e) {
			throw new Error("Cannot " + (void 0 === val ? "get" : "set") + " path " + path + " on object: " + str(root) + (void 0 === val ? "" : " to value: " + str(val, 22)));
		}
	}
	function str(o, len = 44) {
		let s;
		try {
			s = "object" === typeof o ? JSON.stringify(o) : "" + o;
		} catch (e) {
			s = "" + o;
		}
		return snip(len < s.length ? s.substring(0, len - 3) + "..." : s, len);
	}
	function snip(s, len = 5) {
		return void 0 === s ? "" : ("" + s).substring(0, len).replace(/[\r\n\t]/g, ".");
	}
}));
// node_modules/@tabnas/parser/dist/lexer.js
var require_lexer = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.NOT_UTF8 = exports.WINDOW_SIZES = exports.SourceWindow = exports.STATE_MASK = exports.STOP = exports.CI_RESET = exports.IS_ROW = exports.CONSUME = exports.makeTextMatcher = exports.makeNumberMatcher = exports.makeCommentMatcher = exports.makeStringMatcher = exports.makeLineMatcher = exports.makeSpaceMatcher = exports.makeFixedMatcher = exports.makeMatchMatcher = exports.makeToken = exports.makePoint = exports.makeLex = exports.makeNoToken = exports.Token = exports.Point = exports.Lex = void 0;
	exports.guardedMatcher = guardedMatcher;
	exports.scan = scan;
	exports.buildCharRunSpec = buildCharRunSpec;
	exports.buildLineRunSpec = buildLineRunSpec;
	exports.buildStringBodySpec = buildStringBodySpec;
	exports.utf8Prefix = utf8Prefix;
	exports.readWhole = readWhole;
	const types_1 = require_types();
	const utility_1 = require_utility();
	const error_1 = require_error();
	var Point = class {
		constructor(len, sI, rI, cI) {
			this.len = -1;
			this.sI = 0;
			this.rI = 1;
			this.cI = 1;
			this.token = [];
			this.len = len;
			if (null != sI) this.sI = sI;
			if (null != rI) this.rI = rI;
			if (null != cI) this.cI = cI;
		}
		toString() {
			return "Point[" + [
				this.sI + "/" + this.len,
				this.rI,
				this.cI
			] + (0 < this.token.length ? " " + this.token : "") + "]";
		}
		[types_1.INSPECT]() {
			return this.toString();
		}
	};
	exports.Point = Point;
	const makePoint = (...params) => new Point(...params);
	exports.makePoint = makePoint;
	const STRING_TYPE = "string";
	let settleToken;
	function ownText(s) {
		return 0 === s.length ? s : (" " + s).slice(1);
	}
	var Token = class {
		#src;
		#ref;
		constructor(name, tin, val, src, pnt, use, why, ref, len) {
			this.isToken = true;
			this.name = types_1.EMPTY;
			this.tin = -1;
			this.val = void 0;
			this.sI = -1;
			this.rI = -1;
			this.cI = -1;
			this.len = -1;
			this.name = name;
			this.tin = tin;
			this.#src = src;
			this.#ref = ref;
			this.val = val;
			this.sI = pnt.sI;
			this.rI = pnt.rI;
			this.cI = pnt.cI;
			this.use = use;
			this.why = why;
			this.len = null != len ? len : null == src ? 0 : src.length;
		}
		get src() {
			let s = this.#src;
			if (void 0 === s) {
				const ref = this.#ref;
				s = this.#src = void 0 === ref ? types_1.EMPTY : ref.substring(this.sI, this.sI + this.len);
			}
			return s;
		}
		set src(s) {
			this.#src = s;
		}
		resolveVal(rule, ctx) {
			return "function" === typeof this.val ? this.val(rule, ctx) : this.val;
		}
		bad(err, details) {
			this.err = err;
			if (null != details) this.use = (0, utility_1.deep)(this.use || {}, details);
			return this;
		}
		static {
			settleToken = (tkn, base) => {
				const src = tkn.src;
				const own = ownText(src);
				tkn.#src = own;
				tkn.#ref = void 0;
				const val = tkn.val;
				if (val === src) tkn.val = own;
				else if (STRING_TYPE === typeof val) tkn.val = ownText(val);
				tkn.sI += base;
			};
		}
		toString() {
			return "Token[" + this.name + "=" + this.tin + " " + (0, utility_1.snip)(this.src) + (void 0 === this.val || "#ST" === this.name || "#TX" === this.name ? "" : "=" + (0, utility_1.snip)(this.val)) + " " + [
				this.sI,
				this.rI,
				this.cI
			] + (null == this.use ? "" : " " + (0, utility_1.snip)("" + JSON.stringify(this.use).replace(/"/g, ""), 22)) + (null == this.err ? "" : " " + this.err) + (null == this.why ? "" : " " + (0, utility_1.snip)("" + this.why, 22)) + "]";
		}
		[types_1.INSPECT]() {
			return this.toString();
		}
	};
	exports.Token = Token;
	const makeToken = (...params) => new Token(...params);
	exports.makeToken = makeToken;
	const makeNoToken = () => makeToken("", -1, void 0, types_1.EMPTY, makePoint(-1));
	exports.makeNoToken = makeNoToken;
	exports.WINDOW_SIZES = Object.freeze({
		margin: 65536,
		block: 65536,
		chunk: 65536
	});
	const NOT_UTF8 = "stream did not contain valid UTF-8";
	exports.NOT_UTF8 = NOT_UTF8;
	function readFailure(err) {
		return null != err && STRING_TYPE === typeof err.message ? err.message : String(err);
	}
	function readCount(n, len) {
		return "the reader read " + String(n) + " bytes into " + len;
	}
	function utf8Prefix(b, n, ended, scratch) {
		scratch.bad = false;
		let i = 0;
		while (i < n) {
			const c = b[i];
			if (c < 128) {
				i++;
				continue;
			}
			let need = 0;
			let lo = 128;
			let hi = 191;
			if (194 <= c && c <= 223) need = 1;
			else if (224 === c) {
				need = 2;
				lo = 160;
			} else if (225 <= c && c <= 236 || 238 === c || 239 === c) need = 2;
			else if (237 === c) {
				need = 2;
				hi = 159;
			} else if (240 === c) {
				need = 3;
				lo = 144;
			} else if (241 <= c && c <= 243) need = 3;
			else if (244 === c) {
				need = 3;
				hi = 143;
			} else {
				scratch.bad = true;
				return i;
			}
			for (let k = 1; k <= need; k++) {
				if (n <= i + k) {
					scratch.bad = ended;
					return i;
				}
				const d = b[i + k];
				if (1 === k ? d < lo || hi < d : d < 128 || 191 < d) {
					scratch.bad = true;
					return i;
				}
			}
			i += need + 1;
		}
		return n;
	}
	function positionAfter(text) {
		let row = 1;
		for (let i = text.indexOf("\n"); -1 !== i; i = text.indexOf("\n", i + 1)) row++;
		return {
			pos: text.length,
			row,
			col: text.length - text.lastIndexOf("\n")
		};
	}
	function readWhole(reader, chunk) {
		const buffer = new Uint8Array(Math.max(1, chunk | 0));
		const parts = [];
		let total = 0;
		let failed = void 0;
		for (;;) {
			let n;
			try {
				n = reader.read(buffer);
			} catch (err) {
				failed = readFailure(err);
				break;
			}
			if (!(Number.isInteger(n) && 0 <= n && n <= buffer.length)) {
				failed = readCount(n, buffer.length);
				break;
			}
			if (0 === n) break;
			parts.push(buffer.slice(0, n));
			total += n;
		}
		const bytes = new Uint8Array(total);
		let at = 0;
		for (const part of parts) {
			bytes.set(part, at);
			at += part.length;
		}
		const scratch = { bad: false };
		const valid = utf8Prefix(bytes, total, true, scratch);
		const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes.subarray(0, valid));
		const reason = void 0 !== failed ? failed : scratch.bad ? NOT_UTF8 : void 0;
		if (void 0 === reason) return { text };
		return {
			text,
			failure: {
				reason,
				...positionAfter(text)
			}
		};
	}
	function oldestHeld(tokens, keep, floor, notoken) {
		if (null == tokens) return keep;
		for (let i = 0; i < tokens.length && floor <= keep; i++) {
			const t = tokens[i];
			if (null != t && notoken !== t && 0 <= t.tin && 0 <= t.sI && t.sI < keep) keep = t.sI;
		}
		return keep;
	}
	var SourceWindow = class {
		#decoder;
		#scratch;
		constructor(reader, sizes) {
			this.text = types_1.EMPTY;
			this.low = 0;
			this.lowRow = 1;
			this.lowCol = 1;
			this.readRow = 1;
			this.readCol = 1;
			this.exhausted = false;
			this.#scratch = { bad: false };
			this.reader = reader;
			this.margin = Math.max(1, sizes.margin | 0);
			this.block = Math.max(1, sizes.block | 0);
			this.buffer = new Uint8Array(Math.max(1, sizes.chunk | 0));
			this.#decoder = new TextDecoder("utf-8", { ignoreBOM: true });
		}
		get end() {
			return this.low + this.text.length;
		}
		read() {
			const buffer = this.buffer;
			let n;
			try {
				n = this.reader.read(buffer);
			} catch (err) {
				this.fail(readFailure(err));
				return;
			}
			if (!(Number.isInteger(n) && 0 <= n && n <= buffer.length)) {
				this.fail(readCount(n, buffer.length));
				return;
			}
			if (0 === n) this.exhausted = true;
			let bytes = buffer;
			let len = n;
			const pending = this.pending;
			if (void 0 !== pending) {
				bytes = new Uint8Array(pending.length + n);
				bytes.set(pending);
				bytes.set(buffer.subarray(0, n), pending.length);
				len = bytes.length;
				this.pending = void 0;
			}
			const scratch = this.#scratch;
			const valid = utf8Prefix(bytes, len, this.exhausted, scratch);
			if (0 < valid) this.append(this.#decoder.decode(bytes.subarray(0, valid)));
			if (scratch.bad) this.fail(NOT_UTF8);
			else if (valid < len) this.pending = bytes.slice(valid, len);
		}
		append(s) {
			const last = s.lastIndexOf("\n");
			if (-1 === last) this.readCol += s.length;
			else {
				let rows = 0;
				for (let i = s.indexOf("\n"); -1 !== i; i = s.indexOf("\n", i + 1)) rows++;
				this.readRow += rows;
				this.readCol = s.length - last;
			}
			this.text += s;
		}
		fail(reason) {
			this.exhausted = true;
			if (void 0 === this.failure) this.failure = {
				reason,
				pos: this.end,
				row: this.readRow,
				col: this.readCol
			};
		}
		drop(keep) {
			const n = keep - this.low;
			if (n <= 0) return;
			const text = this.text;
			const last = text.lastIndexOf("\n", n - 1);
			if (-1 === last) this.lowCol += n;
			else {
				let rows = 0;
				for (let i = text.indexOf("\n"); -1 !== i && i < n; i = text.indexOf("\n", i + 1)) rows++;
				this.lowRow += rows;
				this.lowCol = n - last;
			}
			this.text = text.substring(n);
			this.low = keep;
		}
	};
	exports.SourceWindow = SourceWindow;
	function guardedMatcher(mcfg, body) {
		return function guarded(lex, rule, tI) {
			if (!mcfg.lex) return void 0;
			if (mcfg.check) {
				lex.refwd();
				const r = mcfg.check(lex);
				if (r && r.done) return r.token;
			}
			return body(lex, rule, tI);
		};
	}
	const CONSUME = 65536;
	exports.CONSUME = CONSUME;
	const IS_ROW = 1 << 17;
	exports.IS_ROW = IS_ROW;
	const CI_RESET = 1 << 18;
	exports.CI_RESET = CI_RESET;
	const STOP = 1 << 19;
	exports.STOP = STOP;
	const STATE_MASK = 65535;
	exports.STATE_MASK = STATE_MASK;
	function scan(src, startSI, startRI, startCI, spec, out) {
		let sI = startSI;
		let rI = startRI;
		let cI = startCI;
		const len = src.length;
		const ncls = spec.nclasses;
		const classOf = spec.classOf;
		const table = spec.table;
		let state = spec.initialState;
		while (sI < len) {
			const cc = src.charCodeAt(sI);
			const cls = cc < 256 ? classOf[cc] : spec.fallback(src[sI]);
			const action = table[state * ncls + cls];
			if (action & CONSUME) {
				sI++;
				if (action & IS_ROW) {
					rI++;
					cI = 1;
				} else if (action & CI_RESET) cI = 1;
				else cI++;
			}
			state = action & STATE_MASK;
			if (action & STOP) break;
		}
		out.sI = sI;
		out.rI = rI;
		out.cI = cI;
		return startSI < sI;
	}
	function buildLineRunSpec(cfgLine) {
		const classOf = /* @__PURE__ */ new Uint8Array(256);
		for (let cc = 0; cc < 256; cc++) if (cfgLine.charsBitmap[cc]) classOf[cc] = cfgLine.rowCharsBitmap[cc] ? 2 : 1;
		const lineChars = cfgLine.chars;
		const rowChars = cfgLine.rowChars;
		const fallback = (c) => {
			if (lineChars[c]) return rowChars[c] ? 2 : 1;
			return 0;
		};
		return {
			initialState: 0,
			nclasses: 3,
			classOf,
			fallback,
			table: LINE_RUN_TABLE
		};
	}
	const LINE_RUN_TABLE = new Int32Array([
		STOP,
		CONSUME,
		196608
	]);
	function buildCharRunSpec(charsBitmap, chars) {
		const fallback = (c) => chars[c] ? 1 : 0;
		return {
			initialState: 0,
			nclasses: 2,
			classOf: charsBitmap,
			fallback,
			table: CHAR_RUN_TABLE
		};
	}
	const CHAR_RUN_TABLE = new Int32Array([STOP, CONSUME]);
	function buildStringBodySpec(cfg, qchar) {
		const qcc = qchar.charCodeAt(0);
		const escCharCode = cfg.string.escCharCode;
		const replaceCodeMap = cfg.string.replaceCodeMap;
		const hasReplace = cfg.string.hasReplace;
		const isMultiLine = !!cfg.string.multiBitmap[qcc];
		const allowControl = cfg.string.allowControl;
		const lineBM = cfg.line.charsBitmap;
		const rowBM = cfg.line.rowCharsBitmap;
		const classOf = /* @__PURE__ */ new Uint8Array(256);
		for (let cc = 0; cc < 256; cc++) if (cc === qcc) classOf[cc] = 1;
		else if (cc === escCharCode) classOf[cc] = 1;
		else if (hasReplace && replaceCodeMap[cc] !== void 0) classOf[cc] = 1;
		else if (isMultiLine && lineBM[cc]) classOf[cc] = rowBM[cc] ? 3 : 2;
		else if (cc < 32) {
			if (allowControl && !lineBM[cc]) classOf[cc] = 0;
			else classOf[cc] = 1;
		}
		const lineChars = cfg.line.chars;
		const rowChars = cfg.line.rowChars;
		const fallback = (c) => {
			const cc = c.charCodeAt(0);
			if (c === qchar) return 1;
			if (cc === escCharCode) return 1;
			if (hasReplace && replaceCodeMap[cc] !== void 0) return 1;
			if (isMultiLine && lineChars[c]) return rowChars[c] ? 3 : 2;
			return 0;
		};
		return {
			initialState: 0,
			nclasses: 4,
			classOf,
			fallback,
			table: STRING_BODY_TABLE
		};
	}
	const STRING_BODY_TABLE = new Int32Array([
		CONSUME,
		STOP,
		327680,
		196608
	]);
	let makeFixedMatcher = (cfg, _opts) => {
		const table = new Array(256);
		const wide = [];
		const byLenDesc = (a, b) => b.len - a.len || (a.src < b.src ? -1 : a.src > b.src ? 1 : 0);
		for (const fsrc of (0, utility_1.keys)(cfg.fixed.token)) {
			const tin = cfg.fixed.token[fsrc];
			if (null == tin || 0 === fsrc.length) continue;
			const cand = {
				src: fsrc,
				len: fsrc.length,
				tin
			};
			const cc = fsrc.charCodeAt(0);
			if (cc < 256) (table[cc] = table[cc] || []).push(cand);
			else wide.push(cand);
		}
		for (const cands of table) if (cands) cands.sort(byLenDesc);
		wide.sort(byLenDesc);
		return guardedMatcher(cfg.fixed, function fixedBody(lex) {
			const pnt = lex.pnt;
			const src = lex.src;
			const cc = src.charCodeAt(pnt.sI);
			const cands = cc < 256 ? table[cc] : wide;
			if (void 0 === cands) return void 0;
			const want = lex.want;
			for (const cand of cands) {
				if (null != want && !want.includes(cand.tin)) continue;
				if (src.length < pnt.sI + cand.len) lex.touchEnd();
				if (1 === cand.len && cc < 256 || src.startsWith(cand.src, pnt.sI)) {
					const tkn = lex.token(cand.tin, void 0, cand.src, pnt);
					pnt.sI += cand.len;
					pnt.cI += cand.len;
					return tkn;
				}
			}
		});
	};
	exports.makeFixedMatcher = makeFixedMatcher;
	let makeMatchMatcher = (cfg, _opts) => {
		let valueMatchers = (0, utility_1.entries)(cfg.match.value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, spec]) => spec);
		let tokenMatchers = (0, utility_1.values)(cfg.match.token).sort((a, b) => (a.tin$ || 0) - (b.tin$ || 0));
		if (0 === valueMatchers.length && 0 === tokenMatchers.length) return null;
		return guardedMatcher(cfg.match, function matchBody(lex, rule, tI = 0) {
			let pnt = lex.pnt;
			let fwd = lex.refwd();
			const rspec = null == rule ? void 0 : rule.spec;
			const gated = null != rspec;
			let oc = gated && "o" === rule.state ? 0 : 1;
			const want = lex.want;
			if (null == want) for (let valueMatcher of valueMatchers) if (valueMatcher.match instanceof RegExp) {
				let m = fwd.match(valueMatcher.match);
				if (m) {
					let msrc = m[0];
					let mlen = msrc.length;
					if (0 < mlen) {
						let tkn = void 0;
						let val = valueMatcher.val ? valueMatcher.val(m) : msrc;
						tkn = lex.token("#VL", val, msrc, pnt);
						pnt.sI += mlen;
						pnt.cI += mlen;
						return tkn;
					}
				}
			} else {
				let tkn = valueMatcher.match(lex, rule);
				if (null != tkn) return tkn;
			}
			const col = null == want && gated ? rspec.def.tcol[oc][tI] : void 0;
			let fixLen = -1;
			const expectedFixedLen = () => {
				if (-1 !== fixLen) return fixLen;
				fixLen = 0;
				if (!cfg.fixed.lex || null == col || 0 === col.length) return fixLen;
				const src = lex.src;
				const sI = pnt.sI;
				const ftoken = cfg.fixed.token;
				for (const fsrc of (0, utility_1.keys)(ftoken)) {
					const ftin = ftoken[fsrc];
					if (null != ftin && fsrc.length > fixLen && col.includes(ftin)) {
						if (src.length < sI + fsrc.length) lex.touchEnd();
						if (src.startsWith(fsrc, sI)) fixLen = fsrc.length;
					}
				}
				return fixLen;
			};
			for (let pass = 0; pass < 2; pass++) {
				for (let tokenMatcher of tokenMatchers) {
					const tin = tokenMatcher.tin$;
					if (null != want) {
						if (!tin || !want.includes(tin)) continue;
					} else {
						const expected = !tin || !gated || null != col && col.includes(tin);
						if (0 === pass ? !expected : expected || !tokenMatcher.eager$) continue;
					}
					if (tokenMatcher instanceof RegExp) {
						let m = fwd.match(tokenMatcher);
						if (m) {
							let msrc = m[0];
							let mlen = msrc.length;
							if (1 === pass && mlen <= expectedFixedLen()) continue;
							if (0 < mlen) {
								let tkn = void 0;
								tkn = lex.token(tin, msrc, msrc, pnt);
								pnt.sI += mlen;
								pnt.cI += mlen;
								return tkn;
							}
						}
					} else {
						let tkn = tokenMatcher(lex, rule);
						if (null != tkn) return tkn;
					}
				}
				if (null != want) break;
			}
		});
	};
	exports.makeMatchMatcher = makeMatchMatcher;
	let makeCommentMatcher = (cfg, opts) => {
		let oc = opts.comment;
		cfg.comment = {
			lex: oc ? !!oc.lex : false,
			def: (oc?.def ? (0, utility_1.entries)(oc.def) : []).reduce((def, [name, om]) => {
				if (null == om || false === om) return def;
				let { suffixes, suffixFn } = normalizeCommentSuffix(om.suffix);
				def[name] = {
					name,
					start: om.start,
					end: om.end,
					line: !!om.line,
					lex: !!om.lex,
					eatline: !!om.eatline,
					suffixes,
					suffixFn
				};
				return def;
			}, {}),
			check: oc?.check
		};
		let byStartLenDesc = (a, b) => b.start.length - a.start.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
		let lineComments = cfg.comment.lex ? (0, utility_1.values)(cfg.comment.def).filter((c) => c.lex && c.line).sort(byStartLenDesc) : [];
		let blockComments = cfg.comment.lex ? (0, utility_1.values)(cfg.comment.def).filter((c) => c.lex && !c.line).sort(byStartLenDesc) : [];
		const lineRunSpec = buildLineRunSpec(cfg.line);
		const scanOut = {
			sI: 0,
			rI: 0,
			cI: 0
		};
		return guardedMatcher(cfg.comment, function commentBody(lex) {
			let pnt = lex.pnt;
			let src = lex.src;
			let rI = pnt.rI;
			let cI = pnt.cI;
			const lineBM = cfg.line.charsBitmap;
			const rowBM = cfg.line.rowCharsBitmap;
			const lineChars = cfg.line.chars;
			const rowChars = cfg.line.rowChars;
			for (let mc of lineComments) {
				if (src.length < pnt.sI + mc.start.length) lex.touchEnd();
				if (src.startsWith(mc.start, pnt.sI)) {
					let srclen = src.length;
					let aI = pnt.sI + mc.start.length;
					cI += mc.start.length;
					let suffixLen = 0;
					let cc;
					while (aI < srclen && !((cc = src.charCodeAt(aI)) < 256 ? lineBM[cc] : lineChars[src[aI]])) {
						let n = commentSuffixMatch(src, aI, mc.suffixes, lex);
						if (n > 0) {
							suffixLen = n;
							break;
						}
						n = commentSuffixFnMatch(lex, aI, mc.suffixFn);
						if (n > 0) {
							suffixLen = n;
							break;
						}
						cI++;
						aI++;
					}
					if (srclen <= aI) lex.touchEnd();
					if (suffixLen > 0) {
						aI += suffixLen;
						cI += suffixLen;
					} else if (mc.eatline) {
						scan(src, aI, rI, cI, lineRunSpec, scanOut);
						rI = scanOut.rI;
						aI = scanOut.sI;
						if (srclen <= aI) lex.touchEnd();
					}
					let tkn = lex.token("#CM", void 0, void 0, pnt, void 0, void 0, aI - pnt.sI);
					pnt.sI = aI;
					pnt.cI = cI;
					pnt.rI = rI;
					return tkn;
				}
			}
			for (let mc of blockComments) {
				if (src.length < pnt.sI + mc.start.length) lex.touchEnd();
				if (src.startsWith(mc.start, pnt.sI)) {
					let srclen = src.length;
					let aI = pnt.sI + mc.start.length;
					let end = mc.end;
					cI += mc.start.length;
					let suffixLen = 0;
					let cc;
					while (aI < srclen && !src.startsWith(end, aI)) {
						let n = commentSuffixMatch(src, aI, mc.suffixes, lex);
						if (n > 0) {
							suffixLen = n;
							break;
						}
						n = commentSuffixFnMatch(lex, aI, mc.suffixFn);
						if (n > 0) {
							suffixLen = n;
							break;
						}
						cc = src.charCodeAt(aI);
						if (cc < 256 ? rowBM[cc] : rowChars[src[aI]]) {
							rI++;
							cI = 0;
						}
						cI++;
						aI++;
					}
					if (srclen < aI + end.length && 0 === suffixLen) lex.touchEnd();
					if (suffixLen > 0) {
						for (let k = 0; k < suffixLen; k++) {
							cc = src.charCodeAt(aI + k);
							if (cc < 256 ? rowBM[cc] : rowChars[src[aI + k]]) {
								rI++;
								cI = 0;
							}
							cI++;
						}
						let tkn = lex.token("#CM", void 0, void 0, pnt, void 0, void 0, aI + suffixLen - pnt.sI);
						pnt.sI = aI + suffixLen;
						pnt.rI = rI;
						pnt.cI = cI;
						return tkn;
					}
					if (src.startsWith(end, aI)) {
						cI += end.length;
						if (mc.eatline) {
							scan(src, aI, rI, cI, lineRunSpec, scanOut);
							rI = scanOut.rI;
							aI = scanOut.sI;
							if (srclen <= aI) lex.touchEnd();
						}
						let tkn = lex.token("#CM", void 0, void 0, pnt, void 0, void 0, aI + end.length - pnt.sI);
						pnt.sI = aI + end.length;
						pnt.rI = rI;
						pnt.cI = cI;
						return tkn;
					} else return lex.bad(utility_1.S.unterminated_comment, pnt.sI, pnt.sI + 9 * mc.start.length);
				}
			}
		});
	};
	exports.makeCommentMatcher = makeCommentMatcher;
	function normalizeCommentSuffix(raw) {
		if (null == raw) return {
			suffixes: void 0,
			suffixFn: void 0
		};
		if ("function" === typeof raw) return {
			suffixes: void 0,
			suffixFn: raw
		};
		let list = [];
		if ("string" === typeof raw) {
			if ("" !== raw) list.push(raw);
		} else if (Array.isArray(raw)) {
			for (let s of raw) if ("string" === typeof s && "" !== s) list.push(s);
		}
		if (list.length > 1) list.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
		return {
			suffixes: 0 === list.length ? void 0 : list,
			suffixFn: void 0
		};
	}
	function commentSuffixMatch(src, aI, suffixes, lex) {
		if (!suffixes || 0 === suffixes.length) return 0;
		for (let s of suffixes) {
			if (void 0 !== lex && src.length < aI + s.length) lex.touchEnd();
			if (src.startsWith(s, aI)) return s.length;
		}
		return 0;
	}
	function commentSuffixFnMatch(lex, aI, fn) {
		if (!fn) return 0;
		let pnt = lex.pnt;
		let savedSI = pnt.sI;
		let savedRI = pnt.rI;
		let savedCI = pnt.cI;
		pnt.sI = aI;
		let tkn;
		try {
			tkn = fn(lex, void 0);
		} finally {
			pnt.sI = savedSI;
			pnt.rI = savedRI;
			pnt.cI = savedCI;
		}
		if (null == tkn) return 0;
		return "string" === typeof tkn.src ? tkn.src.length : 0;
	}
	function enderReach(cfg, opts) {
		let reach = 2;
		for (const fsrc of (0, utility_1.keys)(cfg.fixed.token)) if (reach < fsrc.length) reach = fsrc.length;
		const ender = opts.ender;
		if (Array.isArray(ender)) {
			for (const e of ender) if ("string" === typeof e && reach < e.length) reach = e.length;
		}
		const defs = opts.comment?.lex ? opts.comment.def : void 0;
		if (null != defs) {
			for (const c of (0, utility_1.values)(defs)) if (c && c.lex && "string" === typeof c.start && reach < c.start.length) reach = c.start.length;
		}
		return reach;
	}
	let makeTextMatcher = (cfg, opts) => {
		let ender = (0, utility_1.regexp)(cfg.line.lex ? "y" : "ys", "(.*?)", ...cfg.rePart.ender);
		const reach = enderReach(cfg, opts);
		return function textMatcher(lex) {
			if (cfg.text.check) {
				lex.refwd();
				let check = cfg.text.check(lex);
				if (check && check.done) return check.token;
			}
			let mcfg = cfg.text;
			let pnt = lex.pnt;
			let def = cfg.value.def;
			let defre = cfg.value.defre;
			let msI = pnt.sI;
			ender.lastIndex = pnt.sI;
			let m = ender.exec(lex.src);
			if (m) {
				let msrc = m[1];
				let tsrc = m[2];
				if (lex.src.length < msI + (null == msrc ? 0 : msrc.length) + reach) lex.touchEnd();
				let out = void 0;
				if (null != msrc) {
					let mlen = msrc.length;
					if (0 < mlen) {
						let vs = void 0;
						if (cfg.value.lex) {
							if (void 0 !== (vs = def[msrc])) {
								out = lex.token("#VL", vs.val, msrc, pnt);
								pnt.sI += mlen;
								pnt.cI += mlen;
							} else for (let vspec of defre) if (vspec.match) {
								let res = vspec.match.exec(vspec.consume ? lex.refwd() : msrc);
								if (res && (vspec.consume || res[0].length === msrc.length)) {
									let remsrc = res[0];
									if (null == vspec.val) out = lex.token("#VL", remsrc, remsrc, pnt);
									else {
										let val = "function" === typeof vspec.val ? vspec.val(res) : vspec.val;
										out = lex.token("#VL", val, remsrc, pnt);
									}
									pnt.sI += remsrc.length;
									pnt.cI += remsrc.length;
								}
							}
						}
						if (null == out && mcfg.lex) {
							out = lex.token("#TX", msrc, msrc, pnt);
							pnt.sI += mlen;
							pnt.cI += mlen;
						}
					}
				}
				if (out && pnt.sI === msI + (null == msrc ? 0 : msrc.length)) out = subMatchFixed(lex, out, tsrc);
				if (out && 0 < cfg.text.modify.length) {
					const modify = cfg.text.modify;
					for (let mI = 0; mI < modify.length; mI++) out.val = modify[mI](out.val, lex, cfg, opts);
				}
				return out;
			}
		};
	};
	exports.makeTextMatcher = makeTextMatcher;
	let makeNumberMatcher = (cfg, _opts) => {
		let mcfg = cfg.number;
		let baseAlts = [
			mcfg.hex ? "[xX][0-9a-fA-F_]+" : null,
			mcfg.oct ? "[oO][0-7_]+" : null,
			mcfg.bin ? "[bB][01_]+" : null
		].filter((s) => null != s).join("|");
		let ender = (0, utility_1.regexp)("y", ("([-+]?" + ("" === baseAlts ? "\\.?[0-9](?:[0-9_]*[0-9])?(?:\\.(?:[0-9](?:[0-9_]*[0-9])?)?)?(?:[eE][-+]?[0-9](?:[0-9_]*[0-9])?)?" : "(?:0(?:" + baseAlts + ")|\\.?[0-9](?:[0-9_]*[0-9])?(?:\\.(?:[0-9](?:[0-9_]*[0-9])?)?)?(?:[eE][-+]?[0-9](?:[0-9_]*[0-9])?)?)")).replace(/_/g, mcfg.sep ? (0, utility_1.escre)(mcfg.sepChar) : ""), ")", ...cfg.rePart.ender);
		let numberSep = mcfg.sep ? (0, utility_1.regexp)("g", (0, utility_1.escre)(mcfg.sepChar)) : void 0;
		let numberish = (0, utility_1.regexp)("y", "[-+.0-9a-zA-Z" + (mcfg.sep ? (0, utility_1.escre)(mcfg.sepChar) : "") + "]*");
		const reach = enderReach(cfg, _opts);
		let numberSepChar = mcfg.sep ? mcfg.sepChar : void 0;
		return guardedMatcher(cfg.number, function numberBody(lex) {
			mcfg = cfg.number;
			let pnt = lex.pnt;
			let valdef = cfg.value.def;
			ender.lastIndex = pnt.sI;
			let m = ender.exec(lex.src);
			if (lex.windowOpen) {
				numberish.lastIndex = pnt.sI;
				numberish.test(lex.src);
				if (lex.src.length < numberish.lastIndex + reach) lex.touchEnd();
			}
			if (m) {
				let msrc = m[1];
				let tsrc = m[2];
				let out = void 0;
				let included = true;
				if (null != msrc && (included = !cfg.number.exclude || !msrc.match(cfg.number.exclude))) {
					let mlen = msrc.length;
					if (0 < mlen) {
						let vs = void 0;
						if (cfg.value.lex && void 0 !== (vs = valdef[msrc])) out = lex.token("#VL", vs.val, msrc, pnt);
						else {
							let nstr = numberSep && numberSepChar && -1 < msrc.indexOf(numberSepChar) ? msrc.replace(numberSep, "") : msrc;
							let num = +nstr;
							if (isNaN(num)) {
								let first = nstr[0];
								if ("-" === first || "+" === first) num = ("-" === first ? -1 : 1) * +nstr.substring(1);
							}
							if (!isNaN(num)) {
								out = lex.token("#NR", num, msrc, pnt);
								pnt.sI += mlen;
								pnt.cI += mlen;
							}
						}
					}
				}
				if (included && null != out) out = subMatchFixed(lex, out, tsrc);
				return out;
			}
		});
	};
	exports.makeNumberMatcher = makeNumberMatcher;
	const HEX2 = /^[0-9a-fA-F]{2}$/;
	const HEX4 = /^[0-9a-fA-F]{4}$/;
	let makeStringMatcher = (cfg, opts) => {
		let os = opts.string || {};
		cfg.string = cfg.string || {};
		cfg.string.quoteMap = (0, utility_1.charset)(os.chars);
		cfg.string.quoteBitmap = (0, utility_1.charsBitmap)(os.chars);
		cfg.string.multiChars = (0, utility_1.charset)(os.multiChars);
		cfg.string.multiBitmap = (0, utility_1.charsBitmap)(os.multiChars);
		cfg.string.escMap = { ...os.escape };
		cfg.string.replaceCodeMap = (0, utility_1.omap)((0, utility_1.clean)({ ...os.replace }), ([c, r]) => [c.charCodeAt(0), r]);
		cfg.string = (0, utility_1.deep)(cfg.string, {
			lex: !!os?.lex,
			escChar: os.escapeChar,
			escCharCode: null == os.escapeChar ? void 0 : os.escapeChar.charCodeAt(0),
			allowUnknown: !!os.allowUnknown,
			escapeStrict: !!os.escapeStrict,
			allowControl: !!os.allowControl,
			hasReplace: false,
			abandon: !!os.abandon
		});
		cfg.string.check = os.check;
		cfg.string.escMap = (0, utility_1.clean)(cfg.string.escMap);
		for (const k of (0, utility_1.keys)(cfg.string.escMap)) if ("" === cfg.string.escMap[k]) delete cfg.string.escMap[k];
		cfg.string.escBitmap = (0, utility_1.charsBitmap)(cfg.string.escMap);
		cfg.string.hasReplace = 0 < (0, utility_1.keys)(cfg.string.replaceCodeMap).length;
		const bodySpecs = /* @__PURE__ */ new Map();
		for (const qc of Object.keys(cfg.string.quoteMap)) bodySpecs.set(qc.charCodeAt(0), buildStringBodySpec(cfg, qc));
		const scanOut = {
			sI: 0,
			rI: 0,
			cI: 0
		};
		return guardedMatcher(cfg.string, function stringBody(lex) {
			const mcfg = cfg.string;
			const { quoteMap, quoteBitmap, escMap, escCharCode, multiChars, multiBitmap, allowUnknown, replaceCodeMap, hasReplace, escapeStrict } = mcfg;
			const { pnt, src } = lex;
			const startSI = pnt.sI;
			const startRI = pnt.rI;
			const srclen = src.length;
			const qcc = src.charCodeAt(startSI);
			if (!(qcc < 256 ? quoteBitmap[qcc] : quoteMap[src[startSI]])) return void 0;
			const q = src[startSI];
			qcc < 256 ? multiBitmap[qcc] : multiChars[q];
			const bodySpec = bodySpecs.get(qcc) || (() => {
				const spec = buildStringBodySpec(cfg, q);
				bodySpecs.set(qcc, spec);
				return spec;
			})();
			let sI = startSI + 1;
			let rI = startRI;
			let cI = pnt.cI + 1;
			let buf = void 0;
			while (sI < srclen) {
				const bodyStart = sI;
				scan(src, sI, rI, cI, bodySpec, scanOut);
				sI = scanOut.sI;
				rI = scanOut.rI;
				cI = scanOut.cI;
				if (void 0 !== buf && bodyStart < sI) buf.push(src.substring(bodyStart, sI));
				if (sI >= srclen) break;
				const cc = src.charCodeAt(sI);
				if (cc === qcc) {
					const val = void 0 === buf ? src.substring(startSI + 1, sI) : buf.join(types_1.EMPTY);
					sI++;
					const tkn = lex.token("#ST", val, void 0, pnt, void 0, void 0, sI - startSI);
					pnt.sI = sI;
					pnt.rI = rI;
					pnt.cI = cI + 1;
					return tkn;
				}
				if (hasReplace) {
					const rs = replaceCodeMap[cc];
					if (rs !== void 0) {
						if (void 0 === buf) buf = startSI + 1 < sI ? [src.substring(startSI + 1, sI)] : [];
						buf.push(rs);
						sI++;
						cI++;
						continue;
					}
				}
				if (cc === escCharCode) {
					if (void 0 === buf) buf = startSI + 1 < sI ? [src.substring(startSI + 1, sI)] : [];
					sI++;
					cI++;
					if (sI >= srclen) break;
					const ec = src[sI];
					const es = escMap[ec];
					if (es != null) {
						buf.push(es);
						sI++;
						cI++;
					} else if ("x" === ec && !escapeStrict) {
						sI++;
						if (srclen < sI + 2) lex.touchEnd();
						const xs = src.substring(sI, sI + 2);
						const xx = HEX2.test(xs) ? parseInt(xs, 16) : NaN;
						if (isNaN(xx)) {
							if (mcfg.abandon) return void 0;
							sI -= 2;
							cI -= 1;
							pnt.sI = sI;
							pnt.cI = cI;
							return lex.bad(utility_1.S.invalid_ascii, sI, sI + 4);
						}
						buf.push(String.fromCharCode(xx));
						sI += 2;
						cI += 3;
					} else if ("u" === ec) {
						sI++;
						if (srclen <= sI) lex.touchEnd();
						if ("{" === src[sI] && !escapeStrict) {
							const endI = src.indexOf("}", sI + 1);
							if (-1 === endI) lex.touchEnd();
							const digits = -1 === endI ? "" : src.substring(sI + 1, endI);
							const uu = 0 < digits.length && digits.length <= 6 && /^[0-9a-fA-F]+$/.test(digits) ? parseInt(digits, 16) : NaN;
							if (isNaN(uu) || 1114111 < uu) {
								if (mcfg.abandon) return void 0;
								sI = sI - 2;
								pnt.sI = sI;
								pnt.cI = cI - 1;
								return lex.bad(utility_1.S.invalid_unicode, sI, -1 === endI ? srclen : endI + 1);
							}
							buf.push(String.fromCodePoint(uu));
							cI += endI + 1 - sI + 1;
							sI = endI + 1;
						} else {
							if (srclen < sI + 4) lex.touchEnd();
							const us = src.substring(sI, sI + 4);
							const uu = HEX4.test(us) ? parseInt(us, 16) : NaN;
							if (isNaN(uu)) {
								if (mcfg.abandon) return void 0;
								sI = sI - 2;
								cI -= 1;
								pnt.sI = sI;
								pnt.cI = cI;
								return lex.bad(utility_1.S.invalid_unicode, sI, sI + 6);
							}
							buf.push(String.fromCharCode(uu));
							sI += 4;
							cI += 5;
						}
					} else if (allowUnknown) {
						buf.push(ec);
						sI++;
						cI++;
					} else {
						if (mcfg.abandon) return void 0;
						pnt.sI = sI;
						pnt.cI = cI;
						return lex.bad(utility_1.S.unexpected, sI, sI + 1);
					}
					continue;
				}
				if (cc < 32) {
					if (mcfg.abandon) return void 0;
					pnt.sI = sI;
					pnt.cI = cI;
					return lex.bad(utility_1.S.unprintable, sI, sI + 1);
				}
				break;
			}
			lex.touchEnd();
			if (mcfg.abandon) return void 0;
			pnt.rI = startRI;
			return lex.bad(utility_1.S.unterminated_string, startSI, sI);
		});
	};
	exports.makeStringMatcher = makeStringMatcher;
	let makeLineMatcher = (cfg, _opts) => {
		const spec = buildLineRunSpec(cfg.line);
		const out = {
			sI: 0,
			rI: 0,
			cI: 0
		};
		return guardedMatcher(cfg.line, function lineBody(lex) {
			const { pnt, src } = lex;
			if (cfg.line.single) {
				const bm = cfg.line.charsBitmap;
				const rbm = cfg.line.rowCharsBitmap;
				const chars = cfg.line.chars;
				const rowChars = cfg.line.rowChars;
				let sI = pnt.sI;
				let rI = pnt.rI;
				let cc;
				const counts = {};
				while ((cc = src.charCodeAt(sI)) < 256 ? bm[cc] : chars[src[sI]]) {
					const c = src[sI];
					const n = (counts[c] || 0) + 1;
					counts[c] = n;
					if (n > 1) break;
					if (cc < 256 ? rbm[cc] : rowChars[src[sI]]) rI++;
					sI++;
				}
				if (src.length <= sI) lex.touchEnd();
				if (pnt.sI < sI) {
					const tkn = lex.token("#LN", void 0, void 0, pnt, void 0, void 0, sI - pnt.sI);
					pnt.sI = sI;
					pnt.rI = rI;
					pnt.cI = 1;
					return tkn;
				}
				return;
			}
			const lined = scan(src, pnt.sI, pnt.rI, pnt.cI, spec, out);
			if (src.length <= out.sI) lex.touchEnd();
			if (lined) {
				const tkn = lex.token("#LN", void 0, void 0, pnt, void 0, void 0, out.sI - pnt.sI);
				pnt.sI = out.sI;
				pnt.rI = out.rI;
				pnt.cI = 1;
				return tkn;
			}
		});
	};
	exports.makeLineMatcher = makeLineMatcher;
	let makeSpaceMatcher = (cfg, _opts) => {
		const spec = buildCharRunSpec(cfg.space.charsBitmap, cfg.space.chars);
		const out = {
			sI: 0,
			rI: 0,
			cI: 0
		};
		return guardedMatcher(cfg.space, function spaceBody(lex) {
			const { pnt, src } = lex;
			const spaced = scan(src, pnt.sI, pnt.rI, pnt.cI, spec, out);
			if (src.length <= out.sI) lex.touchEnd();
			if (spaced) {
				const tkn = lex.token("#SP", void 0, void 0, pnt, void 0, void 0, out.sI - pnt.sI);
				pnt.sI = out.sI;
				pnt.rI = out.rI;
				pnt.cI = out.cI;
				return tkn;
			}
		});
	};
	exports.makeSpaceMatcher = makeSpaceMatcher;
	function subMatchFixed(lex, first, tsrc) {
		let pnt = lex.pnt;
		let out = first;
		if (lex.cfg.fixed.lex && null != tsrc) {
			if (0 < tsrc.length) {
				let tkn = void 0;
				let tin = lex.cfg.fixed.token[tsrc];
				if (null != tin) tkn = lex.token(tin, void 0, tsrc, pnt);
				if (null != tkn) {
					pnt.sI += tkn.src.length;
					pnt.cI += tkn.src.length;
					if (null == first) out = tkn;
					else pnt.token.push(tkn);
				}
			}
		}
		return out;
	}
	const BUILTIN_MATCHER = {
		match: 1,
		fixed: 1,
		space: 1,
		line: 1,
		string: 1,
		comment: 1,
		number: 1,
		text: 1
	};
	var Lex = class {
		#win;
		#cutting;
		#off;
		#touched;
		#match;
		#keepFrom;
		refwd() {
			if (this.fwdSI !== this.pnt.sI) {
				const w = this.#win;
				const at = void 0 === w || this.#cutting ? this.pnt.sI : this.pnt.sI - w.low;
				this.fwd = this.src.substring(at);
				this.fwdSI = this.pnt.sI;
			}
			return this.fwd;
		}
		relex(from, want, rule) {
			if (null == from || from.len <= 0 || from.sI < 0) return;
			const pnt = this.pnt;
			const sI = pnt.sI;
			const rI = pnt.rI;
			const cI = pnt.cI;
			const queue = pnt.token;
			const end = pnt.end;
			pnt.sI = from.sI;
			pnt.rI = from.rI;
			pnt.cI = from.cI;
			pnt.token = [];
			pnt.end = void 0;
			this.want = want;
			let tkn = void 0;
			try {
				tkn = this.next(rule);
			} finally {
				this.want = null;
			}
			if (null == tkn || !want.includes(tkn.tin)) {
				pnt.sI = sI;
				pnt.rI = rI;
				pnt.cI = cI;
				pnt.token = queue;
				pnt.end = end;
				return;
			}
			if (null != from.ignored) tkn.ignored = from.ignored;
			const undo = this.relexUndo;
			undo.sI = sI;
			undo.rI = rI;
			undo.cI = cI;
			undo.token = queue;
			undo.end = end;
			return tkn;
		}
		unrelex(sI, rI, cI, token, end) {
			const pnt = this.pnt;
			pnt.sI = sI;
			pnt.rI = rI;
			pnt.cI = cI;
			pnt.token = token;
			pnt.end = end;
		}
		speculate(mat, rule, tI) {
			const pnt = this.pnt;
			const sI = pnt.sI;
			const rI = pnt.rI;
			const cI = pnt.cI;
			const qN = pnt.token.length;
			const end = pnt.end;
			if (void 0 === BUILTIN_MATCHER[mat.matcher]) this.refwd();
			const tkn = mat(this, rule, tI);
			if (null != tkn && this.want.includes(tkn.tin)) return tkn;
			pnt.sI = sI;
			pnt.rI = rI;
			pnt.cI = cI;
			pnt.token.length = qN;
			pnt.end = end;
		}
		constructor(ctx, win) {
			this.src = types_1.EMPTY;
			this.ctx = {};
			this.cfg = {};
			this.pnt = makePoint(-1);
			this.fwd = types_1.EMPTY;
			this.fwdSI = -1;
			this.#win = void 0;
			this.#cutting = false;
			this.#off = 0;
			this.#touched = false;
			this.#match = void 0;
			this.#keepFrom = 0;
			this.want = null;
			this.relexUndo = {
				sI: -1,
				rI: -1,
				cI: -1,
				token: [],
				end: void 0
			};
			this.ctx = ctx;
			this.cfg = ctx.cfg;
			if (void 0 === win) {
				this.src = ctx.src();
				this.pnt = makePoint(this.src.length);
			} else {
				this.#win = win;
				this.src = win.text;
				this.pnt = makePoint(win.end);
			}
		}
		get windowed() {
			return void 0 !== this.#win;
		}
		get windowOpen() {
			const w = this.#win;
			return void 0 !== w && !w.exhausted;
		}
		touchEnd() {
			const w = this.#win;
			if (void 0 !== w && !w.exhausted) this.#touched = true;
		}
		window() {
			return this.refwd();
		}
		fill(ahead) {
			if (void 0 !== this.#win) this.#grow(ahead);
			return ahead <= this.pnt.len - this.pnt.sI;
		}
		lengthRead() {
			const w = this.#win;
			return void 0 === w ? this.src.length : w.end;
		}
		isEmptySource() {
			const w = this.#win;
			if (void 0 === w) return 0 === this.src.length;
			this.#grow(1);
			return 0 === w.end && void 0 === w.failure;
		}
		excerpt() {
			const w = this.#win;
			if (void 0 === w) return {
				text: this.src,
				row: 1,
				col: 1,
				off: 0
			};
			const start = w.text.length;
			let cut = start;
			if (!w.text.endsWith("\n")) {
				let nl = -1;
				for (;;) {
					nl = w.text.indexOf("\n", start);
					if (-1 !== nl || w.exhausted || start + w.margin <= w.text.length) break;
					w.read();
				}
				cut = Math.min(-1 === nl ? w.text.length : nl + 1, start + w.margin);
				this.#synced();
			}
			return {
				text: w.text.substring(0, cut),
				row: w.lowRow,
				col: w.lowCol,
				off: w.low
			};
		}
		#grow(ahead) {
			const w = this.#win;
			const at = this.pnt.sI + (this.#cutting ? this.#off : 0);
			if (w.exhausted || ahead <= w.end - at) return;
			while (!w.exhausted && w.end - at < ahead) w.read();
			this.#synced();
		}
		#synced() {
			const w = this.#win;
			this.src = w.text;
			this.pnt.len = w.end - (this.#cutting ? this.#off : 0);
			this.fwdSI = -1;
			this.fwd = types_1.EMPTY;
		}
		#release() {
			const w = this.#win;
			const pnt = this.pnt;
			const floor = w.low + w.block;
			if (pnt.sI < floor || null != this.want) return;
			const ctx = this.ctx;
			const notoken = ctx.NOTOKEN;
			let keep = oldestHeld(ctx.t, Math.min(pnt.sI, this.#keepFrom), floor, notoken);
			keep = oldestHeld(pnt.token, keep, floor, notoken);
			keep = oldestHeld(ctx.v, keep, floor, notoken);
			if (keep < floor) return;
			w.drop(keep);
			this.#synced();
		}
		#cutWindow(rule, tI) {
			if (this.#cutting) {
				const p = this.pnt;
				if (p.len <= p.sI) {
					this.touchEnd();
					this.#match = void 0;
					return this.#win.exhausted ? this.token("#ZZ", void 0, "", p) : this.token("#BD", void 0, types_1.EMPTY, p, void 0, utility_1.S.unexpected);
				}
				return this.#cut(rule, tI);
			}
			const w = this.#win;
			const pnt = this.pnt;
			let ahead = w.margin;
			for (;;) {
				this.#release();
				this.#grow(ahead);
				if (void 0 !== w.failure) throw this.#unreadable(rule);
				const base = w.low;
				const sI = pnt.sI;
				const rI = pnt.rI;
				const cI = pnt.cI;
				const queue = pnt.token;
				const qN = queue.length;
				const end = pnt.end;
				this.#cutting = true;
				this.#off = base;
				this.#touched = false;
				pnt.sI = sI - base;
				pnt.len = w.text.length;
				this.fwdSI = -1;
				let tkn;
				try {
					if (pnt.len <= pnt.sI) {
						this.#match = void 0;
						tkn = pnt.end = this.token("#ZZ", void 0, "", pnt);
					} else tkn = this.#cut(rule, tI);
				} finally {
					this.#cutting = false;
					this.#off = 0;
					pnt.sI += base;
					this.#synced();
				}
				if (!this.#touched && (w.exhausted || pnt.sI < pnt.len)) {
					settleToken(tkn, base);
					const made = pnt.token;
					for (let i = made === queue ? qN : 0; i < made.length; i++) if (made[i] !== tkn) settleToken(made[i], base);
					if (void 0 !== pnt.end && end !== pnt.end && tkn !== pnt.end) settleToken(pnt.end, base);
					return tkn;
				}
				pnt.sI = sI;
				pnt.rI = rI;
				pnt.cI = cI;
				queue.length = qN;
				pnt.token = queue;
				pnt.end = end;
				ahead *= 2;
			}
		}
		#unreadable(rule) {
			const f = this.#win.failure;
			const tkn = makeToken("#BD", (0, utility_1.tokenize)("#BD", this.cfg), void 0, f.reason, makePoint(f.pos, f.pos, f.row, f.col), void 0, utility_1.S.unreadable);
			return new error_1.TabnasError(utility_1.S.unreadable, {}, tkn, rule, this.ctx);
		}
		token(ref, val, src, pnt, use, why, len) {
			let tin;
			let name;
			if ("string" === typeof ref) {
				name = ref;
				tin = (0, utility_1.tokenize)(name, this.cfg);
			} else {
				tin = ref;
				name = (0, utility_1.tokenize)(ref, this.cfg);
			}
			const p = pnt || this.pnt;
			const w = this.#win;
			if (void 0 !== w && !this.#cutting) {
				if (void 0 === src) {
					const at = p.sI - w.low;
					src = this.src.substring(at, at + (len || 0));
				}
				return makeToken(name, tin, val, ownText(src), p, use, why, void 0, len);
			}
			return makeToken(name, tin, val, src, p, use, why, this.src, len);
		}
		next(rule, alt, altI, tI) {
			let tkn;
			let pnt = this.pnt;
			let sI = pnt.sI;
			let match = void 0;
			if (pnt.end) tkn = pnt.end;
			else if (0 < pnt.token.length) tkn = pnt.token.shift();
			else if (void 0 !== this.#win) {
				tkn = this.#cutWindow(rule, tI);
				match = this.#match;
			} else if (pnt.len <= pnt.sI) {
				pnt.end = this.token("#ZZ", void 0, "", pnt);
				tkn = pnt.end;
			} else {
				tkn = this.#cut(rule, tI);
				match = this.#match;
			}
			if (void 0 !== this.#win) {
				const ignore = this.cfg.tokenSetTins.IGNORE;
				if (null == ignore || !ignore[tkn.tin]) this.#keepFrom = tkn.sI + Math.max(0, tkn.len);
			}
			this.ctx.log && this.ctx.log(utility_1.S.lex, this.ctx, rule, this, pnt, sI, match, tkn, alt, altI, tI);
			if (this.ctx.sub.lex) this.ctx.sub.lex.map((sub) => sub(tkn, rule, this.ctx));
			return tkn;
		}
		#cut(rule, tI) {
			const pnt = this.pnt;
			let tkn;
			let match = void 0;
			const dispatch = this.cfg.lex.dispatch;
			const cc = this.src.charCodeAt(pnt.sI);
			const mats = void 0 === dispatch ? this.cfg.lex.match : dispatch[cc < 256 ? cc : 256];
			try {
				for (let mat of mats) {
					if (null != this.want) {
						const nm = mat.matcher;
						if ("match" !== nm && "fixed" !== nm) {
							const t = this.cfg.t;
							const btin = "space" === nm ? t.SP : "line" === nm ? t.LN : "string" === nm ? t.ST : "comment" === nm ? t.CM : "number" === nm ? t.NR : "text" === nm ? t.TX : -1;
							if (-1 === btin) {
								const cand = this.speculate(mat, rule, tI);
								if (void 0 === cand) continue;
								tkn = cand;
								match = mat;
								break;
							}
							if (!this.want.includes(btin)) continue;
						}
					}
					if (void 0 === BUILTIN_MATCHER[mat.matcher]) this.refwd();
					if (tkn = mat(this, rule, tI)) {
						match = mat;
						break;
					}
				}
			} catch (err) {
				tkn = tkn || this.token("#BD", void 0, this.src[pnt.sI], pnt, { err }, err.code || utility_1.S.unexpected);
			}
			this.#match = match;
			return tkn || this.token("#BD", void 0, this.src[pnt.sI], pnt, void 0, utility_1.S.unexpected);
		}
		tokenize(ref) {
			return (0, utility_1.tokenize)(ref, this.cfg);
		}
		bad(why, pstart, pend) {
			if (this.src.length < pend) this.touchEnd();
			return this.token("#BD", void 0, 0 <= pstart && pstart <= pend ? this.src.substring(pstart, pend) : this.src[this.pnt.sI], void 0, void 0, why);
		}
	};
	exports.Lex = Lex;
	const makeLex = (...params) => new Lex(...params);
	exports.makeLex = makeLex;
}));
// node_modules/@tabnas/parser/dist/utility.js
var require_utility = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MATCHER_TOKEN_NAMES = exports.WIDENINGS = exports.values = exports.keys = exports.omap = exports.isarr = exports.entries = exports.defprop = exports.assign = exports.S = exports.KEY_ORDER = void 0;
	exports.recordKeyOrder = recordKeyOrder;
	exports.keyOrder = keyOrder;
	exports.badlex = badlex;
	exports.charset = charset;
	exports.charsBitmap = charsBitmap;
	exports.clean = clean;
	exports.clone = clone;
	exports.configure = configure;
	exports.deep = deep;
	exports.escre = escre;
	exports.filterRules = filterRules;
	exports.getpath = getpath;
	exports.makelog = makelog;
	exports.mesc = mesc;
	exports.regexp = regexp;
	exports.snip = snip;
	exports.srcfmt = srcfmt;
	exports.tokenize = tokenize;
	exports.parserwrap = parserwrap;
	exports.str = str;
	exports.findTokenSet = findTokenSet;
	exports.modlist = modlist;
	exports.resolveFuncRefs = resolveFuncRefs;
	exports.validateOptions = validateOptions;
	exports.validateCommentDefinitions = validateCommentDefinitions;
	exports.rejectReservedNames = rejectReservedNames;
	exports.isMatcherToken = isMatcherToken;
	const types_1 = require_types();
	const lexer_1 = require_lexer();
	const error_1 = require_error();
	const keys = (x) => null == x ? [] : Object.keys(x);
	exports.keys = keys;
	const values = (x) => null == x ? [] : Object.values(x);
	exports.values = values;
	const entries = (x) => null == x ? [] : Object.entries(x);
	exports.entries = entries;
	const assign = (x, ...r) => Object.assign(null == x ? {} : x, ...r);
	exports.assign = assign;
	const assigndual = (target, source) => {
		const into = null == target ? {} : target;
		for (const key of keys(source)) defprop(into, key, {
			value: source[key],
			writable: true,
			enumerable: true,
			configurable: true
		});
		return into;
	};
	const isarr = (x) => Array.isArray(x);
	exports.isarr = isarr;
	const defprop = Object.defineProperty;
	exports.defprop = defprop;
	const omap = (o, f) => {
		return Object.entries(o || {}).reduce((o, e) => {
			let me = f ? f(e) : e;
			if (void 0 === me[0]) delete o[e[0]];
			else o[me[0]] = me[1];
			let i = 2;
			while (void 0 !== me[i]) {
				o[me[i]] = me[i + 1];
				i += 2;
			}
			return o;
		}, {});
	};
	exports.omap = omap;
	const S = {
		indent: ". ",
		logindent: "  ",
		space: " ",
		gap: "  ",
		Object: "Object",
		Array: "Array",
		object: "object",
		string: "string",
		function: "function",
		unexpected: "unexpected",
		map: "map",
		list: "list",
		elem: "elem",
		pair: "pair",
		val: "val",
		node: "node",
		no_re_flags: types_1.EMPTY,
		unprintable: "unprintable",
		invalid_ascii: "invalid_ascii",
		invalid_unicode: "invalid_unicode",
		invalid_lex_state: "invalid_lex_state",
		unterminated_string: "unterminated_string",
		unterminated_comment: "unterminated_comment",
		unreadable: "unreadable",
		lex: "lex",
		parse: "parse",
		error: "error",
		none: "none",
		imp_map: "imp,map",
		imp_list: "imp,list",
		imp_null: "imp,null",
		end: "end",
		open: "open",
		close: "close",
		rule: "rule",
		stack: "stack",
		nUll: "null",
		name: "name",
		make: "make",
		colon: ":",
		step: "step"
	};
	exports.S = S;
	function configure(tabnas, incfg, opts) {
		validateCommentDefinitions(opts);
		const cfg = incfg || {};
		cfg.t = cfg.t || {};
		cfg.tI = cfg.tI || 1;
		const t = (tn) => tokenize(tn, cfg);
		if (false !== opts.standard$) {
			t("#BD");
			t("#ZZ");
			t("#UK");
			t("#AA");
			t("#SP");
			t("#LN");
			t("#CM");
			t("#NR");
			t("#ST");
			t("#TX");
			t("#VL");
		}
		cfg.safe = { key: false === opts.safe?.key ? false : true };
		cfg.fixed = {
			lex: !!opts.fixed?.lex,
			token: opts.fixed ? omap(checkFixedTokenNames(clean(opts.fixed.token)), ([name, src]) => [src, tokenize(name, cfg)]) : {},
			ref: void 0,
			check: opts.fixed?.check
		};
		cfg.fixed.ref = omap(cfg.fixed.token, ([tin, src]) => [tin, src]);
		cfg.fixed.ref = Object.assign(cfg.fixed.ref, omap(cfg.fixed.ref, ([tin, src]) => [src, tin]));
		cfg.match = {
			lex: !!opts.match?.lex,
			value: opts.match ? omap(clean(opts.match.value), ([name, spec]) => [name, spec]) : {},
			token: opts.match ? omap(clean(opts.match.token), ([name, matcher]) => [tokenize(name, cfg), matcher]) : {},
			check: opts.match?.check
		};
		omap(cfg.match.token, ([tin, matcher]) => [tin, (matcher.tin$ = +tin, matcher)]);
		const tokenSet = opts.tokenSet ? Object.keys(opts.tokenSet).reduce((a, n) => {
			const members = opts.tokenSet[n];
			if (null == members || types_1.SKIP === members || !Array.isArray(members)) return a;
			a[n] = members.filter((x) => null != x).map((n) => t(n));
			return a;
		}, {}) : {};
		cfg.tokenSet = cfg.tokenSet || Object.create(null);
		entries(tokenSet).map((entry) => {
			let name = entry[0];
			let tinset = entry[1];
			if (cfg.tokenSet[name]) {
				cfg.tokenSet[name].length = 0;
				cfg.tokenSet[name].push(...tinset);
			} else cfg.tokenSet[name] = tinset;
		});
		cfg.tokenSetTins = entries(cfg.tokenSet).reduce((a, en) => (a[en[0]] = a[en[0]] || {}, en[1].map((tin) => a[en[0]][tin] = true), a), Object.create(null));
		cfg.tokenSetTins.IGNORE = cfg.tokenSetTins.IGNORE || {};
		cfg.space = {
			lex: !!opts.space?.lex,
			chars: charset(opts.space?.chars),
			charsBitmap: charsBitmap(opts.space?.chars),
			check: opts.space?.check
		};
		cfg.line = {
			lex: !!opts.line?.lex,
			chars: charset(opts.line?.chars),
			charsBitmap: charsBitmap(opts.line?.chars),
			rowChars: charset(opts.line?.rowChars),
			rowCharsBitmap: charsBitmap(opts.line?.rowChars),
			single: !!opts.line?.single,
			check: opts.line?.check
		};
		cfg.text = {
			lex: !!opts.text?.lex,
			modify: (opts.text?.modify ? [opts.text.modify] : []).flat().filter((m) => null != m),
			check: opts.text?.check
		};
		cfg.number = {
			lex: !!opts.number?.lex,
			hex: !!opts.number?.hex,
			oct: !!opts.number?.oct,
			bin: !!opts.number?.bin,
			sep: null != opts.number?.sep && "" !== opts.number.sep,
			exclude: opts.number?.exclude,
			sepChar: opts.number?.sep,
			check: opts.number?.check
		};
		cfg.value = {
			lex: !!opts.value?.lex,
			def: entries(opts.value?.def || {}).reduce((a, e) => (null == e[1] || false === e[1] || e[1].match || (a[e[0]] = e[1]), a), Object.create(null)),
			defre: entries(opts.value?.def || {}).filter(([, spec]) => spec && spec.match).map(([name, spec]) => ({
				name,
				val: spec.val,
				match: spec.match,
				consume: !!spec.consume
			})).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
		};
		cfg.rule = {
			start: null == opts.rule?.start ? "val" : opts.rule.start,
			maxmul: null == opts.rule?.maxmul ? 3 : opts.rule.maxmul,
			finish: !!opts.rule?.finish,
			history: null == opts.rule?.history || false === opts.rule.history ? null : opts.rule.history,
			include: opts.rule?.include ? opts.rule.include.split(/\s*,+\s*/).filter((g) => "" !== g) : [],
			exclude: opts.rule?.exclude ? opts.rule.exclude.split(/\s*,+\s*/).filter((g) => "" !== g) : []
		};
		cfg.map = {
			extend: !!opts.map?.extend,
			merge: opts.map?.merge,
			child: !!opts.map?.child,
			ordered: !!opts.map?.ordered
		};
		cfg.list = {
			property: !!opts.list?.property,
			pair: !!opts.list?.pair,
			child: !!opts.list?.child
		};
		cfg.info = {
			map: !!opts.info?.map,
			list: !!opts.info?.list,
			text: !!opts.info?.text,
			marker: opts.info?.marker || "__info__"
		};
		let fixedRE = Object.keys(cfg.fixed.token).sort((a, b) => b.length - a.length).map((fixed) => escre(fixed)).join("|");
		let commentStartRE = opts.comment?.lex ? (opts.comment.def ? values(opts.comment.def) : []).filter((c) => c && c.lex).map((c) => escre(c.start)).join("|") : "";
		let enderRE = [
			"([",
			escre(keys(charset(cfg.space.lex && cfg.space.chars, cfg.line.lex && cfg.line.chars)).join("")),
			"]",
			("string" === typeof opts.ender ? opts.ender.split("") : Array.isArray(opts.ender) ? opts.ender : []).map((c) => "|" + escre(c)).join(""),
			"" === fixedRE ? "" : "|",
			fixedRE,
			"" === commentStartRE ? "" : "|",
			commentStartRE,
			"|$)"
		];
		cfg.rePart = {
			fixed: fixedRE,
			ender: enderRE,
			commentStart: commentStartRE
		};
		cfg.re = {
			ender: regexp(null, ...enderRE),
			rowChars: regexp(null, escre(opts.line?.rowChars)),
			columns: regexp(null, "[" + escre(opts.line?.chars) + "]", "(.*)$")
		};
		cfg.lex = {
			empty: !!opts.lex?.empty,
			emptyResult: opts.lex?.emptyResult,
			relex: !!opts.lex?.relex,
			window: !!opts.lex?.window,
			match: opts.lex?.match ? entries(opts.lex.match).reduce((list, entry) => {
				let name = entry[0];
				let matchspec = entry[1];
				if (matchspec) {
					let matcher = matchspec.make(cfg, opts);
					if (matcher) {
						matcher.matcher = name;
						matcher.make = matchspec.make;
						matcher.order = matchspec.order;
					}
					list.push(matcher);
				}
				return list;
			}, []).filter((m) => null != m && false !== m && -1 < +m.order).sort((a, b) => a.order - b.order) : []
		};
		const rcv = opts.parse?.recover;
		cfg.parse = {
			prepare: values(opts.parse?.prepare),
			recover: {
				enabled: !!rcv?.enabled,
				syncGroups: (rcv?.syncGroups ?? [
					"close",
					"comma",
					"end"
				]).slice(),
				syncTins: (rcv?.syncTokens ?? []).map((name) => tokenize(name, cfg)),
				popUntilValid: false !== rcv?.popUntilValid,
				maxSkip: null == rcv?.maxSkip ? 64 : rcv.maxSkip,
				maxRecoveries: null == rcv?.maxRecoveries ? 32 : rcv.maxRecoveries,
				suppress: null == rcv?.suppress ? 4 : rcv.suppress
			},
			budget: {
				checkEveryN: opts.parse?.budget?.checkEveryN || 0,
				onCheck: opts.parse?.budget?.onCheck || null
			}
		};
		cfg.debug = {
			get_console: opts.debug?.get_console || (() => console),
			maxlen: null == opts.debug?.maxlen ? 99 : opts.debug.maxlen,
			print: {
				config: !!opts.debug?.print?.config,
				src: opts.debug?.print?.src
			}
		};
		cfg.error = opts.error ?? {};
		cfg.errmsg = opts.errmsg ?? { suffix: true };
		cfg.hint = opts.hint ?? {};
		if (opts.config?.modify) keys(opts.config.modify).forEach((modifer) => opts.config.modify[modifer](cfg, opts));
		buildLexDispatch(cfg);
		if (cfg.debug.print.config) cfg.debug.get_console().dir(cfg, { depth: null });
		cfg.result = { fail: [] };
		if (opts.result) cfg.result.fail = [...opts.result.fail];
		const history = opts.rewind?.history;
		cfg.rewind = { history: false === history ? 1e400 : null == history ? 64 : history < 0 ? 0 : history };
		const optscolor = opts.color ?? {};
		cfg.color = cfg.color ?? {};
		cfg.color.active = optscolor.active ?? cfg.color.active ?? true;
		cfg.color.reset = optscolor.reset ?? cfg.color.reset ?? "\x1B[0m";
		cfg.color.hi = optscolor.hi ?? cfg.color.hi ?? "\x1B[91m";
		cfg.color.lo = optscolor.lo ?? cfg.color.lo ?? "\x1B[2m";
		cfg.color.line = optscolor.line ?? cfg.color.line ?? "\x1B[34m";
		assigndual(tabnas.options, opts);
		assigndual(tabnas.token, cfg.t);
		assigndual(tabnas.tokenSet, cfg.tokenSet);
		assigndual(tabnas.fixed, cfg.fixed.ref);
		return cfg;
	}
	function tokenize(ref, cfg, tabnas) {
		let tokenmap = cfg.t;
		let token = tokenmap[ref];
		if (null == token && types_1.STRING === typeof ref) {
			token = cfg.tI++;
			tokenmap[token] = ref;
			tokenmap[ref] = token;
			tokenmap[ref.substring(1)] = token;
			if (null != tabnas) assigndual(tabnas.token, cfg.t);
		}
		return token;
	}
	function findTokenSet(ref, cfg) {
		let tokenSetMap = cfg.tokenSet;
		return tokenSetMap[ref] ?? ("string" == typeof ref ? tokenSetMap[ref.replace(/#/g, "")] : void 0);
	}
	function mesc(s, _) {
		return _ = new String(s), _.esc = true, _;
	}
	function regexp(flags, ...parts) {
		return new RegExp(parts.map((p) => p.esc ? escre(p.toString()) : p).join(types_1.EMPTY), null == flags ? "" : flags);
	}
	function escre(s) {
		return null == s ? "" : s.replace(/[-\\|\]{}()[^$+*?.!=]/g, "\\$&").replace(/\t/g, "\\t").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
	}
	function isClassInstance(v) {
		const ctor = v.constructor;
		return S.function === typeof ctor && S.Object !== ctor.name && S.Array !== ctor.name;
	}
	function deep(base, ...rest) {
		let base_isf = S.function === typeof base;
		let base_iso = null != base && (S.object === typeof base || base_isf);
		for (let over of rest) {
			let over_isf = S.function === typeof over;
			let over_iso = null != over && (S.object === typeof over || over_isf);
			let over_ctor;
			if (base_iso && over_iso && !over_isf && Array.isArray(base) === Array.isArray(over) && !isClassInstance(over)) for (let k in over) {
				if ("__proto__" === k || "constructor" === k || "prototype" === k || !Object.prototype.hasOwnProperty.call(over, k)) continue;
				const merged = deep(base_isf ? Object.prototype.hasOwnProperty.call(base, k) ? base[k] : void 0 : base[k], over[k]);
				if (base_isf) defprop(base, k, {
					value: merged,
					writable: true,
					enumerable: true,
					configurable: true
				});
				else base[k] = merged;
			}
			else {
				base = void 0 === over || types_1.SKIP === over ? base : over_isf ? over : over_iso ? S.function === typeof (over_ctor = over.constructor) && S.Object !== over_ctor.name && S.Array !== over_ctor.name ? over : deep(Array.isArray(over) ? [] : {}, over) : over;
				base_isf = S.function === typeof base;
				base_iso = null != base && (S.object === typeof base || base_isf);
			}
		}
		return base;
	}
	function badlex(lex, BD, ctx) {
		let next = lex.next.bind(lex);
		lex.next = (rule, alt, altI, tI) => {
			let token = next(rule, alt, altI, tI);
			if (BD === token.tin) {
				let details = {};
				if (null != token.use) details.use = token.use;
				throw new error_1.TabnasError(token.why || S.unexpected, details, token, rule, ctx);
			}
			return token;
		};
		return lex;
	}
	function makelog(ctx, meta) {
		let trace = ctx.opts?.plugin?.debug?.trace;
		if (meta || trace) {
			if ("number" === typeof meta?.log || trace) {
				let exclude_objects = false;
				let logdepth = meta?.log;
				if (-1 === logdepth || trace) {
					logdepth = 1;
					exclude_objects = true;
				}
				ctx.log = (...rest) => {
					if (exclude_objects) {
						let logstr = rest.filter((item) => S.object != typeof item).map((item) => S.function == typeof item ? item.name : item).join(S.gap);
						ctx.cfg.debug.get_console().log(logstr);
					} else ctx.cfg.debug.get_console().dir(rest, { depth: logdepth });
				};
			} else if ("function" === typeof meta.log) ctx.log = meta.log;
		}
		return ctx.log;
	}
	function buildLexDispatch(cfg) {
		const table = new Array(257);
		for (let c = 0; c <= 256; c++) table[c] = [];
		const all = (mat) => {
			for (let c = 0; c <= 256; c++) table[c].push(mat);
		};
		const bytes = (mat, test) => {
			for (let c = 0; c < 256; c++) if (test(c)) table[c].push(mat);
			table[256].push(mat);
		};
		for (const mat of cfg.lex.match) {
			const name = mat.matcher;
			if ("fixed" === name && !cfg.fixed.check) {
				const first = {};
				for (const fsrc of keys(cfg.fixed.token)) if (0 < fsrc.length) {
					const cc = fsrc.charCodeAt(0);
					if (cc < 256) first[cc] = true;
				}
				bytes(mat, (c) => true === first[c]);
			} else if ("space" === name && !cfg.space.check) bytes(mat, (c) => 0 !== cfg.space.charsBitmap[c]);
			else if ("line" === name && !cfg.line.check) bytes(mat, (c) => 0 !== cfg.line.charsBitmap[c]);
			else if ("string" === name && !cfg.string.check) bytes(mat, (c) => 0 !== cfg.string.quoteBitmap[c]);
			else if ("comment" === name && !cfg.comment.check) {
				const first = {};
				for (const cm of values(cfg.comment.def || {})) {
					const start = cm.start;
					if ("string" === typeof start && 0 < start.length) {
						const cc = start.charCodeAt(0);
						if (cc < 256) first[cc] = true;
					}
				}
				bytes(mat, (c) => true === first[c]);
			} else if ("number" === name && !cfg.number.check) bytes(mat, (c) => 43 === c || 45 === c || 46 === c || 48 <= c && c <= 57);
			else all(mat);
		}
		cfg.lex.dispatch = table;
	}
	function srcfmt(config) {
		return "function" === typeof config.debug.print.src ? config.debug.print.src : (s) => {
			let out = null == s ? types_1.EMPTY : Array.isArray(s) ? JSON.stringify(s).replace(/]$/, entries(s).filter((en) => isNaN(en[0])).map((en, i) => (0 === i ? ", " : "") + en[0] + ": " + JSON.stringify(en[1])) + "]") : JSON.stringify(s);
			out = out.substring(0, config.debug.maxlen) + (config.debug.maxlen < out.length ? "..." : types_1.EMPTY);
			return out;
		};
	}
	function str(o, len = 44) {
		let s;
		try {
			s = "object" === typeof o ? JSON.stringify(o) : "" + o;
		} catch (e) {
			s = "" + o;
		}
		return snip(len < s.length ? s.substring(0, len - 3) + "..." : s, len);
	}
	function snip(s, len = 5) {
		return void 0 === s ? "" : ("" + s).substring(0, len).replace(/[\r\n\t]/g, ".");
	}
	function clone(class_instance) {
		const out = Object.create(Object.getPrototypeOf(class_instance));
		for (const k in class_instance) out[k] = deep(void 0, class_instance[k]);
		return out;
	}
	function charset(...parts) {
		return null == parts ? {} : parts.filter((p) => false !== p).map((p) => "object" === typeof p ? keys(p).join(types_1.EMPTY) : p).join(types_1.EMPTY).split(types_1.EMPTY).reduce((a, c) => (a[c] = c.charCodeAt(0), a), {});
	}
	function charsBitmap(...parts) {
		const out = /* @__PURE__ */ new Uint8Array(256);
		for (const p of parts) {
			if (null == p || false === p) continue;
			const s = "string" === typeof p ? p : keys(p).join(types_1.EMPTY);
			for (let i = 0; i < s.length; i++) {
				const cc = s.charCodeAt(i);
				if (cc < 256) out[cc] = 1;
			}
		}
		return out;
	}
	const MATCHER_TOKEN_NAMES = /* @__PURE__ */ new Set([
		"#BD",
		"#ZZ",
		"#UK",
		"#AA",
		"#SP",
		"#LN",
		"#CM",
		"#NR",
		"#ST",
		"#TX",
		"#VL"
	]);
	exports.MATCHER_TOKEN_NAMES = MATCHER_TOKEN_NAMES;
	function isMatcherToken(name) {
		return MATCHER_TOKEN_NAMES.has(name);
	}
	function checkFixedTokenNames(token) {
		if (null == token) return token;
		for (const name of keys(token)) if (MATCHER_TOKEN_NAMES.has(name)) throw new Error(`Tabnas: ${name} is produced by a lexer matcher and cannot be bound to the fixed literal ${JSON.stringify(token[name])}. Doing so adds a second producer for the same token rather than replacing the matcher, and values silently vanish. Configure the matcher instead (options.number, options.string, options.text, options.value, options.space, options.line, options.comment), or use a token name of your own. Fixed punctuation tokens (#OB #CB #OS #CS #CL #CA) may be rebound freely.`);
		return token;
	}
	function clean(o) {
		for (let p in o) if (null == o[p]) delete o[p];
		return o;
	}
	function filterRules(rs, cfg) {
		const newDef = { ...rs.def };
		for (const rsn of ["open", "close"]) newDef[rsn] = rs.def[rsn].map((as) => ({
			...as,
			g: "string" === typeof as.g ? (as.g || "").split(/\s*,+\s*/) : as.g || []
		})).filter((as) => cfg.rule.include.reduce((a, g) => a || null != as.g && -1 !== as.g.indexOf(g), 0 === cfg.rule.include.length)).filter((as) => cfg.rule.exclude.reduce((a, g) => a && (null == as.g || -1 === as.g.indexOf(g)), true));
		const newRs = Object.create(Object.getPrototypeOf(rs));
		Object.assign(newRs, rs);
		newRs.def = newDef;
		return newRs;
	}
	function modlist(list, mods) {
		if (mods && list) {
			if (0 < list.length) {
				if (mods.delete && 0 < mods.delete.length) for (let i = 0; i < mods.delete.length; i++) {
					let mdI = mods.delete[i];
					if (mdI < 0 ? -1 * mdI <= list.length : mdI < list.length) {
						let dI = (list.length + mdI) % list.length;
						list[dI] = null;
					}
				}
				if (mods.move) for (let i = 0; i < mods.move.length; i += 2) {
					let fromI = (list.length + mods.move[i]) % list.length;
					let toI = (list.length + mods.move[i + 1]) % list.length;
					let entry = list[fromI];
					list.splice(fromI, 1);
					list.splice(toI, 0, entry);
				}
				let filtered = list.filter((entry) => null != entry);
				if (filtered.length !== list.length) {
					list.length = 0;
					list.push(...filtered);
				}
			}
			if (mods.custom) {
				let newlist = mods.custom(list);
				if (null != newlist) list = newlist;
			}
		}
		return list;
	}
	function parserwrap(parser) {
		return { start: function(src, tabnas, meta, parent_ctx) {
			try {
				return parser.start(src, tabnas, meta, parent_ctx);
			} catch (ex) {
				if ("SyntaxError" === ex.name) {
					let loc = 0;
					let row = 0;
					let col = 0;
					let tsrc = types_1.EMPTY;
					let errloc = ex.message.match(/^Unexpected token (.) .*position\s+(\d+)/i);
					if (errloc) {
						tsrc = errloc[1];
						loc = parseInt(errloc[2]);
						row = src.substring(0, loc).replace(/[^\n]/g, types_1.EMPTY).length;
						let cI = loc - 1;
						while (-1 < cI && "\n" !== src.charAt(cI)) cI--;
						col = Math.max(src.substring(cI, loc).length, 0);
					}
					let token = ex.token || (0, lexer_1.makeToken)("#UK", tokenize("#UK", tabnas.internal().config), void 0, tsrc, (0, lexer_1.makePoint)(tsrc.length, loc, ex.lineNumber || row, ex.columnNumber || col));
					const norule = { name: "no-rule" };
					throw new error_1.TabnasError(ex.code || "json", ex.details || { msg: ex.message }, token, norule, ex.ctx || {
						uI: -1,
						opts: tabnas.options,
						cfg: tabnas.internal().config,
						token,
						meta,
						src: () => src,
						root: () => void 0,
						plgn: () => tabnas.internal().plugins,
						inst: () => tabnas,
						rule: norule,
						sub: {},
						errs: [],
						xs: -1,
						v2: token,
						v1: token,
						t: [token, token],
						tC: -1,
						kI: -1,
						rs: [],
						rsI: 0,
						rsm: Object.create(null),
						n: {},
						log: meta ? meta.log : void 0,
						F: srcfmt(tabnas.internal().config),
						u: {},
						NORULE: norule,
						NOTOKEN: { name: "no-token" }
					});
				} else throw ex;
			}
		} };
	}
	function getpath(root, path) {
		path = "string" === typeof path ? path.split(".") : path;
		let node = root;
		for (let i = 0; i < path.length && null != node; i++) node = node[path[i]];
		return node;
	}
	const WIDENINGS = {
		"options.ender": (val) => S.string === typeof val,
		"options.lex.match.*": (val) => false === val,
		"options.rewind.history": (val) => false === val,
		"options.errmsg.suffix": (val) => S.string === typeof val || S.function === typeof val
	};
	exports.WIDENINGS = WIDENINGS;
	function widened(at, val) {
		const exact = WIDENINGS[at];
		if (null != exact && exact(val)) return true;
		const dot = at.lastIndexOf(".");
		if (0 > dot) return false;
		const wild = WIDENINGS[at.substring(0, dot + 1) + "*"];
		return null != wild && wild(val);
	}
	function validateOptions(opts, dflt, path = "options") {
		if (null == opts || S.object !== typeof opts || Array.isArray(opts)) return;
		for (const key of Object.keys(opts)) {
			const val = opts[key];
			const d = dflt?.[key];
			const at = path + "." + key;
			if ("options.rule.history" === at && null != val) {
				if (false === val) continue;
				if ("number" !== typeof val || !Number.isSafeInteger(val) || val < 1) throw new Error(`Tabnas: ${at} must be an integer of at least 1, null, or false`);
				if (types_1.MAX_RULE_HISTORY < val) throw new Error(`Tabnas: ${at} is outside the supported range (at most ${types_1.MAX_RULE_HISTORY})`);
				continue;
			}
			if (widened(at, val)) continue;
			const entry = DYNAMIC_MAPS[at];
			if (null != entry) {
				if (void 0 === val || types_1.SKIP === val) continue;
				if (null === val) {
					if (NULL_CONTAINER_FAULT.has(at)) bad(at, "object", val);
					continue;
				}
				if (S.object !== typeof val || Array.isArray(val)) bad(at, "object", val);
				for (const name of Object.keys(val)) {
					const nat = at + "." + name;
					if (RESERVED_MAP_KEYS.has(name)) throw new Error(`Tabnas: ${nat}: \`${name}\` is a reserved name and cannot be a ${at.slice(at.lastIndexOf(".") + 1)} entry (it would reach the prototype chain)`);
					if (widened(nat, val[name])) continue;
					entry(val[name], nat);
				}
				continue;
			}
			if (void 0 === d || null === d || void 0 === val || null === val || types_1.SKIP === val) continue;
			if (S.function === typeof d) {
				if (S.function !== typeof val) bad(at, "function", val);
				continue;
			}
			if (Array.isArray(d)) {
				if (!Array.isArray(val)) bad(at, "array", val);
				continue;
			}
			if (S.object === typeof d) {
				if (d instanceof RegExp) continue;
				if (S.object !== typeof val || Array.isArray(val)) bad(at, "object", val);
				validateOptions(val, d, at);
				continue;
			}
			const want = typeof d;
			if (want !== typeof val) bad(at, want, val);
		}
	}
	function bad(at, want, val) {
		const got = S.function === typeof val ? "a function reference" : null === val ? "null" : Array.isArray(val) ? "array" : typeof val;
		throw new Error(`Tabnas: ${at}: expected ${want}, got ${got}` + (S.function === typeof val ? " (a function reference is only allowed in a declared code slot)" : ""));
	}
	const NULL_CONTAINER_FAULT = /* @__PURE__ */ new Set(["options.tokenSet"]);
	const RESERVED_MAP_KEYS = /* @__PURE__ */ new Set([
		"__proto__",
		"constructor",
		"prototype"
	]);
	const oneOf = (types, allowNull = true) => (val, at) => {
		if (null == val && allowNull) return;
		const t = val instanceof RegExp ? "regexp" : Array.isArray(val) ? "array" : typeof val;
		if (!types.includes(t)) bad(at, types.join(" or "), val);
	};
	const DYNAMIC_MAPS = {
		"options.fixed.token": oneOf(["string"]),
		"options.match.token": oneOf([
			"regexp",
			"function",
			"string"
		]),
		"options.match.value": oneOf([
			"regexp",
			"function",
			"object"
		]),
		"options.tokenSet": (val, at) => {
			if (void 0 === val || types_1.SKIP === val) return;
			if (!Array.isArray(val)) bad(at, "array", val);
			for (let i = 0; i < val.length; i++) if (null != val[i] && types_1.SKIP !== val[i] && S.string !== typeof val[i]) bad(at + "[" + i + "]", "string", val[i]);
		},
		"options.comment.def": (val, at) => {
			if (null == val || false === val || types_1.SKIP === val) return;
			if (S.object !== typeof val || Array.isArray(val)) bad(at, "object", val);
			validateOptions(val, COMMENT_DEF_SHAPE, at);
		},
		"options.value.def": (val, at) => {
			if (null == val || false === val || types_1.SKIP === val) return;
			if (S.object !== typeof val || Array.isArray(val)) bad(at, "object", val);
			if (void 0 !== val.consume && null !== val.consume && "boolean" !== typeof val.consume) bad(at + ".consume", "boolean", val.consume);
		},
		"options.string.escape": oneOf(["string"]),
		"options.string.replace": oneOf(["string"]),
		"options.error": oneOf(["string"]),
		"options.hint": oneOf(["string"]),
		"options.parse.prepare": oneOf(["function"]),
		"options.config.modify": oneOf(["function"]),
		"options.lex.match": (val, at) => {
			if (null == val) return;
			if (S.object !== typeof val || Array.isArray(val)) bad(at, "object", val);
			if (null != val.order && "number" !== typeof val.order) bad(at + ".order", "number", val.order);
			if (null != val.make && S.function !== typeof val.make) bad(at + ".make", "function", val.make);
		},
		"options.plugin": () => {}
	};
	function rejectReservedNames(options) {
		if (null == options || S.object !== typeof options) return;
		for (const at of Object.keys(DYNAMIC_MAPS)) {
			let node = options;
			const path = at.split(".").slice(1);
			for (const segment of path) node = null != node && S.object === typeof node && Object.prototype.hasOwnProperty.call(node, segment) ? node[segment] : void 0;
			if (null == node || S.object !== typeof node || Array.isArray(node)) continue;
			for (const name of Object.keys(node)) if (RESERVED_MAP_KEYS.has(name)) throw new Error(`Tabnas: ${at}.${name}: \`${name}\` is a reserved name and cannot be a ${at.slice(at.lastIndexOf(".") + 1)} entry (it would reach the prototype chain)`);
		}
	}
	const COMMENT_DEF_SHAPE = {
		line: true,
		start: "#",
		end: "*/",
		lex: true,
		eatline: false
	};
	function validateCommentDefinitions(opts) {
		const definitions = opts.comment?.def;
		if (null == definitions) return;
		for (const [name, definition] of entries(definitions)) {
			if (null == definition || false === definition || definition.line) continue;
			if ("string" !== typeof definition.end || 0 === definition.end.length) throw new Error(`Tabnas: options.comment.def.${name}.end: block comments require a non-empty end marker`);
		}
	}
	function resolveFuncRefs(obj, ref) {
		if (null == obj || "object" !== typeof obj) {
			if ("string" === typeof obj && "@" === obj[0]) {
				if ("@" === obj[1]) return obj.substring(1);
				if ("SKIP" === obj.substring(1)) return types_1.SKIP;
				const m = obj.match(/^@\/(.*)\/([\w]*)$/);
				if (m) return new RegExp(m[1], m[2]);
				const me = obj.match(/^@~\/(.*)\/([\w]*)$/);
				if (me) {
					const re = new RegExp(me[1], me[2]);
					re.eager$ = true;
					return re;
				}
				if (ref) {
					const fn = ref[obj];
					if ("function" === typeof fn) return fn;
				}
			}
			return obj;
		}
		if (Array.isArray(obj)) return obj.map((item) => resolveFuncRefs(item, ref));
		const ctor = obj.constructor;
		if (ctor && "Object" !== ctor.name) return obj;
		const out = {};
		for (const key of Object.keys(obj)) out[key] = resolveFuncRefs(obj[key], ref);
		return out;
	}
	const KEY_ORDER = Symbol.for("tabnas.keyOrder");
	exports.KEY_ORDER = KEY_ORDER;
	function recordKeyOrder(node, key) {
		let order = node[KEY_ORDER];
		if (void 0 === order) {
			order = [];
			defprop(node, KEY_ORDER, {
				value: order,
				enumerable: false,
				writable: true,
				configurable: true
			});
		}
		order.push("" + key);
	}
	function keyOrder(node) {
		if (null != node && "object" === typeof node) {
			const order = node[KEY_ORDER];
			if (void 0 !== order) return order.slice();
			return Object.keys(node);
		}
		return [];
	}
}));
// node_modules/@tabnas/parser/dist/builtins.js
var require_builtins = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.BUILTIN_REFS = exports.BUILTIN_CONFIG_FACTORY = exports.BUILTIN_SCHEMA_VERSION = void 0;
	const utility_1 = require_utility();
	exports.BUILTIN_SCHEMA_VERSION = 5;
	const defprop = Object.defineProperty;
	function appendKids(to, from) {
		const n = from.length;
		for (let i = 0; i < n; i++) to.push(from[i]);
	}
	function markNode(node, marker, data) {
		if (node != null && "object" === typeof node) defprop(node, marker, {
			value: data,
			writable: true
		});
	}
	function mkNode(rule, kind) {
		return "user" === kind ? {
			rule,
			src: "",
			kids: []
		} : {
			src: "",
			kids: []
		};
	}
	const makeNode$ = (cfg) => (r) => {
		if (cfg.init) r.node = mkNode(cfg.rule, cfg.kind);
		const n = r.node;
		const nterms = cfg.nterms || 0;
		for (let i = 0; i < nterms; i++) n.src += r.o[i].src;
	};
	const makeCapture$ = (cfg) => (r) => {
		if (null == r.node) r.node = mkNode(cfg.rule, cfg.kind);
		const n = r.node;
		const c = r.child && r.child.node;
		if (null == c) return;
		if ("object" !== typeof c || !("src" in c)) {
			n.kids.push(c);
			return;
		}
		if (c === n) return;
		n.src += c.src;
		if (c.rule) n.kids.push(c);
		else if (Array.isArray(c.kids)) appendKids(n.kids, c.kids);
	};
	const bubble$ = (r) => {
		if (r.child && r.child.node !== void 0) r.node = r.child.node;
	};
	const makeFold$ = (cfg) => (r) => {
		const p = r.parent && r.parent.node;
		if (null == p || "object" !== typeof p || !("src" in p)) return;
		const own = r.node;
		if (null != own && "object" === typeof own && "src" in own && own !== p) {
			p.src += own.src;
			if (own.rule) p.kids.push(own);
			else if (Array.isArray(own.kids)) appendKids(p.kids, own.kids);
		}
		const cN = cfg.cN || 0;
		for (let i = 0; i < cN; i++) p.src += r.c[i].src;
		r.node = void 0;
	};
	const probeInit$ = (r, ctx) => {
		r.k.pd_phase = 0;
		r.k.pd_mark = ctx.mark();
		ctx.probeOpen(r);
	};
	const probeDecide$ = (r, ctx) => {
		if (null == r.k.pd_mark) throw new Error("@probeDecide$: no pd_mark — phase-0 @probeInit$ did not run");
		const peek = ctx.t[0];
		ctx.rewind(r.k.pd_mark);
		r.k.pd_phase = peek && peek.name === r.k.pd_d ? 1 : 2;
		ctx.probeClose();
	};
	const probePhase0$ = (r) => !r.k.pd_phase;
	const probePhase1$ = (r) => 1 === r.k.pd_phase;
	const probePhase2$ = (r) => 2 === r.k.pd_phase;
	const makeObject$ = (cfg) => (r, ctx) => {
		const node = Object.create(null);
		r.node = node;
		if (ctx.cfg.info.map) markNode(node, ctx.cfg.info.marker, {
			implicit: !!cfg.implicit,
			meta: {}
		});
	};
	const makeArray$ = (cfg) => (r, ctx) => {
		const node = [];
		r.node = node;
		if (ctx.cfg.info.list) markNode(node, ctx.cfg.info.marker, {
			implicit: !!cfg.implicit,
			meta: {}
		});
	};
	const reset$ = (r) => {
		r.node = void 0;
	};
	const makeKey$ = (cfg) => (r) => {
		r.u[cfg.slot || "key"] = "string" === typeof cfg.lit ? cfg.lit : r.o[cfg.from || 0]?.val;
	};
	const cfgTrue = (v) => true === v;
	const srcVal = (node) => null != node && "object" === typeof node && "string" === typeof node.src ? node.src : node;
	const makeSetval$ = (cfg) => (r, ctx) => {
		const n = r.node;
		if (null != n && "object" === typeof n) {
			const key = r.u[cfg.slot || "key"];
			if (ctx.cfg.info.map && key === ctx.cfg.info.marker) return;
			if (ctx.cfg.map && ctx.cfg.map.ordered && !(key in n)) (0, utility_1.recordKeyOrder)(n, key);
			n[key] = cfgTrue(cfg.src) ? srcVal(r.child.node) : r.child.node;
		}
	};
	const makePush$ = (cfg) => (r) => {
		if (void 0 !== r.child.node && Array.isArray(r.node)) r.node.push(cfgTrue(cfg.src) ? srcVal(r.child.node) : r.child.node);
	};
	const makeValue$ = (cfg) => (r, ctx) => {
		if (void 0 !== r.child.node) {
			r.node = r.child.node;
			return;
		}
		const tok = r.o[cfg.from || 0];
		let val = tok ? tok.resolveVal(r, ctx) : void 0;
		const info = ctx.cfg.info;
		if (info.text && "string" === typeof val && tok && (tok.tin === ctx.cfg.t.ST || tok.tin === ctx.cfg.t.TX)) {
			const quote = tok.tin === ctx.cfg.t.ST && tok.src.length > 0 ? tok.src[0] : "";
			const sv = new String(val);
			markNode(sv, info.marker, { quote });
			val = sv;
		}
		r.node = val;
	};
	const node$ = makeNode$({});
	const capture$ = makeCapture$({});
	const fold$ = makeFold$({});
	const object$ = makeObject$({});
	const array$ = makeArray$({});
	const key$ = makeKey$({});
	const push$ = makePush$({});
	const setval$ = makeSetval$({});
	const value$ = makeValue$({});
	exports.BUILTIN_CONFIG_FACTORY = Object.freeze({
		"@node$": makeNode$,
		"@capture$": makeCapture$,
		"@fold$": makeFold$,
		"@object$": makeObject$,
		"@array$": makeArray$,
		"@key$": makeKey$,
		"@setval$": makeSetval$,
		"@push$": makePush$,
		"@value$": makeValue$
	});
	exports.BUILTIN_REFS = Object.freeze({
		"@node$": node$,
		"@capture$": capture$,
		"@bubble$": bubble$,
		"@fold$": fold$,
		"@probeInit$": probeInit$,
		"@probeDecide$": probeDecide$,
		"@probePhase0$": probePhase0$,
		"@probePhase1$": probePhase1$,
		"@probePhase2$": probePhase2$,
		"@object$": object$,
		"@array$": array$,
		"@reset$": reset$,
		"@key$": key$,
		"@setval$": setval$,
		"@push$": push$,
		"@value$": value$
	});
}));
// node_modules/@tabnas/parser/dist/defaults.js
var require_defaults$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.defaults = void 0;
	const lexer_1 = require_lexer();
	exports.defaults = {
		safe: { key: true },
		tag: "-",
		fixed: {
			lex: true,
			token: {
				"#OB": "{",
				"#CB": "}",
				"#OS": "[",
				"#CS": "]",
				"#CL": ":",
				"#CA": ","
			}
		},
		match: {
			lex: true,
			token: {}
		},
		tokenSet: Object.assign(Object.create(null), {
			IGNORE: [
				"#SP",
				"#LN",
				"#CM"
			],
			VAL: [
				"#TX",
				"#NR",
				"#ST",
				"#VL"
			],
			KEY: [
				"#TX",
				"#NR",
				"#ST",
				"#VL"
			]
		}),
		space: {
			lex: true,
			chars: " 	"
		},
		line: {
			lex: true,
			chars: "\r\n",
			rowChars: "\n",
			single: false
		},
		text: { lex: true },
		number: {
			lex: true,
			hex: true,
			oct: true,
			bin: true,
			sep: "_",
			exclude: void 0
		},
		comment: {
			lex: true,
			def: {
				hash: {
					line: true,
					start: "#",
					lex: true,
					eatline: false
				},
				slash: {
					line: true,
					start: "//",
					lex: true,
					eatline: false
				},
				multi: {
					line: false,
					start: "/*",
					end: "*/",
					lex: true,
					eatline: false
				}
			}
		},
		string: {
			lex: true,
			chars: "'\"`",
			multiChars: "`",
			escapeChar: "\\",
			escape: {
				b: "\b",
				f: "\f",
				n: "\n",
				r: "\r",
				t: "	",
				v: "\v",
				"\"": "\"",
				"'": "'",
				"`": "`",
				"\\": "\\",
				"/": "/"
			},
			allowUnknown: true,
			escapeStrict: false,
			allowControl: false,
			abandon: false
		},
		map: {
			extend: true,
			merge: void 0,
			child: false
		},
		list: {
			property: true,
			pair: false,
			child: false
		},
		info: {
			map: false,
			list: false,
			text: false,
			marker: "__info__"
		},
		value: {
			lex: true,
			def: {
				true: { val: true },
				false: { val: false },
				null: { val: null }
			}
		},
		ender: [],
		plugin: {},
		debug: {
			get_console: () => console,
			maxlen: 99,
			print: {
				config: false,
				src: void 0
			}
		},
		error: {
			unknown: "unknown error: {code}",
			unexpected: "unexpected character(s): {src}",
			invalid_unicode: "invalid unicode escape: {src}",
			invalid_ascii: "invalid ascii escape: {src}",
			unprintable: "unprintable character: {src}",
			unterminated_string: "unterminated string: {src}",
			unterminated_comment: "unterminated comment: {src}",
			unknown_rule: "unknown rule: {rulename}",
			end_of_source: "unexpected end of source",
			cancel: "parse cancelled",
			unreadable: "the source could not be read: {src}"
		},
		errmsg: {
			name: "tabnas",
			suffix: true
		},
		hint: {
			unknown: `
Unknown error code: {code}
Details:
{details}`,
			unexpected: `
The character(s) {src} do not match any rule alternative active at
this position.`,
			invalid_unicode: `
The escape sequence {src} does not encode a valid unicode code point.`,
			invalid_ascii: `
The escape sequence {src} does not encode a valid ASCII character.`,
			unprintable: `
The character {src} (code point below 32) is not allowed inside a
string literal.`,
			unterminated_string: `
This string has no end quote.`,
			unterminated_comment: `
This comment is never closed.`,
			unknown_rule: `
No rule named {rulename} is defined.`,
			end_of_source: `
Unexpected end of source.`,
			cancel: `
The parse was cancelled by the caller's parse.budget.onCheck callback
(or exceeded its configured budget) before completing.`,
			unreadable: `
The reader the source came from failed, or gave bytes that
are not UTF-8, so the parse ends where the source does.`
		},
		lex: {
			match: {
				match: {
					order: 1e6,
					make: lexer_1.makeMatchMatcher
				},
				fixed: {
					order: 2e6,
					make: lexer_1.makeFixedMatcher
				},
				space: {
					order: 3e6,
					make: lexer_1.makeSpaceMatcher
				},
				line: {
					order: 4e6,
					make: lexer_1.makeLineMatcher
				},
				string: {
					order: 5e6,
					make: lexer_1.makeStringMatcher
				},
				comment: {
					order: 6e6,
					make: lexer_1.makeCommentMatcher
				},
				number: {
					order: 7e6,
					make: lexer_1.makeNumberMatcher
				},
				text: {
					order: 8e6,
					make: lexer_1.makeTextMatcher
				}
			},
			empty: true,
			emptyResult: void 0,
			relex: false,
			window: false
		},
		parse: {
			prepare: {},
			recover: {
				enabled: false,
				syncGroups: null,
				syncTokens: [],
				popUntilValid: true,
				maxSkip: 64,
				maxRecoveries: 32,
				suppress: 4
			},
			budget: {
				checkEveryN: 0,
				onCheck: null
			}
		},
		rule: {
			start: "val",
			finish: true,
			maxmul: 3,
			history: null,
			include: "",
			exclude: ""
		},
		result: { fail: [] },
		rewind: { history: 64 },
		config: { modify: {} },
		parser: { start: void 0 }
	};
}));
// node_modules/@tabnas/parser/dist/context.js
var require_context = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Context = void 0;
	var Context = class {
		constructor(init) {
			this.uI = 0;
			this.xs = -1;
			this.errs = [];
			this.v = [];
			this.vAbs = 0;
			this.tC = -2;
			this.kI = -1;
			this.rs = [];
			this.rsI = 0;
			this.u = {};
			this.probeOwners = [];
			this.probePass = false;
			this.opts = init.opts;
			this.cfg = init.cfg;
			this.meta = init.meta;
			this.src = init.src;
			this.root = init.root;
			this.plgn = init.plgn;
			this.inst = init.inst;
			this.sub = init.sub;
			this.rsm = init.rsm;
			this.F = init.F;
			this.NOTOKEN = init.NOTOKEN;
			this.NORULE = init.NORULE;
			this.rule = init.NORULE;
			this.t = [init.NOTOKEN, init.NOTOKEN];
		}
		get t0() {
			return this.t[0] ?? this.NOTOKEN;
		}
		set t0(tkn) {
			this.t[0] = tkn;
		}
		get t1() {
			return this.t[1] ?? this.NOTOKEN;
		}
		set t1(tkn) {
			this.t[1] = tkn;
		}
		get v1() {
			return this.v[this.v.length - 1] ?? this.NOTOKEN;
		}
		set v1(tkn) {
			if (0 < this.v.length) this.v[this.v.length - 1] = tkn;
			else this.v.push(tkn);
		}
		get v2() {
			return this.v[this.v.length - 2] ?? this.NOTOKEN;
		}
		set v2(tkn) {
			const L = this.v.length;
			if (1 < L) this.v[L - 2] = tkn;
			else if (1 === L) this.v.unshift(tkn);
			else this.v.push(tkn);
		}
		probeOpen(rule) {
			this.probeOwners.push(rule.d);
			this.probePass = true;
		}
		probeClose() {
			if (0 < this.probeOwners.length) this.probeOwners.pop();
			this.probePass = true;
		}
		probeDepth() {
			return this.probeOwners.length;
		}
		probeAbandon(rule) {
			const probe = 0 < this.probeOwners.length;
			while (0 < this.probeOwners.length && rule.d <= this.probeOwners[this.probeOwners.length - 1]) this.probeOwners.pop();
			return probe;
		}
		probeTake() {
			const probe = 0 < this.probeOwners.length || this.probePass;
			this.probePass = false;
			return probe;
		}
		mark() {
			return this.vAbs;
		}
		rewind(mark) {
			const k = this.vAbs - mark;
			if (k <= 0) return;
			if (k > this.v.length) throw new Error(`tabnas: ctx.rewind target ${mark} is outside the retained history window (oldest mark available is ${this.vAbs - this.v.length}, current is ${this.vAbs}); increase options.rewind.history.`);
			const queue = this.lex.pnt.token;
			const NOTOKEN = this.NOTOKEN;
			const pendingLookahead = [];
			for (let i = 0; i < this.t.length; i++) {
				const tkn = this.t[i];
				if (tkn && tkn !== NOTOKEN) pendingLookahead.push(tkn);
				this.t[i] = NOTOKEN;
			}
			for (let i = pendingLookahead.length - 1; i >= 0; i--) queue.unshift(pendingLookahead[i]);
			for (let i = 0; i < k; i++) queue.unshift(this.v.pop());
			this.vAbs -= k;
			this.lex.pnt.end = void 0;
		}
	};
	exports.Context = Context;
}));
// node_modules/@tabnas/parser/dist/rules.js
var require_rules = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.makeRuleSpec = exports.makeNoRule = exports.makeRule = exports.AltMatch = exports.RuleSpec = exports.Rule = void 0;
	exports.publishedHistoryChildSnapshot = publishedHistoryChildSnapshot;
	exports.refreshHistoryChild = refreshHistoryChild;
	exports.validateAlt = validateAlt;
	exports.validateAlts = validateAlts;
	exports.validateGrammar = validateGrammar;
	exports.continuationTins = continuationTins;
	const types_1 = require_types();
	const utility_1 = require_utility();
	const builtins_1 = require_builtins();
	const error_1 = require_error();
	var Rule = class Rule {
		#node;
		#n;
		#u;
		#k;
		get n() {
			return this.#n ??= Object.create(null);
		}
		set n(v) {
			this.#n = v;
		}
		get u() {
			return this.#u ??= Object.create(null);
		}
		set u(v) {
			this.#u = v;
		}
		get k() {
			return this.#k ??= Object.create(null);
		}
		set k(v) {
			this.#k = v;
		}
		static #nodeProperty = {
			configurable: true,
			enumerable: true,
			get() {
				return this.#node.value;
			},
			set(value) {
				this.#node.value = value;
			}
		};
		rawn() {
			return this.#n;
		}
		rawu() {
			return this.#u;
		}
		rawk() {
			return this.#k;
		}
		constructor(spec, ctx, node, snapshotI) {
			this.i = -1;
			this.name = types_1.EMPTY;
			this.#node = { value: null };
			this.state = types_1.OPEN;
			this.d = -1;
			this.bo = false;
			this.ao = false;
			this.bc = false;
			this.ac = false;
			this.oN = 0;
			this.cN = 0;
			this.need = 0;
			this.i = void 0 === snapshotI ? ctx.uI++ : snapshotI;
			this.name = spec.name;
			this.spec = spec;
			(0, utility_1.defprop)(this, "node", Rule.#nodeProperty);
			this.child = ctx.NORULE;
			this.parent = ctx.NORULE;
			this.prev = ctx.NORULE;
			this.next = ctx.NORULE;
			this._NOTOKEN = ctx.NOTOKEN;
			this.o = [];
			this.c = [];
			this.node = node;
			this.d = ctx.rsI;
			this.bo = null != spec.def.bo;
			this.ao = null != spec.def.ao;
			this.bc = null != spec.def.bc;
			this.ac = null != spec.def.ac;
		}
		snapshot(ctx) {
			const copy = new Rule(this.spec, ctx, this.node, this.i);
			copy.#node = this.#node;
			copy.name = this.name;
			copy.state = this.state;
			copy.d = this.d;
			copy.bo = this.bo;
			copy.ao = this.ao;
			copy.bc = this.bc;
			copy.ac = this.ac;
			copy.oN = this.oN;
			copy.cN = this.cN;
			copy.child = this.child;
			copy.parent = this.parent;
			copy.prev = this.prev;
			copy.next = this.next;
			copy.o = this.o.slice();
			copy.c = this.c.slice();
			copy._NOTOKEN = this._NOTOKEN;
			copy.need = this.need;
			copy.why = this.why;
			if (void 0 !== this.#n) copy.#n = Object.assign(Object.create(null), this.#n);
			if (void 0 !== this.#u) copy.#u = Object.assign(Object.create(null), this.#u);
			if (void 0 !== this.#k) copy.#k = Object.assign(Object.create(null), this.#k);
			return copy;
		}
		get o0() {
			return this.o[0] ?? this._NOTOKEN;
		}
		set o0(v) {
			this.o[0] = v;
		}
		get o1() {
			return this.o[1] ?? this._NOTOKEN;
		}
		set o1(v) {
			this.o[1] = v;
		}
		get c0() {
			return this.c[0] ?? this._NOTOKEN;
		}
		set c0(v) {
			this.c[0] = v;
		}
		get c1() {
			return this.c[1] ?? this._NOTOKEN;
		}
		set c1(v) {
			this.c[1] = v;
		}
		get os() {
			return this.oN;
		}
		set os(v) {
			this.oN = v;
		}
		get cs() {
			return this.cN;
		}
		set cs(v) {
			this.cN = v;
		}
		process(ctx, lex) {
			return this.spec.process(this, ctx, lex, this.state);
		}
		eq(counter, limit = 0) {
			return (this.#n?.[counter] ?? 0) === limit;
		}
		lt(counter, limit = 0) {
			return (this.#n?.[counter] ?? 0) < limit;
		}
		gt(counter, limit = 0) {
			return (this.#n?.[counter] ?? 0) > limit;
		}
		lte(counter, limit = 0) {
			return (this.#n?.[counter] ?? 0) <= limit;
		}
		gte(counter, limit = 0) {
			return (this.#n?.[counter] ?? 0) >= limit;
		}
		/** Has this counter been set at all? The comparison helpers read an unset
		* counter as 0, so they cannot distinguish "never counted" from "counted
		* zero"; this can. (Declarative equivalent: `{ 'n.k': { $exist: true } }`.) */
		exist(counter) {
			return null != this.#n?.[counter];
		}
		toString() {
			return "[Rule " + this.name + "~" + this.i + "]";
		}
	};
	exports.Rule = Rule;
	const makeRule = (...params) => new Rule(...params);
	exports.makeRule = makeRule;
	const makeNoRule = (j, ctx) => makeRule(makeRuleSpec(j, ctx.cfg, {}), ctx);
	exports.makeNoRule = makeNoRule;
	function boundedRuleHistory(rule, ctx, history, link) {
		if (null == history) return rule;
		const links = [];
		let current = rule;
		while (current !== ctx.NORULE && links.length < history) {
			links.push(current);
			current = current.prev;
		}
		let prev = ctx.NORULE;
		for (let depth = links.length - 1; 0 <= depth; depth--) {
			const copy = links[depth].snapshot(ctx);
			if (0 !== depth || "parent" !== link) {
				copy.child = ctx.NORULE;
				copy.next = ctx.NORULE;
			}
			copy.prev = prev;
			prev = copy;
		}
		return prev;
	}
	function freezePushedChild(rule, next, ctx) {
		const frozen = next.snapshot(ctx);
		if (rule.child === next) rule.child = frozen;
		if (rule.next === next) rule.next = frozen;
	}
	function freezeHistoryChild(rule, ctx) {
		const pusher = rule.historyPusher;
		if (null == pusher || pusher.child.i !== rule.i) return;
		const frozen = boundedRuleHistory(rule, ctx, ctx.cfg.rule.history, "prev");
		pusher.child = frozen;
		if (pusher.next.i === rule.i) pusher.next = frozen;
	}
	function publishedHistoryChildSnapshot(rule, ctx) {
		const pusher = rule.historyPusher;
		if (null == pusher || pusher.child.i !== rule.i) return void 0;
		return pusher.child.snapshot(ctx);
	}
	function mergeHistoryRecord(target, base, published) {
		const baseRecord = base ?? {};
		const publishedRecord = published ?? {};
		const keys = /* @__PURE__ */ new Set([...Object.keys(baseRecord), ...Object.keys(publishedRecord)]);
		let out;
		for (const key of keys) {
			const inBase = Object.prototype.hasOwnProperty.call(baseRecord, key);
			const inPublished = Object.prototype.hasOwnProperty.call(publishedRecord, key);
			const baseValue = baseRecord[key];
			const publishedValue = publishedRecord[key];
			if (inBase === inPublished && (!inBase || Object.is(baseValue, publishedValue))) continue;
			out ??= target();
			if (inPublished) out[key] = publishedValue;
			else delete out[key];
		}
	}
	function sameHistoryArray(left, right) {
		return left.length === right.length && left.every((value, i) => value === right[i]);
	}
	function refreshHistoryChild(rule, ctx, base) {
		const pusher = rule.historyPusher;
		if (null == pusher || pusher.child.i !== rule.i) return;
		const published = pusher.child;
		const frozen = boundedRuleHistory(rule, ctx, ctx.cfg.rule.history, "prev");
		if (null != base) {
			mergeHistoryRecord(() => frozen.n, base.rawn(), published.rawn());
			mergeHistoryRecord(() => frozen.u, base.rawu(), published.rawu());
			mergeHistoryRecord(() => frozen.k, base.rawk(), published.rawk());
			if (!sameHistoryArray(base.o, published.o)) {
				frozen.o = published.o.slice();
				frozen.oN = published.oN;
			}
			if (!sameHistoryArray(base.c, published.c)) {
				frozen.c = published.c.slice();
				frozen.cN = published.cN;
			}
			if (base.need !== published.need) frozen.need = published.need;
			if (base.why !== published.why) frozen.why = published.why;
		}
		pusher.child = frozen;
		if (pusher.next.i === rule.i) pusher.next = frozen;
	}
	var AltMatch = class {
		constructor() {
			this.p = types_1.EMPTY;
			this.r = types_1.EMPTY;
			this.b = 0;
		}
	};
	exports.AltMatch = AltMatch;
	const makeAltMatch = (...params) => new AltMatch(...params);
	const EMPTY_ALT = makeAltMatch();
	var RuleSpec = class {
		constructor(j, cfg, def) {
			this.name = types_1.EMPTY;
			this.def = {
				open: [],
				close: [],
				bo: [],
				bc: [],
				ao: [],
				ac: [],
				tcol: [],
				first: [],
				fnref: {}
			};
			this.ji = j;
			this.cfg = cfg;
			this.def = Object.assign(this.def, def);
			this.def.open = (this.def.open || []).filter((alt) => null != alt);
			this.def.close = (this.def.close || []).filter((alt) => null != alt);
			for (let alt of this.def.open) normalt(alt, types_1.OPEN, this);
			for (let alt of this.def.close) normalt(alt, types_1.CLOSE, this);
			for (let an of [
				"bo",
				"ao",
				"bc",
				"ac"
			]) for (let sa of this.def[an] ?? []) if ("object" === typeof sa) {
				let sadef = sa;
				this[an](sadef.append, sadef.action);
			}
		}
		tin(ref) {
			return (0, utility_1.tokenize)(ref, this.cfg);
		}
		fnref(frm) {
			Object.assign(this.def.fnref, frm);
			const rn = this.name;
			const fr = this.def.fnref;
			const installed = this.def.fnrefInstalled = this.def.fnrefInstalled || /* @__PURE__ */ new Map();
			const replaced = this.def.fnrefReplaced = this.def.fnrefReplaced || /* @__PURE__ */ new Set();
			const reserved = [
				`@${rn}-bo`,
				`@${rn}-ao`,
				`@${rn}-bc`,
				`@${rn}-ac`
			];
			for (let base of reserved) {
				let phaseSet = installed.get(base);
				if (!phaseSet) installed.set(base, phaseSet = /* @__PURE__ */ new WeakSet());
				const aname = base.substring(base.length - 2);
				const replaceFn = fr[base + "/replace"];
				if (replaceFn) {
					if (!replaced.has(base)) {
						replaced.add(base);
						this.def[aname].length = 0;
						phaseSet = /* @__PURE__ */ new WeakSet();
						installed.set(base, phaseSet);
						phaseSet.add(replaceFn);
						this[aname](true, replaceFn);
					}
					continue;
				}
				if (replaced.has(base)) continue;
				const prependFn = fr[base + "/prepend"];
				const appendFn = fr[base + "/append"] ?? fr[base];
				if (prependFn && !phaseSet.has(prependFn)) {
					phaseSet.add(prependFn);
					this[aname](false, prependFn);
				}
				if (appendFn && !phaseSet.has(appendFn)) {
					phaseSet.add(appendFn);
					this[aname](true, appendFn);
				}
			}
			return this;
		}
		add(rs, a, mods) {
			let inject = mods?.append ? "push" : "unshift";
			let aa = ((0, utility_1.isarr)(a) ? a : [a]).filter((alt) => null != alt && "object" === typeof alt).map((a) => normalt(a, rs, this));
			let altState = "o" === rs ? "open" : "close";
			let alts = this.def[altState];
			if (mods?.clear) alts.length = 0;
			if ("push" === inject) for (let aI = 0; aI < aa.length; aI++) alts.push(aa[aI]);
			else {
				const old = alts.splice(0, alts.length);
				for (let aI = 0; aI < aa.length; aI++) alts.push(aa[aI]);
				for (let oI = 0; oI < old.length; oI++) alts.push(old[oI]);
			}
			alts = this.def[altState] = (0, utility_1.modlist)(alts, mods);
			this.norm();
			return this;
		}
		open(a, mods) {
			return this.add("o", a, mods);
		}
		close(a, mods) {
			return this.add("c", a, mods);
		}
		action(append, step, state, action) {
			let actions = this.def[step + state];
			if (append) actions.push(action);
			else actions.unshift(action);
			return this;
		}
		bo(append, action) {
			return this.action(action ? !!append : true, types_1.BEFORE, types_1.OPEN, "string" === typeof append ? this.def.fnref[append] : action ?? append);
		}
		ao(append, action) {
			return this.action(action ? !!append : true, types_1.AFTER, types_1.OPEN, "string" === typeof append ? this.def.fnref[append] : action ?? append);
		}
		bc(append, action) {
			return this.action(action ? !!append : true, types_1.BEFORE, types_1.CLOSE, "string" === typeof append ? this.def.fnref[append] : action ?? append);
		}
		ac(append, action) {
			return this.action(action ? !!append : true, types_1.AFTER, types_1.CLOSE, "string" === typeof append ? this.def.fnref[append] : action ?? append);
		}
		clear() {
			this.def.open.length = 0;
			this.def.close.length = 0;
			this.def.bo.length = 0;
			this.def.ao.length = 0;
			this.def.bc.length = 0;
			this.def.ac.length = 0;
			return this;
		}
		clearOpen() {
			this.def.open.length = 0;
			return this;
		}
		clearClose() {
			this.def.close.length = 0;
			return this;
		}
		clearActions(...phases) {
			const all = 0 < phases.length ? phases : [
				"bo",
				"ao",
				"bc",
				"ac"
			];
			const installed = this.def.fnrefInstalled;
			const replaced = this.def.fnrefReplaced;
			for (const p of all) {
				this.def[p].length = 0;
				const base = `@${this.name}-${p}`;
				installed && installed.delete(base);
				replaced && replaced.delete(base);
			}
			return this;
		}
		norm() {
			this.def.open.map((alt) => normalt(alt, types_1.OPEN, this));
			this.def.close.map((alt) => normalt(alt, types_1.CLOSE, this));
			const columns = [];
			const maxS = (alts) => alts.reduce((m, a) => Math.max(m, a.sN || 0), 0);
			const maxOpen = maxS(this.def.open);
			const maxClose = maxS(this.def.close);
			for (let tI = 0; tI < maxOpen; tI++) this.def.open.reduce(...collate(0, tI, columns));
			for (let tI = 0; tI < maxClose; tI++) this.def.close.reduce(...collate(1, tI, columns));
			columns[0] = columns[0] || [];
			columns[1] = columns[1] || [];
			for (let tI = 0; tI < maxOpen; tI++) columns[0][tI] = columns[0][tI] || [];
			for (let tI = 0; tI < maxClose; tI++) columns[1][tI] = columns[1][tI] || [];
			this.def.tcol = columns;
			this.def.first = [indexFirst(this.def.open), indexFirst(this.def.close)];
			function collate(stateI, tokenI, columns) {
				columns[stateI] = columns[stateI] || [];
				return [function(tins, alt) {
					let resolved = alt.t && alt.t[tokenI];
					if (resolved && 0 < resolved.length) {
						let newtins = [...new Set(tins.concat(resolved))];
						tins.length = 0;
						tins.push(...newtins);
					}
					return tins;
				}, columns[stateI][tokenI] = columns[stateI][tokenI] || []];
			}
			return this;
		}
		process(rule, ctx, lex, state) {
			ctx.log && ctx.log(utility_1.S.rule, ctx, rule, lex);
			let is_open = state === "o";
			let next = is_open ? rule : ctx.NORULE;
			let why = is_open ? "O" : "C";
			let def = this.def;
			const logging = null != ctx.log;
			let alts = is_open ? def.open : def.close;
			let befores = is_open ? rule.bo ? def.bo : null : rule.bc ? def.bc : null;
			if (rule._skipBefores) {
				rule._skipBefores = false;
				befores = null;
			}
			if (befores) {
				let bout = void 0;
				for (let bI = 0; bI < befores.length; bI++) {
					bout = befores[bI].call(this, rule, ctx, next, bout);
					if (bout?.isToken && bout?.err) return this.bad(bout, rule, ctx, { is_open });
				}
			}
			let alt = 0 < alts.length ? parse_alts(is_open, alts, lex, rule, ctx) : EMPTY_ALT;
			if (alt.h) {
				alt = alt.h(rule, ctx, alt, next) || alt;
				if (logging) why += "H";
			}
			ctx._dalt = 0 < alts.length ? alt : null;
			if (null == alt.e && alt.ef) {
				const errTkn = alt.ef(rule, ctx, alt);
				if (errTkn) alt.e = errTkn;
			}
			if (alt.e) return this.bad(alt.e, rule, ctx, { is_open });
			if (alt.n) {
				const rn = rule.n;
				for (let cn in alt.n) rn[cn] = 0 === alt.n[cn] ? 0 : (null == rn[cn] ? 0 : rn[cn]) + alt.n[cn];
			}
			if (alt.u) rule.u = Object.assign(rule.u, alt.u);
			if (alt.k) rule.k = Object.assign(rule.k, alt.k);
			let consumed = rule[is_open ? "oN" : "cN"] - (alt.b || 0);
			if (consumed < 0) consumed = 0;
			if (0 < consumed) {
				const NOTOKEN = ctx.NOTOKEN;
				for (let i = 0; i < consumed; i++) {
					ctx.v.push(ctx.t[i]);
					ctx.t[i] = NOTOKEN;
				}
				ctx.vAbs += consumed;
				const cap = ctx.cfg.rewind.history;
				if (cap !== 1e400 && ctx.v.length > 2 * cap) ctx.v.splice(0, ctx.v.length - cap);
			}
			if (alt.a) {
				if (logging) why += "A";
				let tout = alt.a(rule, ctx, alt);
				if (tout && tout.isToken && tout.err) return this.bad(tout, rule, ctx, { is_open });
			}
			let boundedPush = false;
			let boundedReplace = false;
			let popped = false;
			if (alt.p) {
				ctx.rs[ctx.rsI++] = rule;
				let rulespec = ctx.rsm[alt.p];
				if (rulespec) {
					next = makeRule(rulespec, ctx, rule.node);
					const pn = rule.rawn();
					if (void 0 !== pn) {
						let nn = void 0;
						for (let cn in pn) (nn ??= next.n)[cn] = pn[cn];
					}
					const pk = rule.rawk();
					if (void 0 !== pk) {
						let nk = void 0;
						for (let kn in pk) (nk ??= next.k)[kn] = pk[kn];
					}
					boundedPush = null != ctx.cfg.rule.history;
					if (boundedPush) {
						next.parent = boundedRuleHistory(rule, ctx, ctx.cfg.rule.history, "pusherBefore");
						rule.child = next;
						next.historyPusher = rule;
					} else {
						next.parent = rule;
						rule.child = next;
					}
					if (logging) why += "P`" + alt.p + "`";
				} else return this.bad(this.unknownRule(ctx.t0, alt.p), rule, ctx, { is_open });
			} else if (alt.r) {
				let rulespec = ctx.rsm[alt.r];
				if (rulespec) {
					next = makeRule(rulespec, ctx, rule.node);
					next.parent = rule.parent;
					boundedReplace = null != ctx.cfg.rule.history;
					if (!boundedReplace) next.prev = rule;
					else next.historyPusher = rule.historyPusher;
					const pn = rule.rawn();
					if (void 0 !== pn) {
						let nn = void 0;
						for (let cn in pn) (nn ??= next.n)[cn] = pn[cn];
					}
					const pk = rule.rawk();
					if (void 0 !== pk) {
						let nk = void 0;
						for (let kn in pk) (nk ??= next.k)[kn] = pk[kn];
					}
					if (logging) why += "R`" + alt.r + "`";
				} else return this.bad(this.unknownRule(ctx.t0, alt.r), rule, ctx, { is_open });
			} else if (!is_open) {
				popped = true;
				next = ctx.rs[--ctx.rsI] || ctx.NORULE;
			}
			rule.next = next;
			let afters = is_open ? rule.ao ? def.ao : null : rule.ac ? def.ac : null;
			if (afters) {
				let aout = void 0;
				for (let aI = 0; aI < afters.length; aI++) {
					aout = afters[aI](rule, ctx, next, aout);
					if (aout?.isToken && aout?.err) {
						if (boundedPush) freezePushedChild(rule, next, ctx);
						return this.bad(aout, rule, ctx, { is_open });
					}
				}
			}
			next.why = why;
			ctx.log && ctx.log(utility_1.S.node, ctx, rule, lex, next);
			if (types_1.OPEN === rule.state) rule.state = types_1.CLOSE;
			if (boundedPush) {
				freezePushedChild(rule, next, ctx);
				next.parent = boundedRuleHistory(rule, ctx, ctx.cfg.rule.history, "parent");
			} else if (boundedReplace) {
				next.prev = boundedRuleHistory(rule, ctx, ctx.cfg.rule.history, "prev");
				freezeHistoryChild(rule, ctx);
				rule.next = ctx.NORULE;
			} else if (popped && null != ctx.cfg.rule.history) freezeHistoryChild(rule, ctx);
			if (0 < consumed) {
				const L = ctx.t.length;
				for (let i = 0; i < L - consumed; i++) ctx.t[i] = ctx.t[i + consumed];
				for (let i = Math.max(0, L - consumed); i < L; i++) ctx.t[i] = ctx.NOTOKEN;
			}
			return next;
		}
		bad(tkn, rule, ctx, parse) {
			if ((ctx.cfg?.parse?.recover)?.enabled) {
				const next = attemptRecover(tkn, rule, ctx, parse);
				if (null != next) return next;
				const lastErr = ctx.errs?.[ctx.errs.length - 1];
				if (null != lastErr) throw lastErr;
			}
			throw new error_1.TabnasError(tkn.err || utility_1.S.unexpected, {
				...tkn.use,
				state: parse.is_open ? utility_1.S.open : utility_1.S.close
			}, tkn, rule, ctx);
		}
		unknownRule(tkn, name) {
			tkn.err = "unknown_rule";
			tkn.use = tkn.use || {};
			tkn.use.rulename = name;
			return tkn;
		}
	};
	exports.RuleSpec = RuleSpec;
	const makeRuleSpec = (...params) => new RuleSpec(...params);
	exports.makeRuleSpec = makeRuleSpec;
	const closeInfoCache = /* @__PURE__ */ new WeakMap();
	const MID_CONSTRUCT = {
		unprintable: true,
		invalid_unicode: true,
		invalid_ascii: true
	};
	function advanceLexPast(lex, t, toLineEnd) {
		const pnt = lex.pnt;
		const src = lex.src;
		const rowsObj = (lex.ctx?.cfg)?.line?.rowChars;
		const isRow = (ch) => null != rowsObj ? !!rowsObj[ch] : "\n" === ch;
		let target = Math.max(pnt.sI, t.sI + Math.max(1, t.len | 0));
		if (toLineEnd) {
			let e = target;
			while (e < src.length && !isRow(src[e])) e++;
			target = Math.max(target, Math.min(src.length, e + 1));
		}
		while (pnt.sI < target && pnt.sI < src.length) {
			if (isRow(src[pnt.sI])) {
				pnt.rI++;
				pnt.cI = 1;
			} else pnt.cI++;
			pnt.sI++;
		}
	}
	function closeInfo(spec, groups, sig) {
		const close = spec.def?.close ?? [];
		let info = closeInfoCache.get(close);
		if (null == info || info.len !== close.length || info.sig !== sig) {
			const sync = /* @__PURE__ */ new Set();
			const all = /* @__PURE__ */ new Set();
			let any = false;
			for (const alt of close) {
				if (0 === (alt.sN | 0)) {
					any = true;
					continue;
				}
				const lead = alt.t?.[0] ?? [];
				for (const tin of lead) all.add(tin);
				const g = alt.g ?? [];
				for (const tag of g) if (groups.includes(tag)) {
					for (const tin of lead) sync.add(tin);
					break;
				}
			}
			info = {
				len: close.length,
				sig,
				sync,
				all,
				any
			};
			closeInfoCache.set(close, info);
		}
		return info;
	}
	function computeSyncTins(ctx, rule) {
		const rec = ctx.cfg.parse.recover;
		const sig = rec.syncGroups.join(",");
		const out = /* @__PURE__ */ new Set();
		const addSync = (r) => {
			if (null != r && r !== ctx.NORULE) closeInfo(r.spec, rec.syncGroups, sig).sync.forEach((t) => out.add(t));
		};
		addSync(rule);
		for (let d = ctx.rsI - 1; 0 <= d; d--) addSync(ctx.rs[d]);
		if (0 === out.size) {
			const addAll = (r) => {
				if (null != r && r !== ctx.NORULE) closeInfo(r.spec, rec.syncGroups, sig).all.forEach((t) => out.add(t));
			};
			addAll(rule);
			for (let d = ctx.rsI - 1; 0 <= d; d--) addAll(ctx.rs[d]);
		}
		for (const tin of rec.syncTins) out.add(tin);
		return out;
	}
	function acceptsClose(spec, tin, groups, sig) {
		const info = closeInfo(spec, groups, sig);
		return info.any || info.all.has(tin);
	}
	function altMatchDepth(alt, ctx) {
		const aN = alt.sN | 0;
		const tbuf = ctx.t;
		const NOTOKEN = ctx.NOTOKEN;
		const bitAA = 1 << ctx.cfg.t.AA - 1;
		let k = 0;
		while (k < aN) {
			const tk = tbuf[k];
			if (null == tk || NOTOKEN === tk) break;
			const Sk = alt.S ? alt.S[k] : null;
			if (null != Sk) {
				const tin = tk.tin;
				const part = tin / 31 | 0;
				const aaBit = 0 === part ? bitAA : 0;
				if (0 === (Sk[part] & (1 << tin % 31 - 1 | aaBit))) break;
			}
			k++;
		}
		return k;
	}
	function continuationTins(ctx, rule, atPos) {
		const out = /* @__PURE__ */ new Set();
		if (null == rule || null == ctx || rule === ctx.NORULE) return [];
		const queryPos = null == atPos ? 0 : atPos;
		const cont = ctx._contTins;
		if (null != cont && 0 < cont.length) for (const t of cont) out.add(t);
		else {
			const stateAltsNow = types_1.OPEN === rule.state ? rule.spec.def?.open : rule.spec.def?.close;
			for (const a of stateAltsNow ?? []) {
				const aN = a.sN | 0;
				const k = altMatchDepth(a, ctx);
				if (k === queryPos && k < aN) for (const t of a.t?.[k] ?? []) out.add(t);
			}
		}
		let r = rule;
		let d = ctx.rsI - 1;
		for (;;) {
			if (!closeInfo(r.spec, [], "").any) break;
			const parent = 0 <= d ? ctx.rs[d--] : void 0;
			if (null == parent || parent === ctx.NORULE) break;
			const pAt = (parent.spec.def?.tcol)?.[1]?.[0] ?? [];
			for (const t of pAt) out.add(t);
			r = parent;
		}
		const opened = /* @__PURE__ */ new Set();
		const addOpeners = (name) => {
			if (null == name || false === name || 0 === name) return;
			const rn = String(name);
			if ("" === rn || opened.has(rn)) return;
			opened.add(rn);
			const spec = ctx.rsm[rn];
			if (null == spec) return;
			const openTins = spec.def?.tcol?.[0]?.[0] ?? [];
			for (const t of openTins) out.add(t);
			for (const a of spec.def?.open ?? []) if (0 === (a.sN | 0)) {
				addOpeners(a.p);
				addOpeners(a.r);
			}
		};
		const stateAlts = types_1.OPEN === rule.state ? rule.spec.def?.open : rule.spec.def?.close;
		for (const a of stateAlts ?? []) {
			const aN = a.sN | 0;
			if (altMatchDepth(a, ctx) !== aN) continue;
			const ab = a.b;
			if (null != ab && false !== ab && "number" !== typeof ab) continue;
			if (aN - ("number" === typeof ab ? ab : 0) !== queryPos) continue;
			addOpeners(a.p);
			addOpeners(a.r);
		}
		return [...out].sort((a, b) => a - b);
	}
	function attemptRecover(tkn, rule, ctx, parse) {
		const rec = ctx.cfg.parse.recover;
		const lex = ctx.lex;
		if (null == lex) return void 0;
		const err = new error_1.TabnasError(tkn.err || tkn.why || utility_1.S.unexpected, {
			...tkn.use,
			state: parse.is_open ? utility_1.S.open : utility_1.S.close
		}, tkn, rule, ctx);
		const lastAbs = ctx._recoverAt;
		if (null != lastAbs && ctx.vAbs - lastAbs < rec.suppress) {
			if (ctx.errs[ctx.errs.length - 1] === err) ctx.errs.pop();
		}
		if (rec.maxRecoveries < ctx.errs.length) return void 0;
		const lastSI = ctx._recoverSI ?? -1;
		const noProgress = null != lastAbs && lastAbs === ctx.vAbs;
		ctx._recoverAt = ctx.vAbs;
		const sync = computeSyncTins(ctx, rule);
		const ZZ = ctx.cfg.t.ZZ;
		const BD = ctx.cfg.t.BD;
		const IGNORE = ctx.cfg.tokenSetTins.IGNORE;
		const NOTOKEN = ctx.NOTOKEN;
		const tbuf = ctx.t;
		const advancePast = (t, toLineEnd) => advanceLexPast(lex, t, toLineEnd);
		const pending = [];
		for (let i = 0; i < tbuf.length; i++) {
			const t = tbuf[i];
			if (null != t && NOTOKEN !== t) pending.push(t);
			tbuf[i] = NOTOKEN;
		}
		const fetch = () => {
			let t;
			do
				t = lex.next(rule);
			while (IGNORE[t.tin]);
			return t;
		};
		let cand = 0 < pending.length ? pending.shift() : fetch();
		let skipped = 0;
		while (ZZ !== cand.tin && (!sync.has(cand.tin) || noProgress && cand.sI <= lastSI)) {
			if (BD === cand.tin) advancePast(cand, true === MID_CONSTRUCT[cand.why]);
			if (rec.maxSkip <= skipped++) return void 0;
			cand = 0 < pending.length ? pending.shift() : fetch();
		}
		if (ZZ === cand.tin && noProgress && lastSI >= cand.sI) return;
		ctx._recoverSI = cand.sI;
		tbuf[0] = cand;
		for (let i = 0; i < pending.length && i + 1 < tbuf.length; i++) tbuf[i + 1] = pending[i];
		err.recovered = {
			skipped,
			sync: cand.tin
		};
		const sig = rec.syncGroups.join(",");
		if (rec.popUntilValid) {
			if (rule !== ctx.NORULE && acceptsClose(rule.spec, cand.tin, rec.syncGroups, sig)) {
				if (types_1.OPEN === rule.state) rule.state = types_1.CLOSE;
				else if (!parse.is_open) rule._skipBefores = true;
				return rule;
			}
			if (rule !== ctx.NORULE) freezeHistoryChild(rule, ctx);
			const probe = rule !== ctx.NORULE && ctx.probeAbandon(rule);
			if (rule !== ctx.NORULE && ctx.sub.ruleDone) {
				const publishedBefore = publishedHistoryChildSnapshot(rule, ctx);
				const done = {
					state: types_1.CLOSE,
					alt: null,
					forced: true,
					probe
				};
				ctx.sub.ruleDone.map((s) => s(rule, ctx, done));
				refreshHistoryChild(rule, ctx, publishedBefore);
			}
			while (0 < ctx.rsI) {
				const r = ctx.rs[--ctx.rsI];
				if (null != r && acceptsClose(r.spec, cand.tin, rec.syncGroups, sig)) return r;
				if (null != r) freezeHistoryChild(r, ctx);
				const probe = null != r && ctx.probeAbandon(r);
				if (null != r && ctx.sub.ruleDone) {
					const publishedBefore = publishedHistoryChildSnapshot(r, ctx);
					const done = {
						state: types_1.CLOSE,
						alt: null,
						forced: true,
						probe
					};
					ctx.sub.ruleDone.map((s) => s(r, ctx, done));
					refreshHistoryChild(r, ctx, publishedBefore);
				}
			}
			return;
		}
		if (rule !== ctx.NORULE) {
			freezeHistoryChild(rule, ctx);
			ctx.probeAbandon(rule);
		}
		if (0 < ctx.rsI) return ctx.rs[--ctx.rsI];
	}
	const NO_ALTS = [];
	function indexFirst(alts) {
		const byTin = /* @__PURE__ */ new Map();
		const wild = [];
		for (let aI = 0; aI < alts.length; aI++) {
			const a = alts[aI];
			if (0 === (a.sN | 0) || null == a.S || null == a.S[0]) {
				wild.push(aI);
				continue;
			}
			for (const tin of a.t[0] ?? []) {
				let list = byTin.get(tin);
				if (null == list) {
					list = [];
					byTin.set(tin, list);
				}
				if (list[list.length - 1] !== aI) list.push(aI);
			}
		}
		return {
			alts,
			n: alts.length,
			byTin,
			wild
		};
	}
	function parse_alts(is_open, alts, lex, rule, ctx) {
		let out = ctx._palt || (ctx._palt = makeAltMatch());
		ctx._contTins = void 0;
		out.b = 0;
		out.p = types_1.EMPTY;
		out.r = types_1.EMPTY;
		out.n = void 0;
		out.h = void 0;
		out.a = void 0;
		out.u = void 0;
		out.k = void 0;
		out.e = void 0;
		let alt = null;
		let altI = 0;
		let t = ctx.cfg.t;
		let cond = true;
		let bitAA = 1 << t.AA - 1;
		let IGNORE = ctx.cfg.tokenSetTins.IGNORE;
		let BD = t.BD;
		const UNEXPECTED = utility_1.S.unexpected;
		let len = alts.length;
		const NOTOKEN = ctx.NOTOKEN;
		const tbuf = ctx.t;
		const RELEX = ctx.cfg.lex.relex;
		let unI = -1;
		let unTkn = NOTOKEN;
		let unSI = 0;
		let unRI = 0;
		let unCI = 0;
		let unQueue = null;
		let unEnd = void 0;
		let unTokens = null;
		let deepest = 0;
		const built = RELEX ? void 0 : rule.spec.def.first?.[is_open ? 0 : 1];
		let first = null != built && built.alts === alts && built.n === len ? built : void 0;
		let named = null;
		let wild = NO_ALTS;
		let nI = 0;
		let wI = 0;
		let keyTin = BD;
		altI = 0;
		while (altI < len) {
			if (null == named && null != first) {
				const t0 = tbuf[0];
				if (null != t0 && NOTOKEN !== t0 && BD !== t0.tin) {
					keyTin = t0.tin;
					named = first.byTin.get(keyTin) ?? NO_ALTS;
					wild = first.wild;
					nI = 0;
					wI = 0;
					while (nI < named.length && named[nI] < altI) nI++;
					while (wI < wild.length && wild[wI] < altI) wI++;
				}
			}
			if (null != named) {
				const n = nI < named.length ? named[nI] : len;
				const w = wI < wild.length ? wild[wI] : len;
				if (n >= len && w >= len) {
					altI = len;
					cond = false;
					alt = null;
					break;
				}
				if (n < w) {
					altI = n;
					nI++;
				} else {
					altI = w;
					wI++;
				}
			}
			alt = alts[altI];
			let matched = 0;
			cond = true;
			unI = -1;
			const S = alt.S;
			const sN = alt.sN | 0;
			for (let i = 0; i < sN; i++) {
				let tkn = tbuf[i];
				if (null == tkn || NOTOKEN === tkn) {
					let refetch = false;
					do {
						refetch = false;
						tkn = lex.next(rule, alt, altI, i);
						ctx.tC++;
						if (BD === tkn.tin && !RELEX) {
							let details = {};
							if (null != tkn.use) details.use = tkn.use;
							const rec = ctx.cfg.parse.recover;
							if (rec.enabled) {
								const bderr = new error_1.TabnasError(tkn.why || UNEXPECTED, details, tkn, rule, ctx);
								const runEnd = ctx._badTo;
								const runErr = ctx._badErr;
								const lastAbs = ctx._recoverAt;
								if (null != runEnd && tkn.sI <= runEnd && null != runErr && ctx.errs[ctx.errs.length - 1] === bderr) {
									ctx.errs.pop();
									runErr.recovered.skipped++;
									if (rec.maxSkip < runErr.recovered.skipped) throw bderr;
								} else if (null != lastAbs && ctx.vAbs - lastAbs < rec.suppress && ctx.errs[ctx.errs.length - 1] === bderr) {
									ctx.errs.pop();
									ctx._badErr = null;
								} else {
									bderr.recovered = {
										skipped: 1,
										bad: true
									};
									ctx._badErr = bderr;
									ctx._recoverAt = ctx.vAbs;
								}
								ctx._badTo = tkn.sI + Math.max(1, tkn.len | 0);
								if (rec.maxRecoveries < ctx.errs.length) throw bderr;
								advanceLexPast(lex, tkn, true === MID_CONSTRUCT[tkn.why]);
								refetch = true;
								continue;
							}
							throw new error_1.TabnasError(tkn.why || UNEXPECTED, details, tkn, rule, ctx);
						}
					} while (refetch || IGNORE[tkn.tin]);
					tbuf[i] = tkn;
				}
				const Si = S ? S[i] : null;
				const isBad = BD === tkn.tin;
				if (isBad || null != Si) {
					let hit = false;
					if (!isBad && null != Si) {
						const tin = tkn.tin;
						const part = tin / 31 | 0;
						const aaBit = part === 0 ? bitAA : 0;
						hit = 0 !== (Si[part] & (1 << tin % 31 - 1 | aaBit));
					}
					if (!hit) {
						let recut = void 0;
						if (RELEX && 0 < tkn.len) {
							const want = alt.t[i];
							if (null != want && 0 < want.length) recut = lex.relex(tkn, want, rule);
						}
						if (null == recut) {
							cond = false;
							break;
						}
						if (-1 === unI) {
							const u = lex.relexUndo;
							unI = i;
							unTkn = tkn;
							unTokens = tbuf.slice();
							unSI = u.sI;
							unRI = u.rI;
							unCI = u.cI;
							unQueue = u.token;
							unEnd = u.end;
						}
						tbuf[i] = recut;
						for (let j = i + 1; j < tbuf.length; j++) tbuf[j] = NOTOKEN;
					}
				}
				matched = i + 1;
			}
			if (cond) {
				if (is_open) {
					rule.oN = matched;
					for (let i = 0; i < matched; i++) rule.o[i] = tbuf[i];
					for (let i = matched; i < rule.o.length; i++) rule.o[i] = NOTOKEN;
				} else {
					rule.cN = matched;
					for (let i = 0; i < matched; i++) rule.c[i] = tbuf[i];
					for (let i = matched; i < rule.c.length; i++) rule.c[i] = NOTOKEN;
				}
				if (alt.c) cond = alt.c(rule, ctx, out);
			}
			if (cond) break;
			else {
				if (matched > deepest) deepest = matched;
				alt = null;
				if (-1 !== unI) {
					lex.unrelex(unSI, unRI, unCI, unQueue, unEnd);
					const restored = unTokens;
					tbuf.length = restored.length;
					for (let j = 0; j < restored.length; j++) tbuf[j] = restored[j];
					if (ctx.sub.lex) ctx.sub.lex.map((sub) => sub(unTkn, rule, ctx));
					unI = -1;
				}
			}
			const stale = null != first && first !== rule.spec.def.first?.[is_open ? 0 : 1];
			if (stale) first = void 0;
			if (null == named) altI++;
			else {
				const t0 = tbuf[0];
				if (stale || null == t0 || NOTOKEN === t0 || keyTin !== t0.tin) {
					named = null;
					altI++;
				}
			}
		}
		if (!cond) {
			const bad = tbuf[0];
			ctx._eMax = deepest;
			{
				const cont = /* @__PURE__ */ new Set();
				for (let aI = 0; aI < len; aI++) {
					const a = alts[aI];
					const aN = a.sN | 0;
					let k = 0;
					while (k < aN) {
						const tk = tbuf[k];
						if (null == tk || NOTOKEN === tk) break;
						const Sk = a.S ? a.S[k] : null;
						if (null != Sk) {
							const tin = tk.tin;
							const part = tin / 31 | 0;
							const aaBit = 0 === part ? bitAA : 0;
							if (0 === (Sk[part] & (1 << tin % 31 - 1 | aaBit))) break;
						}
						k++;
					}
					if (k < aN) {
						const next = a.t?.[k] ?? [];
						for (const tin of next) cont.add(tin);
					}
				}
				ctx._contTins = [...cont];
			}
			if (RELEX && null != bad && BD === bad.tin && !ctx.cfg.parse.recover.enabled) {
				const details = {};
				if (null != bad.use) details.use = bad.use;
				throw new error_1.TabnasError(bad.why || UNEXPECTED, details, bad, rule, ctx);
			}
			out.e = tbuf[0] ?? NOTOKEN;
		}
		if (alt) {
			out.n = null != alt.n ? alt.n : out.n;
			out.h = null != alt.h ? alt.h : out.h;
			out.a = null != alt.a ? alt.a : out.a;
			out.u = null != alt.u ? alt.u : out.u;
			out.k = null != alt.k ? alt.k : out.k;
			out.g = null != alt.g ? alt.g : out.g;
			out.ef = alt.e || void 0;
			out.p = null != alt.p && false !== alt.p ? "string" === typeof alt.p ? alt.p : alt.p(rule, ctx, out) : out.p;
			out.r = null != alt.r && false !== alt.r ? "string" === typeof alt.r ? alt.r : alt.r(rule, ctx, out) : out.r;
			out.b = null != alt.b && false !== alt.b ? "number" === typeof alt.b ? alt.b : alt.b(rule, ctx, out) : out.b;
		}
		let match = altI < alts.length;
		ctx.log && ctx.log(utility_1.S.parse, ctx, rule, lex, match, cond, altI, alt, out);
		return out;
	}
	const partify = (tins, part) => tins.filter((tin) => 31 * part <= tin && tin < 31 * (part + 1));
	const bitify = (s, part) => s.reduce((bits, tin) => 1 << tin - (31 * part + 1) | bits, 0);
	const GROUP_TAG_RE = /^[a-z][a-z0-9-]+$/;
	function normalt(a, rs, r) {
		if (types_1.STRING === typeof a.g) a.g = a.g.split(/\s*,\s*/);
		else if (null == a.g) a.g = [];
		for (let tag of a.g) if (!GROUP_TAG_RE.test(tag)) throw new Error(`Grammar: invalid group tag "${tag}" in rule ${r.name} (${rs}) — must match ${GROUP_TAG_RE}`);
		a.g = a.g.sort();
		const aa = a;
		if (!a.s || 0 === a.s.length) {
			a.s = null;
			aa.t = [];
			aa.S = null;
			aa.sN = 0;
		} else {
			const tinsify = (s) => {
				return s.flat().map((n) => "string" === typeof n ? n.split(/\s* +\s*/) : n).flat().map((n) => "string" === typeof n ? r.ji.tokenSet(n) ?? r.ji.token(n) : n).flat().filter((tin) => "number" === typeof tin);
			};
			if ("string" === typeof a.s) a.s = a.s.split(/\s* +\s*/);
			const sN = a.s.length;
			const t = new Array(sN);
			const S = new Array(sN);
			for (let i = 0; i < sN; i++) {
				const tins = tinsify([a.s[i]]);
				t[i] = tins;
				const aaTin = r.ji.token("#AA");
				if (aaTin != null && tins.includes(aaTin)) {
					S[i] = null;
					continue;
				}
				S[i] = 0 < tins.length ? new Array(Math.max(...tins.map((tin) => 1 + tin / 31 | 0))).fill(null).map((_, j) => j).map((part) => bitify(partify(tins, part), part)) : null;
			}
			aa.t = t;
			aa.S = S;
			aa.sN = sN;
		}
		if (!a.p) a.p = null;
		else resolveFunctionRef("push", rs, r, a, "p");
		if (!a.r) a.r = null;
		else resolveFunctionRef("replace", rs, r, a, "r");
		if (!a.b) a.b = null;
		else resolveFunctionRef("back", rs, r, a, "b");
		if (!a.a) a.a = null;
		else {
			bindBuiltinConfig(r, a);
			resolveFunctionRef("action", rs, r, a, "a");
		}
		if (!a.h) a.h = null;
		else resolveFunctionRef("modify", rs, r, a, "h");
		if (!a.e) a.e = null;
		else resolveFunctionRef("error", rs, r, a, "e");
		if (!a.c) a.c = null;
		else {
			const ct = typeof a.c;
			if ("string" === ct) resolveFunctionRef("condition", rs, r, a, "c");
			else if ("function" === ct) {
				if ("c" === a.c.name) (0, utility_1.defprop)(a.c, "name", { value: "ruleCond" });
			} else if ("object" === ct) {
				const ac = a.c;
				const conds = [];
				const ruleprops = Object.keys(a.c);
				for (let prop of ruleprops) {
					const pspec = ac[prop];
					if (null != pspec) {
						const problems = condProblems(prop, pspec);
						if (0 < problems.length) {
							const where = (r?.name ?? "?") + "." + (types_1.OPEN === rs ? "open" : "close");
							throw new Error("tabnas: " + where + ": " + problems.join("; "));
						}
						if ("object" === typeof pspec) for (let co of Object.keys(pspec)) conds.push(makeRuleCond(co, prop, pspec[co]));
						else conds.push(makeRuleCond("$eq", prop, pspec));
					}
				}
				if (0 === conds.length) delete a.c;
				else if (1 === conds.length) a.c = conds[0];
				else a.c = function conjunctCond(r, c, a) {
					for (let cond of conds) if (false == cond(r, c, a)) return false;
					return true;
				};
			} else throw new Error("Grammar: invalid condition: " + a.c);
		}
		return a;
	}
	function isfnref(v) {
		return "string" === typeof v && v.startsWith("@");
	}
	function bindBuiltinConfig(r, a) {
		const consumed = [];
		const bindOne = (ref) => {
			if (!isfnref(ref)) return ref;
			const factory = builtins_1.BUILTIN_CONFIG_FACTORY[ref];
			if (null == factory) return ref;
			if (r.def.fnref[ref] !== builtins_1.BUILTIN_REFS[ref]) return ref;
			const name = ref.slice(1);
			const bound = factory(a.k && a.k[name] || {});
			if (a.k && name in a.k) consumed.push(name);
			return bound;
		};
		if ((0, utility_1.isarr)(a.a)) a.a = a.a.map(bindOne);
		else a.a = bindOne(a.a);
		if (null != a.k && 0 < consumed.length) {
			for (const name of consumed) delete a.k[name];
			if (0 === Object.keys(a.k).length) a.k = void 0;
		}
	}
	function resolveFunctionRef(fkind, rs, r, a, k) {
		const val = a[k];
		if ("a" === k && Array.isArray(val)) {
			if (0 === val.length) {
				a[k] = null;
				return;
			}
			const fns = val.map((v) => {
				if (isfnref(v)) {
					const f = r.def.fnref[v];
					if (null == f) throw new Error(`Grammar: unknown ${fkind} function reference: ` + v + ` for rule ${r.name} (${rs}) and alt ${a.s} (${a.g})`);
					return f;
				}
				return v;
			});
			a[k] = function composedAction(rule, ctx, alt) {
				let out;
				for (const f of fns) {
					out = f(rule, ctx, alt);
					if (out && out.isToken && out.err) return out;
				}
				return out;
			};
			return;
		}
		if (isfnref(val)) {
			const func = r.def.fnref[val];
			if (null == func) throw new Error(`Grammar: unknown ${fkind} function reference: ` + val + ` for rule ${r.name} (${rs}) and alt ${a.s} (${a.g})`);
			a[k] = func;
		}
	}
	const COND_OPS = {
		$eq: 1,
		$ne: 1,
		$lt: 1,
		$lte: 1,
		$gt: 1,
		$gte: 1,
		$exist: 1
	};
	const COND_PATH_ROOTS = {
		n: 1,
		u: 1,
		k: 1,
		d: 1,
		i: 1,
		name: 1,
		state: 1,
		node: 1,
		need: 1,
		oN: 1,
		cN: 1,
		o: 1,
		c: 1,
		o0: 1,
		o1: 1,
		c0: 1,
		c1: 1,
		parent: 1,
		child: 1,
		prev: 1,
		next: 1,
		spec: 1
	};
	/** Every problem in an alternate's DECLARATIVE parts, as messages.
	*
	* Pure: it reports instead of throwing, so a whole grammar can be checked and
	* every problem listed at once. `normalt` calls it while the grammar is being
	* built and raises on what it finds, which is why a bad declarative spec can
	* never surface during a parse — but a grammar held as data (the Grammar /
	* GrammarText path, a generator, an editor) can be checked with this directly,
	* before any parser exists.
	*
	* Only declarative fields are checkable: a condition given as a function is
	* opaque, and `p`/`r` rule names may legitimately be defined later. */
	function validateAlt(alt) {
		const out = [];
		if (null == alt || "object" !== typeof alt) return out;
		if (null != alt.c && "object" === typeof alt.c && "function" !== typeof alt.c) for (const prop of Object.keys(alt.c)) {
			const pspec = alt.c[prop];
			if (null != pspec) out.push(...condProblems(prop, pspec));
		}
		if (null != alt.g) {
			const tags = "string" === typeof alt.g ? alt.g.split(",") : alt.g;
			if (Array.isArray(tags)) {
				for (const tag of tags) if ("string" === typeof tag && !GROUP_TAG_RE.test(tag.trim())) out.push("invalid group tag: \"" + tag + "\"");
			}
		}
		return out;
	}
	/** Every problem in a list of alternates, each prefixed with where it is.
	* `label` names the list, e.g. `"val.open"`. */
	function validateAlts(alts, label = "") {
		const out = [];
		const at = label ? label + " " : "";
		if (!Array.isArray(alts)) return out;
		for (let index = 0; index < alts.length; index++) for (const problem of validateAlt(alts[index])) out.push(at + "alt[" + index + "]: " + problem);
		return out;
	}
	/** The alternates a rule-spec state holds, in either shipped shape: a bare
	* array, or the `{ alts, inject }` form that carries injection modifiers.
	* Anything else yields undefined — validation reports what it can read and
	* stays silent about what it cannot. */
	function specAltList(state) {
		if (Array.isArray(state)) return state;
		if (null != state && "object" === typeof state && Array.isArray(state.alts)) return state.alts;
	}
	/** Whether a `p`/`r` slot names a rule nothing defines. Returns undefined
	* when there is nothing to check: absent, `false` (disabled), a function, or
	* a FuncRef — a `@name` resolves to a function that yields its rule name at
	* parse time, so no static check can follow it. */
	function unknownRuleRef(ref, defined) {
		if (null == ref || false === ref || "string" !== typeof ref || "" === ref) return;
		if (ref.startsWith("@")) return;
		return defined.has(ref) ? void 0 : ref;
	}
	/** Every dangling rule reference in a grammar spec: an alternate whose `p`
	* or `r` names a rule nothing defines. This is the one check that needs the
	* whole rule map in scope, which is why `validateAlt` cannot make it — and
	* the reference is a static typo the engine can otherwise only report at
	* parse time, once an input happens to reach the alternate carrying it.
	*
	* Deliberately narrow: this reports rule references and nothing else. Run
	* `validateAlts` per list for the per-alternate checks — those two runtimes
	* word their messages differently today, and composing them here would bake
	* that difference into a new API. These messages are identical in both.
	*
	* `known` names rules that already exist on the target instance, so a spec
	* that EXTENDS a grammar can push to a rule it does not itself define without
	* being flagged. Omit it to check a spec as a self-contained document.
	*
	* Problems are labelled as `validateAlts` labels them (`val.open alt[0]: …`)
	* and sorted, so the two runtimes report the same list in the same order.
	* The order is JavaScript's — by UTF-16 code unit — which the Go port
	* reproduces deliberately; byte-wise ordering disagrees as soon as a rule
	* name outside the BMP meets one above U+E000. */
	function validateGrammar(spec, known) {
		const out = [];
		if (null == spec || "object" !== typeof spec || null == spec.rule || "object" !== typeof spec.rule) return out;
		const defined = new Set(spec.clear ? [] : known || []);
		for (const rulename of Object.keys(spec.rule)) if (null == spec.rule[rulename]) defined.delete(rulename);
		else defined.add(rulename);
		for (const rulename of Object.keys(spec.rule)) {
			const rulespec = spec.rule[rulename];
			if (null == rulespec || "object" !== typeof rulespec) continue;
			for (const state of ["open", "close"]) {
				const alts = specAltList(rulespec[state]);
				if (null == alts) continue;
				const label = rulename + "." + state;
				for (let index = 0; index < alts.length; index++) {
					const alt = alts[index];
					if (null == alt || "object" !== typeof alt) continue;
					for (const slot of ["p", "r"]) {
						const bad = unknownRuleRef(alt[slot], defined);
						if (void 0 !== bad) out.push(label + " alt[" + index + "]: unknown rule in " + slot + ": \"" + bad + "\"");
					}
				}
			}
		}
		out.sort();
		return out;
	}
	/** Problems with one declarative condition entry: `prop` against `pspec`.
	* Pure — returns messages instead of throwing, so a validation pass can
	* collect every problem in a grammar rather than stopping at the first. */
	function condProblems(prop, pspec) {
		const out = [];
		const root = prop.split(".")[0];
		if (1 !== COND_PATH_ROOTS[root]) out.push("unknown condition path: \"" + prop + "\" (no rule property \"" + root + "\"); known roots: " + Object.keys(COND_PATH_ROOTS).join(", "));
		if (null != pspec && "object" === typeof pspec) {
			for (const co of Object.keys(pspec)) if (1 !== COND_OPS[co]) out.push("unknown condition operator: " + co + " (on \"" + prop + "\"); known operators: " + Object.keys(COND_OPS).join(", "));
		}
		return out;
	}
	function makeRuleCond(co, prop, val) {
		const path = prop.split(".");
		const iscounter = "n" === path[0] && 2 === path.length && "number" === typeof val;
		const read = (r) => {
			const rval = (0, utility_1.getpath)(r, path);
			return null == rval && iscounter ? 0 : rval;
		};
		if ("$eq" === co) return function ruleCond(r, _c, _a) {
			return read(r) === val;
		};
		else if ("$ne" === co) return function ruleCond(r, _c, _a) {
			return read(r) != val;
		};
		else if ("$lt" === co) return function ruleCond(r, _c, _a) {
			const rval = read(r);
			return null == rval || rval < val;
		};
		else if ("$lte" === co) return function ruleCond(r, _c, _a) {
			const rval = read(r);
			return null == rval || rval <= val;
		};
		else if ("$gt" === co) return function ruleCond(r, _c, _a) {
			const rval = read(r);
			return null == rval || rval > val;
		};
		else if ("$gte" === co) return function ruleCond(r, _c, _a) {
			const rval = read(r);
			return null == rval || rval >= val;
		};
		else if ("$exist" === co) return function ruleCond(r, _c, _a) {
			const rval = (0, utility_1.getpath)(r, path);
			return true === val ? null != rval : null == rval;
		};
		else throw new Error("Grammer: unknown comparison operator: " + co);
	}
}));
// node_modules/@tabnas/parser/dist/parser.js
var require_parser = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.makeParser = exports.makeRuleSpec = exports.makeRule = exports.Parser = void 0;
	const types_1 = require_types();
	const context_1 = require_context();
	const utility_1 = require_utility();
	const error_1 = require_error();
	const lexer_1 = require_lexer();
	const rules_1 = require_rules();
	Object.defineProperty(exports, "makeRule", {
		enumerable: true,
		get: function() {
			return rules_1.makeRule;
		}
	});
	Object.defineProperty(exports, "makeRuleSpec", {
		enumerable: true,
		get: function() {
			return rules_1.makeRuleSpec;
		}
	});
	var Parser = class Parser {
		#nrspec;
		#srcfmt;
		constructor(options, cfg, j) {
			this.rsm = Object.create(null);
			this.options = options;
			this.cfg = cfg;
			this.ji = j;
		}
		rule(name, define) {
			if (null == name) return this.rsm;
			let rs = this.rsm[name];
			if (null === define) delete this.rsm[name];
			else if (void 0 !== define) {
				rs = this.rsm[name] = this.rsm[name] || (0, rules_1.makeRuleSpec)(this.ji, this.cfg, {});
				rs.name = name;
				rs = this.rsm[name] = define(this.rsm[name], this) || this.rsm[name];
				return;
			}
			return rs;
		}
		start(src, tabnas, meta, parent_ctx, win) {
			let root;
			let endtkn = (0, lexer_1.makeToken)("#ZZ", (0, utility_1.tokenize)("#ZZ", this.cfg), void 0, types_1.EMPTY, (0, lexer_1.makePoint)(-1));
			let bdtin = (0, utility_1.tokenize)("#BD", this.cfg);
			let notoken = (0, lexer_1.makeNoToken)();
			let ctx = new context_1.Context({
				opts: this.options,
				cfg: this.cfg,
				meta: meta || {},
				src: void 0 === win ? () => src : () => types_1.EMPTY,
				root: () => root,
				plgn: () => tabnas.internal().plugins,
				inst: () => tabnas,
				sub: tabnas.internal().sub,
				rsm: this.rsm,
				F: this.#srcfmt ??= (0, utility_1.srcfmt)(this.cfg),
				NOTOKEN: notoken,
				NORULE: {}
			});
			if (null != parent_ctx) {
				(0, utility_1.deep)(ctx, parent_ctx);
				ctx.errs = [];
			}
			let norule = (0, rules_1.makeRule)(this.#nrspec ??= (0, rules_1.makeRuleSpec)(this.ji, this.cfg, {}), ctx);
			ctx.NORULE = norule;
			ctx.rule = norule;
			if (meta && utility_1.S.function === typeof meta.log) ctx.log = meta.log;
			this.cfg.parse.prepare.forEach((prep) => prep(tabnas, ctx, meta));
			const recovering = this.cfg.parse.recover.enabled;
			const empty = () => {
				if (this.cfg.lex.empty) return recovering ? {
					value: this.cfg.lex.emptyResult,
					errors: ctx.errs
				} : this.cfg.lex.emptyResult;
				else {
					const emptyErr = new error_1.TabnasError(utility_1.S.unexpected, { src }, ctx.t0, norule, ctx);
					if (recovering) return {
						value: void 0,
						errors: ctx.errs
					};
					throw emptyErr;
				}
			};
			if (void 0 === win && "" === src) return empty();
			let lex = (0, lexer_1.makeLex)(ctx, win);
			ctx.lex = lex;
			if (void 0 !== win && lex.isEmptySource()) return empty();
			let startspec = this.rsm[this.cfg.rule.start];
			if (null == startspec) return recovering ? {
				value: void 0,
				errors: ctx.errs
			} : void 0;
			let rule = (0, rules_1.makeRule)(startspec, ctx);
			root = rule;
			let rsmCount = 0;
			for (let _rn in this.rsm) rsmCount++;
			let maxmul = ctx.cfg.rule.maxmul;
			if (!(0 < maxmul)) maxmul = 3;
			const budget = (read) => {
				const maxr = 2 * rsmCount * read * 2 * maxmul;
				return maxr < 100 ? 100 : maxr;
			};
			let maxr = budget(lex.lengthRead());
			let kI = 0;
			const budgetN = this.cfg.parse.budget.checkEveryN;
			const onCheck = this.cfg.parse.budget.onCheck;
			try {
				while (norule !== rule && (kI < maxr || void 0 !== win && kI < (maxr = budget(lex.lengthRead())))) {
					ctx.kI = kI;
					ctx.rule = rule;
					if (budgetN && null != onCheck && 0 === kI % budgetN && 0 < kI) {
						if (false === onCheck(ctx)) throw new error_1.TabnasError("cancel", {}, ctx.t0, rule, ctx);
					}
					ctx.log && ctx.log(utility_1.S.step, ctx.kI + ":");
					if (ctx.sub.rule) ctx.sub.rule.map((sub) => sub(rule, ctx));
					const prev = rule;
					const prevState = rule.state;
					const probeAtStart = 0 < ctx.probeDepth();
					rule = rule.process(ctx, lex);
					const probe = ctx.probeTake() || probeAtStart;
					if (ctx.sub.ruleDone) {
						const publishedBefore = (0, rules_1.publishedHistoryChildSnapshot)(prev, ctx);
						const dalt = ctx._dalt;
						const done = {
							state: prevState,
							probe,
							alt: null == dalt ? null : {
								b: dalt.b || 0,
								g: dalt.g ? dalt.g.slice() : [],
								p: dalt.p || types_1.EMPTY,
								r: dalt.r || types_1.EMPTY,
								err: dalt.e
							}
						};
						ctx.sub.ruleDone.map((sub) => sub(prev, ctx, done));
						(0, rules_1.refreshHistoryChild)(prev, ctx, publishedBefore);
					}
					ctx.log && ctx.log(utility_1.S.stack, ctx, rule, lex);
					kI++;
				}
				const buffered = ctx.t[0];
				if (null != buffered && notoken.tin !== buffered.tin && endtkn.tin !== buffered.tin) {
					if (bdtin === buffered.tin) {
						let details = {};
						if (null != buffered.use) details.use = buffered.use;
						throw new error_1.TabnasError(buffered.why || utility_1.S.unexpected, details, buffered, rule, ctx);
					}
					throw new error_1.TabnasError(utility_1.S.unexpected, {}, buffered, norule, ctx);
				}
				const IGNORE = this.cfg.tokenSetTins.IGNORE;
				let endtry = lex.next(rule);
				while (IGNORE[endtry.tin]) endtry = lex.next(rule);
				if (bdtin === endtry.tin) {
					let details = {};
					if (null != endtry.use) details.use = endtry.use;
					throw new error_1.TabnasError(endtry.why || utility_1.S.unexpected, details, endtry, rule, ctx);
				}
				if (endtkn.tin !== endtry.tin) throw new error_1.TabnasError(utility_1.S.unexpected, {}, endtry, norule, ctx);
				const result = ctx.root().node;
				if (this.cfg.result.fail.includes(result)) throw new error_1.TabnasError(utility_1.S.unexpected, {}, ctx.t0, norule, ctx);
				return recovering ? {
					value: result,
					errors: ctx.errs
				} : result;
			} catch (err) {
				if (ctx.sub.ruleDone && err instanceof error_1.TabnasError) try {
					const frule = ctx.rule;
					if (null != frule && norule !== frule) {
						const publishedBefore = (0, rules_1.publishedHistoryChildSnapshot)(frule, ctx);
						const dalt = ctx._dalt;
						const done = {
							state: frule.state,
							probe: ctx.probeTake(),
							alt: null == dalt ? null : {
								b: dalt.b || 0,
								g: dalt.g ? dalt.g.slice() : [],
								p: dalt.p || types_1.EMPTY,
								r: dalt.r || types_1.EMPTY,
								err: dalt.e ?? err.internal?.token
							}
						};
						ctx.sub.ruleDone.map((sub) => sub(frule, ctx, done));
						(0, rules_1.refreshHistoryChild)(frule, ctx, publishedBefore);
					}
				} catch (subErr) {}
				if (recovering && err instanceof error_1.TabnasError) {
					let value = void 0;
					try {
						value = ctx.root()?.node;
						if (null == value) {
							for (let d = 0; d < ctx.rsI; d++) {
								const n = ctx.rs[d]?.node;
								if (null != n) {
									value = n;
									break;
								}
							}
							if (null == value) value = ctx.rule?.node ?? void 0;
						}
					} catch (rootErr) {}
					return {
						value,
						errors: ctx.errs
					};
				}
				throw err;
			}
		}
		unreadable(failure, text, tabnas, meta) {
			const ctx = new context_1.Context({
				opts: this.options,
				cfg: this.cfg,
				meta: meta || {},
				src: () => text,
				root: () => void 0,
				plgn: () => tabnas.internal().plugins,
				inst: () => tabnas,
				sub: tabnas.internal().sub,
				rsm: this.rsm,
				F: this.#srcfmt ??= (0, utility_1.srcfmt)(this.cfg),
				NOTOKEN: (0, lexer_1.makeNoToken)(),
				NORULE: {}
			});
			const norule = (0, rules_1.makeRule)(this.#nrspec ??= (0, rules_1.makeRuleSpec)(this.ji, this.cfg, {}), ctx);
			ctx.NORULE = norule;
			ctx.rule = norule;
			const tkn = (0, lexer_1.makeToken)("#BD", (0, utility_1.tokenize)("#BD", this.cfg), void 0, failure.reason, (0, lexer_1.makePoint)(failure.pos, failure.pos, failure.row, failure.col), void 0, utility_1.S.unreadable);
			return new error_1.TabnasError(utility_1.S.unreadable, {}, tkn, norule, ctx);
		}
		clone(options, config, j) {
			let parser = new Parser(options, config, j);
			parser.rsm = Object.keys(this.rsm).reduce((a, rn) => (a[rn] = (0, utility_1.filterRules)(this.rsm[rn], this.cfg), a), Object.create(null));
			parser.norm();
			return parser;
		}
		norm() {
			(0, utility_1.values)(this.rsm).map((rs) => rs.norm());
		}
	};
	exports.Parser = Parser;
	const makeParser = (...params) => new Parser(...params);
	exports.makeParser = makeParser;
}));
// node_modules/@tabnas/parser/dist/merge.js
var require_merge = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.mergeInstances = mergeInstances;
	exports.deshareMatchTokens = deshareMatchTokens;
	const defaults_1 = require_defaults$1();
	function isplain(v) {
		if (null == v || "object" !== typeof v || Array.isArray(v)) return false;
		const proto = Object.getPrototypeOf(v);
		return null === proto || proto === Object.prototype;
	}
	function leafeq(u, v) {
		if (Object.is(u, v)) return true;
		if (u instanceof RegExp && v instanceof RegExp) return u.source === v.source && u.flags === v.flags;
		if (Array.isArray(u) && Array.isArray(v)) return u.length === v.length && u.every((e, i) => leafeq(e, v[i]));
		if (isplain(u) && isplain(v)) {
			const uk = Object.keys(u);
			const vk = Object.keys(v);
			return uk.length === vk.length && uk.every((k) => leafeq(u[k], v[k]));
		}
		return false;
	}
	function mergeOptionTrees(av, bv, dv, path) {
		if (void 0 === av) return bv;
		if (void 0 === bv) return av;
		if (isplain(av) && isplain(bv)) {
			const out = {};
			const bkeys = Object.keys(bv);
			const union = [...Object.keys(av), ...bkeys.filter((k) => !(k in av))];
			for (const k of union) {
				const merged = mergeOptionTrees(av[k], bv[k], isplain(dv) ? dv[k] : void 0, [...path, k]);
				if (void 0 !== merged) out[k] = merged;
			}
			return out;
		}
		if (leafeq(av, bv)) return av;
		if (leafeq(av, dv)) return bv;
		if (leafeq(bv, dv)) return av;
		throw new Error("merge: conflicting option values at " + path.join("."));
	}
	function checkFixedTokenSources(options) {
		const token = options.fixed?.token;
		if (null == token) return;
		const bysrc = {};
		for (const name of Object.keys(token)) {
			const src = token[name];
			if (null != bysrc[src] && bysrc[src] !== name) throw new Error("merge: fixed tokens " + bysrc[src] + " and " + name + " both claim source " + JSON.stringify(src));
			bysrc[src] = name;
		}
	}
	function deshareMatchTokens(options) {
		const token = options.match?.token;
		if (null == token) return;
		const fresh = {};
		for (const name of Object.keys(token)) {
			const m = token[name];
			if (m instanceof RegExp) {
				const re = new RegExp(m.source, m.flags);
				if (m.eager$) re.eager$ = true;
				fresh[name] = re;
			} else if ("function" === typeof m) {
				const wrapped = (lex, rule, tI) => m(lex, rule, tI);
				if (m.eager$) wrapped.eager$ = true;
				fresh[name] = wrapped;
			} else fresh[name] = m;
		}
		options.match.token = fresh;
	}
	function orderLexMatch(options) {
		const match = options.lex?.match;
		if (null == match) return;
		const names = Object.keys(match).sort((a, b) => {
			const oa = match[a]?.order ?? 0;
			const ob = match[b]?.order ?? 0;
			return oa !== ob ? oa - ob : a < b ? -1 : a > b ? 1 : 0;
		});
		const ordered = {};
		for (const name of names) ordered[name] = match[name];
		options.lex.match = ordered;
	}
	function untin(entry, cfg) {
		const name = (tin) => {
			const n = cfg.t[tin];
			if (null == n) throw new Error("merge: unknown token tin: " + tin);
			return n;
		};
		if ("number" === typeof entry) return name(entry);
		if (Array.isArray(entry)) return entry.map((e) => "number" === typeof e ? name(e) : e);
		return entry;
	}
	function altComplexity(alt) {
		return [
			alt.c ? 1 : 0,
			alt.e ? 1 : 0,
			alt.h ? 1 : 0,
			alt.b ? 1 : 0,
			alt.n ? Object.keys(alt.n).length : 0,
			alt.a ? 1 : 0,
			alt.u ? 1 : 0,
			alt.k ? 1 : 0,
			alt.p ? 1 : 0,
			alt.r ? 1 : 0
		];
	}
	function declaredNames(s) {
		return (s || []).map((entry) => (Array.isArray(entry) ? entry : [entry]).flatMap((e) => null == e ? [] : "string" === typeof e ? e.split(/\s* +\s*/) : [String(e)]).filter((n) => "" !== n).sort().join(" "));
	}
	function portable(alt, cfg, tag) {
		const keys = (alt.t || []).map((tins) => tins.map((tin) => cfg.t[tin]).sort().join(" "));
		const clone = { ...alt };
		delete clone.t;
		delete clone.S;
		delete clone.sN;
		clone.s = alt.s && alt.s.length ? alt.s.map((entry) => untin(entry, cfg)) : null;
		clone.g = [...alt.g || []];
		if (alt.n) clone.n = { ...alt.n };
		if (alt.u) clone.u = { ...alt.u };
		if (alt.k) clone.k = { ...alt.k };
		return {
			alt: clone,
			keys,
			names: declaredNames(clone.s),
			complexity: altComplexity(alt),
			gkey: (alt.g || []).join(","),
			tag
		};
	}
	function compareAlts(a, b) {
		const n = Math.min(a.keys.length, b.keys.length);
		for (let i = 0; i < n; i++) if (a.keys[i] !== b.keys[i]) return a.keys[i] < b.keys[i] ? -1 : 1;
		if (a.keys.length !== b.keys.length) return b.keys.length - a.keys.length;
		for (let i = 0; i < a.complexity.length; i++) {
			const d = b.complexity[i] - a.complexity[i];
			if (0 !== d) return d;
		}
		if (a.gkey !== b.gkey) return a.gkey < b.gkey ? -1 : 1;
		return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
	}
	function fneq(u, v) {
		if (u === v) return true;
		return "function" === typeof u && "function" === typeof v && u.toString() === v.toString();
	}
	function identicalAlts(a, b) {
		if (a.keys.length !== b.keys.length || !a.keys.every((k, i) => k === b.keys[i]) || a.names.length !== b.names.length || !a.names.every((n, i) => n === b.names[i]) || a.gkey !== b.gkey) return false;
		if (a.alt.c !== b.alt.c && (a.alt.c || b.alt.c)) return false;
		return fneq(a.alt.a, b.alt.a) && fneq(a.alt.h, b.alt.h) && fneq(a.alt.e, b.alt.e) && (a.alt.b === b.alt.b || fneq(a.alt.b, b.alt.b)) && (a.alt.p === b.alt.p || fneq(a.alt.p, b.alt.p)) && (a.alt.r === b.alt.r || fneq(a.alt.r, b.alt.r)) && leafeq(a.alt.n, b.alt.n) && leafeq(a.alt.u, b.alt.u) && leafeq(a.alt.k, b.alt.k);
	}
	function interleave(xs, ys) {
		const yy = ys.filter((y) => !xs.some((x) => identicalAlts(x, y)));
		const out = [];
		let i = 0;
		let j = 0;
		while (i < xs.length && j < yy.length) if (compareAlts(xs[i], yy[j]) <= 0) out.push(xs[i++]);
		else out.push(yy[j++]);
		while (i < xs.length) out.push(xs[i++]);
		while (j < yy.length) out.push(yy[j++]);
		return out;
	}
	function ruleRecords(tn, tag) {
		const internal = tn.internal();
		const cfg = internal.config;
		const rsm = internal.parser.rule();
		const records = {};
		for (const name of Object.keys(rsm)) {
			const def = rsm[name].def;
			const fnref = {};
			for (const key of Object.keys(def.fnref)) if (key.includes("$")) fnref[key] = def.fnref[key];
			else fnref["@" + tag + ":" + key.substring(1)] = def.fnref[key];
			records[name] = {
				fnref,
				bo: [...def.bo],
				ao: [...def.ao],
				bc: [...def.bc],
				ac: [...def.ac],
				open: def.open.map((alt) => portable(alt, cfg, tag)),
				close: def.close.map((alt) => portable(alt, cfg, tag))
			};
		}
		return records;
	}
	function concatActions(xs, ys) {
		const out = [...xs];
		for (const fn of ys) if (!out.some((existing) => fneq(existing, fn))) out.push(fn);
		return out;
	}
	function cloneAlt(alt) {
		const out = { ...alt };
		out.s = Array.isArray(alt.s) ? [...alt.s] : alt.s;
		out.g = [...alt.g || []];
		if (alt.n) out.n = { ...alt.n };
		if (alt.u) out.u = { ...alt.u };
		if (alt.k) out.k = { ...alt.k };
		return out;
	}
	function mergeInstances(a, b, makeInstance) {
		const tagOf = (tn, which) => {
			const tag = tn.internal().merged.tag;
			if (null == tag || "" === tag || "-" === tag) throw new Error("merge: the " + which + " instance needs a tag option (used to prefix its named actions)");
			return String(tag);
		};
		const tagA = tagOf(a, "first");
		const tagB = tagOf(b, "second");
		if (tagA === tagB) throw new Error("merge: instance tags must differ, both are " + JSON.stringify(tagA));
		const [x, y] = tagA < tagB ? [a, b] : [b, a];
		const [tagX, tagY] = tagA < tagB ? [tagA, tagB] : [tagB, tagA];
		const strip = (tree) => {
			const { tag, plugins, ...rest } = tree;
			if (isplain(rest.rule) && false === rest.rule.history) return {
				...rest,
				rule: {
					...rest.rule,
					history: null
				}
			};
			return rest;
		};
		const mergedOptions = mergeOptionTrees(strip(x.internal().merged), strip(y.internal().merged), defaults_1.defaults, []);
		mergedOptions.tag = tagX + "~" + tagY;
		checkFixedTokenSources(mergedOptions);
		deshareMatchTokens(mergedOptions);
		orderLexMatch(mergedOptions);
		const xRecords = ruleRecords(x, tagX);
		const yRecords = ruleRecords(y, tagY);
		const ruleNames = [...Object.keys(xRecords), ...Object.keys(yRecords).filter((n) => !(n in xRecords))].sort();
		const empty = {
			fnref: {},
			bo: [],
			ao: [],
			bc: [],
			ac: [],
			open: [],
			close: []
		};
		const records = {};
		for (const name of ruleNames) {
			const xr = xRecords[name] || empty;
			const yr = yRecords[name] || empty;
			records[name] = {
				fnref: {
					...xr.fnref,
					...yr.fnref
				},
				bo: concatActions(xr.bo, yr.bo),
				ao: concatActions(xr.ao, yr.ao),
				bc: concatActions(xr.bc, yr.bc),
				ac: concatActions(xr.ac, yr.ac),
				open: interleave(xr.open, yr.open),
				close: interleave(xr.close, yr.close)
			};
		}
		const mergedGrammar = function(tn) {
			for (const name of ruleNames) {
				const rec = records[name];
				tn.rule(name, (rs) => {
					Object.assign(rs.def.fnref, rec.fnref);
					rs.def.bo.push(...rec.bo);
					rs.def.ao.push(...rec.ao);
					rs.def.bc.push(...rec.bc);
					rs.def.ac.push(...rec.ac);
					if (0 < rec.open.length) rs.open(rec.open.map((p) => cloneAlt(p.alt)), { append: true });
					if (0 < rec.close.length) rs.close(rec.close.map((p) => cloneAlt(p.alt)), { append: true });
				});
			}
		};
		Object.defineProperty(mergedGrammar, "name", { value: "merged" });
		const out = makeInstance(mergedOptions);
		out.use(mergedGrammar);
		const sub = out.internal().sub;
		const xSub = x.internal().sub;
		const ySub = y.internal().sub;
		for (const kind of [
			"lex",
			"rule",
			"ruleDone"
		]) {
			const combined = [...xSub[kind] || [], ...ySub[kind] || []];
			if (0 < combined.length) sub[kind] = [...sub[kind] || [], ...combined];
		}
		return out;
	}
}));
// node_modules/@tabnas/parser/dist/tabnas.js
var require_tabnas = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.validateGrammar = exports.validateAlts = exports.validateAlt = exports.makeToken = exports.makeTextMatcher = exports.makeStringMatcher = exports.makeSpaceMatcher = exports.makeRuleSpec = exports.makeRule = exports.makePoint = exports.makeParser = exports.makeNumberMatcher = exports.makeLineMatcher = exports.makeLex = exports.makeFixedMatcher = exports.makeCommentMatcher = exports.util = exports.S = exports.SKIP = exports.MAX_RULE_HISTORY = exports.EMPTY = exports.AFTER = exports.BEFORE = exports.CLOSE = exports.OPEN = exports.BUILTIN_SCHEMA_VERSION = exports.BUILTIN_REFS = exports.TabnasError = exports.Tabnas = exports.keyOrder = exports.VERSION = void 0;
	const types_1 = require_types();
	Object.defineProperty(exports, "OPEN", {
		enumerable: true,
		get: function() {
			return types_1.OPEN;
		}
	});
	Object.defineProperty(exports, "CLOSE", {
		enumerable: true,
		get: function() {
			return types_1.CLOSE;
		}
	});
	Object.defineProperty(exports, "BEFORE", {
		enumerable: true,
		get: function() {
			return types_1.BEFORE;
		}
	});
	Object.defineProperty(exports, "AFTER", {
		enumerable: true,
		get: function() {
			return types_1.AFTER;
		}
	});
	Object.defineProperty(exports, "EMPTY", {
		enumerable: true,
		get: function() {
			return types_1.EMPTY;
		}
	});
	Object.defineProperty(exports, "MAX_RULE_HISTORY", {
		enumerable: true,
		get: function() {
			return types_1.MAX_RULE_HISTORY;
		}
	});
	Object.defineProperty(exports, "SKIP", {
		enumerable: true,
		get: function() {
			return types_1.SKIP;
		}
	});
	const utility_1 = require_utility();
	Object.defineProperty(exports, "keyOrder", {
		enumerable: true,
		get: function() {
			return utility_1.keyOrder;
		}
	});
	Object.defineProperty(exports, "S", {
		enumerable: true,
		get: function() {
			return utility_1.S;
		}
	});
	const builtins_1 = require_builtins();
	Object.defineProperty(exports, "BUILTIN_REFS", {
		enumerable: true,
		get: function() {
			return builtins_1.BUILTIN_REFS;
		}
	});
	Object.defineProperty(exports, "BUILTIN_SCHEMA_VERSION", {
		enumerable: true,
		get: function() {
			return builtins_1.BUILTIN_SCHEMA_VERSION;
		}
	});
	const error_1 = require_error();
	Object.defineProperty(exports, "TabnasError", {
		enumerable: true,
		get: function() {
			return error_1.TabnasError;
		}
	});
	const defaults_1 = require_defaults$1();
	const lexer_1 = require_lexer();
	Object.defineProperty(exports, "makeCommentMatcher", {
		enumerable: true,
		get: function() {
			return lexer_1.makeCommentMatcher;
		}
	});
	Object.defineProperty(exports, "makeFixedMatcher", {
		enumerable: true,
		get: function() {
			return lexer_1.makeFixedMatcher;
		}
	});
	Object.defineProperty(exports, "makeLex", {
		enumerable: true,
		get: function() {
			return lexer_1.makeLex;
		}
	});
	Object.defineProperty(exports, "makeLineMatcher", {
		enumerable: true,
		get: function() {
			return lexer_1.makeLineMatcher;
		}
	});
	Object.defineProperty(exports, "makeNumberMatcher", {
		enumerable: true,
		get: function() {
			return lexer_1.makeNumberMatcher;
		}
	});
	Object.defineProperty(exports, "makePoint", {
		enumerable: true,
		get: function() {
			return lexer_1.makePoint;
		}
	});
	Object.defineProperty(exports, "makeSpaceMatcher", {
		enumerable: true,
		get: function() {
			return lexer_1.makeSpaceMatcher;
		}
	});
	Object.defineProperty(exports, "makeStringMatcher", {
		enumerable: true,
		get: function() {
			return lexer_1.makeStringMatcher;
		}
	});
	Object.defineProperty(exports, "makeTextMatcher", {
		enumerable: true,
		get: function() {
			return lexer_1.makeTextMatcher;
		}
	});
	Object.defineProperty(exports, "makeToken", {
		enumerable: true,
		get: function() {
			return lexer_1.makeToken;
		}
	});
	const parser_1 = require_parser();
	Object.defineProperty(exports, "makeParser", {
		enumerable: true,
		get: function() {
			return parser_1.makeParser;
		}
	});
	Object.defineProperty(exports, "makeRule", {
		enumerable: true,
		get: function() {
			return parser_1.makeRule;
		}
	});
	Object.defineProperty(exports, "makeRuleSpec", {
		enumerable: true,
		get: function() {
			return parser_1.makeRuleSpec;
		}
	});
	const rules_1 = require_rules();
	Object.defineProperty(exports, "validateAlt", {
		enumerable: true,
		get: function() {
			return rules_1.validateAlt;
		}
	});
	Object.defineProperty(exports, "validateAlts", {
		enumerable: true,
		get: function() {
			return rules_1.validateAlts;
		}
	});
	Object.defineProperty(exports, "validateGrammar", {
		enumerable: true,
		get: function() {
			return rules_1.validateGrammar;
		}
	});
	const merge_1 = require_merge();
	const util = {
		keyOrder: utility_1.keyOrder,
		recordKeyOrder: utility_1.recordKeyOrder,
		KEY_ORDER: utility_1.KEY_ORDER,
		badlex: utility_1.badlex,
		charset: utility_1.charset,
		clean: utility_1.clean,
		clone: utility_1.clone,
		configure: utility_1.configure,
		deep: utility_1.deep,
		entries: utility_1.entries,
		errdesc: error_1.errdesc,
		errinject: error_1.errinject,
		errmsg: error_1.errmsg,
		errsite: error_1.errsite,
		escre: utility_1.escre,
		keys: utility_1.keys,
		makelog: utility_1.makelog,
		mesc: utility_1.mesc,
		omap: utility_1.omap,
		parserwrap: utility_1.parserwrap,
		prop: error_1.prop,
		regexp: utility_1.regexp,
		srcfmt: utility_1.srcfmt,
		str: utility_1.str,
		strinject: error_1.strinject,
		tokenize: utility_1.tokenize,
		trimstk: error_1.trimstk,
		values: utility_1.values,
		isMatcherToken: utility_1.isMatcherToken,
		guardedMatcher: lexer_1.guardedMatcher,
		scan: lexer_1.scan,
		buildCharRunSpec: lexer_1.buildCharRunSpec,
		buildLineRunSpec: lexer_1.buildLineRunSpec,
		buildStringBodySpec: lexer_1.buildStringBodySpec,
		CONSUME: lexer_1.CONSUME,
		IS_ROW: lexer_1.IS_ROW,
		CI_RESET: lexer_1.CI_RESET,
		STOP: lexer_1.STOP,
		STATE_MASK: lexer_1.STATE_MASK
	};
	exports.util = util;
	exports.Tabnas = class Tabnas {
		#internal;
		#continst;
		#continstGen = -1;
		#gen = 0;
		#contAtEnd = null;
		static {
			this.util = util;
		}
		static {
			this.S = utility_1.S;
		}
		static {
			this.OPEN = types_1.OPEN;
		}
		static {
			this.CLOSE = types_1.CLOSE;
		}
		static {
			this.BEFORE = types_1.BEFORE;
		}
		static {
			this.AFTER = types_1.AFTER;
		}
		static {
			this.EMPTY = types_1.EMPTY;
		}
		static {
			this.SKIP = types_1.SKIP;
		}
		constructor(options, parent) {
			let plugins = [];
			let opts = {};
			if (options) {
				if (Array.isArray(options.plugins)) {
					plugins = options.plugins;
					const { plugins: _ignored, ...rest } = options;
					opts = rest;
				} else opts = options;
			}
			this.parent = parent;
			const internal = {
				parser: void 0,
				config: void 0,
				plugins: [],
				sub: {
					lex: void 0,
					rule: void 0,
					ruleDone: void 0
				},
				mark: Math.random(),
				merged: void 0
			};
			this.#internal = internal;
			if (opts) (0, utility_1.validateOptions)(opts, defaults_1.defaults);
			const merged_options = (0, utility_1.deep)({}, parent ? { ...parent.#internal.merged } : false === opts.defaults$ ? {} : defaults_1.defaults, opts || {});
			internal.merged = merged_options;
			this.id = "Tabnas/" + Date.now() + "/" + ("" + Math.random()).substring(2, 8).padEnd(6, "0") + (null == merged_options.tag ? "" : "/" + merged_options.tag);
			this.token = ((ref) => internal.config.fixed.token[ref] ?? (0, utility_1.tokenize)(ref, internal.config, this));
			this.tokenSet = ((ref) => (0, utility_1.findTokenSet)(ref, internal.config));
			this.fixed = ((ref) => internal.config.fixed.ref[ref]);
			const optionsFn = ((change) => {
				if (null != change) this.#gen++;
				return this.#setOptions(change);
			});
			(0, utility_1.deep)(optionsFn, internal.merged);
			(0, utility_1.defprop)(this, "options", {
				value: optionsFn,
				writable: true,
				enumerable: true,
				configurable: true
			});
			if (parent) {
				const parentInternal = parent.#internal;
				internal.config = (0, utility_1.configure)(this, void 0, merged_options);
				(0, utility_1.assign)(this.token, internal.config.t);
				for (const k of Object.keys(parent)) if (void 0 === this[k]) this[k] = parent[k];
				internal.parser = (0, parser_1.makeParser)(merged_options, internal.config, this);
				const inherited = parentInternal.plugins;
				internal.plugins = [];
				for (const plugin of inherited) this.use(plugin);
				const rsm = internal.parser.rule();
				const filtered = Object.create(null);
				for (const rn of Object.keys(rsm)) filtered[rn] = (0, utility_1.filterRules)(rsm[rn], internal.config);
				internal.parser.rsm = filtered;
				internal.parser.norm();
			} else {
				internal.config = (0, utility_1.configure)(this, void 0, merged_options);
				internal.parser = (0, parser_1.makeParser)(merged_options, internal.config, this);
				(0, utility_1.assign)(this.token, internal.config.t);
			}
			for (const plugin of plugins) this.use(plugin);
		}
		#setOptions(change) {
			if (null != change) {
				(0, utility_1.validateOptions)(change, defaults_1.defaults);
				(0, utility_1.deep)(this.#internal.merged, change);
				(0, utility_1.configure)(this, this.#internal.config, this.#internal.merged);
				this.#internal.parser = this.#internal.parser.clone(this.#internal.merged, this.#internal.config, this);
				(0, utility_1.deep)(this.options, this.#internal.merged);
			}
			return { ...this.#internal.merged };
		}
		parse(src, meta, parent_ctx) {
			if (utility_1.S.string === typeof src) {
				const internalParser = this.#internal.parser;
				const optsParser = this.#internal.merged.parser;
				return (optsParser?.start ? (0, utility_1.parserwrap)(optsParser) : internalParser).start(src, this, meta, parent_ctx);
			}
			return src;
		}
		parseReader(reader, meta, parent_ctx) {
			return this.parseReaderWithSizes(reader, lexer_1.WINDOW_SIZES, meta, parent_ctx);
		}
		parseReaderWithSizes(reader, sizes, meta, parent_ctx) {
			if (null == reader || utility_1.S.function !== typeof reader.read) throw new TypeError("Tabnas.parseReader: the first argument must be a reader, an object with a read(buffer) method.");
			const internal = this.#internal;
			const cfg = internal.config;
			const optsParser = internal.merged.parser;
			if (!cfg.lex.window || optsParser?.start || cfg.parse.recover.enabled) {
				const { text, failure } = (0, lexer_1.readWhole)(reader, sizes.chunk);
				if (void 0 !== failure) throw internal.parser.unreadable(failure, text, this, meta);
				return this.parse(text, meta, parent_ctx);
			}
			return internal.parser.start(types_1.EMPTY, this, meta, parent_ctx, new lexer_1.SourceWindow(reader, sizes));
		}
		config() {
			return (0, utility_1.deep)(this.#internal.config);
		}
		use(plugin, plugin_options) {
			this.#gen++;
			if (utility_1.S.function !== typeof plugin) throw new Error("Tabnas.use: the first argument must be a function defining a plugin.");
			const plugin_name = plugin.name.toLowerCase();
			const full_options = (0, utility_1.deep)({}, plugin.defaults || {}, plugin_options || {});
			this.options({ plugin: { [plugin_name]: full_options } });
			const merged_plugin_options = this.#internal.merged.plugin[plugin_name];
			this.#internal.plugins.push(plugin);
			plugin.options = merged_plugin_options;
			return plugin(this, merged_plugin_options) || this;
		}
		rule(name, define) {
			if (void 0 !== define) this.#gen++;
			const result = this.#internal.parser.rule(name, define);
			return result === void 0 ? this : result;
		}
		make(options) {
			return new Tabnas(options, this);
		}
		merge(other) {
			return (0, merge_1.mergeInstances)(this, other, (options) => new Tabnas(options));
		}
		empty(options) {
			return new Tabnas({
				defaults$: false,
				standard$: false,
				grammar$: false,
				...options || {}
			});
		}
		toString() {
			return this.id;
		}
		sub(spec) {
			if (spec.lex) {
				this.#internal.sub.lex = this.#internal.sub.lex || [];
				this.#internal.sub.lex.push(spec.lex);
			}
			if (spec.rule) {
				this.#internal.sub.rule = this.#internal.sub.rule || [];
				this.#internal.sub.rule.push(spec.rule);
			}
			if (spec.ruleDone) {
				this.#internal.sub.ruleDone = this.#internal.sub.ruleDone || [];
				this.#internal.sub.ruleDone.push(spec.ruleDone);
			}
			return this;
		}
		continuations(src) {
			if (null == this.#continst || this.#continstGen !== this.#gen) {
				const sib = this.make({ parse: { recover: { enabled: false } } });
				const srcRsm = this.#internal.parser.rsm;
				const sibParser = sib.internal().parser;
				let transplanted = false;
				for (const rn of Object.keys(srcRsm)) if (null == sibParser.rsm[rn]) {
					sibParser.rsm[rn] = (0, utility_1.filterRules)(srcRsm[rn], sib.internal().config);
					transplanted = true;
				}
				if (transplanted) sibParser.norm();
				const ZZ = sib.token("#ZZ");
				sib.sub({ lex: (tkn, rule, ctx) => {
					if (ZZ === tkn.tin) try {
						let pos = 0;
						const buf = ctx.t;
						const NOTOKEN = ctx.NOTOKEN;
						while (pos < buf.length && null != buf[pos] && NOTOKEN !== buf[pos]) pos++;
						const got = (0, rules_1.continuationTins)(ctx, rule, pos);
						const acc = this.#contAtEnd;
						this.#contAtEnd = null == acc ? got : [.../* @__PURE__ */ new Set([...acc, ...got])];
					} catch (e) {}
				} });
				this.#continst = sib;
				this.#continstGen = this.#gen;
			}
			const inst = this.#continst;
			this.#contAtEnd = null;
			let err = void 0;
			try {
				inst.parse(src);
			} catch (e) {
				if (e instanceof error_1.TabnasError) err = e;
				else throw e;
			}
			if (null == err) {
				const atEnd = this.#contAtEnd;
				if (null != atEnd) {
					const set = new Set(atEnd);
					set.add(inst.token("#ZZ"));
					const tins = [...set].sort((a, b) => a - b);
					return {
						tins,
						tokens: tins.map((tin) => String(inst.token(tin)))
					};
				}
				const startTins = this.#startOpeners(inst);
				return {
					tins: startTins,
					tokens: startTins.map((tin) => String(inst.token(tin)))
				};
			}
			const ctx = err.internal?.ctx;
			let rule = err.internal?.rule ?? ctx?.rule;
			let tins = null != ctx ? (0, rules_1.continuationTins)(ctx, rule) : [];
			if (0 === tins.length) tins = this.#startOpeners(inst);
			const tokens = tins.map((tin) => String(inst.token(tin)));
			return {
				tins,
				tokens
			};
		}
		#startOpeners(inst) {
			const cfg = inst.internal().config;
			const at = inst.internal().parser.rsm[cfg.rule.start]?.def?.tcol?.[0]?.[0];
			return Array.isArray(at) ? [...at].sort((a, b) => a - b) : [];
		}
		internal() {
			return this.#internal;
		}
		grammar(gs, setting) {
			this.#gen++;
			(0, utility_1.rejectReservedNames)(gs.options);
			gs = (0, utility_1.deep)({}, gs);
			if (gs.options) (0, merge_1.deshareMatchTokens)(gs.options);
			const altG = setting?.rule?.alt?.g;
			const altGArr = null == altG ? null : Array.isArray(altG) ? [...altG] : String(altG).split(/\s*,\s*/).filter((s) => s.length > 0);
			const applyG = (alts) => {
				if (null == altGArr || 0 === altGArr.length || !Array.isArray(alts)) return alts;
				return alts.map((a) => {
					if (null == a || utility_1.S.object !== typeof a) return a;
					const existing = null == a.g ? [] : Array.isArray(a.g) ? [...a.g] : String(a.g).split(/\s*,\s*/).filter((s) => s.length > 0);
					return {
						...a,
						g: [...existing, ...altGArr]
					};
				});
			};
			if (null != gs.v) {
				if ("number" !== typeof gs.v || !Number.isInteger(gs.v) || gs.v < 1) throw new Error(`Grammar: invalid builtin schema version: ${gs.v} (expected a positive integer)`);
				if (gs.v > builtins_1.BUILTIN_SCHEMA_VERSION) throw new Error(`Grammar: requires builtin schema version ${gs.v}, but this engine supports up to ${builtins_1.BUILTIN_SCHEMA_VERSION}`);
			}
			if (gs.ref) {
				for (const key of Object.keys(gs.ref)) if (key.includes("$")) throw new Error(`Grammar: '$' is reserved for engine builtins; user ref key '${key}' may not contain '$'`);
			}
			const ref = Object.assign(Object.create(null), builtins_1.BUILTIN_REFS, gs.ref || {});
			if (true === gs.clear) {
				const rsm = this.#internal.parser.rule();
				for (const rulename of (0, utility_1.keys)(rsm)) this.rule(rulename, null);
				const fixed = this.#internal.config.fixed.token;
				const token = {};
				for (const src of (0, utility_1.keys)(fixed)) {
					const name = this.token(fixed[src]);
					if (null != name) token[name] = null;
				}
				if (0 < (0, utility_1.keys)(token).length) this.options({ fixed: { token } });
			}
			if (gs.options) {
				const resolved = (0, utility_1.resolveFuncRefs)(gs.options, ref);
				this.options(resolved);
			}
			if (gs.rule) for (const rulename of Object.keys(gs.rule)) {
				const rulespec = gs.rule[rulename];
				if (null === rulespec) {
					this.rule(rulename, null);
					continue;
				}
				this.rule(rulename, (rs) => {
					rs.fnref(ref);
					if (rulespec.open) {
						const isarr = Array.isArray(rulespec.open);
						const alts = isarr ? rulespec.open : rulespec.open.alts;
						const inject = isarr ? {} : rulespec.open.inject;
						rs.open(applyG(alts), inject);
					}
					if (rulespec.close) {
						const isarr = Array.isArray(rulespec.close);
						const alts = isarr ? rulespec.close : rulespec.close.alts;
						const inject = isarr ? {} : rulespec.close.inject;
						rs.close(applyG(alts), inject);
					}
				});
			}
			return this;
		}
		get util() {
			return util;
		}
	};
	exports.VERSION = "0.12.20";
}));
// node_modules/@tabnas/jsonic/dist/translate.js
var require_translate$2 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.translate = translate;
	const TRANSLATION = Object.freeze({
		manifest: `{
  "$schema": "https://tabnas.dev/schema/plugin.schema.json",
  "name": "@tabnas/jsonic",
  "go": "github.com/tabnas/jsonic/go",
  "rust": "tabnas-jsonic",
  "description": "The jsonic base grammar: relaxed, extensible JSON for the tabnas engine.",
  "base": "@tabnas/json",
  "engine": "@tabnas/parser",
  "extensions": [
    ".jsonic"
  ],
  "languageId": "jsonic",
  "pluginKind": "grammar",
  "grammarKind": "imperative",
  "lexStream": "clean",
  "syncGroups": [
    "end",
    "comma",
    "close",
    "sync"
  ],
  "specDir": "test/spec",
  "clib": {
    "dir": "go/clib",
    "library": "libtabnasjsonic",
    "abi": "v1",
    "errorCodes": [
      "usage",
      "grammar",
      "handle",
      "internal"
    ]
  },
  "errorCodes": [],
  "docs": "https://tabnas.dev/docs/packages",
  "repository": "https://github.com/tabnas/jsonic",
  "versionSource": "ts/package.json",
  "translate": {
    "reads": "tree",
    "writes": "tree",
    "root": "any",
    "render": "json",
    "transduce": "alchemy/transduce.alc",
    "loss": [
      "Comments are not kept.",
      "Trailing commas are not kept.",
      "Implicit objects and lists, unquoted keys and strings, single-quoted, backtick and multiline strings, and path-dive keys are written in JSON's forms.",
      "Numbers spelled in hexadecimal, octal or binary, with digit separators, with a leading plus sign or a leading zero, or with a leading or trailing decimal point are written as plain decimal numbers.",
      "JSON has no spelling for Infinity or NaN, so a number that is not finite is written as null."
    ]
  }
}
`,
		render: Object.freeze({ entry: "json" }),
		transduce: Object.freeze({
			entry: "jsonic-transduce",
			source: `; jsonic's transducer part: the document's JSON events from the jsonic
; grammar's rule passes, for a host that reads parser events (alchemy-cli's
; \`translate\` and \`run --grammar jsonic\`). The grammar's rules are json's,
; \`map\`, \`list\`, \`pair\`, \`elem\` and \`val\`, and map onto a tree as json's
; do, but the relaxed forms the grammar reads are built in its actions,
; which the passes do not show, so the part is hand-written over them:
; a \`map\`'s passes open and close an object, a \`list\`'s an array, a
; \`pair\`'s open on its key alternate announces its key, the first
; token's text (a quoted or bare string as its value, any other token
; as its source), while one opened on a separator with no key
; (\`{,a:1}\`) announces nothing, and a \`val\` yields its scalar at its
; close, from the value the close carries, so that a close whose
; alternate replaces the val with \`list\`, the first element of an
; implicit list (\`x,y,z\`), starts the array before it and the list's
; open starts no second one. A \`val\` whose node is undefined
; (\`{a:}\`, \`a:,b:\`, \`[\`) is null in an object and nothing in a list, as
; the grammar's actions keep it; an \`elem\` that opens on a separator with
; no value (\`[,]\`) is a null element; an \`elem\` that opens on a pair
; (\`[a:1]\`), which the grammar drops, yields nothing, its passes passed
; by until it closes; and the empty document, which makes no pass, is
; null at \`finish\`. Every event is the one the walk of the grammar's
; value under its default options gives, the options every host that
; reads a part builds the grammar with (\`make()\` in each runtime): the
; passes carry no options, and an option that reshapes the value,
; \`list.pair\` (a pair in a list kept as an object, by the same
; alternate that drops it), \`list.child\`, \`info.map\` (a member named
; as the marker dropped) or \`lex.emptyResult\`, is not in them, so a
; host that sets one reads the document whole. Two shapes under the
; defaults the tree contract a host puts after the part refuses, so
; the host reads the document whole too: an implicit list whose first
; element is a container (\`{a:1},{b:2}\`), whose events stream before
; the list is known, a second root to the contract
; (STREAMABILITY_UNKNOWN); and a member name repeated, which the
; grammar's \`map.extend\` merges and the part streams twice
; (DUPLICATE_MEMBER).
;
; The state is [stack carry drop seen]: a marker per open frame, innermost
; last (:object or :array for a container, :leaf for a val that pushed
; nothing, :pushed for one that pushed a container); whether a val's close
; made an implicit list, so the list's open starts no array; the depth of
; an elem whose pair the list drops, while its passes pass by, or missing;
; and whether a pass was seen. Nothing grows with the document's length,
; only with its nesting, under max_metadata_bytes.

; Whether an alternate's groups hold the one named: a pattern variable
; binds rather than compares, so each group is matched by its literal.
def jsonic-transduce-has-pair [groups]
  match (count (filter (fn [g] (match g (case "pair" true) (case _ false))) groups))
    case 0 false
    case _ true

def jsonic-transduce-has-null [groups]
  match (count (filter (fn [g] (match g (case "null" true) (case _ false))) groups))
    case 0 false
    case _ true

def jsonic-transduce-has-key [groups]
  match (count (filter (fn [g] (match g (case "key" true) (case _ false))) groups))
    case 0 false
    case _ true

def jsonic-transduce-key [token]
  match (kind (get :val token))
    case :string (get :val token)
    case _ (get :src token)

def jsonic-transduce-groups [rule]
  match (get :alt rule)
    case missing []
    case alt (get :g alt)

def jsonic-transduce-open [stack carry drop rule]
  match (get :name rule)
    case "map" (transition [(push :object stack) false drop true] [object-start])
    case "list"
      match carry
        case true (transition [(push :array stack) false drop true] [])
        case _ (transition [(push :array stack) false drop true] [array-start])
    case "pair"
      match (jsonic-transduce-has-key (jsonic-transduce-groups rule))
        case true
          match (transduce-token 0 rule)
            case missing (transition [stack carry drop true] [])
            case token (transition [stack carry drop true] [(key (jsonic-transduce-key token))])
        case _ (transition [stack carry drop true] [])
    case "elem"
      let [groups (jsonic-transduce-groups rule)]
        match (jsonic-transduce-has-pair groups)
          case true (transition [stack carry (get :d rule) true] [])
          case _
            match (jsonic-transduce-has-null groups)
              case true (transition [stack carry drop true] [(scalar null)])
              case _ (transition [stack carry drop true] [])
    case "val"
      match (get :alt rule)
        case missing (transition [(push :leaf stack) carry drop true] [])
        case alt
          match (get :p alt)
            case "" (transition [(push :leaf stack) carry drop true] [])
            case _ (transition [(push :pushed stack) carry drop true] [])
    case _ (transition [stack carry drop true] [])

; An undefined value, which jsonic keeps as null in an object and drops
; from a list.
def jsonic-transduce-undefined [rest carry drop]
  match (count rest)
    case 0 (transition [rest carry drop true] [(scalar null)])
    case _
      match (top rest)
        case :object (transition [rest carry drop true] [(scalar null)])
        case _ (transition [rest carry drop true] [])

def jsonic-transduce-leaf [rest carry drop rule]
  match (get :value rule)
    case missing (jsonic-transduce-undefined rest carry drop)
    case value
      match (get :alt rule)
        case missing (transition [rest carry drop true] [(scalar value)])
        case alt
          match (get :r alt)
            case "list" (transition [rest true drop true] [array-start (scalar value)])
            case _ (transition [rest carry drop true] [(scalar value)])

def jsonic-transduce-close [stack carry drop rule]
  match (get :name rule)
    case "val"
      match (top stack)
        case :pushed (transition [(pop stack) carry drop true] [])
        case :leaf (jsonic-transduce-leaf (pop stack) carry drop rule)
        case _ (fail :protocol-order "a val closed with no val open, which the passes never do")
    case "map" (transition [(pop stack) carry drop true] [object-end])
    case "list" (transition [(pop stack) carry drop true] [array-end])
    case _ (transition [stack carry drop true] [])

def jsonic-transduce-step [state pass]
  match state
    case [stack carry drop seen]
      match drop
        case missing
          match pass
            case (open rule) (jsonic-transduce-open stack carry drop rule)
            case (close rule) (jsonic-transduce-close stack carry drop rule)
        case depth
          match pass
            case (close rule)
              match (get :name rule)
                case "elem"
                  match (compare (get :d rule) depth)
                    case :equal (transition [stack carry missing true] [])
                    case _ (transition state [])
                case _ (transition state [])
            case _ (transition state [])

def jsonic-transduce-finish [state]
  match state
    case [[] carry drop false] [(scalar null)]
    case [[] carry drop true] []
    case _ (fail :protocol-order "the rule passes ended inside a container, which a tree's never do")

def jsonic-transduce [input]
  as-events (scan-emit [[] false missing false] jsonic-transduce-step jsonic-transduce-finish (parser-events input))
`
		})
	});
	function translate() {
		return TRANSLATION;
	}
}));
// node_modules/@tabnas/jsonic/dist/defaults.js
var require_defaults = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.defaults = void 0;
	const lexer_1 = require_lexer();
	exports.defaults = {
		safe: { key: true },
		tag: "-",
		fixed: {
			lex: true,
			token: {
				"#OB": "{",
				"#CB": "}",
				"#OS": "[",
				"#CS": "]",
				"#CL": ":",
				"#CA": ","
			}
		},
		match: {
			lex: true,
			token: {}
		},
		tokenSet: {
			IGNORE: [
				"#SP",
				"#LN",
				"#CM"
			],
			VAL: [
				"#TX",
				"#NR",
				"#ST",
				"#VL"
			],
			KEY: [
				"#TX",
				"#NR",
				"#ST",
				"#VL"
			]
		},
		space: {
			lex: true,
			chars: " 	"
		},
		line: {
			lex: true,
			chars: "\r\n",
			rowChars: "\n",
			single: false
		},
		text: { lex: true },
		number: {
			lex: true,
			hex: true,
			oct: true,
			bin: true,
			sep: "_",
			exclude: void 0
		},
		comment: {
			lex: true,
			def: {
				hash: {
					line: true,
					start: "#",
					lex: true,
					eatline: false
				},
				slash: {
					line: true,
					start: "//",
					lex: true,
					eatline: false
				},
				multi: {
					line: false,
					start: "/*",
					end: "*/",
					lex: true,
					eatline: false
				}
			}
		},
		string: {
			lex: true,
			chars: "'\"`",
			multiChars: "`",
			escapeChar: "\\",
			escape: {
				b: "\b",
				f: "\f",
				n: "\n",
				r: "\r",
				t: "	",
				v: "\v",
				"\"": "\"",
				"'": "'",
				"`": "`",
				"\\": "\\",
				"/": "/"
			},
			allowUnknown: true,
			abandon: false
		},
		map: {
			extend: true,
			merge: void 0,
			child: false
		},
		list: {
			property: true,
			pair: false,
			child: false
		},
		info: {
			map: false,
			list: false,
			text: false,
			marker: "__info__"
		},
		value: {
			lex: true,
			def: {
				true: { val: true },
				false: { val: false },
				null: { val: null }
			}
		},
		ender: [],
		plugin: {},
		debug: {
			get_console: () => console,
			maxlen: 99,
			print: {
				config: false,
				src: void 0
			}
		},
		error: {
			unknown: "unknown error: {code}",
			unexpected: "unexpected character(s): {src}",
			invalid_unicode: "invalid unicode escape: {src}",
			invalid_ascii: "invalid ascii escape: {src}",
			unprintable: "unprintable character: {src}",
			unterminated_string: "unterminated string: {src}",
			unterminated_comment: "unterminated comment: {src}",
			unknown_rule: "unknown rule: {rulename}",
			end_of_source: "unexpected end of source"
		},
		errmsg: {
			name: "jsonic",
			suffix: true,
			link: "https://github.com/tabnas/jsonic"
		},
		hint: {
			unknown: `
Since the error is unknown, this is probably a bug inside jsonic
itself, or a plugin. Please consider posting a github issue - thanks!

Code: {code}, Details: 
{details}`,
			unexpected: `
The character(s) {src} were not expected at this point as they do not
match the expected syntax, even under the relaxed jsonic rules. If it
is not obviously wrong, the actual syntax error may be elsewhere. Try
commenting out larger areas around this point until you get no errors,
then remove the comments in small sections until you find the
offending syntax. NOTE: Also check if any plugins you are using
expect different syntax in this case.`,
			invalid_unicode: `
The escape sequence {src} does not encode a valid unicode code point
number. You may need to validate your string data manually using test
code to see how JavaScript will interpret it. Also consider that your
data may have become corrupted, or the escape sequence has not been
generated correctly.`,
			invalid_ascii: `
The escape sequence {src} does not encode a valid ASCII character. You
may need to validate your string data manually using test code to see
how JavaScript will interpret it. Also consider that your data may
have become corrupted, or the escape sequence has not been generated
correctly.`,
			unprintable: `
String values cannot contain unprintable characters (character codes
below 32). The character {src} is unprintable. You may need to remove
these characters from your source data. Also check that it has not
become corrupted.`,
			unterminated_string: `
This string has no end quote.`,
			unterminated_comment: `
This comment is never closed.`,
			unknown_rule: `
No rule named $rulename is defined. This is probably an error in the
grammar of a plugin.`,
			end_of_source: `
Unexpected end of source.`
		},
		lex: {
			match: {
				match: {
					order: 1e6,
					make: lexer_1.makeMatchMatcher
				},
				fixed: {
					order: 2e6,
					make: lexer_1.makeFixedMatcher
				},
				space: {
					order: 3e6,
					make: lexer_1.makeSpaceMatcher
				},
				line: {
					order: 4e6,
					make: lexer_1.makeLineMatcher
				},
				string: {
					order: 5e6,
					make: lexer_1.makeStringMatcher
				},
				comment: {
					order: 6e6,
					make: lexer_1.makeCommentMatcher
				},
				number: {
					order: 7e6,
					make: lexer_1.makeNumberMatcher
				},
				text: {
					order: 8e6,
					make: lexer_1.makeTextMatcher
				}
			},
			empty: true,
			emptyResult: void 0
		},
		parse: { prepare: {} },
		rule: {
			start: "val",
			finish: true,
			maxmul: 3,
			include: void 0,
			exclude: void 0
		},
		result: { fail: [] },
		rewind: { history: 64 },
		config: { modify: {} },
		parser: { start: void 0 }
	};
}));
// node_modules/@tabnas/json/dist/translate.js
var require_translate$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.translate = translate;
	const TRANSLATION = Object.freeze({
		manifest: `{
  "$schema": "https://tabnas.dev/schema/plugin.schema.json",
  "name": "@tabnas/json",
  "go": "github.com/tabnas/json/go",
  "rust": "tabnas-json",
  "description": "A standard JSON parser (RFC 8259) for the tabnas engine.",
  "engine": "@tabnas/parser",
  "extensions": [
    ".json"
  ],
  "mediaTypes": [
    "application/json"
  ],
  "languageId": "json",
  "pluginKind": "grammar",
  "grammarKind": "data",
  "lexStream": "clean",
  "syncGroups": [
    "end",
    "comma",
    "close"
  ],
  "specDir": "test/spec",
  "clib": {
    "dir": "go/clib",
    "library": "libtabnasjson",
    "abi": "v1",
    "errorCodes": [
      "usage",
      "grammar",
      "handle",
      "internal"
    ]
  },
  "errorCodes": [],
  "docs": "https://tabnas.dev/docs/packages",
  "repository": "https://github.com/tabnas/json",
  "versionSource": "ts/package.json",
  "translate": {
    "reads": "tree",
    "writes": "tree",
    "root": "any",
    "render": "json",
    "transduce": "alchemy/transduce.alc",
    "loss": [
      "JSON has no spelling for Infinity or NaN, so a number that is not finite is written as null."
    ]
  }
}
`,
		render: Object.freeze({ entry: "json" }),
		transduce: Object.freeze({
			entry: "json-transduce",
			source: `; JSON's transducer part: the document's JSON events from the json
; grammar's rule passes (ParserEvents/1), streamed as the parser makes
; them, so that a host that reads parser events (alchemy-cli's translate
; and run --grammar, aless) reads a JSON document through this file rather
; than through transduce's inference over the grammar's rule events.
;
; The grammar's rules map onto a tree, so the part is the library's
; declarative transducer, transduce-tree, with a spec keyed by rule name:
; a map rule's open pass begins an object and its close pass ends it, a
; list rule's an array; a pair rule's open pass announces the member's
; name, its first token's value; and a val rule's open pass yields the
; scalar its first token carries, with the lexeme a number token keeps
; (2.50 is written 2.50). Every event is the one the walk of the grammar's
; value gives, a number's lexeme aside, which alchemy-cli's transduce.tsv
; runner holds it to; a repeated member is streamed twice, as the
; document spells it, for a tree-contract or a capture's policy to judge.
def json-transduce [input]
  transduce-tree
    record
      entry :map (record (entry :container :object))
      entry :list (record (entry :container :array))
      entry :pair (record (entry :key 0))
      entry :val (record (entry :scalar 0))
    input
`
		})
	});
	function translate() {
		return TRANSLATION;
	}
}));
// node_modules/@tabnas/json/dist/json.js
var require_json = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.translate = exports.JsonError = exports.TabnasError = exports.Tabnas = exports.json = exports.VERSION = void 0;
	exports.registerJsonGrammar = registerJsonGrammar;
	exports.make = make;
	exports.parse = parse;
	const parser_1 = require_tabnas();
	Object.defineProperty(exports, "Tabnas", {
		enumerable: true,
		get: function() {
			return parser_1.Tabnas;
		}
	});
	Object.defineProperty(exports, "TabnasError", {
		enumerable: true,
		get: function() {
			return parser_1.TabnasError;
		}
	});
	Object.defineProperty(exports, "JsonError", {
		enumerable: true,
		get: function() {
			return parser_1.TabnasError;
		}
	});
	exports.VERSION = "0.5.20";
	const JSON_OPTIONS = {
		text: { lex: false },
		number: {
			hex: false,
			oct: false,
			bin: false,
			sep: null,
			exclude: /^(?!-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$)/
		},
		string: {
			chars: "\"",
			multiChars: "",
			allowUnknown: false,
			escapeStrict: true,
			escape: {
				v: "",
				"'": "",
				"`": ""
			}
		},
		comment: { lex: false },
		map: { extend: false },
		lex: { empty: false },
		rule: {
			finish: false,
			include: "json"
		},
		result: { fail: [void 0, NaN] },
		tokenSet: { KEY: [
			"#ST",
			null,
			null,
			null
		] }
	};
	function registerJsonGrammar(tn, opts) {
		const pushChain = () => opts?.chainOff ? { k: { push$: { chain: false } } } : {};
		tn.grammar({
			v: 2,
			rule: {
				val: {
					open: [
						{
							s: "#OB",
							p: "map",
							b: 1,
							a: "@reset$",
							g: "map,json"
						},
						{
							s: "#OS",
							p: "list",
							b: 1,
							a: "@reset$",
							g: "list,json"
						},
						{
							s: "#VAL",
							a: "@reset$",
							g: "val,json"
						}
					],
					close: [{
						s: "#ZZ",
						a: "@value$",
						g: "end,json"
					}, {
						b: 1,
						a: "@value$",
						g: "more,json"
					}]
				},
				map: {
					open: [{
						s: "#OB #CB",
						b: 1,
						n: { pk: 0 },
						a: "@object$",
						g: "map,json"
					}, {
						s: "#OB",
						p: "pair",
						n: { pk: 0 },
						a: "@object$",
						g: "map,json,pair"
					}],
					close: [{
						s: "#CB",
						g: "end,json"
					}]
				},
				list: {
					open: [{
						s: "#OS #CS",
						b: 1,
						a: "@array$",
						g: "list,json"
					}, {
						s: "#OS",
						p: "elem",
						a: "@array$",
						g: "list,elem,json"
					}],
					close: [{
						s: "#CS",
						g: "end,json"
					}]
				},
				pair: {
					open: [{
						s: "#KEY #CL",
						p: "val",
						u: { pair: true },
						a: "@key$",
						g: "map,pair,key,json"
					}],
					close: [{
						s: "#CA",
						r: "pair",
						a: "@setval$",
						g: "map,pair,comma,json"
					}, {
						s: "#CB",
						b: 1,
						a: "@setval$",
						g: "map,pair,close,json"
					}]
				},
				elem: {
					open: [{
						p: "val",
						g: "list,elem,val,json"
					}],
					close: [{
						s: "#CA",
						r: "elem",
						a: "@push$",
						...pushChain(),
						g: "list,elem,comma,json"
					}, {
						s: "#CS",
						b: 1,
						a: "@push$",
						...pushChain(),
						g: "list,elem,close,json"
					}]
				}
			}
		});
	}
	exports.json = function json(tn, _options) {
		tn.options(JSON_OPTIONS);
		registerJsonGrammar(tn, { chainOff: true });
	};
	function make(opts) {
		const tn = new parser_1.Tabnas({ plugins: [exports.json] });
		tn.options({ lex: { window: true } });
		if (opts) tn.options(opts);
		return tn;
	}
	let defaultParser;
	function parse(src) {
		return (defaultParser ??= make()).parse(src);
	}
	var translate_1 = require_translate$1();
	Object.defineProperty(exports, "translate", {
		enumerable: true,
		get: function() {
			return translate_1.translate;
		}
	});
	exports.default = parse;
}));
// node_modules/@tabnas/jsonic/dist/grammar.js
var require_grammar = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.jsonicPlugin = exports.registerJsonicGrammar = void 0;
	exports.grammar = grammar;
	exports.makeJSON = makeJSON;
	const json_1 = require_json();
	const jsonic_1 = require_jsonic();
	const defaults_1 = require_defaults();
	const defprop = Object.defineProperty;
	function mark(node, marker, data) {
		if (node != null && typeof node === "object") defprop(node, marker, {
			value: data,
			writable: true
		});
	}
	function grammar(jsonic) {
		const { deep, recordKeyOrder, keyOrder } = jsonic.util;
		const { CA, TX, ST, ZZ } = jsonic.token;
		const { VAL } = jsonic.tokenSet;
		const fnm = {
			"@finish": (_rule, ctx) => {
				if (!ctx.cfg.rule.finish) {
					ctx.t0.err = "end_of_source";
					return ctx.t0;
				}
			},
			"@pairkey": (r) => {
				const key_token = r.o0;
				const key = ST === key_token.tin || TX === key_token.tin ? key_token.val : key_token.src;
				r.u.key = key;
			}
		};
		(0, json_1.registerJsonGrammar)(jsonic);
		jsonic.rule("val", (rs) => {
			rs.fnref({ "@val-bc/replace": (r, ctx) => {
				r.u.openval = r.node;
				const resolveToken = () => {
					let val = r.o0.resolveVal(r, ctx);
					if (ctx.cfg.info.text && typeof val === "string" && (r.o0.tin === ctx.cfg.t.ST || r.o0.tin === ctx.cfg.t.TX)) {
						let quote = r.o0.tin === ctx.cfg.t.ST && r.o0.src.length > 0 ? r.o0.src[0] : "";
						let sv = new String(val);
						mark(sv, ctx.cfg.info.marker, { quote });
						val = sv;
					}
					return val;
				};
				r.node = void 0 !== r.child.node ? r.child.node : null != r.node && "object" !== typeof r.node ? r.node : 0 !== r.os ? resolveToken() : void 0 !== r.node ? r.node : void 0;
			} }).ac((r) => {
				const ov = r.u.openval;
				if (null != ov && "object" !== typeof ov && void 0 === r.child.node) r.node = ov;
			});
		});
		function pairval(r, ctx) {
			let key = r.u.key;
			let val = r.child.node;
			val = void 0 === val ? null : val;
			if (r.u.list && ctx.cfg.safe.key) {
				if ("__proto__" === key || "constructor" === key) return;
			}
			if (ctx.cfg.info.map && key === ctx.cfg.info.marker) return;
			const prev = r.node[key];
			const incoming = val;
			val = null == prev ? val : ctx.cfg.map.merge ? ctx.cfg.map.merge(prev, val, r, ctx) : ctx.cfg.map.extend ? deep(prev, val) : val;
			if (ctx.cfg.map.ordered) {
				if (!(key in r.node)) recordKeyOrder(r.node, key);
				else if (val === prev && incoming !== prev && null != incoming && "object" === typeof incoming && !Array.isArray(incoming)) {
					const have = new Set(keyOrder(val));
					for (const k of keyOrder(incoming)) if (!have.has(k)) recordKeyOrder(val, k);
				}
			}
			r.node[key] = val;
		}
		jsonic.grammar({
			ref: { "@val-close-error": (r, c) => 0 === r.d ? c.t0 : void 0 },
			rule: { val: {
				open: {
					alts: [
						{
							s: "#KEY #CL",
							c: { d: 0 },
							p: "map",
							b: 2,
							a: "@reset$",
							g: "pair,jsonic,top"
						},
						{
							s: "#KEY #CL",
							p: "map",
							b: 2,
							n: { pk: 1 },
							a: "@reset$",
							g: "pair,jsonic"
						},
						{
							s: "#VAL",
							a: "@reset$",
							g: "val,json"
						},
						{
							s: ["#CB #CS"],
							b: 1,
							c: { d: { $gt: 0 } },
							a: "@reset$",
							g: "val,imp,null,jsonic"
						},
						{
							s: "#CA",
							c: { d: 0 },
							p: "list",
							b: 1,
							a: "@array$",
							k: { array$: { implicit: true } },
							g: "list,imp,jsonic"
						},
						{
							s: "#CA",
							b: 1,
							a: "@reset$",
							g: "list,val,imp,null,jsonic"
						},
						{
							s: "#ZZ",
							g: "jsonic"
						}
					],
					inject: {
						append: true,
						delete: [2]
					}
				},
				close: {
					alts: [
						{
							s: ["#CB #CS"],
							b: 1,
							g: "val,json,close",
							e: "@val-close-error"
						},
						{
							s: "#CA",
							c: {
								"n.dlist": { $lte: 0 },
								"n.dmap": { $lte: 0 }
							},
							r: "list",
							u: { implist: true },
							g: "list,val,imp,comma,jsonic"
						},
						{
							c: {
								"n.dlist": { $lte: 0 },
								"n.dmap": { $lte: 0 }
							},
							r: "list",
							u: { implist: true },
							g: "list,val,imp,space,jsonic",
							b: 1
						},
						{
							s: "#ZZ",
							g: "end,jsonic"
						}
					],
					inject: {
						append: true,
						move: [1, -1]
					}
				}
			} }
		});
		jsonic.rule("map", (rs) => {
			rs.fnref({ ...fnm }).bo((r) => {
				r.n.dmap = 1 + (r.n.dmap ? r.n.dmap : 0);
			}).open([{
				s: "#OB #ZZ",
				b: 1,
				a: "@object$",
				e: "@finish",
				g: "end,jsonic"
			}]).open([{
				s: "#KEY #CL",
				p: "pair",
				b: 2,
				a: "@object$",
				k: { object$: { implicit: true } },
				g: "pair,list,val,imp,jsonic"
			}], { append: true }).close([
				{
					s: "#CB",
					c: { "n.pk": { $lte: 0 } },
					g: "end,json"
				},
				{
					s: "#CB",
					b: 1,
					g: "path,close,jsonic"
				},
				{
					s: ["#CA #CS #VAL"],
					b: 1,
					g: "end,path,jsonic"
				},
				{
					s: "#ZZ",
					e: "@finish",
					g: "end,jsonic"
				}
			], {
				append: true,
				delete: [0]
			}).bc((r, ctx) => {
				let m = ctx.cfg.info.marker;
				if (ctx.cfg.info.map && r.node?.[m]) r.node[m].implicit = !(r.o0 && r.o0.tin === ctx.cfg.t.OB);
			});
		});
		jsonic.rule("list", (rs) => {
			rs.fnref({
				...fnm,
				"@list-bo": (r, ctx) => {
					r.n.dlist = 1 + (r.n.dlist ? r.n.dlist : 0);
					if (r.prev.u.implist) {
						r.node = [];
						if (ctx.cfg.info.list) mark(r.node, ctx.cfg.info.marker, {
							implicit: true,
							meta: {}
						});
						r.node.push(r.prev.node);
						r.prev.node = r.node;
					}
				}
			}).open({
				c: { "prev.u.implist": { $eq: true } },
				p: "elem"
			}).open([{
				s: "#CA",
				p: "elem",
				b: 1,
				g: "list,elem,val,imp,jsonic"
			}, {
				p: "elem",
				g: "list,elem,jsonic"
			}], { append: true }).close([{
				s: "#ZZ",
				e: "@finish",
				g: "end,jsonic"
			}], { append: true }).bc((r, ctx) => {
				let m = ctx.cfg.info.marker;
				if (ctx.cfg.info.list && r.node?.[m]) r.node[m].implicit = !(r.o0 && r.o0.tin === ctx.cfg.t.OS);
			});
		});
		jsonic.rule("pair", (rs, p) => {
			rs.fnref({
				...fnm,
				"@pair-bc": (r, ctx) => {
					if (r.u.pair) pairval(r, ctx);
					if (true === r.u.child) {
						let val = r.child.node;
						val = void 0 === val ? null : val;
						let prev = r.node["child$"];
						if (void 0 === prev) r.node["child$"] = val;
						else r.node["child$"] = ctx.cfg.map.merge ? ctx.cfg.map.merge(prev, val, r, ctx) : ctx.cfg.map.extend ? deep(prev, val) : val;
					}
				}
			}).open([
				{
					s: "#KEY #CL",
					p: "val",
					u: { pair: true },
					a: "@pairkey",
					g: "map,pair,key,json"
				},
				{
					s: "#CA",
					g: "map,pair,comma,jsonic"
				},
				p.cfg.map.child && {
					s: "#CL",
					p: "val",
					u: {
						done: true,
						child: true
					},
					g: "map,pair,child,jsonic"
				}
			], {
				append: true,
				clear: true
			}).close([
				{
					s: "#CB",
					c: { "n.pk": { $lte: 0 } },
					b: 1,
					g: "map,pair,close,json"
				},
				{
					s: "#CA #CB",
					c: { "n.pk": { $lte: 0 } },
					b: 1,
					g: "map,pair,comma,jsonic"
				},
				{
					s: [CA, ZZ],
					g: "end,jsonic"
				},
				{
					s: "#CA",
					c: { "n.pk": { $lte: 0 } },
					r: "pair",
					g: "map,pair,sync,json"
				},
				{
					s: "#CA",
					c: { "n.dmap": { $lte: 1 } },
					r: "pair",
					g: "map,pair,sync,jsonic"
				},
				{
					s: "#KEY",
					c: { "n.dmap": { $lte: 1 } },
					r: "pair",
					b: 1,
					g: "map,pair,imp,sync,jsonic"
				},
				{
					s: ["#CB #CA #CS #KEY"],
					c: { "n.pk": { $gt: 0 } },
					b: 1,
					g: "map,pair,imp,path,close,jsonic"
				},
				{
					s: "#CS",
					e: (r) => r.c0,
					g: "end,jsonic"
				},
				{
					s: "#ZZ",
					e: "@finish",
					g: "map,pair,end,json"
				},
				{
					r: "pair",
					b: 1,
					g: "map,pair,imp,jsonic"
				}
			], {
				append: true,
				delete: [0, 1]
			});
		});
		jsonic.rule("elem", (rs, p) => {
			rs.fnref({
				...fnm,
				"@elem-bc/replace": (r, ctx) => {
					if (true !== r.u.done && void 0 !== r.child.node) r.node.push(r.child.node);
					if (true === r.u.pair) {
						if (ctx.cfg.list.pair) {
							let key = r.u.key;
							let val = r.child.node;
							val = void 0 === val ? null : val;
							let pairObj = Object.create(null);
							if (ctx.cfg.map.ordered) recordKeyOrder(pairObj, key);
							pairObj[key] = val;
							r.node.push(pairObj);
						} else pairval(r, ctx);
					}
					if (true === r.u.child) {
						let val = r.child.node;
						val = void 0 === val ? null : val;
						let prev = r.node["child$"];
						if (void 0 === prev) r.node["child$"] = val;
						else r.node["child$"] = ctx.cfg.map.merge ? ctx.cfg.map.merge(prev, val, r, ctx) : ctx.cfg.map.extend ? deep(prev, val) : val;
					}
				}
			}).open([
				{
					s: "#CA #CA",
					b: 2,
					u: { done: true },
					a: (r) => r.node.push(null),
					g: "list,elem,imp,null,jsonic"
				},
				{
					s: "#CA",
					u: { done: true },
					a: (r) => r.node.push(null),
					g: "list,elem,imp,null,jsonic"
				},
				{
					s: "#KEY #CL",
					e: p.cfg.list.property || p.cfg.list.pair ? void 0 : (_r, ctx) => ctx.t0,
					p: "val",
					n: {
						pk: 1,
						dmap: 1
					},
					u: {
						done: true,
						pair: true,
						list: true
					},
					a: "@pairkey",
					g: "elem,pair,jsonic"
				},
				p.cfg.list.child && {
					s: "#CL",
					p: "val",
					u: {
						done: true,
						child: true,
						list: true
					},
					g: "elem,child,jsonic"
				}
			]).close([
				{
					s: ["#CA", "#CS #ZZ"],
					b: 1,
					g: "list,elem,comma,jsonic"
				},
				{
					s: "#CA",
					r: "elem",
					g: "list,elem,sync,json"
				},
				{
					s: "#CS",
					b: 1,
					g: "list,elem,close,json"
				},
				{
					s: "#ZZ",
					e: "@finish",
					g: "list,elem,end,json"
				},
				{
					s: "#CB",
					e: (r) => r.c0,
					g: "end,jsonic"
				},
				{
					r: "elem",
					b: 1,
					g: "list,elem,imp,jsonic"
				}
			], { delete: [-1, -2] });
		});
	}
	function makeJSON(jsonic) {
		return jsonic.make({
			text: { lex: false },
			number: {
				hex: false,
				oct: false,
				bin: false,
				sep: null,
				exclude: /^(?!-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?$)/
			},
			string: {
				chars: "\"",
				multiChars: "",
				allowUnknown: false,
				escape: { v: null },
				escapeStrict: true
			},
			comment: { lex: false },
			map: { extend: false },
			lex: { empty: false },
			rule: {
				finish: false,
				include: "json"
			},
			result: { fail: [void 0, NaN] },
			tokenSet: { KEY: [
				"#ST",
				null,
				null,
				null
			] }
		});
	}
	const registerJsonicGrammar = grammar;
	exports.registerJsonicGrammar = registerJsonicGrammar;
	exports.jsonicPlugin = function jsonic(tn, _options) {
		tn.options(defaults_1.defaults);
		registerJsonicGrammar(tn);
		(0, jsonic_1.applyRuleFilter)(tn);
	};
}));
// node_modules/@tabnas/jsonic/dist/jsonic.js
var require_jsonic = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.root = exports.S = exports.SKIP = exports.EMPTY = exports.AFTER = exports.BEFORE = exports.CLOSE = exports.OPEN = exports.makeTextMatcher = exports.makeNumberMatcher = exports.makeCommentMatcher = exports.makeStringMatcher = exports.makeLineMatcher = exports.makeSpaceMatcher = exports.makeFixedMatcher = exports.makeParser = exports.makeLex = exports.makeRuleSpec = exports.makeRule = exports.makePoint = exports.makeToken = exports.util = exports.registerJsonicGrammar = exports.jsonic = exports.JsonicError = exports.Jsonic = exports.translate = exports.VERSION = exports.keyOrder = exports.Tabnas = void 0;
	exports.applyRuleFilter = applyRuleFilter;
	exports.makeTabnas = makeTabnas;
	exports.make = make;
	const parser_1 = require_tabnas();
	Object.defineProperty(exports, "JsonicError", {
		enumerable: true,
		get: function() {
			return parser_1.TabnasError;
		}
	});
	Object.defineProperty(exports, "util", {
		enumerable: true,
		get: function() {
			return parser_1.util;
		}
	});
	Object.defineProperty(exports, "S", {
		enumerable: true,
		get: function() {
			return parser_1.S;
		}
	});
	Object.defineProperty(exports, "OPEN", {
		enumerable: true,
		get: function() {
			return parser_1.OPEN;
		}
	});
	Object.defineProperty(exports, "CLOSE", {
		enumerable: true,
		get: function() {
			return parser_1.CLOSE;
		}
	});
	Object.defineProperty(exports, "BEFORE", {
		enumerable: true,
		get: function() {
			return parser_1.BEFORE;
		}
	});
	Object.defineProperty(exports, "AFTER", {
		enumerable: true,
		get: function() {
			return parser_1.AFTER;
		}
	});
	Object.defineProperty(exports, "EMPTY", {
		enumerable: true,
		get: function() {
			return parser_1.EMPTY;
		}
	});
	Object.defineProperty(exports, "SKIP", {
		enumerable: true,
		get: function() {
			return parser_1.SKIP;
		}
	});
	Object.defineProperty(exports, "makeLex", {
		enumerable: true,
		get: function() {
			return parser_1.makeLex;
		}
	});
	Object.defineProperty(exports, "makeParser", {
		enumerable: true,
		get: function() {
			return parser_1.makeParser;
		}
	});
	Object.defineProperty(exports, "makeToken", {
		enumerable: true,
		get: function() {
			return parser_1.makeToken;
		}
	});
	Object.defineProperty(exports, "makePoint", {
		enumerable: true,
		get: function() {
			return parser_1.makePoint;
		}
	});
	Object.defineProperty(exports, "makeRule", {
		enumerable: true,
		get: function() {
			return parser_1.makeRule;
		}
	});
	Object.defineProperty(exports, "makeRuleSpec", {
		enumerable: true,
		get: function() {
			return parser_1.makeRuleSpec;
		}
	});
	Object.defineProperty(exports, "makeFixedMatcher", {
		enumerable: true,
		get: function() {
			return parser_1.makeFixedMatcher;
		}
	});
	Object.defineProperty(exports, "makeSpaceMatcher", {
		enumerable: true,
		get: function() {
			return parser_1.makeSpaceMatcher;
		}
	});
	Object.defineProperty(exports, "makeLineMatcher", {
		enumerable: true,
		get: function() {
			return parser_1.makeLineMatcher;
		}
	});
	Object.defineProperty(exports, "makeStringMatcher", {
		enumerable: true,
		get: function() {
			return parser_1.makeStringMatcher;
		}
	});
	Object.defineProperty(exports, "makeCommentMatcher", {
		enumerable: true,
		get: function() {
			return parser_1.makeCommentMatcher;
		}
	});
	Object.defineProperty(exports, "makeNumberMatcher", {
		enumerable: true,
		get: function() {
			return parser_1.makeNumberMatcher;
		}
	});
	Object.defineProperty(exports, "makeTextMatcher", {
		enumerable: true,
		get: function() {
			return parser_1.makeTextMatcher;
		}
	});
	const utility_1 = require_utility();
	const translate_1 = require_translate$2();
	Object.defineProperty(exports, "translate", {
		enumerable: true,
		get: function() {
			return translate_1.translate;
		}
	});
	const defaults_1 = require_defaults();
	const grammar_1 = require_grammar();
	Object.defineProperty(exports, "jsonic", {
		enumerable: true,
		get: function() {
			return grammar_1.jsonicPlugin;
		}
	});
	Object.defineProperty(exports, "registerJsonicGrammar", {
		enumerable: true,
		get: function() {
			return grammar_1.registerJsonicGrammar;
		}
	});
	function make(param_options, parent) {
		let injectFullAPI = true;
		if ("jsonic" === param_options) injectFullAPI = false;
		else if ("json" === param_options) return (0, grammar_1.makeJSON)(root);
		param_options = "string" === typeof param_options ? {} : param_options;
		let tabnas;
		if (parent) tabnas = parent.internal().tabnas.make(param_options || {});
		else {
			const opts = (0, utility_1.deep)({}, false === param_options?.defaults$ ? {} : defaults_1.defaults, param_options || {});
			tabnas = new parser_1.Tabnas(opts);
		}
		const internal = {
			get parser() {
				return tabnas.internal().parser;
			},
			get config() {
				return tabnas.internal().config;
			},
			plugins: [],
			get sub() {
				return tabnas.internal().sub;
			},
			get mark() {
				return tabnas.internal().mark;
			},
			get merged() {
				return tabnas.internal().merged;
			},
			tabnas
		};
		const jsonic = function Jsonic(src, meta, parent_ctx) {
			if (parser_1.S.string === typeof src) {
				const opts_parser = tabnas.options.parser;
				return (opts_parser?.start ? (0, utility_1.parserwrap)(opts_parser) : tabnas.internal().parser).start(src, jsonic, meta, parent_ctx);
			}
			return src;
		};
		const api = {
			parse: jsonic,
			token: tabnas.token,
			tokenSet: tabnas.tokenSet,
			fixed: tabnas.fixed,
			options: tabnas.options,
			config: () => tabnas.config(),
			use: function use(plugin, plugin_options) {
				if (parser_1.S.function !== typeof plugin) throw new Error("Jsonic.use: the first argument must be a function defining a plugin. See https://github.com/tabnas/jsonic");
				const plugin_name = plugin.name.toLowerCase();
				const full_plugin_options = (0, utility_1.deep)({}, plugin.defaults || {}, plugin_options || {});
				ji.options({ plugin: { [plugin_name]: full_plugin_options } });
				const merged_plugin_options = ji.options.plugin[plugin_name];
				internal.plugins.push(plugin);
				plugin.options = merged_plugin_options;
				return plugin(ji, merged_plugin_options) || ji;
			},
			rule: (name, define) => {
				const r = tabnas.rule(name, define);
				return r === tabnas ? jsonic : r;
			},
			make: (options) => make(options, jsonic),
			empty: (options) => make({
				defaults$: false,
				standard$: false,
				grammar$: false,
				...options || {}
			}),
			id: "Jsonic/" + Date.now() + "/" + ("" + Math.random()).substring(2, 8).padEnd(6, "0") + (null == tabnas.options.tag ? "" : "/" + tabnas.options.tag),
			toString: () => api.id,
			sub: (spec) => {
				tabnas.sub(spec);
				return jsonic;
			},
			util: parser_1.util,
			grammar: (gs, setting) => {
				if ("string" === typeof gs) {
					const parsed = make()(gs);
					if (null == parsed || "object" !== typeof parsed) return jsonic;
					gs = parsed;
				}
				tabnas.grammar(gs, setting);
				return jsonic;
			}
		};
		(0, utility_1.defprop)(api.make, parser_1.S.name, { value: parser_1.S.make });
		if (injectFullAPI) (0, utility_1.assign)(jsonic, api);
		else (0, utility_1.assign)(jsonic, {
			empty: api.empty,
			parse: api.parse,
			sub: api.sub,
			id: api.id,
			toString: api.toString
		});
		(0, utility_1.defprop)(jsonic, "internal", { value: () => internal });
		const ji = injectFullAPI ? jsonic : (0, utility_1.assign)(Object.create(jsonic), api);
		if (parent) {
			for (const k in parent) if (void 0 === jsonic[k]) jsonic[k] = parent[k];
			jsonic.parent = parent;
		}
		if (false !== tabnas.options.grammar$) (0, grammar_1.grammar)(ji);
		if (parent) {
			const inherited = parent.internal().plugins;
			for (const plugin of inherited) ji.use(plugin);
		}
		applyRuleFilter(tabnas);
		return jsonic;
	}
	function applyRuleFilter(tabnas) {
		const cfg = tabnas.internal().config;
		if (0 === cfg.rule.include.length && 0 === cfg.rule.exclude.length) return;
		const tparser = tabnas.internal().parser;
		const rsm = tparser.rule();
		const filtered = {};
		for (const rn of Object.keys(rsm)) filtered[rn] = (0, utility_1.filterRules)(rsm[rn], cfg);
		tparser.rsm = filtered;
		tparser.norm();
	}
	function makeTabnas() {
		const tn = new parser_1.Tabnas().use(grammar_1.jsonicPlugin);
		tn.options({ lex: { window: true } });
		return tn;
	}
	const VERSION = "0.7.12";
	exports.VERSION = VERSION;
	let root = void 0;
	exports.root = root;
	let Jsonic = exports.root = root = make("jsonic");
	exports.Jsonic = Jsonic;
	root.Jsonic = root;
	root.JsonicError = parser_1.TabnasError;
	root.makeLex = parser_1.makeLex;
	root.makeParser = parser_1.makeParser;
	root.makeToken = parser_1.makeToken;
	root.makePoint = parser_1.makePoint;
	root.makeRule = parser_1.makeRule;
	root.makeRuleSpec = parser_1.makeRuleSpec;
	root.makeFixedMatcher = parser_1.makeFixedMatcher;
	root.makeSpaceMatcher = parser_1.makeSpaceMatcher;
	root.makeLineMatcher = parser_1.makeLineMatcher;
	root.makeStringMatcher = parser_1.makeStringMatcher;
	root.makeCommentMatcher = parser_1.makeCommentMatcher;
	root.makeNumberMatcher = parser_1.makeNumberMatcher;
	root.makeTextMatcher = parser_1.makeTextMatcher;
	root.OPEN = parser_1.OPEN;
	root.CLOSE = parser_1.CLOSE;
	root.BEFORE = parser_1.BEFORE;
	root.AFTER = parser_1.AFTER;
	root.EMPTY = parser_1.EMPTY;
	root.SKIP = parser_1.SKIP;
	root.util = parser_1.util;
	root.make = make;
	root.S = parser_1.S;
	root.jsonic = grammar_1.jsonicPlugin;
	root.registerJsonicGrammar = grammar_1.registerJsonicGrammar;
	root.Tabnas = parser_1.Tabnas;
	root.makeTabnas = makeTabnas;
	root.VERSION = VERSION;
	root.translate = translate_1.translate;
	root.keyOrder = parser_1.keyOrder;
	var parser_2 = require_tabnas();
	Object.defineProperty(exports, "Tabnas", {
		enumerable: true,
		get: function() {
			return parser_2.Tabnas;
		}
	});
	var parser_3 = require_tabnas();
	Object.defineProperty(exports, "keyOrder", {
		enumerable: true,
		get: function() {
			return parser_3.keyOrder;
		}
	});
	exports.default = Jsonic;
	if ("undefined" !== typeof module) module.exports = Jsonic;
}));
// node_modules/@tabnas/zon/dist/translate.js
var require_translate = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.translate = translate;
	const TRANSLATION = Object.freeze({
		manifest: `{
  "$schema": "https://tabnas.dev/schema/plugin.schema.json",
  "name": "@tabnas/zon",
  "go": "github.com/tabnas/zon/go",
  "rust": "tabnas-zon",
  "description": "Zig Object Notation (ZON) parsing for the tabnas engine.",
  "base": "@tabnas/jsonic",
  "engine": "@tabnas/parser",
  "grammar": "zon-grammar.jsonic",
  "extensions": [
    ".zon"
  ],
  "languageId": "zon",
  "pluginKind": "grammar",
  "grammarKind": "closure",
  "lexStream": "clean",
  "syncGroups": [
    "end",
    "comma",
    "close"
  ],
  "specDir": "test/spec",
  "clib": {
    "dir": "go/clib",
    "library": "libtabnaszon",
    "abi": "v1",
    "errorCodes": [
      "usage",
      "grammar",
      "handle",
      "internal"
    ]
  },
  "errorCodes": [
    "zon_number",
    "zon_ident",
    "zon_char",
    "zon_doc_comment",
    "zon_dup_field"
  ],
  "docs": "https://tabnas.dev/docs/packages",
  "repository": "https://github.com/tabnas/zon",
  "versionSource": "ts/package.json",
  "translate": {
    "reads": "tree",
    "writes": "tree",
    "root": "any",
    "render": "alchemy/render.alc",
    "transduce": "alchemy/transduce.alc",
    "loss": [
      "Comments are not kept.",
      "Every field name is written in the quoted identifier form, .@\\"name\\", whether or not it is a bare identifier.",
      "Strings are written double-quoted with Zig's escapes, never as multiline string literals.",
      "A character literal and an enum literal are written as the value the reader resolved them to, so neither reads back as a literal.",
      "An empty struct is written .{}, which ZON reads as an empty tuple, so an empty object reads back as an empty array.",
      "A field name is written by a convention that keeps every name apart: the empty name, which ZON has no field name for, as $empty; a name holding U+0000, which no ZON field name holds, as $json: followed by the name's double-quoted JSON form, as alchemy's quoted writes it; a name that begins with $ with one more $ in front, so $empty, $big and $json:x are written $$empty, $$big and $$json:x; and any other name as it is.",
      "Each field name reads back by the reverse of that convention: $empty is the empty name; $json: followed by a text is the string the text spells as a double-quoted JSON string, as alchemy's unquoted reads it; $$ followed by a rest is $ followed by the rest; and any other name is as it is.",
      "An object whose only member is $big and holds an integer's digits as the reader writes them (a string of the characters 0 to 9 and - that alchemy's number reads, other than -0), the reader's form of an integer no double holds exactly, is written as that integer, so it reads back as a number when a double holds the integer; any other object with a $big member is written as a struct, whose $big field the convention for names writes as $$big, so one whose $big holds 1-2, 01, -0 or - reads back as the object it was."
    ]
  }
}
`,
		render: Object.freeze({
			entry: "zon-render",
			source: `; ZON's render: a tree's events written as one ZON (Zig Object Notation)
; document. This is a library of definitions, each named \`zon-...\`, which
; a host links with its own program (alchemy's \`compile_sources\`); its
; entry point is \`zon-render\`, and nothing else here is the host's to
; call.
;
; The profile: an object is a struct literal, \`.{ .@"key" = value, ... }\`,
; an array a tuple literal, \`.{ value, ... }\`, and an empty container of
; either kind \`.{}\`, which ZON reads as an empty tuple, so an empty object
; reads back as an empty array. Every field name is written in the quoted
; identifier form, \`.@"name"\`, whether or not it is a bare identifier. A
; string is double-quoted with Zig's escapes: \`quoted\` gives the JSON
; form, and the escapes Zig lacks are rewritten, \`\\u00XX\` to the byte
; escape \`\\xXX\`, or to the two bytes \`\\xc2\\xXX\` for U+0080 to U+009F,
; since \`\\x\` writes a byte and the string is UTF-8; \`\\b\` to \`\\x08\`; \`\\f\`
; to \`\\x0c\`; \`\\ufffe\` and \`\\uffff\` to \`\\u{fffe}\` and \`\\u{ffff}\`. A number
; is its lexeme, or as the JSON renderer writes it when it has none; every
; JSON number is a Zig literal but \`-0\`, which ZON refuses as an ambiguous
; negative zero and is written \`-0.0\`; a non-finite one is \`inf\`, \`-inf\`
; or \`nan\`. The form is readable, as \`zig fmt\` writes it: one value per
; line, each ending in a comma, two spaces of indentation per level of
; nesting, and a container closed on its own line.
;
; A field name is written by a convention that keeps every name apart,
; since ZON has no identifier for some names, and the reader's own big
; integer takes the name \`$big\`. The empty name, which ZON has no
; identifier for (\`.@""\` is not one), is written as \`$empty\`. A name
; holding a character no ZON field name carries is written as \`$json:\`
; followed by the name's \`quoted\` form, which holds no such character:
; Zig's \`@"..."\` identifiers refuse a null byte and the empty name and
; nothing else, so that character is U+0000 (\`chars-within\` tells such a
; name). A name that begins with \`$\` is written with one more \`$\` in
; front: \`$empty\` as \`$$empty\`, \`$big\` as \`$$big\`, \`$json:x\` as
; \`$$json:x\`. Any other name is written as it is. The reverse, which
; reads each field name back: \`$empty\` is the empty name; \`$json:\` and a
; text is the name \`unquoted\` reads from the text; \`$$\` and a rest is
; \`$\` and the rest; any other name is as it is. No two names are written
; as one, so no struct the render writes holds a field twice.
;
; The reader has no big integer value: an integer literal no double holds
; exactly is built as the object \`{"$big": "<digits>"}\`, the digits after
; a minus sign when it is negative. So an object whose only member is
; \`$big\`, holding an integer as the reader spells one, is written as that
; integer: a string of the characters \`0\` to \`9\` and \`-\` alone
; (\`chars-within\`) that \`number\` reads (\`is-number\`), so a minus sign at
; most and first, and no leading zero, but not \`-0\`, which ZON refuses as
; an ambiguous negative zero. That is decided on the name as it is, before
; the convention above escapes it. The digits are held until the object
; ends, and an object with a second member is written as the struct it
; is, its first field \`$big\`, which the convention writes \`$$big\`; so is
; one whose \`$big\` holds anything else, such as the strings \`1-2\`, \`01\`,
; \`-0\` and \`-\`, which are written as strings.
;
; The events are a tree's: a struct holds each field once. A walked value
; is one by construction; a host that streams a parse must refuse a
; member the parse repeats, since the render writes what it is given and
; ZON forbids a repeated field.
;
; The state is the stack of open containers, one marker each, so it
; grows with a document's nesting and never with its width:
; \`:object-open\` and \`:array-open\` for a container whose \`.{\` is held
; until its first child or its end, so that an empty one is \`.{}\`;
; \`:object\` for a struct waiting for a field name, \`:member\` for one
; whose field name is written and waits for the value, and \`:array\` for
; a tuple waiting for an item; \`:big-key\` for an object whose first
; member is \`$big\` and waits for its value, and \`[:big digits]\` for one
; holding the digits, which its end writes as the integer. Once the root
; value is written the state is \`[:root-done]\`, and nothing may follow
; it. Events no tree has fail with PROTOCOL_ORDER_ERROR, saying so.
;
; Each value directly inside the root struct or tuple is a record of the
; text: the step that ends one answers alchemy's \`:record-end\` after its
; outputs, and so does the step that opens the root, so a host's writer
; holds a record until its end, and a run that fails part way leaves
; whole records behind.

def zon-indent [s]
  repeat (count s) "  "

; The top marker, or \`:none\` before the root value.
def zon-top [s]
  match (count s)
    case 0 :none
    case _ (top s)

; The top container under another marker.
def zon-mark [marker s]
  push marker (pop s)

; A value completed: a struct waiting for its member's value waits for
; its next field name, and the root value, once written, is the document.
def zon-done [s]
  match (count s)
    case 0 [:root-done]
    case _
      match (zon-top s)
        case :member (zon-mark :object s)
        case :big-key (zon-mark :object s)
        case _ s

def zon-key-due [s]
  fail :protocol-order "the events hold a value where a field name is due, which a tree's never do"

; The state a value may begin in: anywhere but a struct waiting for a
; field name.
def zon-value [s]
  match (zon-top s)
    case :object-open (zon-key-due s)
    case :object (zon-key-due s)
    case [:big _] (zon-key-due s)
    case _ s

; What comes before a value whose parent is the top of s: nothing at the
; root or after a field name's \` = \`; the struct's opening and its \`$big\`
; field for the value of a \`$big\` that is not the reader's digits; the
; tuple's opening and the item's indentation for the first item of a held
; tuple; the indentation alone for a later item.
def zon-lead [s]
  match (zon-top s)
    case :none ""
    case :member ""
    case :big-key (concat ".{\\n" (zon-indent s) (zon-key "$big") " = ")
    case :array-open (concat ".{\\n" (zon-indent s))
    case :array (zon-indent s)
    case _ (zon-key-due s)

; What comes after a value whose parent is the top of s: the line's end
; at the root, and a comma before it inside a container.
def zon-end [s]
  match (count s)
    case 0 "\\n"
    case _ ",\\n"

; A held tuple is opened by its first item.
def zon-opened [s]
  match (zon-top s)
    case :array-open (zon-mark :array s)
    case _ s

; A string in Zig's double-quoted form: \`quoted\`'s JSON form, protected,
; with its escapes rewritten.
def zon-string [text]
  zon-escapes (zon-protect (quoted text))

; The JSON form with each \`\\\\\`, an escaped backslash, replaced by a
; sentinel no quoted string holds (\`quoted\` escapes U+0001), so that
; every \`\\\` the rewrites meet begins an escape: an escaped backslash
; followed by the letters \`u0085\`, say, is never read as \`\\u0085\`.
def zon-protect [json-form]
  replace-text "\\\\\\\\" "\\u0001" json-form

; The escapes Zig lacks, rewritten in a protected JSON form: the two C1
; ranges first, so that \`\\u008X\` and \`\\u009X\` become the two UTF-8 bytes
; \`\\xc2\\x8X\` and \`\\xc2\\x9X\`, then every other \`\\u00XX\` to the byte \`\\xXX\`,
; \`\\b\` to \`\\x08\`, \`\\f\` to \`\\x0c\`, the two noncharacters \`\\ufffe\` and
; \`\\uffff\` to Zig's \`\\u{fffe}\` and \`\\u{ffff}\`, and the sentinel back to
; \`\\\\\`.
def zon-escapes [protected]
  replace-text "\\u0001" "\\\\\\\\"
    replace-text "\\\\uffff" "\\\\u{ffff}"
      replace-text "\\\\ufffe" "\\\\u{fffe}"
        replace-text "\\\\f" "\\\\x0c"
          replace-text "\\\\b" "\\\\x08"
            replace-text "\\\\u00" "\\\\x"
              replace-text "\\\\u009" "\\\\xc2\\\\x9"
                replace-text "\\\\u008" "\\\\xc2\\\\x8" protected

; A finite number by its text. ZON refuses \`-0\`, the one JSON lexeme that
; is not a Zig literal, as an ambiguous negative zero; \`-0.0\` is the
; float it means.
def zon-finite [text]
  match text
    case "-0" "-0.0"
    case _ text

def zon-number [n]
  match (number-class n)
    case :finite (zon-finite (scalar-text csv-options n))
    case :infinity "inf"
    case :negative-infinity "-inf"
    case :nan "nan"

def zon-scalar [value]
  match (kind value)
    case :null "null"
    case :boolean
      match value
        case true "true"
        case false "false"
    case :number (zon-number value)
    case _ (zon-string value)

; The characters a field name may hold in ZON: every one but U+0000.
def zon-name-chars [[1 1114111]]

; A field name, in the quoted identifier form.
def zon-key [name]
  concat ".@" (zon-field name)

; The field a name is written as, in Zig's double-quoted form, by the
; convention above: the empty name as \`$empty\`; a name holding U+0000 as
; \`$json:\` and its quoted form; a name that begins with \`$\` with one more
; \`$\` in front; any other name as it is.
def zon-field [name]
  match (length name)
    case 0 (zon-string "$empty")
    case _
      match (chars-within zon-name-chars name)
        case true (zon-escapes (zon-protect (zon-dollar (quoted name))))
        case false (zon-string (string-join "" ["$json:" (quoted name)]))

; A name's JSON form with one more \`$\` after the opening quote when the
; name begins with \`$\`. The sentinel U+0002, which a quoted string never
; holds raw (\`quoted\` escapes it), marks where the form begins, so the
; \`"$\` that follows it is the opening quote and the name's first
; character, never an escaped quote and a \`$\` inside the name.
def zon-dollar [json-form]
  replace-text "\\u0002" ""
    replace-text "\\u0002\\"$" "\\"$$" (string-join "" ["\\u0002" json-form])

; The characters of the reader's big integer digits: \`-\` and \`0\` to \`9\`.
def zon-digit-chars [[45 45] [48 57]]

; Whether a value is an integer as the reader writes a big integer's
; digits: a string, not empty, of the characters in \`zon-digit-chars\`
; alone, which \`number\` reads (\`is-number\`), so a minus sign at most and
; first, then \`0\` or digits that do not begin with \`0\`; and not \`-0\`,
; which ZON refuses as an ambiguous negative zero. Each is a ZON integer
; literal as it is.
def zon-big-digits [value]
  match (kind value)
    case :string
      match (length value)
        case 0 false
        case _
          match (chars-within zon-digit-chars value)
            case false false
            case true
              match value
                case "-0" false
                case _ (is-number value)
    case _ false

; A field name, written where the struct's fields go: the first opens the
; held struct, unless it is \`$big\`, whose value is waited for; a name
; after held digits opens the struct with \`$big\` first, its digits a
; string.
def zon-member [name s]
  match (zon-top s)
    case :object-open
      match name
        case "$big" (transition (zon-mark :big-key s) [])
        case _ (transition (zon-mark :member s) [".{\\n" (zon-indent s) (zon-key name) " = "])
    case :object
      transition (zon-mark :member s) [(zon-indent s) (zon-key name) " = "]
    case [:big digits]
      transition (zon-mark :member s) (zon-big-field digits name s)
    case _ (fail :protocol-order "the events hold a field name where a value is due, which a tree's never do")

; The held digits as the struct's \`$big\` field, a string, then the field
; name after it. In the root struct the \`$big\` field is a value directly
; inside the root, so it ends a record before the next field begins.
def zon-big-field [digits name s]
  match (count s)
    case 1 [".{\\n" (zon-indent s) (zon-key "$big") " = " (zon-string digits) ",\\n" :record-end (zon-indent s) (zon-key name) " = "]
    case _ [".{\\n" (zon-indent s) (zon-key "$big") " = " (zon-string digits) ",\\n" (zon-indent s) (zon-key name) " = "]

; The value of a \`$big\` that is an object's first member: the reader's
; digits are held until the object ends or another member begins; any
; other value is written as the struct's first field.
def zon-big [value s]
  match (zon-big-digits value)
    case true (transition (zon-mark [:big value] s) [])
    case false (zon-to (zon-done s) [(zon-lead s) (zon-scalar value) (zon-end s)])

; The outputs of a step whose next state is s, with the end of a record
; after them when s is one level deep: the root opened, or a value
; directly inside it ended (or the root itself, where the mark is the
; document's end).
def zon-ended [s outputs]
  match (count s)
    case 1 (push :record-end outputs)
    case _ outputs

; A step that moves to s, writing outputs, with the end of a record when
; s is one level deep.
def zon-to [s outputs]
  transition s (zon-ended s outputs)

def zon-step [s event]
  match (zon-top s)
    case :root-done (fail :protocol-order "the events hold more after the root value, which a tree's never do")
    case _ (zon-event s event)

def zon-event [s event]
  match event
    case object-start
      zon-to (push :object-open (zon-opened (zon-value s))) [(zon-lead s)]
    case array-start
      zon-to (push :array-open (zon-opened (zon-value s))) [(zon-lead s)]
    case (key name) (zon-member name s)
    case (scalar value)
      match (zon-top s)
        case :big-key (zon-big value s)
        case _
          zon-to (zon-done (zon-opened (zon-value s))) [(zon-lead s) (zon-scalar value) (zon-end s)]
    case object-end
      match (zon-top s)
        case :object-open
          zon-to (zon-done (pop s)) [".{}" (zon-end (pop s))]
        case :object
          zon-to (zon-done (pop s)) [(zon-indent (pop s)) "}" (zon-end (pop s))]
        case [:big digits]
          zon-to (zon-done (pop s)) [digits (zon-end (pop s))]
        case :member
          fail :protocol-order "the events end a struct after a field name and before its value, which a tree's never do"
        case :big-key
          fail :protocol-order "the events end a struct after a field name and before its value, which a tree's never do"
        case _
          fail :protocol-order "the events end a struct that is not open, which a tree's never do"
    case array-end
      match (zon-top s)
        case :array-open
          zon-to (zon-done (pop s)) [".{}" (zon-end (pop s))]
        case :array
          zon-to (zon-done (pop s)) [(zon-indent (pop s)) "}" (zon-end (pop s))]
        case _
          fail :protocol-order "the events end a tuple that is not open, which a tree's never do"

def zon-finish [s]
  match (zon-top s)
    case :root-done []
    case :none (fail :protocol-order "the events hold no value, where a tree's hold one")
    case _ (fail :protocol-order "the events ended inside a container, which a tree's never do")

; The render: the tree's events in, the document's text out.
def zon-render [input]
  join ""
    scan-emit [] zon-step zon-finish (events input)
`
		}),
		transduce: Object.freeze({
			entry: "zon-transduce",
			source: `; ZON's transducer part: the document's JSON events from the zon
; grammar's rule passes (ParserEvents/1), streamed as the parser makes
; them, so that a host that reads parser events (alchemy-cli's translate
; and run --grammar, aless) reads a ZON document through this file rather
; than through transduce's inference over the grammar's rule events.
;
; The grammar's rules are named as json's and map onto a tree as json's
; do: a map rule's open pass begins an object (a struct literal) and its
; close pass ends it, a list rule's an array (a tuple, or the empty .{});
; a pair rule's open pass announces the field's name, its first token's
; value, as the document spells it; and a val rule's open pass yields what
; its first token carries. For the containers and the keys the part is the
; library's declarative transducer, transduce-tree, with json's spec keyed
; by rule name (its open, close and finish steps, over the same state).
; The scalars are its own, since one of ZON's values the declarative form
; cannot take from a token: an integer no double holds, which the reader
; builds as the object {"$big": "<digits>"} (its Rust reader always, its
; TypeScript and Go readers for a host that asks, as alchemy-cli's parser
; does), is yielded as that object, one member; every other token's value
; as the scalar it is, a number with the lexeme it keeps where JSON spells
; it so (2.50 is written 2.50, 0x10 as 16), a character literal and a
; multiline string as the value the reader resolved, an enum literal as
; its name, which is the reader's value too unless a host sets enumTag,
; whose wrapping is made on the node after its close and reaches no pass.
; Every event is the one the walk of the grammar's value gives, a number's
; lexeme aside, which alchemy-cli's transduce.tsv runner holds it to; a
; repeated field the grammar refuses before any pass streams it.
def zon-transduce-spec
  record
    entry :map (record (entry :container :object))
    entry :list (record (entry :container :array))
    entry :pair (record (entry :key 0))
    entry :val (record (entry :scalar 0))

; A token's value as events: the reader's big integer, a record of one
; member, as that object; any other as the scalar it is.
def zon-transduce-value [value]
  match (kind value)
    case :record
      match (keys value)
        case [name] [object-start (key name) (scalar (get name value)) object-end]
        case _ (fail :unrepresentable "a token's value is a record the stream has no form for")
    case _ [(scalar value)]

def zon-transduce-step [state pass]
  match pass
    case (open rule)
      match (get (get :name rule) zon-transduce-spec)
        case missing (transition state [])
        case entry
          match (get :scalar entry)
            case missing (transduce-open zon-transduce-spec state rule)
            case _
              match (get-path (path 0) (get :tokens rule))
                case missing (transition state [])
                case token (transition state (zon-transduce-value (get :val token)))
    case (close rule) (transduce-close zon-transduce-spec state rule)

def zon-transduce [input]
  as-events (scan-emit [[] false] zon-transduce-step transduce-finish (parser-events input))
`
		})
	});
	function translate() {
		return TRANSLATION;
	}
}));
// node_modules/@tabnas/zon/dist/zon.js
var require_zon = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.translate = exports.VERSION = exports.Zon = void 0;
	const parser_1 = require_tabnas();
	const jsonic_1 = require_jsonic();
	const grammarText = `
# ZON Grammar Definition
# Parses Zig Object Notation (ZON) - a data format based on Zig anonymous
# struct literals.
#
# Example:
#   .{
#       .name = "example",
#       .version = "0.0.1",
#       .deps = .{ .foo = .{ .url = "https://..." } },
#       .paths = .{ "build.zig", "src" },
#   }
#
# The custom zon-dot lex matcher distinguishes struct (map) and tuple (list)
# openings at lex time by peeking ahead:
#   .{  followed by  .ident =    -> emits #OB  (struct / map)
#   .{  otherwise                -> emits #OS  (tuple / list)
# Both close on } which lexes as #CB. The list rules below use #CB (not
# the default #CS) as the list terminator so that the single } character
# closes both struct and tuple literals.
#
# A bare .identifier emits #TX with val = identifier (the leading dot is
# stripped). This token is both a valid KEY (when followed by =) and a
# valid VAL (when used as an enum literal).
#
# The grammar is applied with { rule: { alt: { g: 'zon' } } } so every
# alt below is automatically tagged with the 'zon' group.

{
  rule: val: open: [
    # Empty .{} -> empty list.
    { s: '#OS #CB' b: 2 p: list g: 'list,empty' }
  ]

  rule: list: open: [
    # @array$ allocates the list node (an empty array). Under the new core
    # the list node is no longer auto-seeded: @tabnas/json's @array$ only
    # runs on its own #OS open alts, which ZON replaces here. Without this
    # the elem rule's @elem-bc/replace would push onto an undefined node.
    { s: '#OS #CB' b: 1 a: '@array$' g: 'list,empty' }
    { s: '#OS' p: elem a: '@array$' g: 'list,open' }
  ]
  rule: list: close: [
    { s: '#CB' g: 'list,close' }
  ]

  rule: elem: close: [
    { s: '#CA #CB' b: 1 g: 'elem,trailing,comma' }
    { s: '#CA' r: elem g: 'elem,next,comma' }
    { s: '#CB' b: 1 g: 'elem,end' }
  ]

  rule: pair: close: [
    { s: '#CA #CB' b: 1 g: 'pair,trailing,comma' }
    { s: '#CA' r: pair g: 'pair,next,comma' }
    { s: '#CB' b: 1 g: 'pair,end' }
  ]
}
`;
	const Zon = (tn, options) => {
		const charAsNumber = !!options.charAsNumber;
		const enumTag = options.enumTag || null;
		tn.options({ config: { modify: { "zon-tokendesc": (cfg) => {
			cfg.tokenDesc = Object.assign(cfg.tokenDesc || {}, {
				"#OB": ".{ — start of a struct (map)",
				"#OS": ".{ — start of a tuple (list)",
				"#CS": "} — end of a tuple (list)",
				"KEY": "field name: .identifier or .@\"...\" (dot stripped)",
				"VAL": "value: number, string, true/false/null, or .enum"
			});
		} } } });
		const refs = {
			"@val-ac": (r, _ctx) => {
				if (!enumTag) return;
				if (void 0 !== r.child.node) return;
				if (0 === r.os) return;
				const tkn = r.o0;
				if (tkn && tkn.use && tkn.use.zonEnum) r.node = { [enumTag]: tkn.val };
			},
			"@pair-bc/prepend": (r, ctx) => {
				if (!r.u.pair) return;
				const node = r.node;
				if (null == node || "object" !== typeof node) return;
				const key = r.u.key;
				if (key in node) {
					const tkn = r.o0 || ctx.t0;
					tkn.err = "zon_dup_field";
					tkn.use = Object.assign(tkn.use || {}, { key });
					return tkn;
				}
			}
		};
		const grammarDef = new parser_1.Tabnas().use(jsonic_1.jsonic).parse(grammarText);
		grammarDef.ref = refs;
		grammarDef.options = {
			rule: {
				exclude: "jsonic,imp",
				start: "val"
			},
			fixed: { token: {
				"#OB": null,
				"#OS": null,
				"#CS": null,
				"#CL": "="
			} },
			tokenSet: { KEY: [
				"#TX",
				null,
				null,
				null
			] },
			string: { lex: false },
			number: { lex: false },
			error: {
				zon_number: "invalid ZON number literal: {src}",
				zon_ident: "invalid ZON identifier: {src}",
				zon_char: "invalid ZON character literal: {src}",
				zon_doc_comment: "doc comments are not allowed in ZON: {src}",
				zon_dup_field: "duplicate struct field name: {src}"
			},
			hint: {
				zon_number: "A ZON number is a Zig literal, such as 0, 42, 1_000, 3.14, 1.e3, 0x2a,\n0x1.8p3, 0o17 or 0b101. After a lowercase base prefix every digit is of\nthat base, and there is at least one. A decimal integer part other\nthan 0 does not start with 0. Only decimal and hex numbers take a\nfraction or an exponent (e, or p for hex), and an exponent needs\ndigits. An underscore goes only between two digits. A negative zero is\nwritten -0.0, not -0, and nan takes no sign.",
				zon_ident: "A ZON field name is .name, a letter or underscore then letters, digits\nand underscores, or .@\"text\" for any other name; the quoted form must\nnot be empty or hold an invalid escape.",
				zon_char: "A ZON character literal holds exactly one character or escape between\nsingle quotes, as in 'a', and names a code point no higher than U+10FFFF.",
				zon_doc_comment: "ZON allows only plain // comments. Doc comments, /// and //!, belong to\nZig source; change them to //.",
				zon_dup_field: "A struct literal may name each field only once, and {src} appears\nagain. Remove or rename the repeated field."
			},
			comment: {
				lex: true,
				def: {
					hash: { lex: false },
					slash: {
						line: true,
						start: "//",
						lex: true,
						eatline: false
					},
					multi: { lex: false }
				}
			},
			value: {
				lex: true,
				def: {
					true: { val: true },
					false: { val: false },
					null: { val: null }
				}
			},
			text: { lex: false },
			lex: { match: {
				zonDot: {
					order: 1e5,
					make: buildZonDotMatcher()
				},
				zonMultiString: {
					order: 11e4,
					make: buildZonMultiStringMatcher()
				},
				zonChar: {
					order: 12e4,
					make: buildZonCharMatcher(charAsNumber)
				},
				zonNumber: {
					order: 13e4,
					make: buildZonNumberMatcher()
				},
				zonDocComment: {
					order: 14e4,
					make: buildZonDocCommentMatcher()
				},
				zonString: {
					order: 15e4,
					make: buildZonStringMatcher()
				}
			} }
		};
		tn.grammar(grammarDef, { rule: { alt: { g: "zon" } } });
	};
	exports.Zon = Zon;
	var Source = class {
		constructor(lex) {
			this.lex = lex;
			this.from = lex.pnt.sI;
		}
		has(i) {
			if (i < this.lex.src.length) return true;
			const read = i - this.from;
			this.lex.fill?.(Math.max(read + 1, 2 * read));
			return i < this.lex.src.length;
		}
		at(i) {
			return this.has(i) ? this.lex.src[i] : void 0;
		}
		code(i) {
			return this.has(i) ? this.lex.src.charCodeAt(i) : NaN;
		}
		point(i) {
			return this.has(i) ? this.lex.src.codePointAt(i) : void 0;
		}
		text(a, b) {
			this.has(b - 1);
			return this.lex.src.substring(a, b);
		}
		cap(end) {
			return this.has(end - 1) ? end : this.lex.src.length;
		}
	};
	function buildZonDotMatcher() {
		return function makeZonDotMatcher(cfg, _opts) {
			return function zonDotMatcher(lex) {
				const { pnt } = lex;
				const src = new Source(lex);
				const { sI, cI, rI } = pnt;
				if ("." !== src.at(sI)) return void 0;
				const pos = skipInsigPos(cfg, src, sI + 1, rI, cI + 1);
				const dI = pos.i;
				const advance = (end) => {
					pnt.sI = end;
					pnt.rI = pos.rI;
					pnt.cI = pos.cI + (end - dI);
				};
				if ("{" === src.at(dI)) {
					const tin = peekIsMapOpen(cfg, src, dI + 1) ? "#OB" : "#OS";
					const tkn = lex.token(tin, void 0, src.text(sI, dI + 1), pnt);
					advance(dI + 1);
					return tkn;
				}
				if ("@" === src.at(dI) && "\"" === src.at(dI + 1)) {
					const dec = decodeZigString(src, dI + 2);
					if (null === dec || "" === dec.val || -1 !== dec.val.indexOf("\0")) return lex.bad("zon_ident", sI, null === dec ? dI + 2 : dec.end);
					const srcText = src.text(sI, dec.end);
					const tkn = lex.token("#TX", dec.val, srcText, pnt, { zonEnum: true });
					advance(dec.end);
					return tkn;
				}
				if (!isIdStart(src.code(dI))) return void 0;
				let eI = dI;
				while (src.has(eI) && isIdCont(src.code(eI))) eI++;
				const srcText = src.text(sI, eI);
				const name = src.text(dI, eI);
				const tkn = lex.token("#TX", name, srcText, pnt, { zonEnum: true });
				advance(eI);
				return tkn;
			};
		};
	}
	function skipInsigPos(cfg, src, i, rI, cI) {
		while (src.has(i)) {
			const c = src.at(i);
			if (cfg.line.chars[c]) {
				if (cfg.line.rowChars[c]) rI++;
				cI = 1;
				i++;
			} else if (" " === c || "	" === c) {
				i++;
				cI++;
			} else if ("/" === c && "/" === src.at(i + 1)) while (src.has(i) && !cfg.line.chars[src.at(i)]) {
				i++;
				cI++;
			}
			else break;
		}
		return {
			i,
			rI,
			cI
		};
	}
	function peekIsMapOpen(cfg, src, start) {
		let i = skipInsig(cfg, src, start);
		if ("." !== src.at(i)) return false;
		i = skipInsig(cfg, src, i + 1);
		if ("@" === src.at(i) && "\"" === src.at(i + 1)) {
			const dec = decodeZigString(src, i + 2);
			if (null === dec) return false;
			i = dec.end;
		} else {
			if (!isIdStart(src.code(i))) return false;
			i++;
			while (src.has(i) && isIdCont(src.code(i))) i++;
		}
		i = skipInsig(cfg, src, i);
		return "=" === src.at(i);
	}
	function decodeZigString(src, i) {
		const scan = scanZigString(src, i);
		return void 0 === scan.err ? {
			val: scan.val,
			end: scan.end
		} : null;
	}
	function scanZigString(src, start) {
		let out = "";
		let pending = [];
		const flush = () => {
			if (0 < pending.length) {
				out += new TextDecoder().decode(Uint8Array.from(pending));
				pending = [];
			}
		};
		const fault = (err, end) => ({
			val: "",
			end: src.cap(end),
			err
		});
		let i = start;
		while (src.has(i)) {
			const c = src.code(i);
			if (34 === c) {
				flush();
				return {
					val: out,
					end: i + 1
				};
			}
			if (10 === c || 13 === c) return fault("unterminated_string", i);
			if (c < 32 || 127 === c) return fault("unprintable", i + 1);
			if (92 !== c) {
				flush();
				out += src.at(i);
				i++;
				continue;
			}
			const e = src.at(i + 1);
			if (void 0 === e) return fault("unterminated_string", i + 1);
			if ("x" === e) {
				const hex = src.text(i + 2, i + 4);
				if (!/^[0-9a-fA-F]{2}$/.test(hex)) return fault("invalid_ascii", i + 4);
				pending.push(parseInt(hex, 16));
				i += 4;
			} else if ("u" === e) {
				if ("{" !== src.at(i + 2)) return fault("invalid_unicode", i + 3);
				let close = i + 3;
				while (src.has(close) && -1 !== digitVal(src.at(close))) close++;
				if (close === i + 3 || "}" !== src.at(close)) return fault("invalid_unicode", close + 1);
				const cp = parseInt(src.text(i + 3, close), 16);
				if (1114111 < cp || 55296 <= cp && cp <= 57343) return fault("invalid_unicode", close + 1);
				flush();
				out += String.fromCodePoint(cp);
				i = close + 1;
			} else if (void 0 !== ZIG_ESCAPE[e]) {
				flush();
				out += ZIG_ESCAPE[e];
				i += 2;
			} else return fault("unexpected", i + 2);
		}
		return fault("unterminated_string", src.cap(i));
	}
	function buildZonStringMatcher() {
		return function makeZonStringMatcher(_cfg, _opts) {
			return function zonStringMatcher(lex) {
				const { pnt } = lex;
				const src = new Source(lex);
				const { sI, cI } = pnt;
				if ("\"" !== src.at(sI)) return void 0;
				const scan = scanZigString(src, sI + 1);
				if (void 0 !== scan.err) return lex.bad(scan.err, sI, scan.end);
				const tkn = lex.token("#ST", scan.val, src.text(sI, scan.end), pnt);
				pnt.sI = scan.end;
				pnt.cI = cI + (scan.end - sI);
				return tkn;
			};
		};
	}
	const ZIG_ESCAPE = {
		n: "\n",
		r: "\r",
		t: "	",
		"\\": "\\",
		"'": "'",
		"\"": "\""
	};
	function skipInsig(cfg, src, i) {
		return skipInsigPos(cfg, src, i, 1, 1).i;
	}
	function isIdStart(c) {
		return 65 <= c && c <= 90 || 97 <= c && c <= 122 || 95 === c;
	}
	function isIdCont(c) {
		return 48 <= c && c <= 57 || 65 <= c && c <= 90 || 97 <= c && c <= 122 || 95 === c;
	}
	function buildZonMultiStringMatcher() {
		return function makeZonMultiStringMatcher(cfg, _opts) {
			return function zonMultiStringMatcher(lex) {
				const { pnt } = lex;
				const src = new Source(lex);
				if ("\\" !== src.at(pnt.sI) || "\\" !== src.at(pnt.sI + 1)) return void 0;
				const startI = pnt.sI;
				const startCI = pnt.cI;
				let sI = pnt.sI;
				let rI = pnt.rI;
				const parts = [];
				while ("\\" === src.at(sI) && "\\" === src.at(sI + 1)) {
					sI += 2;
					const lineStart = sI;
					while (src.has(sI) && !cfg.line.chars[src.at(sI)]) sI++;
					parts.push(src.text(lineStart, sI));
					if (src.has(sI) && cfg.line.chars[src.at(sI)]) {
						const ch = src.at(sI);
						if (cfg.line.rowChars[ch]) rI++;
						sI++;
						if (src.has(sI) && "\r" === ch && "\n" === src.at(sI)) sI++;
					}
					let peek = sI;
					let peekR = 0;
					while (src.has(peek)) {
						const pc = src.at(peek);
						if (" " === pc || "	" === pc) peek++;
						else if (cfg.line.chars[pc]) {
							if (cfg.line.rowChars[pc]) peekR++;
							peek++;
						} else break;
					}
					if ("\\" !== src.at(peek) || "\\" !== src.at(peek + 1)) break;
					sI = peek;
					rI += peekR;
				}
				const val = parts.join("\n");
				const tsrc = src.text(startI, sI);
				const tkn = lex.token("#ST", val, tsrc, pnt);
				pnt.sI = sI;
				pnt.rI = rI;
				pnt.cI = startCI + (sI - startI);
				return tkn;
			};
		};
	}
	function buildZonCharMatcher(charAsNumber) {
		return function makeZonCharMatcher(_cfg, _opts) {
			return function zonCharMatcher(lex) {
				const { pnt } = lex;
				const src = new Source(lex);
				const { sI, cI } = pnt;
				if ("'" !== src.at(sI)) return void 0;
				let i = sI + 1;
				let codepoint = null;
				if ("\\" === src.at(i)) {
					i++;
					switch (src.at(i)) {
						case "n":
							codepoint = 10;
							i++;
							break;
						case "r":
							codepoint = 13;
							i++;
							break;
						case "t":
							codepoint = 9;
							i++;
							break;
						case "\\":
							codepoint = 92;
							i++;
							break;
						case "'":
							codepoint = 39;
							i++;
							break;
						case "\"":
							codepoint = 34;
							i++;
							break;
						case "x": {
							i++;
							const hex = src.text(i, i + 2);
							if (!/^[0-9a-fA-F]{2}$/.test(hex)) return void 0;
							codepoint = parseInt(hex, 16);
							i += 2;
							break;
						}
						case "u": {
							i++;
							if ("{" !== src.at(i)) return void 0;
							i++;
							let endI = i;
							while (src.has(endI) && -1 !== digitVal(src.at(endI))) endI++;
							if ("}" !== src.at(endI)) return void 0;
							const hex = src.text(i, endI);
							if (!/^[0-9a-fA-F]+$/.test(hex)) return void 0;
							codepoint = parseInt(hex, 16);
							if (1114111 < codepoint) return lex.bad("zon_char", sI, src.cap(endI + 2));
							i = endI + 1;
							break;
						}
						default: return;
					}
				} else if (src.has(i) && "'" !== src.at(i)) {
					codepoint = src.point(i);
					if (codepoint < 32 || 127 === codepoint) return lex.bad("zon_char", sI, i + 1);
					i += codepoint > 65535 ? 2 : 1;
				} else return;
				if ("'" !== src.at(i)) return void 0;
				i++;
				const tsrc = src.text(sI, i);
				const val = charAsNumber ? codepoint : String.fromCodePoint(codepoint);
				const tkn = lex.token("#NR", val, tsrc, pnt);
				pnt.sI = i;
				pnt.cI = cI + (i - sI);
				return tkn;
			};
		};
	}
	function buildZonDocCommentMatcher() {
		return function makeZonDocCommentMatcher(_cfg, _opts) {
			return function zonDocCommentMatcher(lex) {
				const { pnt } = lex;
				const src = new Source(lex);
				const sI = pnt.sI;
				if ("/" !== src.at(sI) || "/" !== src.at(sI + 1)) return void 0;
				const c = src.at(sI + 2);
				if ("!" === c || "/" === c && "/" !== src.at(sI + 3)) return lex.bad("zon_doc_comment", sI, sI + 3);
			};
		};
	}
	function buildZonNumberMatcher() {
		return function makeZonNumberMatcher(_cfg, _opts) {
			return function zonNumberMatcher(lex) {
				const { pnt } = lex;
				const src = new Source(lex);
				const { sI, cI } = pnt;
				let i = sI;
				let neg = false;
				if ("-" === src.at(sI)) {
					neg = true;
					i++;
					while (" " === src.at(i) || "	" === src.at(i)) i++;
				}
				const c = src.at(i);
				if (void 0 === c) return void 0;
				if ("i" === c || "n" === c) {
					const kw = src.text(i, i + 3);
					if (("inf" === kw || "nan" === kw) && !isIdCont(src.code(i + 3))) {
						if ("nan" === kw && neg) return lex.bad("zon_number", sI, i + 3);
						const val = "inf" === kw ? neg ? -1e400 : 1e400 : NaN;
						const end = i + 3;
						const tkn = lex.token("#NR", val, src.text(sI, end), pnt);
						pnt.sI = end;
						pnt.cI = cI + (end - sI);
						return tkn;
					}
					return;
				}
				if (!isDigit(c.charCodeAt(0))) return void 0;
				const num = scanZonNumber(src, i);
				if (num.err) return lex.bad("zon_number", sI, num.end);
				let val;
				if (num.isInt) {
					const big = num.big;
					if (neg && 0n === big) return lex.bad("zon_number", sI, num.end);
					const signed = neg ? -big : big;
					const asNum = Number(signed);
					val = Number.isFinite(asNum) && BigInt(asNum) === signed ? asNum : signed;
				} else val = neg ? -num.num : num.num;
				const end = num.end;
				const tkn = lex.token("#NR", val, src.text(sI, end), pnt);
				pnt.sI = end;
				pnt.cI = cI + (end - sI);
				return tkn;
			};
		};
	}
	function scanZonNumber(src, start) {
		let i = start;
		let base = 10;
		const fail = () => ({
			end: scanNumTokenEnd(src, start),
			err: true
		});
		if ("0" === src.at(i)) {
			const c1 = src.at(i + 1);
			if ("x" === c1 || "o" === c1 || "b" === c1) {
				base = "x" === c1 ? 16 : "o" === c1 ? 8 : 2;
				i += 2;
			} else if ("X" === c1 || "O" === c1 || "B" === c1) return fail();
			else if (void 0 !== c1 && ("_" === c1 || isDigit(c1.charCodeAt(0)))) return fail();
		}
		const intRun = scanDigitRun(src, i, base);
		if (intRun.bad) return fail();
		const intText = src.text(i, intRun.end).replace(/_/g, "");
		i = intRun.end;
		let isFloat = false;
		let fracText = "";
		if ("." === src.at(i)) {
			const after = src.at(i + 1);
			const afterDV = void 0 === after ? -1 : digitVal(after);
			if (0 <= afterDV && afterDV < base || 16 === base && ("p" === after || "P" === after) || 10 === base && ("e" === after || "E" === after)) {
				if (16 !== base && 10 !== base) return fail();
				isFloat = true;
				i++;
				const fracRun = scanDigitRun(src, i, base);
				if (fracRun.bad) return fail();
				fracText = src.text(i, fracRun.end).replace(/_/g, "");
				i = fracRun.end;
			}
		}
		let expVal = 0;
		let hasExp = false;
		const expChar = 16 === base ? "pP" : 10 === base ? "eE" : "";
		const x = src.at(i);
		if ("" !== expChar && void 0 !== x && -1 !== expChar.indexOf(x)) {
			hasExp = true;
			isFloat = true;
			i++;
			let expSign = 1;
			if ("+" === src.at(i) || "-" === src.at(i)) {
				if ("-" === src.at(i)) expSign = -1;
				i++;
			}
			const expRun = scanDigitRun(src, i, 10);
			if (expRun.bad || 0 === expRun.count) return fail();
			expVal = expSign * parseInt(src.text(i, expRun.end).replace(/_/g, ""), 10);
			i = expRun.end;
		}
		if (0 === intRun.count && 0 === fracText.length) return fail();
		if (isIdCont(src.code(i))) return fail();
		if (isFloat) {
			let num;
			if (16 === base) num = Number(BigInt("0x" + ((intText || "0") + fracText))) * Math.pow(2, expVal - 4 * fracText.length);
			else num = parseFloat((intText || "0") + (0 < fracText.length ? "." + fracText : "") + (hasExp ? "e" + expVal : ""));
			return {
				end: i,
				num
			};
		}
		return {
			end: i,
			isInt: true,
			big: BigInt((16 === base ? "0x" : 8 === base ? "0o" : 2 === base ? "0b" : "") + (intText || "0"))
		};
	}
	function scanDigitRun(src, i, base) {
		const start = i;
		let count = 0;
		let prevDigit = false;
		for (; src.has(i); i++) {
			const ch = src.at(i);
			if ("_" === ch) {
				if (!prevDigit) return {
					end: i,
					count,
					bad: true
				};
				prevDigit = false;
				continue;
			}
			const dv = digitVal(ch);
			if (0 <= dv && dv < base) {
				count++;
				prevDigit = true;
				continue;
			}
			break;
		}
		if (start < i && !prevDigit) return {
			end: i,
			count,
			bad: true
		};
		return {
			end: i,
			count,
			bad: false
		};
	}
	function scanNumTokenEnd(src, i) {
		while (src.has(i)) {
			const c = src.code(i);
			if (isIdCont(c)) i++;
			else if (46 === c && src.has(i + 1) && isIdCont(src.code(i + 1))) i++;
			else break;
		}
		return i;
	}
	function isDigit(c) {
		return 48 <= c && c <= 57;
	}
	function digitVal(ch) {
		const c = ch.charCodeAt(0);
		if (48 <= c && c <= 57) return c - 48;
		if (97 <= c && c <= 102) return c - 87;
		if (65 <= c && c <= 70) return c - 55;
		return -1;
	}
	Zon.defaults = {
		charAsNumber: false,
		enumTag: null
	};
	var translate_1 = require_translate();
	Object.defineProperty(exports, "translate", {
		enumerable: true,
		get: function() {
			return translate_1.translate;
		}
	});
	exports.VERSION = "0.5.19";
}));
// src/network.ts
var import_tabnas = require_tabnas();
var import_jsonic = require_jsonic();
var import_zon = require_zon();
async function fetchResponse(url, timeout = 15e3) {
	let response;
	try {
		response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
	} catch (error) {
		throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`HTTP ${response.status} fetching ${url}`);
	}
	return response;
}
async function fetchJson(url) {
	const response = await fetchResponse(url);
	try {
		return await response.json();
	} catch (error) {
		throw new Error(`Failed to read JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
	}
}
async function downloadFile(url) {
	const response = await fetchResponse(url, 12e4);
	const destination = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), `setup-zig-${randomUUID()}`);
	try {
		if (!response.body) throw new Error("Empty response body");
		await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: "wx" }));
		return destination;
	} catch (error) {
		await fs.rm(destination, { force: true });
		throw new Error(`Failed to download ${url}: ${error instanceof Error ? error.message : String(error)}`);
	}
}
// src/common.ts
const zonParser = new import_tabnas.Tabnas().use(import_jsonic.jsonic).use(import_zon.Zon);
const VERSIONS_JSON = "https://ziglang.org/download/index.json";
const MACH_VERSIONS_JSON = "https://pkg.machengine.org/zig/index.json";
let _cached_version = null;
async function getVersion() {
	if (_cached_version !== null) return _cached_version;
	let raw = getInput("version");
	if (raw === "") {
		const manifest = getInput("manifest-path") || "build.zig.zon";
		let source;
		try {
			source = await fs$1.promises.readFile(manifest, "utf8");
		} catch (error) {
			if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "ENOENT") throw error;
			info(`${manifest} not found (using latest)`);
		}
		if (source !== void 0) {
			let zon;
			try {
				zon = zonParser.parse(source);
			} catch (error) {
				throw new Error(`Failed to parse ${manifest}: ${error instanceof Error ? error.message : String(error)}`);
			}
			if (!zon || Array.isArray(zon) && zon.length !== 0 || typeof zon !== "object") throw new Error(`${manifest} must contain a ZON struct`);
			const mach = "mach_zig_version" in zon ? zon.mach_zig_version : void 0;
			const minimum = "minimum_zig_version" in zon ? zon.minimum_zig_version : void 0;
			const candidate = mach ?? minimum ?? "";
			if (typeof candidate !== "string") throw new Error(`Zig version in ${manifest} must be a string`);
			raw = candidate;
			if (raw === "") info(`No Zig version specified in ${manifest} (using latest)`);
		}
		if (raw === "") raw = "latest";
	}
	let version;
	if (raw === "master") version = versionFromIndex(await fetchJson(VERSIONS_JSON), "master");
	else if (raw === "latest") {
		const versions = await fetchJson(VERSIONS_JSON);
		if (typeof versions !== "object" || versions === null) throw new Error("Invalid Zig version index");
		version = Object.keys(versions).filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => versionLessThan(a, b) ? 1 : versionLessThan(b, a) ? -1 : 0)[0];
	} else if (/^\d+\.\d+\.\d+-mach$/.test(raw)) {
		version = versionFromIndex(await fetchJson(MACH_VERSIONS_JSON), raw);
		if (!version) throw new Error(`Mach nominated version '${raw}' not found`);
	} else version = raw;
	if (typeof version !== "string" || parseVersion(version) === null) throw new Error(`Invalid or unavailable Zig version: ${version ?? raw}`);
	_cached_version = version;
	return version;
}
async function getTarballName() {
	const version = await getVersion();
	let arch = {
		arm: "arm",
		arm64: "aarch64",
		loong64: "loongarch64",
		mips: "mips",
		mipsel: "mipsel",
		mips64: "mips64",
		mips64el: "mips64el",
		ppc64: "powerpc64",
		riscv64: "riscv64",
		s390x: "s390x",
		ia32: "x86",
		x64: "x86_64"
	}[os$1.arch()];
	if (arch === "powerpc64" && os$1.endianness() === "LE") arch = "powerpc64le";
	if (arch === "arm" && versionLessThan(version, "0.15.1")) arch = "armv7a";
	const platform = {
		android: "android",
		freebsd: "freebsd",
		sunos: "illumos",
		linux: "linux",
		darwin: "macos",
		netbsd: "netbsd",
		openbsd: "openbsd",
		win32: "windows"
	}[os$1.platform()];
	if (!arch || !platform) throw new Error(`Unsupported Zig platform: ${os$1.platform()}/${os$1.arch()}`);
	if (versionLessThan(version, "0.14.1") || !versionLessThan(version, "0.15.0-dev.0+0") && versionLessThan(version, "0.15.0-dev.631+9a3540d61")) return `zig-${platform}-${arch}-${version}`;
	return `zig-${arch}-${platform}-${version}`;
}
function versionLessThan(cur_ver, min_ver) {
	const cur = parseVersion(cur_ver);
	const min = parseVersion(min_ver);
	if (cur === null || min === null) return false;
	const cur_dev = cur.dev === null ? 1e400 : cur.dev;
	const min_dev = min.dev === null ? 1e400 : min.dev;
	if (cur.major != min.major) return cur.major < min.major;
	if (cur.minor != min.minor) return cur.minor < min.minor;
	if (cur.patch != min.patch) return cur.patch < min.patch;
	return cur_dev < min_dev;
}
function parseVersion(str) {
	const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-dev\.(?<dev>\d+)\+[0-9a-f]+)?$/.exec(str);
	if (match?.groups === void 0) return null;
	return {
		major: Number(match.groups["major"]),
		minor: Number(match.groups["minor"]),
		patch: Number(match.groups["patch"]),
		dev: match.groups["dev"] === void 0 ? null : Number(match.groups["dev"])
	};
}
async function getTarballExt() {
	if (os$1.platform() == "win32") return ".zip";
	return ".tar.xz";
}
async function getCachePrefix() {
	const tarball_name = await getTarballName();
	return `setup-zig-cache-v2-${(process.env.GITHUB_JOB || "zig").replaceAll(/[^\w]/g, "_")}-${tarball_name}-${getInput("cache-key")}-`;
}
function getZigCachePath() {
	return path$1.join(process.env["GITHUB_WORKSPACE"] ?? process.cwd(), ".zig-cache");
}
function getCacheSizeLimit() {
	const raw = getInput("cache-size-limit");
	const bytes = (raw === "" ? 2048 : Number(raw)) * 1024 * 1024;
	if (!Number.isFinite(bytes) || bytes < 0) throw new Error("'cache-size-limit' must be a nonnegative finite number of MiB");
	return bytes;
}
function versionFromIndex(index, key) {
	if (typeof index !== "object" || index === null || !(key in index)) return void 0;
	const entry = Reflect.get(index, key);
	if (typeof entry !== "object" || entry === null || !("version" in entry)) return void 0;
	return typeof entry.version === "string" ? entry.version : void 0;
}
// src/minisign.ts
async function parseKey(key_str) {
	const key_info = decodeBase64(key_str, 42);
	if (key_info.subarray(0, 2).toString() !== "Ed") throw new Error("invalid public key algorithm");
	const id = key_info.subarray(2, 10);
	const key = key_info.subarray(10);
	if (key.byteLength !== 32) throw new Error("invalid public key given");
	return {
		id,
		key: await crypto.subtle.importKey("raw", key, "Ed25519", false, ["verify"])
	};
}
function parseSignature(sig_buf) {
	const lines = sig_buf.toString("utf8").replaceAll("\r\n", "\n").split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length > 4) throw new Error("invalid minisign signature: trailing bytes");
	if (lines.length !== 4) throw new Error("invalid minisign signature: expected four lines");
	const [untrusted, info, trusted, global] = lines;
	if (untrusted === void 0 || info === void 0 || trusted === void 0 || global === void 0) throw new Error("invalid minisign signature: missing fields");
	if (!untrusted.startsWith("untrusted comment: ")) throw new Error("invalid minisign signature: bad untrusted comment header");
	if (!trusted.startsWith("trusted comment: ")) throw new Error("invalid minisign signature: bad trusted comment header");
	const sig_info = decodeBase64(info, 74);
	const global_signature = decodeBase64(global, 64);
	return {
		algorithm: sig_info.subarray(0, 2),
		key_id: sig_info.subarray(2, 10),
		signature: sig_info.subarray(10),
		trusted_comment: Buffer.from(trusted.slice(17)),
		global_signature
	};
}
async function verifySignature(pubkey, signature, file_content) {
	if (!signature.key_id.equals(pubkey.id)) return false;
	let signed_content;
	if (signature.algorithm.equals(Buffer.from("ED"))) {
		const hash = crypto.createHash("BLAKE2b512");
		hash.update(file_content);
		signed_content = hash.digest();
	} else if (signature.algorithm.equals(Buffer.from("Ed"))) signed_content = file_content;
	else return false;
	if (!await crypto.subtle.verify("Ed25519", pubkey.key, signature.signature, signed_content)) return false;
	const global_signed_content = Buffer.concat([signature.signature, signature.trusted_comment]);
	if (!await crypto.subtle.verify("Ed25519", pubkey.key, signature.global_signature, global_signed_content)) return false;
	return true;
}
function decodeBase64(text, length) {
	const data = Buffer.from(text, "base64");
	if (data.length !== length || data.toString("base64") !== text) throw new Error("invalid minisign base64 or field length");
	return data;
}
// src/main.ts
const MINISIGN_KEY = "RWSGOq2NVecA2UPNdBUZykf1CCb147pkmdtYxgb3Ti+JO/wCYvhbAb/U";
const CANONICAL_DEV = "https://ziglang.org/builds";
const CANONICAL_RELEASE = "https://ziglang.org/download";
const MIRRORS_URL = "https://ziglang.org/download/community-mirrors.txt";
async function downloadFromMirror(mirror, tarball_filename) {
	const tarball_path = await downloadFile(`${mirror}/${tarball_filename}?source=github-kjanat-setup-zig`);
	try {
		const signature_response = await fetchResponse(`${mirror}/${tarball_filename}.minisig?source=github-kjanat-setup-zig`);
		const signature_data = Buffer.from(await signature_response.arrayBuffer());
		const tarball_data = await fs$3.readFile(tarball_path);
		const key = await parseKey(MINISIGN_KEY);
		const signature = parseSignature(signature_data);
		if (!await verifySignature(key, signature, tarball_data)) throw new Error(`signature verification failed for '${mirror}/${tarball_filename}'`);
		const match = /^timestamp:\d+\s+file:([^\s]+)\s+hashed$/.exec(signature.trusted_comment.toString());
		if (match === null || match[1] !== tarball_filename) throw new Error(`filename verification failed for '${mirror}/${tarball_filename}'`);
		return tarball_path;
	} catch (error) {
		await fs$3.rm(tarball_path, { force: true });
		throw error;
	}
}
async function downloadTarball(tarball_filename) {
	const preferred_mirror = getInput("mirror");
	if (preferred_mirror) {
		const url = new URL(preferred_mirror);
		if (url.protocol !== "https:" || url.username || url.password) throw new Error("Mirror override must be an HTTPS URL without credentials");
		if (url.hostname === "ziglang.org") throw new Error("'https://ziglang.org' cannot be used as mirror override; see README.md");
		info(`Using mirror: ${preferred_mirror}`);
		return await downloadFromMirror(preferred_mirror.replace(/\/$/, ""), tarball_filename);
	}
	let mirrors;
	try {
		mirrors = (await (await fetchResponse(MIRRORS_URL)).text()).split("\n").map((url) => url.trim()).filter(Boolean);
		if (!mirrors.length) throw new Error("Empty mirror list");
		mirrors = mirrors.map((mirror) => {
			const url = new URL(mirror);
			if (url.protocol !== "https:") throw new Error("Mirror list must use HTTPS");
			return url.href.replace(/\/$/, "");
		});
	} catch {
		mirrors = [
			"https://pkg.machengine.org/zig",
			"https://zigmirror.hryx.net/zig",
			"https://zig.linus.dev/zig",
			"https://zig.squirl.dev",
			"https://zig.florent.dev",
			"https://zig.mirror.mschae23.de/zig",
			"https://zigmirror.meox.dev",
			"https://ziglang.freetls.fastly.net",
			"https://zig.tilok.dev",
			"https://zig-mirror.tsimnet.eu/zig",
			"https://zig.karearl.com/zig",
			"https://pkg.earth/zig",
			"https://fs.liujiacai.net/zigbuilds"
		];
	}
	info(`Available mirrors: ${mirrors.join(", ")}`);
	const shuffled_mirrors = mirrors.map((mirror) => ({
		mirror,
		order: Math.random()
	})).sort((a, b) => a.order - b.order).map((item) => item.mirror);
	for (const mirror of shuffled_mirrors) {
		info(`Attempting mirror: ${mirror}`);
		try {
			return await downloadFromMirror(mirror, tarball_filename);
		} catch (e) {
			info(`Mirror failed with error: ${e}`);
		}
	}
	const zig_version = tarball_filename.match(/\d+\.\d+\.\d+(-dev\.\d+\+[0-9a-f]+)?/)?.[0];
	if (!zig_version) throw new Error(`Invalid archive filename: ${tarball_filename}`);
	const canonical = zig_version.includes("-dev") ? CANONICAL_DEV : `${CANONICAL_RELEASE}/${zig_version}`;
	info(`Attempting official: ${canonical}`);
	return await downloadFromMirror(canonical, tarball_filename);
}
async function retrieveTarball(tarball_name, tarball_ext) {
	const cache_key = `setup-zig-tarball-${tarball_name}`;
	const tarball_basename = `${tarball_name}${tarball_ext}`;
	const runner_temp = process.env.RUNNER_TEMP;
	if (!runner_temp) throw new Error("RUNNER_TEMP is required");
	const tarball_cache_path = path$1.join(runner_temp, tarball_basename);
	try {
		if (isFeatureAvailable() && await restoreCache([tarball_cache_path], cache_key)) return tarball_cache_path;
	} catch (error) {
		warning(`Could not restore Zig archive cache: ${error instanceof Error ? error.message : String(error)}`);
	}
	info(`Cache miss. Fetching Zig ${await getVersion()}`);
	const downloaded_path = await downloadTarball(tarball_basename);
	try {
		await fs$3.copyFile(downloaded_path, tarball_cache_path);
	} finally {
		await fs$3.rm(downloaded_path, { force: true });
	}
	try {
		if (isFeatureAvailable()) await saveCache([tarball_cache_path], cache_key);
	} catch (error) {
		warning(`Could not save Zig archive cache: ${error instanceof Error ? error.message : String(error)}`);
	}
	return tarball_cache_path;
}
async function main() {
	try {
		const size_limit = getCacheSizeLimit();
		const requested_version = await getVersion();
		const tool_cache_input = getInput("use-tool-cache");
		let use_tool_cache;
		if (tool_cache_input === "true") use_tool_cache = true;
		else if (tool_cache_input === "false") use_tool_cache = false;
		else if (tool_cache_input === "") use_tool_cache = process.env["RUNNER_ENVIRONMENT"] !== "github-hosted";
		else throw new Error("Invalid 'use-tool-cache' value. Valid values: 'true', 'false'");
		info(`Using tool-cache: ${use_tool_cache}`);
		let zig_dir;
		if (use_tool_cache) zig_dir = find("zig", await getVersion());
		if (zig_dir) info("Using cached Zig installation from tool-cache");
		else {
			const tarball_name = await getTarballName();
			const tarball_ext = await getTarballExt();
			info(`Fetching ${tarball_name}${tarball_ext}`);
			const fetch_start = Date.now();
			const tarball_path = await retrieveTarball(tarball_name, tarball_ext);
			info(`Fetch took ${Date.now() - fetch_start} ms`);
			info(`Extracting tarball ${tarball_name}${tarball_ext}`);
			const extract_start = Date.now();
			const zig_parent_dir = tarball_ext === ".zip" ? await extractZip(tarball_path) : await extractTar(tarball_path, void 0, "xJ");
			info(`Extract took ${Date.now() - extract_start} ms`);
			const zig_inner_dir = path$1.join(zig_parent_dir, tarball_name);
			if (use_tool_cache) {
				info("Copying Zig installation to tool-cache");
				zig_dir = await cacheDir(zig_inner_dir, "zig", await getVersion());
			} else zig_dir = zig_inner_dir;
		}
		addPath(zig_dir);
		const zig_version = (await getExecOutput(`"${path$1.join(zig_dir, process.platform === "win32" ? "zig.exe" : "zig")}"`, ["version"])).stdout.trim();
		if (zig_version !== requested_version) throw new Error(`Zig version mismatch: expected ${requested_version}, got ${zig_version}`);
		info(`Resolved Zig version ${zig_version}`);
		setOutput("version", zig_version);
		setOutput("path", zig_dir);
		const cache_path = getZigCachePath();
		exportVariable("ZIG_GLOBAL_CACHE_DIR", cache_path);
		exportVariable("ZIG_LOCAL_CACHE_DIR", cache_path);
		if (getBooleanInput("use-cache") && isFeatureAvailable()) {
			const cache_prefix = await getCachePrefix();
			info(`Attempting restore of Zig cache with prefix '${cache_prefix}'`);
			saveState("cache-path", cache_path);
			saveState("cache-prefix", cache_prefix);
			saveState("cache-size-limit", size_limit);
			let hit;
			try {
				hit = await restoreCache([cache_path], cache_prefix);
			} catch (error) {
				warning(`Could not restore Zig build cache: ${error instanceof Error ? error.message : String(error)}`);
			}
			if (hit === void 0) info(`Cache miss: leaving Zig cache directory at ${cache_path} unpopulated`);
			else info(`Cache hit (key '${hit}'): populating Zig cache directory at ${cache_path}`);
		}
	} catch (err) {
		setFailed(err instanceof Error ? err.message : String(err));
	}
}
main();
export { downloadFromMirror, downloadTarball, main, retrieveTarball };
