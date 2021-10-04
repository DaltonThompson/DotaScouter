const version = 1;
let staticName = `staticCache-${version}`;
let dynamicName = `dynamicCache`;
let fontName = `fontCache-${version}`;
let options = {
    ignoreSearch: false,
    ignoreMethod: false,
    ignoreVary: false,
};
let DB = null;
let assets = ['./index.html','./css/main.css','./scripts/renderer.js']

self.addEventListener('install', ev => {
    ev.waitUntil(
        caches.open(staticName).then(cache => {
            cache.addAll(assets).then(() => console.log(`%c[SW]: %cUpdated ${staticName}`, 'color:#0dd', 'color:#eee'),
            (err) => console.warn(`%c[SW]: %cFailed update of ${staticName}`, 'color:#0dd', 'color:#eee')) 
        })
    );
}
self.addEventListener('activate', ev => {
    ev.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(thisCacheName => {
                if(thisCacheName !== staticName) {
                    console.log(`%c[SW] %c removing cache${thisCacheName}`, 'color:#0dd', 'color:#eee')
                    return caches.delete(thisCacheName);
                }
            }))
        })
    )
    console.log('%cSW: %cactivate', 'color:#0dd', 'color:#eee')
});
self.addEventListener('message', ev => console.log('%cSW: %cmessage', 'color:#0dd', 'color:#eee'));
self.addEventListener('fetch', ev => {
    ev.respondWith(
        caches.match(ev.request).then(resp => {
            return (
                resp || 

                fetch(ev.request).then(fetchResp => {
                    let type = fetchResp.headers.get('content-type');
                    let url = ev.request.url;
                    if (url === `https://api.opendota.com/api/heroStats` || url === `https://api.stratz.com/api/v1/GameVersion`) {
                        caches.open(staticName).then(cache => {
                            cache.put(ev.request, fetchResp.clone());
                            return fetchResp;
                        });
                    } else if (url.match(/fonts/i)) {
                        caches.open(fontName).then(cache => {
                            cache.put(ev.request, fetchResp.clone());
                            return fetchResp;
                        });
                    } else {
                        caches.open(dynamicName).then(cache => {
                            cache.put(ev.request, fetchResp.clone());
                            return fetchResp;
                        });
                    }
                })

                Promise.resolve().then(() => {
                    let opts = {
                        mode: ev.request.mode,
                        cache: 'no-cache',
                    };
                    if (!ev.request.url.startsWith(location.origin)) {
                        opts.mode = 'cors';
                        opts.credentials = 'omit';
                    }
                    return fetch(ev.request.url, opts).then(
                        (fetchResp) => {
                            if (fetchResp.ok) handleFetchResponse(fetchResp, ev.request);
                            if (fetchResp.status == 404) {
                                if (ev.request.url.match(/\.png/i)) caches.open(staticName).then(cache => cache.match('/404.html'))
                            }
                            if ()
                        }
                    )
                });
                let reqClone = ev.request.clone();
                fetch(reqClone).then(resp => {
                    if (!resp) {
                        console.log('%cSW: %cfetch did not respond', 'color:#0dd', 'color:#eee');
                        return resp;
                    }
                    let respClone = resp.clone();
                    caches.open(cacheName).then(cache => {
                        cache.put(ev.request, respClone);
                        console.log('%cSW: %cnew data put in cache', 'color:#0dd', 'color:#eee')
                        return resp;
                    })
                })    
            } catch (error) {
                console.log(error);
            }
        })
    )
}); 