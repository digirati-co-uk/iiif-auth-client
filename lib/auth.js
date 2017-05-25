'use strict';

var loadImage = function () {
    var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(imageServiceId, token) {
        var infoResponse;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        infoResponse = void 0;
                        _context.prev = 1;
                        _context.next = 4;
                        return loadInfo(imageServiceId, token);

                    case 4:
                        infoResponse = _context.sent;
                        _context.next = 11;
                        break;

                    case 7:
                        _context.prev = 7;
                        _context.t0 = _context['catch'](1);

                        log("Could not load " + imageServiceId);
                        log(_context.t0);

                    case 11:
                        if (infoResponse && infoResponse.status === 200) {
                            renderImage(infoResponse.info);
                            if (infoResponse.info["@id"] != imageServiceId) {
                                log("The requested imageService is " + imageServiceId);
                                log("The @id returned is " + infoResponse.info["@id"]);
                                log("This image is most likely the degraded version of the one you asked for");
                                infoResponse.degraded = true;
                            }
                        }
                        return _context.abrupt('return', infoResponse);

                    case 13:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this, [[1, 7]]);
    }));

    return function loadImage(_x, _x2) {
        return _ref.apply(this, arguments);
    };
}();

var attemptImageWithToken = function () {
    var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2(authService, imageService) {
        var tokenService, tokenMessage, withTokenInfoResponse;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        log("attempting token interaction for " + authService["@id"]);
                        tokenService = first(authService.service, function (s) {
                            return s.profile === PROFILE_TOKEN;
                        });

                        if (!tokenService) {
                            _context2.next = 15;
                            break;
                        }

                        log("found token service: " + tokenService["@id"]);
                        _context2.next = 6;
                        return openTokenService(tokenService);

                    case 6:
                        tokenMessage = _context2.sent;

                        if (!(tokenMessage && tokenMessage.accessToken)) {
                            _context2.next = 15;
                            break;
                        }

                        _context2.next = 10;
                        return loadImage(imageService, tokenMessage.accessToken);

                    case 10:
                        withTokenInfoResponse = _context2.sent;

                        log("info request with token resulted in " + withTokenInfoResponse.status);

                        if (!(withTokenInfoResponse.status == 200)) {
                            _context2.next = 15;
                            break;
                        }

                        renderImage(withTokenInfoResponse.info);
                        return _context2.abrupt('return', true);

                    case 15:
                        log("Didn't get a 200 info response.");
                        return _context2.abrupt('return', false);

                    case 17:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function attemptImageWithToken(_x3, _x4) {
        return _ref2.apply(this, arguments);
    };
}();

var doAuthChain = function () {
    var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(infoResponse) {
        var services, lastAttempted, requestedId, serviceToTry, success, kioskWindow, _success, contentProviderWindow, _success2, _contentProviderWindow, _success3;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        if (infoResponse.info.service) {
                            _context3.next = 3;
                            break;
                        }

                        log("No services found");
                        return _context3.abrupt('return');

                    case 3:
                        services = asArray(infoResponse.info.service);
                        lastAttempted = null;
                        requestedId = infoResponse.requestedId;

                        // repetition of logic is left in these steps for clarity:

                        log("Looking for external pattern");
                        serviceToTry = first(services, function (s) {
                            return s.profile === PROFILE_EXTERNAL;
                        });

                        if (!serviceToTry) {
                            _context3.next = 15;
                            break;
                        }

                        lastAttempted = serviceToTry;
                        _context3.next = 12;
                        return attemptImageWithToken(serviceToTry, requestedId);

                    case 12:
                        success = _context3.sent;

                        if (!success) {
                            _context3.next = 15;
                            break;
                        }

                        return _context3.abrupt('return');

                    case 15:

                        log("Looking for kiosk pattern");
                        serviceToTry = first(services, function (s) {
                            return s.profile === PROFILE_KIOSK;
                        });

                        if (!serviceToTry) {
                            _context3.next = 31;
                            break;
                        }

                        lastAttempted = serviceToTry;
                        kioskWindow = openContentProviderWindow(serviceToTry);

                        if (!kioskWindow) {
                            _context3.next = 30;
                            break;
                        }

                        _context3.next = 23;
                        return userInteractionWithContentProvider(kioskWindow);

                    case 23:
                        _context3.next = 25;
                        return attemptImageWithToken(serviceToTry, requestedId);

                    case 25:
                        _success = _context3.sent;

                        if (!_success) {
                            _context3.next = 28;
                            break;
                        }

                        return _context3.abrupt('return');

                    case 28:
                        _context3.next = 31;
                        break;

                    case 30:
                        log("Could not open kiosk window");

                    case 31:

                        // The code for the next two patterns is identical (other than the profile name).
                        // The difference is in the expected behaviour of
                        //
                        //    await userInteractionWithContentProvider(contentProviderWindow);
                        // 
                        // For clickthrough the opened window should close immediately having established
                        // a session, whereas for login the user might spend some time entering credentials etc.

                        log("Looking for clickthrough pattern");
                        serviceToTry = first(services, function (s) {
                            return s.profile === PROFILE_CLICKTHROUGH;
                        });

                        if (!serviceToTry) {
                            _context3.next = 46;
                            break;
                        }

                        lastAttempted = serviceToTry;
                        _context3.next = 37;
                        return getContentProviderWindowFromModal(serviceToTry);

                    case 37:
                        contentProviderWindow = _context3.sent;

                        if (!contentProviderWindow) {
                            _context3.next = 46;
                            break;
                        }

                        _context3.next = 41;
                        return userInteractionWithContentProvider(contentProviderWindow);

                    case 41:
                        _context3.next = 43;
                        return attemptImageWithToken(serviceToTry, requestedId);

                    case 43:
                        _success2 = _context3.sent;

                        if (!_success2) {
                            _context3.next = 46;
                            break;
                        }

                        return _context3.abrupt('return');

                    case 46:

                        log("Looking for login pattern");
                        serviceToTry = first(services, function (s) {
                            return s.profile === PROFILE_LOGIN;
                        });

                        if (!serviceToTry) {
                            _context3.next = 61;
                            break;
                        }

                        lastAttempted = serviceToTry;
                        _context3.next = 52;
                        return getContentProviderWindowFromModal(serviceToTry);

                    case 52:
                        _contentProviderWindow = _context3.sent;

                        if (!_contentProviderWindow) {
                            _context3.next = 61;
                            break;
                        }

                        _context3.next = 56;
                        return userInteractionWithContentProvider(_contentProviderWindow);

                    case 56:
                        _context3.next = 58;
                        return attemptImageWithToken(serviceToTry, requestedId);

                    case 58:
                        _success3 = _context3.sent;

                        if (!_success3) {
                            _context3.next = 61;
                            break;
                        }

                        return _context3.abrupt('return');

                    case 61:

                        // nothing worked! Use the most recently tried service as the source of
                        // messages to show to the user.
                        showOutOfOptionsMessages(lastAttempted);

                    case 62:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this);
    }));

    return function doAuthChain(_x5) {
        return _ref3.apply(this, arguments);
    };
}();

// determine the postMessage-style origin for a URL


var _marked = [MessageIdGenerator].map(regeneratorRuntime.mark);

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var PROFILE_LOGIN = 'http://iiif.io/api/auth/1/login';
var PROFILE_CLICKTHROUGH = 'http://iiif.io/api/auth/1/clickthrough';
var PROFILE_KIOSK = 'http://iiif.io/api/auth/1/kiosk';
var PROFILE_EXTERNAL = 'http://iiif.io/api/auth/1/external';
var PROFILE_TOKEN = 'http://iiif.io/api/auth/1/token';
var PROFILE_LOGOUT = 'http://iiif.io/api/auth/1/logout';

var viewer = null;
var messages = {};
window.addEventListener("message", receiveMessage, false);

// resolve returns { infoJson, status }
// reject returns an error message
function loadInfo(imageServiceId, token) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', imageServiceId + "/info.json");
        if (token) {
            request.setRequestHeader("Authorization", "Bearer " + token);
        }
        request.onload = function () {
            try {
                if (this.status === 200 || this.status === 401) {
                    resolve({
                        info: JSON.parse(this.response),
                        status: this.status,
                        requestedId: imageServiceId
                    });
                } else {
                    reject(this.status + " " + this.statusText);
                }
            } catch (e) {
                reject(e.message);
            }
        };
        request.onerror = function () {
            reject(this.status + " " + this.statusText);
        };
        request.send();
    });
}

function init() {
    var imageQs = /image=(.*)/g.exec(window.location.search);
    var sourceQs = /sources=(.*)/g.exec(window.location.search);
    if (imageQs && imageQs[1]) {
        var imageServiceId = imageQs[1].replace(/\/info\.json$/, '');
        selectImage(imageServiceId);
    } else if (sourceQs && sourceQs[1]) {
        loadSourceList(sourceQs[1]).then(function (sources) {
            populateSourceList(sources);
        });
    } else {
        document.querySelector("h1").innerText = "(no image on query string)";
    }
}

function selectImage(imageServiceId) {
    document.querySelector("h1").innerText = imageServiceId;
    var infoJsonAnchor = document.getElementById("infoJson");
    var infoJsonUrl = imageServiceId + "/info.json";
    infoJsonAnchor.href = infoJsonUrl;
    infoJsonAnchor.innerText = infoJsonUrl;
    loadImage(imageServiceId).then(function (infoResponse) {
        if (infoResponse) {
            if (infoResponse.degraded || infoResponse.status === 401) {
                doAuthChain(infoResponse);
            }
        }
    });
}

function populateSourceList(sources) {
    var sourceList = document.getElementById("sourceList");
    sources.forEach(function (image) {
        var opt = document.createElement("option");
        opt.value = image.id;
        opt.innerText = image.label;
        sourceList.appendChild(opt);
    });
    sourceList.style.display = "block";
    sourceList.addEventListener("change", function () {
        selectImage(sourceList.options[sourceList.selectedIndex].value);
    });
    var reloadButton = document.getElementById("reloadSource");
    reloadButton.style.display = "block";
    reloadButton.addEventListener("click", function () {
        selectImage(sourceList.options[sourceList.selectedIndex].value);
    });
}

// load a set of sample images from an instance of iiif-auth-server
function loadSourceList(sourcesUrl) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', sourcesUrl);
        request.onload = function () {
            try {
                if (this.status === 200) {
                    resolve(JSON.parse(this.response));
                } else {
                    reject(this.status + " " + this.statusText);
                }
            } catch (e) {
                reject(e.message);
            }
        };
        request.onerror = function () {
            reject(this.status + " " + this.statusText);
        };
        request.send();
    });
}

function renderImage(info) {
    log("OSD will load " + info["@id"]);
    if (viewer) {
        viewer.destroy();
        viewer = null;
    }
    viewer = OpenSeadragon({
        id: "viewer",
        prefixUrl: "openseadragon/images/",
        tileSources: info
    });
}

function asArray(obj) {
    // wrap in array if singleton
    if (obj) {
        return obj.constructor === Array ? obj : [obj];
    }
    return [];
}

function first(objOrArray, predicate) {
    var arr = asArray(objOrArray);
    var filtered = arr.filter(predicate);
    if (filtered.length > 0) {
        return filtered[0];
    }
    return null;
}

function getOrigin(url) {
    var urlHolder = window.location;
    if (url) {
        urlHolder = document.createElement('a');
        urlHolder.href = url;
    }
    return urlHolder.protocol + "//" + urlHolder.hostname + (urlHolder.port ? ':' + urlHolder.port : '');
}

function MessageIdGenerator() {
    var messageId;
    return regeneratorRuntime.wrap(function MessageIdGenerator$(_context4) {
        while (1) {
            switch (_context4.prev = _context4.next) {
                case 0:
                    messageId = 1; // don't start at 0, it's falsey

                case 1:
                    if (!true) {
                        _context4.next = 6;
                        break;
                    }

                    _context4.next = 4;
                    return messageId++;

                case 4:
                    _context4.next = 1;
                    break;

                case 6:
                case 'end':
                    return _context4.stop();
            }
        }
    }, _marked[0], this);
}

var messageIds = MessageIdGenerator();

function openTokenService(tokenService) {
    // use a Promise across a postMessage call. Discuss...
    return new Promise(function (resolve, reject) {
        // if necessary, the client can decide not to trust this origin
        var serviceOrigin = getOrigin(tokenService["@id"]);
        var messageId = messageIds.next().value;
        messages[messageId] = {
            "resolve": resolve,
            "reject": reject,
            "serviceOrigin": serviceOrigin
        };
        var tokenUrl = tokenService["@id"] + "?messageId=" + messageId + "&origin=" + getOrigin();
        document.getElementById("commsFrame").src = tokenUrl;

        // reject any unhandled messages after a configurable timeout
        var postMessageTimeout = 5000;
        setTimeout(function () {
            if (messages[messageId]) {
                messages[messageId].reject("Message unhandled after " + postMessageTimeout + "ms, rejecting");
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
    var rejectValue = "postMessage event received but rejected.";
    if (event.data.hasOwnProperty("messageId")) {
        log("recieved message with id " + event.data.messageId);
        var message = messages[event.data.messageId];
        if (message && event.origin == message.serviceOrigin) {
            // Any message with a messageId is a success
            log("We trust that we triggered this message, so resolve");
            message.resolve(event.data);
            delete messages[event.data.messageId];
            return;
        }
    }
}

function userInteractionWithContentProvider(contentProviderWindow) {
    return new Promise(function (resolve) {
        // What happens here is forever a mystery to a client application.
        // It can but wait.
        var poll = window.setInterval(function () {
            if (contentProviderWindow.closed) {
                log("cookie service window is now closed");
                window.clearInterval(poll);
                resolve();
            }
        }, 500);
    });
}

function sanitise(s, allowHtml) {
    // Unimplemented
    // Viewers should already have an HTML sanitiser library, for metadata etc
    if (allowHtml) {
        // sanitise but allow permitted tags
        return s;
    }
    // return text content only
    return s;
}

function openContentProviderWindow(service) {
    var cookieServiceUrl = service["@id"] + "?origin=" + getOrigin();
    log("Opening content provider window: " + cookieServiceUrl);
    return window.open(cookieServiceUrl);
}

function getContentProviderWindowFromModal(service) {
    return new Promise(function (resolve) {
        hideModals();
        modal = document.getElementById("beforeOpenCookieServiceModal");
        modal.querySelector(".close").onclick = function (ev) {
            hideModals();
            resolve(null);
        };
        modal.querySelector("#csConfirm").onclick = function (ev) {
            log("Interacting with cookie service in new tab - " + service["@id"]);
            var win = openContentProviderWindow(service);
            hideModals();
            resolve(win);
        };
        modal.querySelector("#csCancel").onclick = function (ev) {
            hideModals();
            resolve(null);
        };
        if (service.label) {
            modal.querySelector("#csLabel").innerText = sanitise(service.label);
        }
        if (service.header) {
            modal.querySelector("#csHeader").innerText = sanitise(service.header);
        }
        if (service.description) {
            modal.querySelector("#csDescription").innerText = sanitise(service.description, true);
        }
        if (service.confirmLabel) {
            modal.querySelector("#csConfirm").innerText = sanitise(service.confirmLabel);
        }
        modal.style.display = "block";
    });
}

function showOutOfOptionsMessages(service) {
    hideModals();
    modal = document.getElementById("failureModal");
    modal.querySelector(".close").onclick = function (ev) {
        return hideModals();
    };
    modal.querySelector("#failureClose").onclick = function (ev) {
        return hideModals();
    };
    if (service.failureHeader) {
        modal.querySelector("#failureHeader").innerText = sanitise(service.failureHeader);
    }
    if (service.failureDescription) {
        modal.querySelector("#failureDescription").innerText = sanitise(service.failureDescription, true);
    }
    modal.style.display = "block";
}

function hideModals() {
    var modals = document.querySelectorAll(".modal");
    modals.forEach(function (m) {
        m.style.display = "none";
        m.querySelectorAll("*").forEach(function (el) {
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
//# sourceMappingURL=auth.js.map