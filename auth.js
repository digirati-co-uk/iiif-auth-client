const PROFILE_LOGIN = 'http://iiif.io/api/auth/1/login'
const PROFILE_CLICKTHROUGH = 'http://iiif.io/api/auth/1/clickthrough'
const PROFILE_KIOSK = 'http://iiif.io/api/auth/1/kiosk'
const PROFILE_EXTERNAL = 'http://iiif.io/api/auth/1/external'
const PROFILE_TOKEN = 'http://iiif.io/api/auth/1/token'
const PROFILE_LOGOUT = 'http://iiif.io/api/auth/1/logout'

let viewer = null;   
let messages = {}
window.addEventListener("message", receiveMessage, false);

// resolve returns { infoJson, status }
// reject returns an error message
function loadInfo(imageServiceId, token){
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', imageServiceId + "/info.json");
        if(token){
            request.setRequestHeader("Authorization", "Bearer " + token);
        }
        request.onload = function(){
            try {
                if(this.status === 200 || this.status === 401){
                    resolve({
                        info: JSON.parse(this.response),
                        status: this.status,
                        requestedId: imageServiceId
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
    const qs = /image=(.*)/g.exec(window.location.search);
    if(qs && qs[1]){
        let imageServiceId = qs[1].replace(/\/info\.json$/, '');
        document.querySelector("h1").innerText = imageServiceId;
        loadImage(imageServiceId).then(infoResponse => {
            if(infoResponse){
                if(infoResponse.degraded || infoResponse.status === 401){
                    doAuthChain(infoResponse);
                }
            }
        });
    } else {
        document.querySelector("h1").innerText = "(no image on query string)";
    }
}

async function loadImage(imageServiceId, token){

    let infoResponse;
    try{
        infoResponse = await loadInfo(imageServiceId, token);
    } catch (e) {
        log("Could not load " + imageServiceId);
        log(e);
    }
    if(infoResponse && infoResponse.status === 200){
        renderImage(infoResponse.info);
        if(infoResponse.info["@id"] != imageServiceId){
            log("The requested imageService is " + imageServiceId);
            log("The @id returned is " + infoResponse.info["@id"]);
            log("This image is most likely the degraded version of the one you asked for")
            infoResponse.degraded = true;
        }
    }
    return infoResponse;
}


function renderImage(info){
    log("OSD will load " + info["@id"]);
    if(viewer){
        viewer.destroy();
        viewer = null;
    }
    viewer = OpenSeadragon({
        id: "viewer",
        prefixUrl: "openseadragon/images/",
        tileSources: info
    });
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
            let withTokenInfoResponse = await loadImage(imageService, tokenMessage.accessToken);
            log("info request with token resulted in " + withTokenInfoResponse.status);
            if(withTokenInfoResponse.status == 200){
                renderImage(withTokenInfoResponse.info);
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
    let imageService = infoResponse.requestedId;

    // repitition of logic is left in these steps for clarity:
    
    log("Looking for external pattern");
    let serviceToTry = first(services, s => s.profile === PROFILE_EXTERNAL);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        let success = await attemptImageWithToken(serviceToTry, imageService);
        if(success) return;
    }

    log("Looking for kiosk pattern");
    serviceToTry = first(services, s => s.profile === PROFILE_KIOSK);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        await openCookieService(serviceToTry);
        let success = await attemptImageWithToken(serviceToTry, imageService);
        if(success) return;
    }

    log("Looking for clickthrough pattern");
    serviceToTry = first(services, s => s.profile === PROFILE_CLICKTHROUGH);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        let accepted = await showOpenCookieServiceModal(serviceToTry);
        if(accepted){
            await openCookieService(serviceToTry);
            let success = await attemptImageWithToken(serviceToTry, imageService);
            if(success) return;
        } 
    }

    log("Looking for login pattern");
    serviceToTry = first(services, s => s.profile === PROFILE_LOGIN);
    if(serviceToTry){
        lastAttempted = serviceToTry;
        let accepted = await showOpenCookieServiceModal(serviceToTry);
        if(accepted){
            await openCookieService(serviceToTry);
            let success = await attemptImageWithToken(serviceToTry, imageService);
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

        // reject for any unhandled messages after a configurable timeout
        const postMessageTimeout = 5000;
        setTimeout(() => {
            if(messages[messageId]){
                messages[messageId].reject(
                    "Message unhandled after " + postMessageTimeout + "ms, rejecting");
                delete messages[event.data.messageId];
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

function openCookieService(cookieService){
    return new Promise(resolve => {
        log("Interacting with cookie service in new tab - " + cookieService["@id"]);
        let win = window.open(cookieService["@id"] + "?origin=" + getOrigin());
        var poll = window.setInterval(() => {
            if(win.closed){
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

function showOpenCookieServiceModal(service){
    return new Promise(resolve => {
        hideModals();
        modal = document.getElementById("beforeOpenCookieServiceModal");
        modal.querySelector(".close").onclick = (ev => {
            resolve(false);
            hideModals();
        });
        modal.querySelector("#csConfirm").onclick = (ev => {
            resolve(true);
            hideModals();
        });
        modal.querySelector("#csCancel").onclick = (ev => {
            resolve(false);
            hideModals();
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