import {ApiWrapper} from "api_wrapper";
import {HttpServer} from "http_server";

export async function main(): Promise<void> {
	let isDevelopment = process.argv.indexOf("--development") > -1;
	let api = new ApiWrapper({isDevelopment});
	let server = new HttpServer(api, 6301);
	await server.start();
	console.error("Started at " + server.port);
}