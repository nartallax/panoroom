import {Api} from "api";
import {HttpServer} from "http_server";

export async function main(): Promise<void> {
	let isDevelopment = process.argv.indexOf("--development") > -1;
	let api = new Api({isDevelopment});
	let server = new HttpServer(api, 6301);
	await server.start();
	console.error("Started at " + server.port);
}