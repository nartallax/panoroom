import {Api} from "api";
import * as Http from "http";
import {logError} from "utils";
import * as Stream from "stream";

export class HttpServer {

	private readonly server: Http.Server;
	
	constructor(private readonly api: Api, readonly port: number){
		this.server = new Http.Server((req, res) => this.wrappedOnRequest(req, res));
	}

	start(): Promise<void> {
		return new Promise((ok, bad) => {
			try {
				this.server.listen(this.port, ok)
			} catch(e){
				bad(e);
			}
		})
	}

	stop(): Promise<void> {
		return new Promise((ok, bad) => {
			try {
				this.server.close(err => err? bad(err): ok())
			} catch(e){
				bad(e);
			}
		})
	}

	private async wrappedOnRequest(req: Http.IncomingMessage, res: Http.ServerResponse): Promise<void>{
		try {
			await this.onRequest(req, res);
		} catch(e){
			logError(e);
			res.statusCode = 500;
			res.end("Server-side error happened, see logs.")
		}
	}

	private async onRequest(req: Http.IncomingMessage, res: Http.ServerResponse): Promise<void>{
		let method = (req.method || "UNKNOWN").toUpperCase();
		if(method !== "GET" && method !== "POST"){
			res.statusCode = 405;
			res.end(method + " is not HTTP method you want here, clearly.")
			return;
		}

		let rawUrl = req.url;
		if(!rawUrl){
			throw new Error("No URL!");
		}

		let path = new URL(rawUrl, "http://localhost/").pathname;
		let body: string | undefined = undefined;
		if(method === "POST"){
			let bodyBytes = await this.readAll(req);
			body = bodyBytes.toString("utf-8");
		}
		
		let result = await this.api.processRequest(path, body);
		if(result.redirectTo){
			res.statusCode = 302;
			res.setHeader("Location", result.redirectTo);
		} else {
			res.statusCode = 200;
		}

		if(result.contentType){
			res.setHeader("Content-Type", result.contentType)
		}
		res.end(result.body);
	}

	private readAll(stream: Stream.Readable): Promise<Buffer>{
		return new Promise((ok, bad) => {
			try {
				let parts = [] as Buffer[];
				stream.on("data", chunk => parts.push(chunk));
				stream.on("error", err => bad(err));
				stream.on("end", () => ok(Buffer.concat(parts)));
			} catch(e){
				bad(e);
			}
		})
	}
}