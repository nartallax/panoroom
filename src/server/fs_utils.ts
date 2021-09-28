import {FsTreeNode} from "utils";
import * as Path from "path";
import {promises as Fs} from "fs";

export async function buildFsTree(path: string, filenameRegexp?: RegExp): Promise<FsTreeNode[]> {
	let filenames = await Fs.readdir(path);
	let result = [] as FsTreeNode[];
	await Promise.all(filenames.map(async filename => {
		let fullPath = Path.resolve(path, filename);
		let stat = await Fs.stat(fullPath)
		if(stat.isDirectory()){
			result.push({
				name: filename,
				children: await buildFsTree(fullPath)
			})
		} else {
			if(!filenameRegexp || filename.match(filenameRegexp)){
				result.push({name: filename})
			}
		}
	}))
	return result.sort((a, b) => a.name > b.name? 1: a.name < b.name? -1: 0)
}