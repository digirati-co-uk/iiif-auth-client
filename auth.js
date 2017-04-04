const PROFILE_LOGIN = 'http://iiif.io/api/auth/1/login'
const PROFILE_CLICKTHROUGH = 'http://iiif.io/api/auth/1/clickthrough'
const PROFILE_KIOSK = 'http://iiif.io/api/auth/1/kiosk'
const PROFILE_EXTERNAL = 'http://iiif.io/api/auth/1/external'
const PROFILE_TOKEN = 'http://iiif.io/api/auth/1/token'
const PROFILE_LOGOUT = 'http://iiif.io/api/auth/1/logout'

let viewer = null;   
let imageService = null; 

if (!window.location.origin) {
    window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
}

var messageBox = {}
window.addEventListener("message", receiveToken, false);

function loadInfo(token){
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        if(token){
            request.setRequestHeader("Authorization", "Bearer " + token);
        }
        request.open('GET', imageService + "/info.json");
        request.onload = function(){
            try {
                if(this.status === 200 || this.status === 401){
                    resolve({
                        info: JSON.parse(this.response),
                        status: this.status
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
        imageService = qs[1].replace(/\/info\.json$/, '');
        document.querySelector("h1").innerText = imageService;
        loadImage();
    } else {
        document.querySelector("h1").innerText = "(no image on query string)";
    }
}

function loadImage(token){
    loadInfo(token)
        .then(infoResponse => {
            if(infoResponse.status === 200){
                view(infoResponse.info);
                if(infoResponse.info["@id"] != imageService){
                    log("The requested imageService is " + imageService);
                    log("The @id returned is " + infoResponse.info["@id"]);
                    lookForServices(infoResponse.info);
                }
            } else if (infoResponse.status === 401) {
                lookForServices(infoResponse.info);
            } else {
                log("Handle other status: " + infoResponse.info.status);
            }
        })
        .catch(err => {
            log("Could not load " + uri);
            log(err);
        });
}


function view(info){
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

function lookForServices(info){
    if(!info.service){
        log("No services found")
        return;
    }
    let services = (info.service.constructor === Array ? info.service : [info.service]);

    // external 
       // try token
    // kiosk
}

function getDomain(url) {
    var matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
    return matches && matches[1];  // will be null if no match is found
}

function requestToken(tokenService, callback){
    // a client can manage its own message IDs
    const messageId = tokenService + "|" + new Date().getTime(); 
    const serviceOrigin = getDomain(tokenService);
    messageBox[messageId] = { 
        "callback": callback,
        "serviceOrigin": serviceOrigin
    };
    var tokenUrl = tokenService + "?messageId=" + msgId + "&origin=" + window.location.origin;
    document.getElementById("commsFrame").src = tokenUrl;
}

function receiveToken(event) {    
    log("event received, origin=" + event.origin);
    var eventOrigin = getDomain(event.origin);
    var token = event.data;
    log(token);
    document.getElementById("commsFrame").src = "resting.html";
    if(token.hasOwnProperty("messageId")){
        var message = messageBox[token.messageId];
        if(message && eventOrigin == message.serviceOrigin)
        {
            message.callback(token);
        } else {
            log("Messages did not match")
        }        
        delete messageBox[token.messageId];
    }
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