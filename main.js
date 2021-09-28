(
function imploderLoader(defs, params, evl) {
    "use strict";
    var req = typeof (require) !== "undefined" ? require : function () { throw new Error("External require() function is not defined! Could not load any external module."); };
    function handleError(e, action) {
        var handler = params.errorHandler;
        if (handler) {
            handler(e, action);
        }
        else {
            console.error((action ? "Error during " + action + ": " : "") + (e.stack || e.message || e));
        }
        throw e;
    }
    // разбираем полученный массив определений
    var renames = {};
    var defMap = {};
    for (var i = 0; i < defs.length; i++) {
        var v = defs[i];
        var m = typeof (v[2]) !== "string" ? v[2] : undefined;
        var def = m ? m : {};
        def.name = v[0];
        def.code = v[v.length - 1];
        if (m && m.altName) {
            renames[m.altName] = def.name;
        }
        def.dependencies = Array.isArray(v[1]) ? v[1] : [];
        defMap[def.name] = def;
    }
    var amd = typeof (define) === "function" && !!define.amd;
    /** функция, которую будут дергать в качестве require изнутри модулей */
    function requireAny(names, onOk, onError) {
        if (!onOk) {
            // дернуты как commonjs, т.е. синхронно с одним именем
            var name_1 = names;
            if (name_1 in defMap) {
                return getProduct(name_1);
            }
            else {
                // тут мы просто надеемся, что человек, который пишет код - не дурак
                // и знает, в каком окружении он будет запускаться
                // и поэтому просто дергаем require как commonjs синхронный require
                return req(name_1);
            }
        }
        else {
            // дернуты как amd
            var callError = function (e) {
                if (onError) {
                    onError(e);
                }
                else {
                    handleError(e);
                }
            };
            try {
                var nameArr = Array.isArray(names) ? names : [names];
                var resultArr_1 = [];
                var nameIndex_1 = {};
                var externalNameArr_1 = nameArr.filter(function (name, index) {
                    nameIndex_1[name] = index;
                    if (name in defMap) {
                        resultArr_1[index] = getProduct(name);
                        return false;
                    }
                    return true;
                });
                if (externalNameArr_1.length === 0) {
                    return onOk.apply(null, resultArr_1);
                }
                else {
                    if (amd) {
                        return req(externalNameArr_1, function (externalResults) {
                            for (var i = 0; i < externalNameArr_1.length; i++) {
                                resultArr_1[nameIndex_1[externalNameArr_1[i]]] = externalResults[i];
                            }
                            onOk.apply(null, resultArr_1);
                        }, onError);
                    }
                    else {
                        // если у нас запросили модули асинхронно, но при этом у нас есть только синрохнный commonjs-овый require - 
                        // то используем его, чего еще делать
                        externalNameArr_1.forEach(function (name) { return resultArr_1[nameIndex_1[name]] = req(name); });
                        onOk.apply(null, resultArr_1);
                    }
                }
            }
            catch (e) {
                callError(e);
            }
        }
    }
    var currentlyDefiningProductMap = {};
    var currentlyDefiningProductSeq = [];
    var products = {};
    function throwCircularDependencyError(name) {
        var str = name;
        for (var i = currentlyDefiningProductSeq.length - 1; i >= 0; i--) {
            var n = currentlyDefiningProductSeq[i];
            str += " <- " + currentlyDefiningProductSeq[i];
            if (n === name)
                break;
        }
        throw new Error("Unresolvable circular dependency detected: " + str);
    }
    function getProduct(name) {
        name = renames[name] || name;
        var meta = defMap[name];
        if (!(name in products)) {
            if (name in currentlyDefiningProductMap) {
                throwCircularDependencyError(name);
            }
            currentlyDefiningProductMap[name] = true;
            currentlyDefiningProductSeq.push(name);
            try {
                var product = {};
                var deps_1 = [product, requireAny];
                meta.dependencies.forEach(function (name) {
                    if (name in renames) {
                        name = renames[name];
                    }
                    var product = products[name];
                    if (product) {
                        deps_1.push(product);
                        return;
                    }
                    var depMeta = defMap[name];
                    if (!depMeta) {
                        throw new Error("Failed to get module \"" + name + "\": no definition is known and no preloaded external module is present.");
                    }
                    deps_1.push(depMeta.arbitraryType || (!depMeta.exports && !depMeta.exportRefs) ? getProduct(name) : getProxy(depMeta));
                });
                var fullCode = meta.code;
                if (meta.nonModule) {
                    fullCode = "function(){" + fullCode + "}";
                }
                fullCode = "'use strict';(" + fullCode + ")\n//# sourceURL=" + meta.name;
                var defFunc = evl(fullCode);
                var returnProduct = defFunc.apply(null, deps_1);
                if (meta.arbitraryType) {
                    product = returnProduct;
                }
                products[name] = product;
            }
            finally {
                delete currentlyDefiningProductMap[name];
                currentlyDefiningProductSeq.pop();
            }
        }
        return products[name];
    }
    var proxies = {};
    function getProxy(def) {
        if (!(def.name in proxies)) {
            var proxy_1 = {};
            getAllExportNames(def).forEach(function (arr) {
                arr.forEach(function (name) {
                    defineProxyProp(def, proxy_1, name);
                });
            });
            proxies[def.name] = proxy_1;
        }
        return proxies[def.name];
    }
    function getAllExportNames(meta, result, noDefault) {
        if (result === void 0) { result = []; }
        if (noDefault === void 0) { noDefault = false; }
        if (meta.exports) {
            if (noDefault) {
                result.push(meta.exports.filter(function (_) { return _ !== "default"; }));
            }
            else {
                result.push(meta.exports);
            }
        }
        if (meta.exportRefs) {
            meta.exportRefs.forEach(function (ref) {
                // тут, теоретически, могла бы возникнуть бесконечная рекурсия
                // но не возникнет, еще при компиляции есть проверка
                if (ref in defMap) {
                    getAllExportNames(defMap[ref], result, true);
                }
                else if (ref in products) {
                    // модуля может не быть, если он внешний и в бандл не вошел
                    result.push(Object.keys(products[ref]));
                }
                else {
                    // такого по идее произойти не должно никогда, т.к. оно упадет раньше
                    // еще на этапе подгрузки внешних модулей
                    throw new Error("External module " + ref + " is not loaded at required time.");
                }
            });
        }
        return result;
    }
    function defineProxyProp(meta, proxy, name) {
        if (proxy.hasOwnProperty(name)) {
            return;
        }
        Object.defineProperty(proxy, name, {
            get: function () { return getProduct(meta.name)[name]; },
            set: function (v) { return getProduct(meta.name)[name] = v; },
            enumerable: true
        });
    }
    function discoverExternalModules(moduleName, result, visited) {
        if (result === void 0) { result = []; }
        if (visited === void 0) { visited = {}; }
        if (moduleName in renames) {
            moduleName = renames[moduleName];
        }
        if (!(moduleName in visited)) {
            visited[moduleName] = true;
            if (moduleName in defMap) {
                defMap[moduleName].dependencies.forEach(function (depName) { return discoverExternalModules(depName, result, visited); });
            }
            else {
                result.push(moduleName);
            }
        }
        return result;
    }
    function afterExternalsLoaded() {
        var mainProduct = getProduct(params.entryPoint.module);
        // инициализируем все модули в бандле, ради сайд-эффектов
        Object.keys(defMap).forEach(function (name) {
            if (!(name in products)) {
                getProduct(name);
            }
        });
        var err = null;
        if (params.entryPoint.function) {
            try {
                mainProduct[params.entryPoint.function].apply(null, params.entryPointArgs || []);
            }
            catch (e) {
                err = e;
            }
        }
        if (err) {
            handleError(err);
        }
        if (typeof (module) === "object" && module.exports) {
            module.exports = mainProduct;
        }
        return mainProduct;
    }
    function start() {
        if (amd) {
            var externalModuleNames_1 = discoverExternalModules(params.entryPoint.module, ["require"]);
            define(externalModuleNames_1, function (require) {
                req = require;
                for (var i = externalModuleNames_1.length; i < arguments.length; i++) {
                    products[externalModuleNames_1[i]] = arguments[i];
                }
                return afterExternalsLoaded();
            });
        }
        else {
            var externalModuleNames_2 = discoverExternalModules(params.entryPoint.module);
            requireAny(externalModuleNames_2, function () {
                for (var i = 0; i < arguments.length; i++) {
                    products[externalModuleNames_2[i]] = arguments[i];
                }
                afterExternalsLoaded();
            });
        }
    }
    start();
})(

[["/common/server_config","function (exports, require) {\n    exports.defaultServerConfig = {\n        canEdit: false\n    };\n}\n"],["/common/utils","function (exports, require) {\n    function logError(a, b) {\n        outputError(\"error\", a, b);\n    }\n    exports.logError = logError;\n    function logWarn(a, b) {\n        outputError(\"warn\", a, b);\n    }\n    exports.logWarn = logWarn;\n    function outputError(type, a, b) {\n        let err = typeof (a) === \"string\" ? b : a;\n        let pretext = typeof (a) === \"string\" ? a : \"\";\n        let errText;\n        if (err instanceof Error) {\n            errText = (err.stack || err.message || err) + \"\";\n        }\n        else {\n            errText = err + \"\";\n        }\n        console[type](pretext + errText);\n    }\n    function isPathInsidePath(innerPath, outerPath) {\n        let startsWith = innerPath.indexOf(outerPath) === 0;\n        if (!startsWith) {\n            return false;\n        }\n        let nextChar = innerPath.length === outerPath.length ? '' : innerPath.charAt(outerPath.length);\n        let hasPathTerminator = nextChar === '/' || nextChar === '\\\\' || nextChar === '';\n        return hasPathTerminator;\n    }\n    exports.isPathInsidePath = isPathInsidePath;\n    function randomNumberString() {\n        return Math.floor(Math.random() * 0xffffffff) + \"\";\n    }\n    exports.randomNumberString = randomNumberString;\n    function randomUniqId(idObject) {\n        let id;\n        do {\n            id = randomNumberString();\n        } while (id in idObject);\n        return id;\n    }\n    exports.randomUniqId = randomUniqId;\n    function deepEquals(a, b) {\n        if (a === b) {\n            return true;\n        }\n        if (typeof (a) !== typeof (b)) {\n            return false;\n        }\n        if (typeof (a) === \"object\" && typeof (b) === \"object\" && a && b) {\n            if (Array.isArray(a) || Array.isArray(b)) {\n                if (!Array.isArray(a) || !Array.isArray(b)) {\n                    return false;\n                }\n                if (a.length !== b.length) {\n                    return false;\n                }\n                for (let i = 0; i < a.length; i++) {\n                    if (!deepEquals(a[i], b[i])) {\n                        return false;\n                    }\n                }\n            }\n            else {\n                for (let k in a) {\n                    if (!(k in b) || !deepEquals(a[k], b[k])) {\n                        return false;\n                    }\n                }\n                for (let k in b) {\n                    if (!(k in a)) {\n                        return false;\n                    }\n                }\n            }\n        }\n        return true;\n    }\n    exports.deepEquals = deepEquals;\n}\n"],["/server/api",["fs","/server/fs_utils","path","/common/server_config"],"function (exports, require, fs_1, fs_utils_1, Path, server_config_1) {\n    const serverConfigFilename = \"./content/server_config.json\";\n    async function readServerConfig() {\n        let rawFile;\n        try {\n            rawFile = await fs_1.promises.readFile(serverConfigFilename, \"utf-8\");\n        }\n        catch (e) {\n            if (e.code === \"ENOENT\") {\n                console.error(\"Server config is not found at \" + Path.resolve(serverConfigFilename) + \" ; will use default.\");\n            }\n            rawFile = \"{}\";\n        }\n        let config = {\n            ...JSON.parse(JSON.stringify(server_config_1.defaultServerConfig)),\n            ...JSON.parse(rawFile)\n        };\n        return config;\n    }\n    async function canEdit() {\n        let config = await readServerConfig();\n        return config.canEdit;\n    }\n    exports.apiMethods = {\n        saveSettings: async (filename, settings) => {\n            if (!(await canEdit())) {\n                throw new Error(\"Editing disabled from config, or by default.\");\n            }\n            filename = filename.toLowerCase().replace(/\\.json$/, \"\").replace(/[^a-z_\\d]/g, \"\") + \".json\";\n            let filePath = Path.resolve(\"./content/\", filename);\n            if (filePath === Path.resolve(serverConfigFilename)) {\n                throw new Error(\"You cannot write to this file with this method.\");\n            }\n            await fs_1.promises.writeFile(filePath, JSON.stringify(settings));\n        },\n        enumeratePanoramFiles: async () => {\n            return await (0, fs_utils_1.buildFsTree)(\"./content/panorams/\", /\\.(jpe?g|png|webp|gif)$/i);\n        },\n        canEdit\n    };\n}\n"],["/server/api_wrapper",["fs","path","/common/utils","@nartallax/imploder","/server/api"],"function (exports, require, fs_1, Path, utils_1, imploder_1, api_1) {\n    const mime = {\n        html: \"text/html; charset=utf-8\",\n        js: \"application/javascript\",\n        png: \"image/png\",\n        jpg: \"image/jpg\",\n        jpeg: \"image/jpeg\",\n        json: \"application/json\"\n    };\n    class ApiWrapper {\n        constructor(params) {\n            this.params = params;\n        }\n        async processRequest(path, body) {\n            if (this.params.isDevelopment) {\n                if (path === \"/content/client.js\") {\n                    let cfg = await imploder_1.Imploder.parseConfig(\"./src/client/tsconfig.json\", { profile: \"development\" });\n                    let imploder = imploder_1.Imploder.externalInstance(cfg);\n                    let code = await imploder.assembleBundle();\n                    return {\n                        body: Buffer.from(code),\n                        contentType: mime.js\n                    };\n                }\n            }\n            if (path.match(/^\\/content(\\/|$)/)) {\n                return await this.processFileContentRequest(path);\n            }\n            if (path === \"/\") {\n                return {\n                    redirectTo: \"/content/\",\n                    body: Buffer.from(`Interface is <a href=\"/content/\">HERE</a>.`, \"utf-8\"),\n                    contentType: mime.html\n                };\n            }\n            if (path.startsWith(\"/api\")) {\n                return await this.processApiRequest(path, body);\n            }\n            throw new Error(\"Don't know how to handle HTTP call to \" + path);\n        }\n        async processFileContentRequest(path) {\n            if (path.endsWith(\"/\") || path === \"/content\") {\n                path += \"index.html\";\n            }\n            let filePath = Path.resolve(Path.join(\".\", path));\n            if (!(0, utils_1.isPathInsidePath)(filePath, Path.resolve(\"./content\"))) {\n                throw new Error(\"Attempt to get files outside of /content directory. This is not allowed. Source path is \" + path + \", resolved path is \" + filePath);\n            }\n            let fileContent = await fs_1.promises.readFile(filePath);\n            let extMatch = filePath.match(/\\.([^./\\\\]+)$/);\n            let ext = (!extMatch ? \"\" : extMatch[1]).toLowerCase();\n            return {\n                body: fileContent,\n                contentType: mime[ext]\n            };\n        }\n        async processApiRequest(path, body) {\n            if (!body) {\n                throw new Error(\"API request, but no body supplied!\");\n            }\n            let methodName = path.substr(\"/api/\".length).replace(/\\/$/, \"\");\n            if (!(methodName in api_1.apiMethods)) {\n                throw new Error(\"Unknown API method: \" + methodName);\n            }\n            let inputData = (JSON.parse(body) || []);\n            let method = api_1.apiMethods[methodName];\n            let outputData = await Promise.resolve(method.call(null, ...inputData)) || null;\n            return {\n                contentType: mime.json,\n                body: Buffer.from(JSON.stringify({ ok: true, result: outputData }))\n            };\n        }\n    }\n    exports.ApiWrapper = ApiWrapper;\n}\n"],["/server/fs_utils",["path","fs"],"function (exports, require, Path, fs_1) {\n    async function buildFsTree(path, filenameRegexp) {\n        let filenames = await fs_1.promises.readdir(path);\n        let result = [];\n        await Promise.all(filenames.map(async (filename) => {\n            let fullPath = Path.resolve(path, filename);\n            let stat = await fs_1.promises.stat(fullPath);\n            if (stat.isDirectory()) {\n                result.push({\n                    name: filename,\n                    children: await buildFsTree(fullPath)\n                });\n            }\n            else {\n                if (!filenameRegexp || filename.match(filenameRegexp)) {\n                    result.push({ name: filename });\n                }\n            }\n        }));\n        return result.sort((a, b) => a.name > b.name ? 1 : a.name < b.name ? -1 : 0);\n    }\n    exports.buildFsTree = buildFsTree;\n}\n"],["/server/http_server",["http","/common/utils"],"function (exports, require, Http, utils_1) {\n    class HttpServer {\n        constructor(api, port) {\n            this.api = api;\n            this.port = port;\n            this.server = new Http.Server((req, res) => this.wrappedOnRequest(req, res));\n        }\n        start() {\n            return new Promise((ok, bad) => {\n                try {\n                    this.server.listen(this.port, ok);\n                }\n                catch (e) {\n                    bad(e);\n                }\n            });\n        }\n        stop() {\n            return new Promise((ok, bad) => {\n                try {\n                    this.server.close(err => err ? bad(err) : ok());\n                }\n                catch (e) {\n                    bad(e);\n                }\n            });\n        }\n        async wrappedOnRequest(req, res) {\n            try {\n                await this.onRequest(req, res);\n            }\n            catch (e) {\n                (0, utils_1.logError)(e);\n                res.statusCode = 500;\n                res.end(\"Server-side error happened, see logs.\");\n            }\n        }\n        async onRequest(req, res) {\n            let method = (req.method || \"UNKNOWN\").toUpperCase();\n            if (method !== \"GET\" && method !== \"POST\") {\n                res.statusCode = 405;\n                res.end(method + \" is not HTTP method you want here, clearly.\");\n                return;\n            }\n            let rawUrl = req.url;\n            if (!rawUrl) {\n                throw new Error(\"No URL!\");\n            }\n            let path = new URL(rawUrl, \"http://localhost/\").pathname;\n            let bodyBytes = undefined;\n            let body = undefined;\n            if (method === \"POST\") {\n                bodyBytes = await this.readAll(req);\n                body = bodyBytes.toString(\"utf-8\");\n            }\n            console.error(`${method} ${rawUrl} ${!bodyBytes ? \"\" : bodyBytes.length + \" bytes\"}`);\n            let result = await this.api.processRequest(path, body);\n            if (result.redirectTo) {\n                res.statusCode = 302;\n                res.setHeader(\"Location\", result.redirectTo);\n            }\n            else {\n                res.statusCode = 200;\n            }\n            if (result.contentType) {\n                res.setHeader(\"Content-Type\", result.contentType);\n            }\n            res.end(result.body);\n        }\n        readAll(stream) {\n            return new Promise((ok, bad) => {\n                try {\n                    let parts = [];\n                    stream.on(\"data\", chunk => parts.push(chunk));\n                    stream.on(\"error\", err => bad(err));\n                    stream.on(\"end\", () => ok(Buffer.concat(parts)));\n                }\n                catch (e) {\n                    bad(e);\n                }\n            });\n        }\n    }\n    exports.HttpServer = HttpServer;\n}\n"],["/server/server_entrypoint",["/server/api_wrapper","/server/http_server"],"function (exports, require, api_wrapper_1, http_server_1) {\n    async function main() {\n        let isDevelopment = process.argv.indexOf(\"--development\") > -1;\n        let api = new api_wrapper_1.ApiWrapper({ isDevelopment });\n        let server = new http_server_1.HttpServer(api, 6301);\n        await server.start();\n        console.error(\"Started at \" + server.port);\n    }\n    exports.main = main;\n}\n"]]
,
{"entryPoint":{"module":"/server/server_entrypoint","function":"main"}},eval);