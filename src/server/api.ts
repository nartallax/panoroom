import {FrontHtmlSourceData} from "front_html";
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

// src: https://stackoverflow.com/questions/7753448/how-do-i-escape-quotes-in-html-attribute-values
function escapeHtml(v: string): string {
    return v.replace(/&/g, "&amp;")
        .replace(/'/g, "&#39;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r\n/g, "&#13;")
        .replace(/[\r\n]/g, "&#13;");
}



function produceFrontHtml(src: FrontHtmlSourceData): string {
	return `<!DOCTYPE html>
<html>
	<head>
		<!-- code by Nartallax, 2021 -->
		<title>${escapeHtml(src.title)}</title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<meta name="description" content="${escapeHtml(src.description)}">
		<link rel="icon" type="image/png" href="./static/favicon.png">
		<script defer src="./static/three.js"></script>
		<script defer src="./static/three.interaction.js"></script>
		<script defer src="./static/client.js"></script>
		<link rel="stylesheet" href="./static/style.css">
	</head>
	<body>
		<div id="loading-screen">
			<div>Загружаемся...</div>
			<noscript>Включай Javascript, без него тут ничего не заработает!</noscript>
		</div>
	</body>
</html>
	`
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

	canEdit,

	updateHtml: async (params: FrontHtmlSourceData): Promise<void> => {
		let html = produceFrontHtml(params);
		let path = Path.resolve("./content/index.html");
		await Fs.writeFile(path, html, "utf-8");
	}
}