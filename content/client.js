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

[["/client/client_entrypoint",["/client/utils/graphic_utils","/client/event_listeners","/client/controls/edit_controls","/client/skybox_controller","/client/context","/client/settings_controller"],"function (exports, require, graphic_utils_1, event_listeners_1, edit_controls_1, skybox_controller_1, context_1, settings_controller_1) {\n    function main() {\n        checkWebglVersion(1);\n        let context = new context_1.AppContextImpl();\n        context.settings = new settings_controller_1.SettingsController(settings_controller_1.defaultViewSettings, context);\n        context.skybox = new skybox_controller_1.SkyboxController(context, \"./img/test_pano.jpg\");\n        context.skybox.start();\n        (0, event_listeners_1.setupEventHandlers)(context);\n        document.body.appendChild((0, edit_controls_1.getEditControls)(context));\n    }\n    exports.main = main;\n    function checkWebglVersion(version) {\n        if ((0, graphic_utils_1.isWebGLAvailable)(version)) {\n            return;\n        }\n        let container = document.getElementById(\"loading-screen\");\n        if (container) {\n            container.appendChild((0, graphic_utils_1.getWebglErrorElement)(version));\n        }\n        throw new Error(\"No webGL, aborted\");\n    }\n}\n"],["/client/context","function (exports, require) {\n    class AppContextImpl {\n        constructor() {\n            this._skybox = null;\n            this._settings = null;\n        }\n        get skybox() {\n            if (!this._skybox) {\n                throw new Error(\"No skybox yet!\");\n            }\n            return this._skybox;\n        }\n        set skybox(v) {\n            this._skybox = v;\n        }\n        get settings() {\n            if (!this._settings) {\n                throw new Error(\"No settings yet!\");\n            }\n            return this._settings;\n        }\n        set settings(v) {\n            this._settings = v;\n        }\n    }\n    exports.AppContextImpl = AppContextImpl;\n}\n"],["/client/controls/edit_controls",["/client/controls/slider","/client/utils/dom_utils"],"function (exports, require, slider_1, dom_utils_1) {\n    function getEditControls(context) {\n        void context;\n        return (0, dom_utils_1.tag)({ class: \"edit-controls-container\" }, [\n            (0, slider_1.slider)({\n                label: \"Радиус цилиндра\", units: \"м\",\n                min: 0.5, value: context.settings.skyboxRadius, max: 5,\n                onChange: v => context.settings.skyboxRadius = v\n            }),\n            (0, slider_1.slider)({\n                label: \"Высота цилиндра\", units: \"м\",\n                min: 2, value: context.settings.skyboxHeight, max: 10,\n                onChange: v => context.settings.skyboxHeight = v\n            }),\n            (0, slider_1.slider)({\n                label: \"FOV\",\n                min: 30, value: context.settings.fov, max: 150,\n                onChange: v => context.settings.fov = v\n            }),\n            (0, slider_1.slider)({\n                label: \"Мин.наклон камеры\",\n                min: -Math.PI / 2, value: context.settings.minPitch, max: 0,\n                onChange: v => context.settings.minPitch = v\n            }),\n            (0, slider_1.slider)({\n                label: \"Макс.наклон камеры\",\n                min: 0, value: context.settings.maxPitch, max: Math.PI / 2,\n                onChange: v => context.settings.maxPitch = v\n            }),\n            (0, slider_1.slider)({\n                label: \"Высота камеры\",\n                min: 0, value: context.settings.cameraHeight, max: 2,\n                onChange: v => context.settings.cameraHeight = v\n            }),\n            (0, slider_1.slider)({\n                label: \"Скорость поворота камеры\",\n                min: 1 / 2000, value: context.settings.cameraRotationSpeed, max: 1 / 100,\n                onChange: v => context.settings.cameraRotationSpeed = v\n            }),\n        ]);\n    }\n    exports.getEditControls = getEditControls;\n}\n"],["/client/controls/slider",["/client/utils/dom_utils","/client/utils/drag","/client/utils/number_utils"],"function (exports, require, dom_utils_1, drag_1, number_utils_1) {\n    function slider(options) {\n        let input = (0, dom_utils_1.tag)({ tagName: \"input\", type: \"number\" });\n        input.value = (0, number_utils_1.toFixedNoTrail)(options.value, 3);\n        let notch = (0, dom_utils_1.tag)({ class: \"slider-notch\", style: \"left: 0\" });\n        let notchContainer = (0, dom_utils_1.tag)({ class: \"slider-notch-container\" }, [notch]);\n        let dragging = false;\n        let oldValue = input.value;\n        function onInputMaybeChanged() {\n            if (dragging) {\n                oldValue = input.value;\n                return;\n            }\n            if (oldValue === input.value) {\n                return;\n            }\n            oldValue = input.value;\n            let value = Math.max(options.min, Math.min(options.max, parseFloat(input.value)));\n            setNotchPos(value);\n            options.onChange(value);\n        }\n        function setNotchPos(value) {\n            notch.style.left = (((value - options.min) / (options.max - options.min)) * 100) + \"%\";\n        }\n        setNotchPos(options.value);\n        input.addEventListener(\"change\", onInputMaybeChanged, { passive: true });\n        input.addEventListener(\"keyup\", onInputMaybeChanged, { passive: true });\n        input.addEventListener(\"keypress\", onInputMaybeChanged, { passive: true });\n        input.addEventListener(\"mouseup\", onInputMaybeChanged, { passive: true });\n        input.addEventListener(\"click\", onInputMaybeChanged, { passive: true });\n        let minX = 0, maxX = 0;\n        (0, drag_1.addDragListeners)({\n            element: notch,\n            onDragStart: () => {\n                let rect = notchContainer.getBoundingClientRect();\n                minX = rect.left;\n                maxX = rect.right;\n                dragging = true;\n            },\n            onDragEnd: () => {\n                dragging = false;\n            },\n            onDrag: ({ x }) => {\n                let percent = Math.max(0, Math.min(1, (x - minX) / (maxX - minX)));\n                notch.style.left = (percent * 100) + \"%\";\n                let value = options.min + ((options.max - options.min) * percent);\n                input.value = (0, number_utils_1.toFixedNoTrail)(value, 3);\n                options.onChange(value);\n            }\n        });\n        return (0, dom_utils_1.tag)({ class: \"slider\" }, [\n            (0, dom_utils_1.tag)({ class: \"slider-top\" }, [\n                (0, dom_utils_1.tag)({ class: \"slider-label\", text: options.label }),\n                input,\n                (0, dom_utils_1.tag)({ class: \"slider-units\", text: options.units || \"\" }),\n            ]),\n            (0, dom_utils_1.tag)({ class: \"slider-bottom\" }, [\n                (0, dom_utils_1.tag)({ class: \"slider-min\", text: (0, number_utils_1.toFixedNoTrail)(options.min, 3) }),\n                (0, dom_utils_1.tag)({ class: \"slider-notch-container-container\" }, [\n                    notchContainer\n                ]),\n                (0, dom_utils_1.tag)({ class: \"slider-max\", text: (0, number_utils_1.toFixedNoTrail)(options.max, 3) })\n            ])\n        ]);\n    }\n    exports.slider = slider;\n}\n"],["/client/event_listeners",["/client/utils/drag"],"function (exports, require, drag_1) {\n    function setupEventHandlers(context) {\n        let canvas = context.skybox.canvas;\n        (0, drag_1.addDragListeners)({\n            element: canvas,\n            rightMouseButton: true,\n            lockPointer: true,\n            onDrag: ({ dx, dy, source }) => {\n                if (source === \"touch\") {\n                    dx *= -1;\n                    dy *= -1;\n                }\n                context.skybox.rotateCamera(dx, dy);\n            }\n        });\n    }\n    exports.setupEventHandlers = setupEventHandlers;\n}\n"],["/client/settings_controller","function (exports, require) {\n    exports.defaultViewSettings = {\n        cameraHeight: 1.8,\n        fov: 75,\n        maxPitch: Math.PI / 2,\n        minPitch: -(Math.PI / 2),\n        skyboxHeight: 3.5,\n        skyboxRadius: 1.5,\n        cameraRotationSpeed: 1 / 350\n    };\n    class SettingsController {\n        constructor(viewSettings, context) {\n            this.context = context;\n            this.haveUnsavedChanges = false;\n            this.viewSettings = JSON.parse(JSON.stringify(viewSettings));\n        }\n        get cameraHeight() { return this.viewSettings.cameraHeight; }\n        set cameraHeight(v) {\n            this.viewSettings.cameraHeight = v;\n            this.context.skybox.onCameraHeightUpdated();\n            this.haveUnsavedChanges = true;\n        }\n        get cameraRotationSpeed() { return this.viewSettings.cameraRotationSpeed; }\n        set cameraRotationSpeed(v) {\n            this.viewSettings.cameraRotationSpeed = v;\n            this.haveUnsavedChanges = true;\n        }\n        get skyboxHeight() { return this.viewSettings.skyboxHeight; }\n        set skyboxHeight(v) {\n            this.viewSettings.skyboxHeight = v;\n            this.context.skybox.onSkyboxGeometrySourceParametersUpdated();\n            this.haveUnsavedChanges = true;\n        }\n        get skyboxRadius() { return this.viewSettings.skyboxRadius; }\n        set skyboxRadius(v) {\n            this.viewSettings.skyboxRadius = v;\n            this.context.skybox.onSkyboxGeometrySourceParametersUpdated();\n            this.haveUnsavedChanges = true;\n        }\n        get fov() { return this.viewSettings.fov; }\n        set fov(v) {\n            this.viewSettings.fov = v;\n            this.context.skybox.onFovUpdated();\n            this.haveUnsavedChanges = true;\n        }\n        get minPitch() { return this.viewSettings.minPitch; }\n        set minPitch(v) {\n            this.viewSettings.minPitch = v;\n            this.context.skybox.onPitchLimitUpdated();\n            this.haveUnsavedChanges = true;\n        }\n        get maxPitch() { return this.viewSettings.maxPitch; }\n        set maxPitch(v) {\n            this.viewSettings.maxPitch = v;\n            this.context.skybox.onPitchLimitUpdated();\n            this.haveUnsavedChanges = true;\n        }\n    }\n    exports.SettingsController = SettingsController;\n}\n"],["/client/skybox_controller",["/client/threejs_decl","/client/utils/graphic_utils"],"function (exports, require, threejs_decl_1, graphic_utils_1) {\n    class SkyboxController {\n        constructor(context, skyboxTexturePath) {\n            this.context = context;\n            this.skyboxTexturePath = skyboxTexturePath;\n            this.scene = new threejs_decl_1.THREE.Scene();\n            this.camera = new threejs_decl_1.THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);\n            this.renderer = new threejs_decl_1.THREE.WebGLRenderer();\n            this.skybox = this.createSkybox();\n            this.scene.add(this.skybox.mesh);\n            this.camera.fov = this.context.settings.fov;\n            this.camera.rotation.order = \"ZYX\";\n            this.camera.position.set(0, this.context.settings.cameraHeight * 1000, 0);\n            this.camera.lookAt(-1, this.context.settings.cameraHeight * 1000, 0);\n            this.camera.lookAt(1, this.context.settings.cameraHeight * 1000, 0);\n        }\n        get canvas() {\n            return this.renderer.domElement;\n        }\n        start() {\n            this.renderer.setSize(window.innerWidth, window.innerHeight);\n            document.body.appendChild(this.canvas);\n            (0, graphic_utils_1.raf)(() => {\n                this.renderer.render(this.scene, this.camera);\n            });\n        }\n        createSkybox() {\n            let texture = new threejs_decl_1.THREE.TextureLoader().load(this.skyboxTexturePath);\n            let material = new threejs_decl_1.THREE.MeshBasicMaterial({ map: texture, side: threejs_decl_1.THREE.BackSide });\n            let { geometry, mesh } = this.createSkyboxMesh(material);\n            return { texture, material, mesh, geometry };\n        }\n        createSkyboxMesh(material) {\n            let geometry = new threejs_decl_1.THREE.CylinderGeometry(this.context.settings.skyboxRadius * 1000, this.context.settings.skyboxRadius * 1000, this.context.settings.skyboxHeight * 1000, 256);\n            patchCylinderUV(geometry);\n            let mesh = new threejs_decl_1.THREE.Mesh(geometry, material);\n            mesh.position.y = (this.context.settings.skyboxHeight / 2) * 1000;\n            return { geometry, mesh };\n        }\n        clampPitch(pitch) {\n            return Math.max(this.context.settings.minPitch, Math.min(this.context.settings.maxPitch, pitch));\n        }\n        rotateCamera(dx, dy) {\n            let pitch = this.camera.rotation.x + (dy * this.context.settings.cameraRotationSpeed);\n            this.camera.rotation.x = this.clampPitch(pitch);\n            this.camera.rotation.y += dx * this.context.settings.cameraRotationSpeed;\n        }\n        onSkyboxGeometrySourceParametersUpdated() {\n            let { geometry, mesh } = this.createSkyboxMesh(this.skybox.material);\n            this.scene.add(mesh);\n            this.scene.remove(this.skybox.mesh);\n            this.skybox.geometry.dispose();\n            this.skybox.mesh = mesh;\n            this.skybox.geometry = geometry;\n        }\n        onCameraHeightUpdated() {\n            this.camera.position.y = this.context.settings.cameraHeight * 1000;\n        }\n        onFovUpdated() {\n            this.camera.fov = this.context.settings.fov;\n            this.camera.updateProjectionMatrix();\n        }\n        onPitchLimitUpdated() {\n            this.camera.rotation.x = this.clampPitch(this.camera.rotation.x);\n        }\n    }\n    exports.SkyboxController = SkyboxController;\n    function patchCylinderUV(geom) {\n        let cylinderSideUVs = new Map();\n        let pos = geom.attributes.position;\n        let uv = geom.attributes.uv;\n        let norm = geom.attributes.normal;\n        function makePosKey(i) {\n            return pos.getX(i).toFixed(3) + \"|\" + pos.getY(i).toFixed(3) + \"|\" + pos.getZ(i).toFixed(3);\n        }\n        for (let i = 0; i < uv.count; i++) {\n            let normY = norm.getY(i);\n            if (normY < 0.0001 && normY > -0.0001) {\n                cylinderSideUVs.set(makePosKey(i), { x: uv.getX(i), y: uv.getY(i) });\n            }\n        }\n        let sideCount = (uv.count - 4) / 6;\n        let topCenterVertexIndexStart = (sideCount * 2) + 2;\n        let bottomCenterVertexIndexStart = (sideCount * 4) + 3;\n        for (let i = 0; i < uv.count; i++) {\n            let normY = norm.getY(i);\n            if (normY > 0.0001 || normY < -0.0001) {\n                let posX = pos.getX(i), posZ = pos.getZ(i);\n                if (posX < 0.0001 && posX > -0.0001 && posZ < 0.0001 && posZ > -0.0001) {\n                    let isTop = normY > 0;\n                    let indexStart = isTop ? topCenterVertexIndexStart : bottomCenterVertexIndexStart;\n                    let offset = ((i - indexStart) + 0.5) / sideCount;\n                    uv.setX(i, offset);\n                    uv.setY(i, isTop ? 1 : 0);\n                }\n                else {\n                    let goodUV = cylinderSideUVs.get(makePosKey(i));\n                    if (goodUV) {\n                        uv.setX(i, goodUV.x);\n                        uv.setY(i, goodUV.y);\n                    }\n                    else {\n                        console.warn(`Found NO good UV for position ${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`);\n                    }\n                }\n            }\n        }\n        uv.needsUpdate = true;\n    }\n}\n"],["/client/threejs_decl","function (exports, require) {\n    exports.THREE = window.THREE;\n}\n"],["/client/utils/dom_utils","function (exports, require) {\n    function tag(a, b) {\n        let description;\n        let children = undefined;\n        if (!a) {\n            description = {};\n            children = b || undefined;\n        }\n        else {\n            if (Array.isArray(a)) {\n                description = {};\n                children = a;\n            }\n            else {\n                description = a;\n                children = b || undefined;\n            }\n        }\n        let res = document.createElement(description.tagName || \"div\");\n        for (let k in description) {\n            let v = description[k];\n            switch (k) {\n                case \"tagName\":\n                    break;\n                case \"text\":\n                    res.textContent = v + \"\";\n                    break;\n                case \"class\":\n                    res.className = v + \"\";\n                    break;\n                default:\n                    res.setAttribute(k, v + \"\");\n                    break;\n            }\n        }\n        if (children) {\n            for (let child of children) {\n                res.appendChild(child instanceof HTMLElement ? child : tag(child));\n            }\n        }\n        return res;\n    }\n    exports.tag = tag;\n}\n"],["/client/utils/drag","function (exports, require) {\n    function addDragListeners(params) {\n        let pointerIsLocked = false;\n        let prevX = 0, prevY = 0;\n        function onTouchMove(evt) {\n            let firstTouch = evt.touches[0];\n            if (!firstTouch) {\n                onTouchEnd();\n                return;\n            }\n            params.onDrag({\n                x: firstTouch.clientX,\n                y: firstTouch.clientY,\n                dx: prevX - firstTouch.clientX,\n                dy: prevY - firstTouch.clientY,\n                source: \"touch\"\n            });\n            prevX = firstTouch.clientX;\n            prevY = firstTouch.clientY;\n        }\n        function onMouseMove(evt) {\n            if (pointerIsLocked) {\n                params.onDrag({\n                    x: evt.clientX,\n                    y: evt.clientX,\n                    dx: -evt.movementX,\n                    dy: -evt.movementY,\n                    source: \"pointer\"\n                });\n            }\n            else {\n                params.onDrag({\n                    x: evt.clientX,\n                    y: evt.clientX,\n                    dx: prevX - evt.clientX,\n                    dy: prevY - evt.clientY,\n                    source: \"pointer\"\n                });\n                prevX = evt.clientX;\n                prevY = evt.clientY;\n            }\n        }\n        function onTouchEnd() {\n            window.removeEventListener(\"touchmove\", onTouchMove);\n            window.removeEventListener(\"touchend\", onTouchEnd);\n            params.onDragEnd && params.onDragEnd();\n        }\n        function onMouseUp() {\n            window.removeEventListener(\"mousemove\", onMouseMove);\n            window.removeEventListener(\"mouseup\", onMouseUp);\n            if (pointerIsLocked) {\n                document.exitPointerLock();\n            }\n            params.onDragEnd && params.onDragEnd();\n        }\n        function installDragListeners(evt) {\n            evt.preventDefault();\n            evt.stopPropagation();\n            params.onDragStart && params.onDragStart();\n            if (evt instanceof TouchEvent) {\n                let firstTouch = evt.touches[0];\n                prevX = firstTouch.clientX;\n                prevY = firstTouch.clientY;\n                window.addEventListener(\"touchmove\", onTouchMove);\n                window.addEventListener(\"touchend\", onTouchEnd);\n            }\n            else {\n                prevX = evt.clientX;\n                prevY = evt.clientY;\n                window.addEventListener(\"mousemove\", onMouseMove);\n                window.addEventListener(\"mouseup\", onMouseUp);\n            }\n        }\n        params.element.addEventListener(\"mousedown\", evt => {\n            let expectedButton = params.rightMouseButton ? 2 : 0;\n            if (evt.button !== expectedButton) {\n                return;\n            }\n            if (params.lockPointer && params.element instanceof HTMLCanvasElement) {\n                pointerIsLocked = lockPointer(params.element);\n            }\n            installDragListeners(evt);\n        });\n        params.element.addEventListener(\"touchstart\", evt => {\n            installDragListeners(evt);\n        });\n        if (params.rightMouseButton) {\n            params.element.addEventListener(\"contextmenu\", evt => {\n                evt.preventDefault();\n                evt.stopPropagation();\n            });\n        }\n        if (params.lockPointer) {\n            document.addEventListener(\"pointerlockchange\", () => {\n                pointerIsLocked = document.pointerLockElement === params.element;\n            }, false);\n        }\n    }\n    exports.addDragListeners = addDragListeners;\n    function lockPointer(canvas) {\n        if (!canvas.requestPointerLock) {\n            return false;\n        }\n        canvas.requestPointerLock();\n        return true;\n    }\n}\n"],["/client/utils/graphic_utils","function (exports, require) {\n    function isWebGLAvailable(version) {\n        try {\n            const canvas = document.createElement(\"canvas\");\n            if (version === 1) {\n                return !!(window.WebGLRenderingContext && (canvas.getContext(\"webgl\") || canvas.getContext('experimental-webgl')));\n            }\n            else {\n                return !!(window.WebGL2RenderingContext && canvas.getContext(\"webgl2\"));\n            }\n        }\n        catch (e) {\n            return false;\n        }\n    }\n    exports.isWebGLAvailable = isWebGLAvailable;\n    function getWebglErrorElement(version) {\n        const names = {\n            1: \"WebGL\",\n            2: \"WebGL 2\"\n        };\n        const contexts = {\n            1: window.WebGLRenderingContext,\n            2: window.WebGL2RenderingContext\n        };\n        const result = document.createElement(\"div\");\n        result.className = \"webgl-error-message\";\n        let target = contexts[version] ? \"graphics card\" : \"browser\";\n        result.textContent = `Your ${target} does not seem to support `;\n        let link = document.createElement(\"a\");\n        link.setAttribute(\"href\", \"http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation\");\n        link.textContent = names[version];\n        result.appendChild(link);\n        return result;\n    }\n    exports.getWebglErrorElement = getWebglErrorElement;\n    function raf(handler) {\n        let lastInvokeTime = Date.now();\n        let stopped = false;\n        let wrappedHandler = () => {\n            if (stopped) {\n                return;\n            }\n            requestAnimationFrame(wrappedHandler);\n            let newNow = Date.now();\n            let diff = newNow - lastInvokeTime;\n            lastInvokeTime = newNow;\n            handler(diff);\n        };\n        requestAnimationFrame(wrappedHandler);\n        return () => stopped = true;\n    }\n    exports.raf = raf;\n}\n"],["/client/utils/number_utils","function (exports, require) {\n    function toFixedNoTrail(v, positions) {\n        return v.toFixed(positions).replace(/\\.?0+$/, \"\");\n    }\n    exports.toFixedNoTrail = toFixedNoTrail;\n}\n"]]
,
{"entryPoint":{"module":"/client/client_entrypoint","function":"main"}},eval);