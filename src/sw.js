console.log('%cSW: %cWatchit, im runnin here!', 'color:#0dd', 'color:#eee');
console.log( { self } );
self.addEventListener('install', ev => console.log('%cSW: %cinstall', 'color:#0dd', 'color:#eee'));
self.addEventListener('activate', ev => console.log('%cSW: %cactivate', 'color:#0dd', 'color:#eee'));
self.addEventListener('message', ev => console.log('%cSW: %cmessage', 'color:#0dd', 'color:#eee'));
self.addEventListener('fetch', ev => console.log('%cSW: %cfetch', 'color:#0dd', 'color:#eee'));
