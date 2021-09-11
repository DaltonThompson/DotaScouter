// dependencies
const chokidar = require('chokidar'), fs = require('fs'), path = require('path'), os = require('os'), fetch = require('node-fetch');

// External paths
let server_log = os.homedir + "/Library/Application Support/Steam/SteamApps/common/dota 2 beta/game/dota/server_log.txt";

// Observes log for all events
const watcher = chokidar.watch(targetPath).on('all', (event, path) => {
    console.log(event, path, readLog());
});
watcher;

// function from dotabuddy. Finds last line of targetPath, calls parselog on it.
function readLog(){
    let lines = [];
    fs.readFileSync(targetPath).toString().split("\n").forEach(line => lines.push(line));
    return this.parseLog(lines[lines.length - 1], lines[lines.length - 2], lines[lines.length - 3]);
};

// function from dotabuddy. Parses log into steamIds, additional data includes date, time, game mode.
function parseLog(lastLine, penultLine, secondLastLine) {

    let regex = /(.*?) - (.*?): (.*?) \(Lobby (\d+) (\w+) (.*?)\)/, match, lastLineMatch = lastLine.match(regex), penultLineMatch, secondLastLineMatch;

    if (penultLine) penultLineMatch = penultLine.match(regex);
    if (secondLastLine) secondLastLineMatch = secondLastLine.match(regex);

    if (lastLineMatch) {
        console.log('%cParsing: %clast line is being processed.', 'color:#dd0', 'color:#eee');
        match = lastLineMatch;
    } else if (penultLineMatch) {
        console.log('%cParsing: %cfirst previous line is being processed.', 'color:#dd0', 'color:#eee');
        match = penultLineMatch;
    } else if (secondLastLineMatch) {
        console.log('%cParsing: %csecond previous line is being processed.', 'color:#dd0', 'color:#eee');
        match = secondLastLineMatch;
    } else {
        return console.log('%cParsing: %cno match found in last line of file.', 'color:#dd0', 'color:#f33; font-style:italic');    }

    console.log(`Match: ${match}`);

    // I believe that dateRegex and dateSplit are the same thing?
    let date = match[1], dateRegex = /\//, time = match[2], dateSplit = date.split("/"), timeSplit = time.split(":"), matchDatetime = new Date(dateSplit[2], dateSplit[0] - 1, dateSplit[1], timeSplit[0], timeSplit[1], timeSplit[2]), server = match[3], lobbyId = match[4], gameMode = match[5], playersString = match[6], playersRegex = /\d:(\[U:\d:\d+])/g, playersMatch;
    steamIds = [];
    while (playersMatch = playersRegex.exec(playersString)) {
        let sid = playersMatch[1].substring(5, playersMatch[1].length - 1);
        steamIds.push(sid);
    }

    // Set values for the match on globalData.
    currentMatch = {
        'time': matchDatetime,
        'mode': gameMode,
        'server': server
    };

    return promiseChain();
};

// Checks dev-mode.json -- if true, copy playersInGame and targetPath values.
let devMode;
try {
    devMode = require('./dev-mode.json') // require() is a node.js function
} catch {
    console.log('%cDid not detect %c./dev-mode.json', 'color:#ddd','font-style:italics')
}
if (devMode.devMode) {
    console.log('%cEntering developer mode.', 'color:#ff0')
    targetPath = devMode.testLog,
    playersTotalInGame = devMode.playersInGame
}

