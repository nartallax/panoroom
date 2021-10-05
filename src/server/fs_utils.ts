import {FsTreeNode} from "utils";
import * as Path from "path";
import {promises as Fs} from "fs";
import * as ImageSize from "image-size";

export async function buildFsTree(path: string, filenameRegexp?: RegExp, imageSize = false): Promise<FsTreeNode[]> {
	let filenames = await Fs.readdir(path);
	let result = [] as FsTreeNode[];
	await Promise.all(filenames.map(async filename => {
		let fullPath = Path.resolve(path, filename);
		let stat = await Fs.stat(fullPath)
		if(stat.isDirectory()){
			result.push({
				name: filename,
				children: await buildFsTree(fullPath, filenameRegexp, imageSize)
			})
		} else {
			if(!filenameRegexp || filename.match(filenameRegexp)){
				let entry: FsTreeNode = {name: filename}
				if(imageSize){
					let size = ImageSize.imageSize(fullPath);
					if(size.width !== undefined && size.height !== undefined){
						entry.dimensions = {
							width: size.width,
							height: size.height
						}
					}
				}
				result.push(entry)
			}
		}
	}))
	return result.sort((a, b) => a.name > b.name? 1: a.name < b.name? -1: 0)
}