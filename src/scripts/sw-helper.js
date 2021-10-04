const swHelper = {
    SW: null,
    init() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').then(registration => {
                swHelper.SW = registration.installing || registration.waiting || registration.active;
                console.log('%cSW: %cregistration promise resolved', 'color:#0dd', 'color:#eee')
            })
            // if (navigator.serviceWorker.controller) console.log('%cSW: %cexists', 'color:#0ff', 'color:#eee')
        } else {
            console.log('Service workers unsupported?!')
        }
    }
};

document.addEventListener('DOMContentLoaded', swHelper.init);