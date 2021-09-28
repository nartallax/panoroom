import {promises as Fs} from "fs";
import * as Path from "path";
import {isPathInsidePath} from "utils";
import {Imploder} from "@nartallax/imploder";
import {apiMethods} from "api";

const mime: Record<string, string> = {
	html: "text/html; charset=utf-8",
	js: "application/javascript",
	png: "image/png",
	jpg: "image/jpg",
	jpeg: "image/jpeg",
	json: "application/json"
}

export interface ApiResponse {
	contentType?: string;
	redirectTo?: string;
	body: Buffer;
}

export class ApiWrapper {
	constructor(private readonly params: {isDevelopment: boolean }){}

	async processRequest(path: string, body?: string): Promise<ApiResponse>{
		if(this.params.isDevelopment){
			if(path === "/content/client.js"){
				let cfg = await Imploder.parseConfig("./src/client/tsconfig.json", {profile: "development"});
				let imploder = Imploder.externalInstance(cfg);
				let code = await imploder.assembleBundle();
				return {
					body: Buffer.from(code),
					contentType: mime.js
				}
			}
		}

		if(path.match(/^\/content(\/|$)/)){
			return await this.processFileContentRequest(path);
		}

		if(path === "/"){
			return {
				redirectTo: "/content/",
				body: Buffer.from(`Interface is <a href="/content/">HERE</a>.`, "utf-8"),
				contentType: mime.html
			}
		}

		if(path.startsWith("/api")){
			return await this.processApiRequest(path, body);
		}

		throw new Error("Don't know how to handle HTTP call to " + path);
	}

	private async processFileContentRequest(path: string): Promise<ApiResponse> {
		if(path.endsWith("/") || path === "/content"){
			path += "index.html";
		}
		let filePath = Path.resolve(Path.join(".", path))
		if(!isPathInsidePath(filePath, Path.resolve("./content"))){
			throw new Error("Attempt to get files outside of /content directory. This is not allowed. Source path is " + path + ", resolved path is " + filePath);
		}
		let fileContent = await Fs.readFile(filePath);
		let extMatch = filePath.match(/\.([^./\\]+)$/);
		let ext = (!extMatch? "": extMatch[1]).toLowerCase();
		return {
			body: fileContent,
			contentType: mime[ext]
		}
	}

	private async processApiRequest(path: string, body?: string): Promise<ApiResponse>{
		if(!body){
			throw new Error("API request, but no body supplied!")
		}

		let methodName = path.substr("/api/".length).replace(/\/$/, "");
		if(!(methodName in apiMethods)){
			throw new Error("Unknown API method: " + methodName);
		}

		let inputData = (JSON.parse(body) || []) as unknown[];
		let method = apiMethods[methodName as keyof typeof apiMethods] as (...inputData: unknown[]) => unknown;
		let outputData = await Promise.resolve(method.call(null, ...inputData)) || null;
		
		return {
			contentType: mime.json,
			body: Buffer.from(JSON.stringify({ok: true, result: outputData}))
		}
	}
}