// dependencies
const chokidar = require('chokidar'), fs = require('fs'), path = require('path'), os = require('os'), fetch = require('node-fetch');

let expiration = 3600000; // Integer in ms. 3600000 ms === 1 hr
let gameVersions; // Array to be read from cache/localStorage or fetched.

// represent rows of gameVersions array
let gameVersionEarliest = 1;
let gameVersionLatest = 0;

let weightIMP = 1; // IMP is 'Individual Match Performance' provided by 
let weightActivity = 1; // Activity currently refers to a directly calculated percent of all matches in which the hero is played.
let multiplierForOrdering = -100; // -1000 turns 0.536 into -536, useful for percents where the first decimal matters, and must be negative to display in descending order.

// External paths
let server_log = os.homedir + "/Library/Application Support/Steam/SteamApps/common/dota 2 beta/game/dota/server_log.txt";

// DOM references
const optionsContainer = document.querySelector('.options_grid');

// Declares number of players to evaluate. Only change if testing.
let playersTotalInGame = 10;
let targetPath = server_log;

// Checks dev-mode.json -- if true, copy playersInGame and targetPath values.
let devMode;
try {
    devMode = require('./dev-mode.json')
} catch {
    console.log('%cDid not detect %c./dev-mode.json', 'color:#ddd','font-style:italics')
}
if (devMode.devMode) {
    console.log('%cEntering developer mode.', 'color:#ff0')
    targetPath = devMode.testLog,
    playersTotalInGame = devMode.playersInGame
}

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
let currentMatch;

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
    currentMatch = {
        'time': matchDatetime,
        'mode': gameMode,
        'server': server
    };

    return promiseChain();
};

const promiseChain = async () => {

    // Get heroStats & gameVersion simulateously
    await Promise.all([
        fetchAndSave(`heroStats`, expiration, `https://api.opendota.com/api/heroStats`),
        fetchAndSave(`gameVersions`, expiration, `https://api.stratz.com/api/v1/GameVersion`)
    ]);
    gameVersions = JSON.parse(localStorage.gameVersions);
    heroStats = JSON.parse(localStorage.heroStats);

    // Simultaneously get heroPerformance for each player and create hero cards.
    await Promise.all([
        iterateThroughPlayers((i) => fetchAndSave(`player${steamIds[i]}patch${gameVersions[gameVersionLatest].id}`, expiration, `https://api.stratz.com/api/v1/Player/${steamIds[i]}/heroPerformance?gameVersionId=${gameVersions[gameVersionLatest].id}`)), // `?gameVersionId=` a comma-delimited array of patch IDs. Currently saving only the most recent (i.e. gameVersions[0]), but may need to add looping if fetching data from other patches.
        initializeHeroCards()
    ]);

    orderCards();

    // Simultaneously get personal data (e.g. username) and create player cards.
    await iterateThroughPlayers((i) => fetchAndSave(`player${steamIds[i]}`, expiration, `https://api.stratz.com/api/v1/Player/${steamIds[i]}`)),
    iterateThroughPlayers(createPlayerCards);
};

const fetchAndSave = async(targetItem, expiry, targetUri) => {
    try {
        let targetItemWasSaved = localStorage[`${targetItem}Retrieved`];
        let targetItemResp = localStorage[targetItem];
        if ( targetItemWasSaved > Date.now()-expiry ) return targetItemResp;
    } catch (error) {
        console.log(error.response);
    }
    await fetchThings(targetUri, targetItem);
}

const fetchThings = async(targetUri, targetItem) => {
    const response = await fetch(targetUri);
    let text = await response.text();
    localStorage[targetItem] = text;
    localStorage[`${targetItem}Retrieved`] = Date.now();
}

const iterateThroughPlayers = async(callback) => {
    let promiseArray = [];
    for (let i = 0; i < playersTotalInGame; i++) promiseArray.push(callback(i));
    return Promise.all(promiseArray);
};

function initializeHeroCards(){
    for (let i = 0; i < heroStats.length; i++) {
        for (let j = 0; j < 10; j++) {
            // Set up element to insert.
            let heroCard = document.createElement("div");
            heroCard.className = `heroCard player${j}`;
            optionsContainer.appendChild(heroCard);
            heroCard.classList.add(`hero` + heroStats[i].id);
            heroCard.setAttribute('id', `player${j}__hero${heroStats[i].id}`);
            heroCard.style.display = 'none';
        }
    }
}

function orderCards() {
    console.log('Starting orderCards')
    // Callback for each globalData.heroStats.id
    for (let i = 0; i < playersTotalInGame; i++) {
        applyOrderToHeroCard(i,steamIds[i]);
    }
}

async function applyOrderToHeroCard(i,id){
    console.log(i,id);
    let performanceRef = await JSON.parse(localStorage.getItem(`player${id}patch${gameVersions[gameVersionLatest].id}`));
    console.log(performanceRef);
    if (performanceRef.length === 0) return document.getElementById(`player${i}__noHeroData`).style.display = 'flex';
    let totalMatchCount = findTotalMatches(performanceRef);
    performanceRef.forEach(playerAsHero => {
        let { convertedIMP, heroMatchCount } = heroIMPAndMatchCount(playerAsHero);
        let orderOfCards = Math.round(multiplierForOrdering * ((weightIMP*convertedIMP) + (weightActivity * (heroMatchCount/totalMatchCount)))/(weightIMP+weightActivity));
        document.getElementById(`player${i}__hero${playerAsHero.heroId}`).style.order = orderOfCards;
        document.getElementById(`player${i}__hero${playerAsHero.heroId}`).style.display = 'flex';
    });
}

function findTotalMatches(playerPerformanceObj){
    let totalMatchCount = 0;
    playerPerformanceObj.forEach(playerAsHero => totalMatchCount += playerAsHero.matchCount);
    return totalMatchCount;
}

// Takes each line of heroPerformance, pulls the player's hero IMP score, converts into 0-to-1 scale (compatible with percentages), and returns it.
function heroIMPAndMatchCount(playerAsHero){
    let convertedIMP = (playerAsHero.imp + 50)/100; // turns -50 -> 50 scale into 0 -> 1
    return {'convertedIMP':convertedIMP, 'heroMatchCount':playerAsHero.matchCount}; // activity is already 0 -> 1.
}

const createPlayerCards = (i) => {
    let playerRef = JSON.parse(localStorage[`player${steamIds[i]}`]);
    try {
        document.querySelector(`.player${i} .player_name`).innerText = playerRef.steamAccount?.name;
    } catch {
        console.error(`Could not get player${i} name`);
    }
    let playeri = document.querySelector(`.player${i} .player_rank`);
    if (playerRef.steamAccount?.seasonRank) {
        let tier = playerRef.steamAccount.seasonRank.toString();
        let medal = tier.charAt(0), star = tier.charAt(1);

        switch (medal){
            case '1':
                playeri.innerText = `Herald ${star}`;
                break;
        
            case '2':
                playeri.innerText = `Guardian ${star}`;
                break;
        
            case '3':
                playeri.innerText = `Crusader ${star}`;
                break;
        
            case '4':
                playeri.innerText = `Archon ${star}`;
                break;

            case '5':
                playeri.innerText = `Legend ${star}`;
                break;

            case '6':
                playeri.innerText = `Ancient ${star}`;
                break;

            case '7':
                playeri.innerText = `Divine ${star}`;i
                break;

            case '8':
                playeri.innerText = `Immortal${playerRef.steamAccount.seasonLeaderboardRank ? ' #'+ globalData.playerRef.steamAccount.seasonLeaderboardRank : ''}`;
                break;
        
            default:
                playeri.innerText = `UNKNOWN`;
        }
    } else {
        playeri.innerText = `UNKNOWN`;
    }
}