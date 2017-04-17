# iiif-auth-client

This is a client implementation of the [IIIF Authentication specification](http://iiif.io/api/auth/1.0/). It can be used to test individual images:

[https://digirati-co-uk.github.io/iiif-auth-client/?image=https://iiifauth.digtest.co.uk/img/01_Icarus_Breughel.jpg/info.json](https://digirati-co-uk.github.io/iiif-auth-client/?image=https://iiifauth.digtest.co.uk/img/01_Icarus_Breughel.jpg/info.json)

...or it can be given a list of images that will populate a drop-down:

[https://digirati-co-uk.github.io/iiif-auth-client/?sources=https://iiifauth.digtest.co.uk/index.json](https://digirati-co-uk.github.io/iiif-auth-client/?sources=https://iiifauth.digtest.co.uk/index.json)

The client is written in ES6 with no dependencies and no transpiling. It is therefore not intended for production as-is, but as an example implementation. As ES6 it is easier to understand how the specification orchestrates the user through one or more interaction patterns, because asynchronous user interaction can be hidden behind `async` functions.

For example, the control flow in the [Workflow from the Browser Client Perspective](http://iiif.io/api/auth/1.0/#workflow-from-the-browser-client-perspective) diagram involves asynchronous user interaction - opening windows, waiting for them to close - but becomes readable as ES6.

![user interaction](https://raw.githubusercontent.com/digirati-co-uk/iiif-auth-client/master/flow_part.PNG "user interaction")

```javascript
// ...
let contentProviderWindow = await getContentProviderWindowFromModal(serviceToTry);
    if(contentProviderWindow){
        await userInteractionWithContentProvider(contentProviderWindow);
        let success = await attemptImageWithToken(serviceToTry, requestedId);
        // ...
```

An example server implementation is provided to test the client against:

* Running example: [https://iiifauth.digtest.co.uk/](https://iiifauth.digtest.co.uk/) 
* Source: [iiif-auth-server](https://github.com/digirati-co-uk/iiif-auth-server)




