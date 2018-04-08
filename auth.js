const PROFILE_LOGIN = 'http://iiif.io/api/auth/1/login';
const PROFILE_CLICKTHROUGH = 'http://iiif.io/api/auth/1/clickthrough';
const PROFILE_KIOSK = 'http://iiif.io/api/auth/1/kiosk';
const PROFILE_EXTERNAL = 'http://iiif.io/api/auth/1/external';
const PROFILE_TOKEN = 'http://iiif.io/api/auth/1/token';
const PROFILE_LOGOUT = 'http://iiif.io/api/auth/1/logout';
const PROFILE_PROBE = 'http://iiif.io/api/auth/1/probe';
const IMAGE_SERVICE_TYPE = 'ImageService2';
const HTTP_METHOD_GET = 'GET';
const HTTP_METHOD_HEAD = 'HEAD';

let viewer = null;   
let messages = {};
let sourcesMap = {};
window.addEventListener("message", receiveMessage, false);

// resolve returns { infoJson, status }
// reject returns an error message
function getInfoResponse(resourceId, token){
    /*
        This now synthesises an object that can be passed around, describing the
        resource and its auth services, and the user's current HTTP status, obtained
        by interacting with the probe service.
        If this is an image service, the info and the status are obtained by 
        making a GET request for the info.json.
        If it isn't a service, the info is constructed from information already
        supplied to the "viewer" (usually from a Manifest) and the status is obtained by
        making a HEAD request to the probe service - which will be the resource id
        itself unless an alternative has been specified.
    */
    
    // we have already stored this information when initialising
    let knownResource = sourcesMap[resourceId];
    let info = null;
    let probeService = resourceId;
    let method = HTTP_METHOD_GET;
    if(knownResource.behaviour == "service"){
        probeService = resourceId + "/info.json";
        log("this is a service, so the probe is " + probeService);
    } else {
        info = knownResource;
        let cookieService = first(knownResource.service, s => s.profile === PROFILE_LOGIN);
        if(cookieService){
            let assertedProbeService = first(cookieService.service, s => s.profile === PROFILE_PROBE);
            if(assertedProbeService){
                log("This resource asserts a separate probe service!");
                probeService = assertedProbeService["@id"];
            }
        } 
        method = HTTP_METHOD_HEAD;
        log("This is a content resource at " + resourceId);
        log("The probe service is " + probeService);
    }
    log("Probe will be requested with HTTP " + method);
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open(method, probeService);
        if(token){
            request.setRequestHeader("Authorization", "Bearer " + token);
        }
        request.onload = function(){
            try {
                if(this.status === 200 || this.status === 401){
                    if(method == HTTP_METHOD_GET){
                        info = JSON.parse(this.response);
                        info.id = info.id || info["@id"];
                        info.type = IMAGE_SERVICE_TYPE;
                    }
                    resolve({
                        info: info,
                        status: this.status,
                        requestedId: resourceId
                    });
                } else {
                    reject(this.status + " " + this.statusText);
                } 
            } catch(e) {
                reject(e.message);
            }
        };
        request.onerror = function() {
            reject(this.status + " " + this.statusText);
        };        
        request.send();
    });
}

function init(){
    const imageQs = /image=(.*)/g.exec(window.location.search);
    const sourceQs = /sources=(.*)/g.exec(window.location.search);
    const p3ManifestQs = /manifest=(.*)/g.exec(window.location.search)
    if(imageQs && imageQs[1]){
        let imageServiceId = imageQs[1].replace(/\/info\.json$/, '');
        sourcesMap[imageServiceId] = {
            "behaviour": "service",
            "id": imageServiceId
        }
        selectResource(imageServiceId);
    } else if(sourceQs && sourceQs[1]) {
        loadSourceList(sourceQs[1]).then(sources => {
            populateSourceList(sources);
        });
    } else if(p3ManifestQs && p3ManifestQs[1]) {
        loadResourceFromManifest(p3ManifestQs[1]).then(resource => {
            selectResource(resource.id);
        });    
    } else {
        document.querySelector("h1").innerText = "(no image on query string)";
    }
}

function selectResource(resourceId){
    // This will either be in the sourcesMap, or will be fetched as an info.json
    // either way, we'll end up with an object that carries the resource URL and the auth services.
    document.querySelector("h1").innerText = resourceId;
    let resourceAnchor = document.getElementById("infoJson");
    let resourceUrl = resourceId + "/info.json";
    let resource = sourcesMap[resourceId];
    if(resource && resource.behaviour != 'service'){
        // not an info.json; just display a link
        resourceUrl = resource.id;
    }    
    resourceAnchor.href = resourceUrl;
    resourceAnchor.innerText = resourceUrl;
    loadResource(resourceId).then(infoResponse => {
        if(infoResponse){
            if(infoResponse.degraded || infoResponse.status === 401){
                doAuthChain(infoResponse);
            }
        }
    });
}

function populateSourceList(sources){
    sourcesMap = {};
    let sourceList = document.getElementById("sourceList");
    sources.forEach(image => {
        let opt = document.createElement("option");
        opt.value = image.id;
        opt.innerText = image.label;
        sourceList.appendChild(opt);
        sourcesMap[image.id] = image;
    });
    sourceList.style.display = "block";    
    sourceList.addEventListener("change", () => {
        selectResource(sourceList.options[sourceList.selectedIndex].value);
    });
    let reloadButton = document.getElementById("reloadSource");
    reloadButton.style.display = "block";    
    reloadButton.addEventListener("click", () => {
        selectResource(sourceList.options[sourceList.selectedIndex].value);
    }); 
}

function loadResourceFromManifest(manifestUrl){
    // This auth demo is not a Presentation API client, it's only for
    // resources. But service-less resources are going to be found in
    // Presentation 3 manifests, so it needs to load them to test. This
    // just gets the first resource it can find.
    sourcesMap = {};
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', manifestUrl);
        request.onload = function(){
            try {
                if(this.status === 200){
                    manifest = JSON.parse(this.response);
                    if(    manifest.items
                        && manifest.items[0].items
                        && manifest.items[0].items[0].items){
                        // this is very fragile
                        const resource = manifest.items[0].items[0].items[0].body;
                        sourcesMap[resource.id] = resource;
                        resource.partOf = manifestUrl;
                        resolve(resource);
                    } else {
                        reject("Cannot find Presentation 3 resource in this manifest");
                    }                    
                } else {
                    reject(this.status + " " + this.statusText);
                } 
            } catch(e) {
                reject(e.message);
            }
        };
        request.onerror = function() {
            reject(this.status + " " + this.statusText);
        };        
        request.send();
    });
}


// load a set of sample images from an instance of iiif-auth-server
function loadSourceList(sourcesUrl){
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', sourcesUrl);
        request.onload = function(){
            try {
                if(this.status === 200){
                    resolve(JSON.parse(this.response));
                } else {
                    reject(this.status + " " + this.statusText);
                } 
            } catch(e) {
                reject(e.message);
            }
        };
        request.onerror = function() {
            reject(this.status + " " + this.statusText);
        };        
        request.send();
    });
}

async function loadResource(resourceId, token){
    let infoResponse;
    try{
        infoResponse = await getInfoResponse(resourceId, token);
    } catch (e) {
        log("Could not load " + resourceId);
        log(e);
    }
    if(infoResponse && infoResponse.status === 200){
        renderResource(infoResponse, resourceId);
    }
    return infoResponse;
}

function renderResource(infoResponse, requestedResource){
    destroyViewer();
    if(infoResponse.info.type == IMAGE_SERVICE_TYPE){
        log("This resource is an image service.");
        renderImageService(infoResponse.info);
        if(infoResponse.info["@id"] != requestedResource){
            log("The requested imageService is " + requestedResource);
            log("The @id returned is " + infoResponse.info["@id"]);
            log("This image is most likely the degraded version of the one you asked for")
            infoResponse.degraded = true;
        }
    } else {
        log("The resource is of type " + infoResponse.info.type);
        let viewerHTML;
        if(infoResponse.info.type == "Video"){
            viewerHTML = "<video src='" + infoResponse.info.id + "' autoplay>Video here</video>";            
        } else if(infoResponse.info.type == "Audio"){
            viewerHTML = "<audio src='" + infoResponse.info.id + "' autoplay>audio here</audio>";
        } else if(infoResponse.info.type == "Text"){
            viewerHTML = "<a href='" + infoResponse.info.id + "' target='_blank'>Open document - " + infoResponse.info.label + "</a>";
        } else {
            viewerHTML = "<p>Not a known type</p>";
        }
        document.getElementById("viewer").innerHTML = viewerHTML;
    }
}

function destroyViewer(){
    if(viewer){
        viewer.destroy();
        viewer = null;
    }
    document.getElementById("viewer").innerHTML = "";
    document.getElementById("largeDownload").innerHTML = "";
}

function renderImageService(info){
    log("OSD will load " + info["@id"]);
    viewer = OpenSeadragon({
        id: "viewer",
        prefixUrl: "openseadragon/images/",
        tileSources: info
    });
    makeDownloadLink(info);
}

function makeDownloadLink(info){
    let largeDownload = document.getElementById("largeDownload");
    let w = info["width"];
    let h = info["height"]
    let dims = "(" + w + " x " + h + ")";
    maxWAssertion = first(info["profile"], pf => pf["maxWidth"]);
    if(maxWAssertion){
        dims += " (max width is " + maxWAssertion["maxWidth"] + ")";
    }
    largeDownload.innerText = "Download large image: " + dims;
    largeDownload.setAttribute("href", info["@id"] + "/full/full/0/default.jpg")
}

function asArray(obj){
    // wrap in array if singleton
    if(obj){
        return (obj.constructor === Array ? obj : [obj]);
    }
    return [];
}

function first(objOrArray, predicate){
    let arr = asArray(objOrArray);
    let filtered = arr.filter(predicate);
    if(filtered.length > 0){
        return filtered[0];
    }
    return null;
}

async function attemptImageWithToken(authService, imageService){
    log("attempting token interaction for " + authService["@id"]);
    let tokenService = first(authService.service, s => s.profile === PROFILE_TOKEN);
    if(tokenService){
        log("found token service: " + tokenService["@id"]);
        let tokenMessage = await openTokenService(tokenService); 
        if(tokenMessage && tokenMessage.accessToken){
            let withTokenInfoResponse = await loadResource(imageService, tokenMessage.accessToken);
            log("info request with token resulted in " + withTokenInfoResponse.status);
            if(withTokenInfoResponse.status == 200){
                renderResource(withTokenInfoResponse, imageService);
                return true;
            }
        }  
    }
    log("Didn't get a 200 info response.")
    return false;
}

async function doAuthChain(infoResponse){
    // This function enters the flowchart at the < External? > junction
    // http://iiif.io/api/auth/1.0/#workflow-from-the-browser-client-perspective
    if(!infoResponse.info.service){
        log("No services found")
        return;
    }
    let services = asArray(infoResponse.info.service);
    let lastAttempted = null;
    let requestedId = infoResponse.requestedId;

    // repetition of logic is left in these steps for clarity:
    
    log("Looking for external pattern");
    let serviceToTry = first(services, s => s.profile === PROFILE_EXTERNAL);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        let success = await attemptImageWithToken(serviceToTry, requestedId);
        if(success) return;
    }

    log("Looking for kiosk pattern");
    serviceToTry = first(services, s => s.profile === PROFILE_KIOSK);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        let kioskWindow = openContentProviderWindow(serviceToTry);
        if(kioskWindow){
            await userInteractionWithContentProvider(kioskWindow);
            let success = await attemptImageWithToken(serviceToTry, requestedId);
            if(success) return;
        } else {
            log("Could not open kiosk window");
        }
    }

    // The code for the next two patterns is identical (other than the profile name).
    // The difference is in the expected behaviour of
    //
    //    await userInteractionWithContentProvider(contentProviderWindow);
    // 
    // For clickthrough the opened window should close immediately having established
    // a session, whereas for login the user might spend some time entering credentials etc.

    log("Looking for clickthrough pattern");
    serviceToTry = first(services, s => s.profile === PROFILE_CLICKTHROUGH);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        let contentProviderWindow = await getContentProviderWindowFromModal(serviceToTry);
        if(contentProviderWindow){
            // should close immediately
            await userInteractionWithContentProvider(contentProviderWindow);
            let success = await attemptImageWithToken(serviceToTry, requestedId);
            if(success) return;
        } 
    }

    log("Looking for login pattern");
    serviceToTry = first(services, s => s.profile === PROFILE_LOGIN);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        let contentProviderWindow = await getContentProviderWindowFromModal(serviceToTry);
        if(contentProviderWindow){
            // we expect the user to spend some time interacting
            await userInteractionWithContentProvider(contentProviderWindow);
            let success = await attemptImageWithToken(serviceToTry, requestedId);
            if(success) return;
        } 
    }

    // nothing worked! Use the most recently tried service as the source of
    // messages to show to the user.
    showOutOfOptionsMessages(lastAttempted);
}

// determine the postMessage-style origin for a URL
function getOrigin(url) {
    let urlHolder = window.location;
    if(url){
        urlHolder = document.createElement('a');
        urlHolder.href = url;
    }
    return urlHolder.protocol + "//" + urlHolder.hostname + (urlHolder.port ? ':' + urlHolder.port: '');
}

function* MessageIdGenerator(){
    var messageId = 1; // don't start at 0, it's falsey
    while(true) yield messageId++;
}

var messageIds = MessageIdGenerator();

function openTokenService(tokenService){
    // use a Promise across a postMessage call. Discuss...
    return new Promise((resolve, reject) => {
        // if necessary, the client can decide not to trust this origin
        const serviceOrigin = getOrigin(tokenService["@id"]);
        const messageId = messageIds.next().value;
        messages[messageId] = { 
            "resolve": resolve,
            "reject": reject,
            "serviceOrigin": serviceOrigin
        };
        var tokenUrl = tokenService["@id"] + "?messageId=" + messageId + "&origin=" + getOrigin();
        document.getElementById("commsFrame").src = tokenUrl;

        // reject any unhandled messages after a configurable timeout
        const postMessageTimeout = 5000;
        setTimeout(() => {
            if(messages[messageId]){
                messages[messageId].reject(
                    "Message unhandled after " + postMessageTimeout + "ms, rejecting");
                delete messages[messageId];
            }
        }, postMessageTimeout);
    });
}

// The event listener for postMessage. Needs to take care it only
// responds to messages initiated by openTokenService(..)
// Completes promises made in openTokenService(..)
function receiveMessage(event) {    
    log("event received, origin=" + event.origin);
    log(JSON.stringify(event.data));
    let rejectValue = "postMessage event received but rejected.";
    if(event.data.hasOwnProperty("messageId")){
        log("recieved message with id " + event.data.messageId);
        var message = messages[event.data.messageId];
        if(message && event.origin == message.serviceOrigin)
        {
            // Any message with a messageId is a success
            log("We trust that we triggered this message, so resolve")
            message.resolve(event.data);
            delete messages[event.data.messageId];
            return;
        }    
    }
}

function userInteractionWithContentProvider(contentProviderWindow){
    return new Promise((resolve) => {
        // What happens here is forever a mystery to a client application.
        // It can but wait.
        var poll = window.setInterval(() => {
            if(contentProviderWindow.closed){
                log("cookie service window is now closed")
                window.clearInterval(poll);
                resolve();
            }
        }, 500);
    });
}

function sanitise(s, allowHtml){
    // Unimplemented
    // Viewers should already have an HTML sanitiser library, for metadata etc
    if(allowHtml){
        // sanitise but allow permitted tags
        return s;
    }
    // return text content only
    return s;
}

function openContentProviderWindow(service){
    let cookieServiceUrl = service["@id"] + "?origin=" + getOrigin();
    log("Opening content provider window: " + cookieServiceUrl);
    return window.open(cookieServiceUrl);
}

function getContentProviderWindowFromModal(service){
    return new Promise(resolve => {
        hideModals();
        modal = document.getElementById("beforeOpenCookieServiceModal");
        modal.querySelector(".close").onclick = (ev => {
            hideModals();
            resolve(null);
        });
        modal.querySelector("#csConfirm").onclick = (ev => {
            log("Interacting with cookie service in new tab - " + service["@id"]);
            let win = openContentProviderWindow(service);
            hideModals();
            resolve(win);
        });
        modal.querySelector("#csCancel").onclick = (ev => {
            hideModals();
            resolve(null);
        });
        if(service.label){
            modal.querySelector("#csLabel").innerText = sanitise(service.label);
        }
        if(service.header){
            modal.querySelector("#csHeader").innerText = sanitise(service.header);
        }
        if(service.description){
            modal.querySelector("#csDescription").innerText = sanitise(service.description, true);
        }
        if(service.confirmLabel){
            modal.querySelector("#csConfirm").innerText = sanitise(service.confirmLabel);
        }
        modal.style.display = "block";
    });
}

function showOutOfOptionsMessages(service){
    hideModals();
    modal = document.getElementById("failureModal");
    modal.querySelector(".close").onclick = (ev => hideModals());
    modal.querySelector("#failureClose").onclick = (ev => hideModals());
    if(service.failureHeader){
        modal.querySelector("#failureHeader").innerText = sanitise(service.failureHeader);
    }
    if(service.failureDescription){
        modal.querySelector("#failureDescription").innerText = sanitise(service.failureDescription, true);
    }
    modal.style.display = "block";
}

function hideModals(){
    let modals = document.querySelectorAll(".modal");
    modals.forEach(m => {
        m.style.display = "none";
        m.querySelectorAll("*").forEach(el => {
            el.onclick = null;
        });
    });
}

function log(text) {
    var logDiv = document.querySelector("#usermessages");
    var p = document.createElement("p");
    p.innerText = text;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(text);
}

init();