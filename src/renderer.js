let testMode;
let testLog = 'test_log.txt';
let gameVersionMin = 144;
let gameVersionMax = 145;

// dependencies
const chokidar = require('chokidar'), fs = require('fs'), path = require('path'), os = require('os'), fetch = require('node-fetch');

// External paths
let server_log = os.homedir + "/Library/Application Support/Steam/SteamApps/common/dota 2 beta/game/dota/server_log.txt";

// DOM references
const optionsContainer = document.querySelector('.options_grid');

// Creates object to hold all hero and player data.
let globalData = {};

// Declares number of players to evaluate. Only change if testing.
let playersTotalInGame = 10;
let targetPath = server_log;

function enterTestMode() {
    testMode = true;
    playersTotalInGame = 1;
    watcher.unwatch(targetPath);
    targetPath = testLog;
    watcher;
    readLog();
}

function exitTestMode() {
    testMode = false;
    playersTotalInGame = 10;
    watcher.unwatch(targetPath);
    targetPath = server_log;
    watcher;
    readLog();
}
// testMode = true;
// playersTotalInGame = 1;
// targetPath = testLog;

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

let steamIds;

// function from dotabuddy. Parses log into steamIds, additional data includes date, time, game mode.
function parseLog(lastLine, penultLine, secondLastLine) {

    let regex = /(.*?) - (.*?): (.*?) \(Lobby (\d+) (\w+) (.*?)\)/, match, lastLineMatch = lastLine.match(regex), penultLineMatch, secondLastLineMatch;

    if (penultLine) penultLineMatch = penultLine.match(regex);
    if (secondLastLine) secondLastLineMatch = secondLastLine.match(regex);

    if (lastLineMatch) {
        console.log('Ongoing game is being processed.');
        match = lastLineMatch;
    } else if (penultLineMatch) {
        console.log('Previous game is being processed.');
        match = penultLineMatch;
    } else if (secondLastLineMatch) {
        console.log('Previous game is being processed.');
        match = secondLastLineMatch;
    } else {
        return console.log('No match found in last line of file.');
    }

    console.log(`Match: ${match}`);

    // I believe that dateRegex and dateSplit are the same thing?
    let date = match[1], dateRegex = /\//, time = match[2], dateSplit = date.split("/"), timeSplit = time.split(":"), matchDatetime = new Date(dateSplit[2], dateSplit[0] - 1, dateSplit[1], timeSplit[0], timeSplit[1], timeSplit[2]), server = match[3], lobbyId = match[4], gameMode = match[5], playersString = match[6], playersRegex = /\d:(\[U:\d:\d+])/g, playersMatch;
    steamIds = [];
    while (playersMatch = playersRegex.exec(playersString)) {
        let sid = playersMatch[1].substring(5, playersMatch[1].length - 1);
        steamIds.push(sid);
    }

    // Set values for the match on globalData.
    globalData.match = {
        'time': matchDatetime,
        'mode': gameMode,
        'server': server
    };
    globalData.player = [];

    // Affixes steamId to each player, calls promiseChain.
    for (i = 0; i < playersTotalInGame; i++) globalData.player[i] = {'steamId': steamIds[i]};
    return promiseChain();
};

const requestHeroStats = async () => {
    try {
        const response = await fetch(`https://api.opendota.com/api/heroStats`)
        globalData.heroStats = await response.json()
    } catch (error) {
        console.log(error.response);
    }
};

function initializeHeroCards(){
    for (let i = 0; i < globalData.heroStats.length; i++) {
        for (let j = 0; j < 10; j++) {
            // Set up element to insert.
            let heroCard = document.createElement("div");
            heroCard.className = `heroCard player${j}`;
            optionsContainer.appendChild(heroCard);
            heroCard.classList.add(`hero` + globalData.heroStats[i].id);
            heroCard.setAttribute('id', `player${j}__hero${globalData.heroStats[i].id}`);
        }
    }
}

const promiseChain = async () => {
    const a = await requestHeroStats();
    const e = await initializeHeroCards();
    const b = await iterateThroughPlayers(requestPlayerPersonal);
    const c = await iterateThroughPlayers(requestPlayerData);
    const d = await orderCards();
    const g = await iterateThroughPlayers(createPlayerCards);
    return [a, e, b, d, c, g];
};

const requestPlayerData = async(i) => {
    try {
        const response = await fetch(`https://api.stratz.com/api/v1/Player/${steamIds[i]}/heroPerformance?gameVersionId=${gameVersionMin}&gameVersionId=${gameVersionMax}`)
        globalData.player[i].performance = await response.json();
        globalData.player[i].access = true;
    } catch (error) {
        globalData.player[i].access = false;
        console.log(error);
    }
};

const iterateThroughPlayers = async(callback) => {
    let promiseArray = [];
    for (let i = 0; i < playersTotalInGame; i++) promiseArray.push(callback(i));
    return Promise.all(promiseArray);
};

const requestPlayerPersonal = async(i) => {
    try {
        const response = await fetch(`https://api.stratz.com/api/v1/Player/${steamIds[i]}`)
        globalData.player[i].stratzAccess = true;
        globalData.player[i].personal = await response.json();
    } catch (error) {
        globalData.player[i].stratzAccess = false;
        console.log(error.response);
    }
}

const createPlayerCards = (i) => {
    if (globalData.player[i].stratzAccess) {
        
        globalData.player[i].personal.hasOwnProperty('steamAccount')
            ? document.querySelector(`.player${i} .player_name`).innerText = globalData.player[i].personal.steamAccount.name
            : console.log(i + ' could not receive avatar or persona name');

        let playeri = document.querySelector(`.player${i} .player_rank`);
        if (globalData.player[i].personal.steamAccount.seasonRank !== undefined) {
            let tier = globalData.player[i].personal.steamAccount.seasonRank;
            let star = Math.floor((tier / 1) % 10), medal = Math.round(tier / 10);
            if (medal === 1) {
                playeri.innerText = `Herald ${star}`;
            } else if (medal === 2) {
                playeri.innerText = `Guardian ${star}`;
            } else if (medal === 3) {
                playeri.innerText = `Crusader ${star}`;
            } else if (medal === 4) {
                playeri.innerText = `Archon ${star}`;
            } else if (medal === 5) {
                playeri.innerText = `Legend ${star}`;
            } else if (medal === 6) {
                playeri.innerText = `Ancient ${star}`;
            } else if (medal === 7) {
                playeri.innerText = `Divine ${star}`;
            } else if (medal === 8) {
                playeri.innerText = `Immortal ${star}`;
            } else {
                playeri.innerText = `UNKNOWN`;
            }
        } else {
            playeri.innerText = `UNKNOWN`;
        }
    }
}

function orderCards() {
    console.log('Starting orderCards')
    // Callback for each globalData.heroStats.id
    globalData.heroStats.forEach(hero => addPlayerProb(hero,hero.id));
}

function addPlayerProb(hero,idOfHero){
    hero.winRate = hero[`5_win`]/hero[`5_pick`];
    // Create obj where array of objects will be saved
    hero.playerWeights = [];
    // Collect References to available hero data for players
    for (let i = 0; i < playersTotalInGame; i++) {
        if (globalData.player[i].access) {
            getWinAttempt(hero, i, globalData.player[i].performance.find(playerAsHero => playerAsHero.heroId === idOfHero));
        } else {
            let obj = {};
            obj[`weightedScore`] = hero.winRate;
            hero.playerWeights[i] = obj;
        }
        document.getElementById(`player${i}__hero${idOfHero}`).style.order = Math.round(hero.playerWeights[i].weightedScore*-1000);
    }
};

function getWinAttempt(hero,i,playerAsHero) {
    // Array to save information
    let obj = {};
    // Takes elem as arg. If no data, returns false; else returns info found at index.
    if (playerAsHero === undefined) {
        // Removes an arbitrary percent for a hero where the player has no games, because less experience means less ability to perform. Lower winrate heroes are less effected by this. Removes 2.5% from a 50% hero.
        obj[`weightedScore`] = hero.winRate * 0.95;
        hero.playerWeights[i] = obj;
    } else {
        let convertedIMP = (playerAsHero.imp + 50)/100;
        obj[`winRate`] = playerAsHero.winCount / playerAsHero.matchCount;
        // Need 4 games on a hero to be at equal weight with meta.
        obj[`weightedScore`] = ( ( playerAsHero.matchCount * convertedIMP ) + playerAsHero.winCount + (8 * hero.winRate)) / ( (2 * playerAsHero.matchCount) + 8);
        hero.playerWeights[i] = obj;
    }
}