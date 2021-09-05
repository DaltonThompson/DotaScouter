console.log('Watchit, im runnin here!');
console.log( { self } );
self.addEventListener('install', ev => console.log('SW install'));
self.addEventListener('activate', ev => console.log('SW activate'));
self.addEventListener('fetch', ev => console.log('SW fetch'));
self.addEventListener('message', ev => console.log('SW message'));
