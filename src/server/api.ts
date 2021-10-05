import {promises as Fs} from "fs";
import {buildFsTree} from "fs_utils";
import * as Path from "path";
import {defaultServerConfig, ServerConfig} from "server_config";
import {FsTreeNode} from "utils";

const serverConfigFilename = "./content/static/server_config.json";

async function readServerConfig(): Promise<ServerConfig>{
	let rawFile: string;
	try {
		rawFile = await Fs.readFile(serverConfigFilename, "utf-8");
	} catch(e){
		if((e as Error & {code: string}).code === "ENOENT"){
			console.error("Server config is not found at " + Path.resolve(serverConfigFilename) + " ; will use default.");
		}
		rawFile = "{}";
	}
	let config: ServerConfig = {
		...JSON.parse(JSON.stringify(defaultServerConfig)),
		...JSON.parse(rawFile)
	}
	return config;
}

async function canEdit(): Promise<boolean>{
	let config = await readServerConfig();
	return config.canEdit;
}

export const apiMethods = {
	saveSettings: async (filename: string, settings: unknown): Promise<void> => {
		if(!(await canEdit())){
			throw new Error("Editing disabled from config, or by default.");
		}
		filename = filename.toLowerCase().replace(/\.json$/, "").replace(/[^a-z_\d]/g, "") + ".json";
		let filePath = Path.resolve("./content/static/", filename);
		if(filePath === Path.resolve(serverConfigFilename)){
			throw new Error("You cannot write to this file with this method.");
		}
		await Fs.writeFile(filePath, JSON.stringify(settings));
	},

	enumeratePanoramFiles: async (): Promise<FsTreeNode[]> => {
		return await buildFsTree("./content/img/", /\.(jpe?g|png|webp|gif)$/i, true);
	},

	canEdit
}