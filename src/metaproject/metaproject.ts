import {Koramund} from "@nartallax/koramund";
import * as Path from "path";

export async function main(): Promise<void>{
	let controller = Koramund.create({
		log: opts => console.error(`${opts.timeStr} | ${opts.paddedProjectName} | ${opts.message}`)
	});

	let server: Koramund.ImploderProject & Koramund.HttpProxifyableProject = controller.addProject({
		name: "Server",
		imploderTsconfigPath: "src/server/tsconfig.json",
		imploderProfile: "development",
		workingDirectory: Path.resolve("."),
		getLaunchCommand: () => [controller.nodePath, server.getImploder().config.outFile, "--development"],
		proxyHttpPort: 6302
	});

	server.onStderr(line => {
		let m = line.match(/^Started at (\d+)\.?$/)
		if(m){
			server.notifyProjectHttpPort(parseInt(m[1]));
			server.notifyLaunched();
		}
	});

	server.onHttpRequest(async req => {
		if(req.url === "/content/"){
			await server.restart()
		}
	})

	let client = controller.addProject({
		name: "Client",
		imploderTsconfigPath: "src/client/tsconfig.json",
		imploderProfile: "development"
	});

	await Promise.all([
		client.getOrStartImploder(),
		server.start()
	]);
}