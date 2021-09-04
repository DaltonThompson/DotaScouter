let testMode;
let testLog = 'test_log.txt';
let gameVersions = 2;

// dependencies
const chokidar = require('chokidar'), fs = require('fs'), path = require('path'), os = require('os'), fetch = require('node-fetch');

// External paths
let server_log = os.homedir + "/Library/Application Support/Steam/SteamApps/common/dota 2 beta/game/dota/server_log.txt";

// DOM references
const optionsContainer = document.querySelector('.options_grid');

// Creates object to hold all hero and player data.
let globalData = {
    'gameVersion':[
        {
          "id": 146,
          "name": "7.30b",
          "startDate": "2021-08-23T00:00:00"
        },
        {
          "id": 145,
          "name": "7.30",
          "startDate": "2021-08-18T00:00:00"
        },
        {
          "id": 144,
          "name": "7.29d",
          "startDate": "2021-05-24T00:00:00"
        }
    ]
};

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

const promiseChain = async () => {

    // Get heroStats & gameVersion simulateously
    await Promise.all([
        fetchAndSave(`https://api.opendota.com/api/heroStats`, globalData, `heroStats`),
        fetchAndSave(`https://api.stratz.com/api/v1/GameVersion`, globalData, `gameVersion`)
    ]);

    // Simultaneously get heroPerformance for each player and create hero cards.
    await Promise.all([
        iterateThroughPlayers((i) => fetchAndSave(`https://api.stratz.com/api/v1/Player/${steamIds[i]}/heroPerformance?gameVersionId=${globalData.gameVersion[gameVersions-1].id}&gameVersionId=${globalData.gameVersion[0].id}`, globalData, `player`, i, `performance`, `access`)),
        initializeHeroCards()
    ]);

    orderCards();

    // Simultaneously get personal data (e.g. username) and create player cards.
    await iterateThroughPlayers((i) => fetchAndSave(`https://api.stratz.com/api/v1/Player/${steamIds[i]}`, globalData, `player`, i, `personal`, `stratzAccess`)),
    iterateThroughPlayers(createPlayerCards);
};

// (string, object, string, etc.)
const fetchAndSave = async(targetUri, saveLocationParent, child, iteration, property, accessNote) => {
    console.log(targetUri);
    try {
        const response = await fetch(targetUri);
        if (property) {
            saveLocationParent[child][iteration][property] = await response.json();
            saveLocationParent[child][iteration][accessNote] = true;
        } else {
            saveLocationParent[child] = await response.json();
        }
        // if (accessNoteLocation) saveLocationParent[accessNoteLocation] = true;
    } catch (error) {
        console.log(error.response);
        saveLocationParent[child][iteration][accessNote] = false;
    }
}

const iterateThroughPlayers = async(callback) => {
    let promiseArray = [];
    for (let i = 0; i < playersTotalInGame; i++) promiseArray.push(callback(i));
    return Promise.all(promiseArray);
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
        if (!globalData.player[i].access || globalData.player[i].performance.length === 0) {
            let obj = {};
            obj[`weightedScore`] = hero.winRate;
            obj[`activity`] = 0;
            hero.playerWeights[i] = obj;
            document.getElementById(`player${i}__noHeroData`).style.display = 'flex';
        } else {
            getWinAttempt(hero, i, globalData.player[i].performance.find(playerAsHero => playerAsHero.heroId === idOfHero));
        }
        // activity added, with points removed spread out equally among heroes.
        let orderOfCards = Math.round(hero.playerWeights[i].weightedScore*-1000 - hero.playerWeights[i].activity*1000 + 1000/121);
        document.getElementById(`player${i}__hero${idOfHero}`).style.order = orderOfCards;
        if (hero.playerWeights[i].activity === 0) document.getElementById(`player${i}__hero${idOfHero}`).style.display = 'none';
    }
};

// ORIGINAL, ACCOUNTING FOR META
// function getWinAttempt(hero,i,playerAsHero) {
//     // Array to save information
//     let obj = {};
//     // Takes elem as arg. If no data, returns false; else returns info found at index.
//     if (playerAsHero === undefined) {
//         obj[`weightedScore`] = hero.winRate;
//         obj[`activity`] = 0;
//         hero.playerWeights[i] = obj;
//     } else {
//         let convertedIMP = (playerAsHero.imp + 50)/100;
//         obj[`winRate`] = playerAsHero.winCount / playerAsHero.matchCount;
//         obj[`activity`] = playerAsHero.activity;
//         // Need 4 games on a hero to be at equal weight with meta.
//         obj[`weightedScore`] = ( ( playerAsHero.matchCount * convertedIMP ) + playerAsHero.winCount + (8 * hero.winRate)) / ( (2 * playerAsHero.matchCount) + 8);
//         hero.playerWeights[i] = obj;
//     }
// }

// NEW, IGNORING META FOR PLAYERS WITH DATA
function getWinAttempt(hero,i,playerAsHero) {
    // Array to save information
    let obj = {};
    // Takes elem as arg. If no data, returns false; else returns info found at index.
    if (playerAsHero === undefined) {
        obj[`weightedScore`] = 0;
        obj[`activity`] = 0;
        hero.playerWeights[i] = obj;
    } else {
        let convertedIMP = (playerAsHero.imp + 50)/100;
        obj[`winRate`] = playerAsHero.winCount / playerAsHero.matchCount;
        obj[`activity`] = playerAsHero.activity;
        obj[`weightedScore`] = ( ( playerAsHero.matchCount * convertedIMP ) + playerAsHero.winCount ) / ( 2 * playerAsHero.matchCount );
        hero.playerWeights[i] = obj;
    }
}

const createPlayerCards = (i) => {
    if (globalData.player[i].stratzAccess) document.querySelector(`.player${i} .player_name`).innerText = globalData.player[i].personal.steamAccount?.name;
    let playeri = document.querySelector(`.player${i} .player_rank`);
    if (globalData.player[i].personal?.steamAccount?.seasonRank) {
        let tier = globalData.player[i].personal.steamAccount.seasonRank;
        let star = Math.floor((tier / 1) % 10), medal = Math.round(tier / 10);

        switch (medal){
            case 1:
                playeri.innerText = `Herald ${star}`;
                break;
        
            case 2:
                playeri.innerText = `Guardian ${star}`;
                break;
        
            case 3:
                playeri.innerText = `Crusader ${star}`;
                break;
        
            case 4:
                playeri.innerText = `Archon ${star}`;
                break;

            case 5:
                playeri.innerText = `Legend ${star}`;
                break;

            case 6:
                playeri.innerText = `Ancient ${star}`;
                break;

            case 7:
                playeri.innerText = `Divine ${star}`;
                break;

            case 8:
                playeri.innerText = `Immortal${globalData.player[i].personal.steamAccount.seasonLeaderboardRank ? ' #'+ globalData.player[i].personal.steamAccount.seasonLeaderboardRank : ''}`;
                break;
        
            default:
                playeri.innerText = `UNKNOWN`;
        }
    } else {
        playeri.innerText = `UNKNOWN`;
    }
}