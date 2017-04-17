# iiif-auth-client

This is a client implementation of the [IIIF Authentication specification](http://iiif.io/api/auth/1.0/). It can be used to test individual auth-enabled IIIF Image services:

[https://digirati-co-uk.github.io/iiif-auth-client/?image=https://iiifauth.digtest.co.uk/img/01_Icarus_Breughel.jpg/info.json](https://digirati-co-uk.github.io/iiif-auth-client/?image=https://iiifauth.digtest.co.uk/img/01_Icarus_Breughel.jpg/info.json)

...or it can be given a list of images that will populate a drop-down:

[https://digirati-co-uk.github.io/iiif-auth-client/?sources=https://iiifauth.digtest.co.uk/index.json](https://digirati-co-uk.github.io/iiif-auth-client/?sources=https://iiifauth.digtest.co.uk/index.json)

> The accompanying server implementation (see below) expects username=username, password=password whenever it presents a login screen.

`iiif-auth-client` is written in ES6 with no dependencies and no transpiling. It is therefore not intended for production use unaltered, but as an example implementation. As ES6 it is easier to understand how the IIIF Auth specification orchestrates the user through one or more interaction patterns, because asynchronous user behaviour and HTTP requests to services can be encapsulated in `async` functions.

For example, the control flow in the [Workflow from the Browser Client Perspective](http://iiif.io/api/auth/1.0/#workflow-from-the-browser-client-perspective) diagram involves opening windows, waiting for them to close, and making web requests for services. This flow becomes readable as ES6.

![user interaction](https://raw.githubusercontent.com/digirati-co-uk/iiif-auth-client/master/flow_part.PNG "user interaction")

```javascript
// ...
let contentProviderWindow = await getContentProviderWindowFromModal(serviceToTry);
    if(contentProviderWindow){
        await userInteractionWithContentProvider(contentProviderWindow);
        let success = await attemptImageWithToken(serviceToTry, requestedId);
        // ...
```

The example server implementation:

* Running example: [https://iiifauth.digtest.co.uk/](https://iiifauth.digtest.co.uk/) 
* Source: [iiif-auth-server](https://github.com/digirati-co-uk/iiif-auth-server)

## TODO

`iiif-auth-client` does not yet have any optimisations that a IIIF viewer would typically implement. Client applications are encouraged to cache and reuse tokens to prevent unnecessary user interactions (such as showing dialogue boxes if the user is already authenticated). Examples of these optimisations will be added later.

The application does not yet handle any Presentation API resources, only individual Image API services, one at a time. A client application that loads a manifest should produce a more seamless experience when navigating from image to image. 




