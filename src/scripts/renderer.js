let mayNeedReset = true;
let lastResetTime = localStorage.getItem("lastResetTime");
let expiration = 3600000 * 2; // Integer in ms. 3600000 ms === 1 hr
let gameVersions; // Array to be read from cache/localStorage or fetched.

// represent rows of gameVersions array
let patches = 1;
let gameVersionsDaysPast;
// let gameVersionLatest = 0;
let gameVersionsToUseString;

let weightIMP = 1; // IMP is 'Individual Match Performance' provided by Stratz
let weightActivity = 1; // Activity currently refers to a directly calculated percent of all matches in which the hero is played.
let weightWinrate = 1;
let multiplierForOrdering = -100; // -1000 turns 0.536 into -536, useful for percents where the first decimal matters, and must be negative to display in descending order.

// DOM references
const optionsContainer = document.querySelector(".options_grid");
const banBox = document.getElementById("banbox");
const pickBoxes = document.querySelectorAll(".pick");
let draggingElement;
let dataHeroId;
banBox.addEventListener("dragover", (e) => e.preventDefault());
banBox.addEventListener("drop", () => {
  console.log("drop~");
  document
    .querySelectorAll(`[data-heroId="${dataHeroId}"]`)
    .forEach((elem) => elem.classList.add("banned"));
});

pickBoxes.forEach((pickBox) => {
  pickBox.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  pickBox.addEventListener("drop", () => {
    //remove current image if something is there
    let dataPickId = pickBox.getAttribute("data-heroId");
    pickBox.classList.remove(`hero${dataPickId}`);
    pickBox.removeAttribute("data-heroId",dataPickId)
    document
      .querySelectorAll(`[data-heroId="${dataPickId}"]`)
      .forEach((elem) => elem.classList.remove("picked"));

    let dataDropId = document.querySelector('.dragging').getAttribute("data-heroId");
    document
      .querySelectorAll(`[data-heroId="${dataDropId}"]`)
      .forEach((elem) => elem.classList.add("picked"));
    pickBox.classList.add(`hero${dataDropId}`);
    pickBox.setAttribute("data-heroId",dataDropId)

    pickBox.addEventListener("click", () => {
      dataPickId = pickBox.getAttribute("data-heroId");
      pickBox.classList.remove(`hero${dataPickId}`);
      pickBox.removeAttribute("data-heroId",dataPickId)
      document
        .querySelectorAll(`[data-heroId="${dataDropId}"]`)
        .forEach((elem) => elem.classList.remove("picked"));
    });
  });
});

// Declares number of players to evaluate. Only change if testing.
let playersTotalInGame = 10;
let targetPath; // = server_log;

let steamIds;
let currentMatch;

document
  .getElementById("buttonEnterIds")
  .addEventListener("click", seeInputBoxes);
document
  .getElementById("cancelSubmission")
  .addEventListener("click", hideInputBoxes);
let formIds = document.getElementById("idSubmission");
let buttonEnterIds = document.getElementById("buttonEnterIds");

function seeInputBoxes() {
  formIds.style = "display: contents;";
  buttonEnterIds.style = "display: none;";
}
function hideInputBoxes() {
  formIds.style = "display: none;";
  buttonEnterIds.style = "display: inline-block;";
}

let validPlayers = [];
function determineValidPlayers() {
  let arr = [];
  for (let i = 0; i < steamIds.length; i++) {
    if (steamIds[i] > 0) arr.push(i);
  }

  return (validPlayers = arr);
}

const fetchThings = async (targetUri, targetItem, backupUri) => {
  const response = await fetch(targetUri);
  if (response.status === 200)
    return (localStorage[targetItem] = await response.text());
  await backupFetch(targetItem, backupUri);
};

const backupFetch = async (targetItem, backupUri) => {
  console.log(`%cFetching backup: %c${backupUri}`, "color:#f4f", "color:#eee");
  const response = await fetch(backupUri);
  if (response.status === 200) {
    let obj = await response.text();
    obj = obj.replace(/"hero_id"/g, `"heroId"`);
    obj = obj.replace(/"games"/g, `"matchCount"`);
    obj = obj.replace(/"last_played"/g, `"lastPlayed"`);
    obj = obj.replace(/"win"/g, `"winCount"`);
    return (localStorage[targetItem] = obj);
  }
};

const fetchAndSave = async (targetItem, targetUri, backupUri) => {
  console.log(`%cFetching: %c${targetUri}`, "color:#f4f", "color:#eee");
  try {
    if (!mayNeedReset && localStorage[targetItem])
      return localStorage[targetItem];
  } catch (error) {
    // if (error === 403 ) try OpenDota API instead, if still 403, say "hidden" in UI for player.
    console.log(error.response);
  }
  await fetchThings(targetUri, targetItem, backupUri);
};

const getGlobalStats = async () => {
  // Get heroStats & gameVersion, and determine which steamIds are valid simultaneously
  await Promise.all([
    fetchAndSave(`heroStats`, `https://api.opendota.com/api/heroStats`),
    fetchAndSave(`gameVersions`, `https://api.stratz.com/api/v1/GameVersion`),
  ]);
  gameVersions = JSON.parse(localStorage.gameVersions);
  gameVersionsDaysPast = Math.round(
    (Date.now() - new Date(gameVersions[patches - 1].startDate)) / 3600000 / 24
  );
  heroStats = JSON.parse(localStorage.heroStats);
};

const promiseChain = async () => {
  // Get heroStats & gameVersion, and determine which steamIds are valid simultaneously
  await determineValidPlayers();
  // Simultaneously get heroPerformance for each player and create hero cards.
  await Promise.all([
    iterateThroughPlayers((i) =>
      fetchAndSave(
        `player${steamIds[i]}patches${patches}`,
        `https://api.stratz.com/api/v1/Player/${steamIds[i]}/heroPerformance?gameVersionId=${gameVersionsToUseString}`,
        `https://api.opendota.com/api/players/${steamIds[i]}/heroes?date=${gameVersionsDaysPast}`
      )
    ), // `?gameVersionId=` a comma-delimited array of patch IDs. Currently saving only the most recent (i.e. gameVersions[0]), but may need to add looping if fetching data from other patches.
    initializeHeroCards(),
  ]);

  orderCards();

  // Simultaneously get personal data (e.g. username) and create player cards.
  await iterateThroughPlayers((i) =>
    fetchAndSave(
      `player${steamIds[i]}`,
      `https://api.stratz.com/api/v1/Player/${steamIds[i]}`
    )
  ),
    iterateThroughPlayers(createPlayerCards);
};

const iterateThroughPlayers = async (callback) => {
  let promiseArray = [];
  for (let i = 0; i < validPlayers.length; i++)
    promiseArray.push(callback(validPlayers[i]));
  return Promise.all(promiseArray);
};

function initializeHeroCards() {
  for (let i = 0; i < heroStats.length; i++) {
    for (let j = 0; j < 10; j++) {
      // Set up element to insert.
      let heroCard = document.createElement("div");
      heroCard.className = `heroCard player${j}`;
      optionsContainer.appendChild(heroCard);
      heroCard.classList.add(`hero` + heroStats[i].id);
      heroCard.classList.add(`draggable`);
      heroCard.setAttribute("id", `player${j}__hero${heroStats[i].id}`);
      heroCard.setAttribute("data-heroId", `${heroStats[i].id}`);
      heroCard.setAttribute("draggable", true);
    }
    let banIcon = document.createElement("div");
    banIcon.className = `icon hero${heroStats[i].id}`;
    banBox.appendChild(banIcon);
    banIcon.setAttribute("data-heroId", `${heroStats[i].id}`);
    banIcon.addEventListener('click', () => {
      let dataPickId = banIcon.getAttribute("data-heroId")
      document
      .querySelectorAll(`.hero${dataPickId}`)
      .forEach((elem) => elem.classList.remove("banned"));
    });

    // banIcon.setAttribute("draggable", true);
  }
  draggables = document.querySelectorAll(`.draggable`);
  draggables.forEach((draggable) => {
    draggable.addEventListener("dragstart", () => {
      draggable.classList.add("dragging");
      draggingElement = document.querySelector(".dragging");
      dataHeroId = draggingElement.getAttribute("data-heroId");
      console.log("dragging " + dataHeroId);
    });
    draggable.addEventListener("dragend", () => {
      draggable.classList.remove("dragging");
    });
  });
}

function orderCards() {
  console.log("%cStarting orderCards", "color:#dd0");
  validPlayers.forEach((i) => {
    applyOrderToHeroCard(i, steamIds[i]);
  });
}

async function applyOrderToHeroCard(i, id) {
  console.log(i, id);
  let performanceRef;
  try {
    performanceRef = await JSON.parse(
      localStorage.getItem(`player${id}patches${patches}`)
    );
  } catch (error) {
    // return (document.getElementById(`player${i}__noHeroData`).style.display =
    //   "flex");
  }
  console.log(performanceRef);
  if (performanceRef.length === 0) {
    // document
    //   .querySelectorAll(`.heroCard.player${i}`)
    //   .forEach((elem) => (elem.style = null));
    return (document.getElementById(`player${i}__noHeroData`).style.display =
      "flex");
  }
  let totalMatchCount = findTotalMatches(performanceRef);
  performanceRef.forEach((playerAsHero) => {
    let { convertedIMP, heroMatchCount, winCount } =
      heroIMPAndMatchCount(playerAsHero);
    let orderOfCards = Math.round(
      (multiplierForOrdering *
        (weightIMP * convertedIMP +
          (weightWinrate * winCount) / heroMatchCount +
          weightActivity * (heroMatchCount / totalMatchCount))) /
        (weightIMP + weightActivity + weightWinrate)
    );
    document.getElementById(
      `player${i}__hero${playerAsHero.heroId}`
    ).style.order = orderOfCards;
    // if (heroMatchCount > 0)
    //   document.getElementById(
    //     `player${i}__hero${playerAsHero.heroId}`
    //   ).style.display = "flex";
  });
}

function findTotalMatches(playerPerformanceObj) {
  let totalMatchCount = 0;
  playerPerformanceObj.forEach(
    (playerAsHero) => (totalMatchCount += playerAsHero.matchCount)
  );
  return totalMatchCount;
}

// Takes each line of heroPerformance, pulls the player's hero IMP score, converts into 0-to-1 scale (compatible with percentages), and returns it.
function heroIMPAndMatchCount(playerAsHero) {
  if (!playerAsHero.imp)
    return {
      convertedIMP: 0,
      heroMatchCount: playerAsHero.matchCount,
      winCount: playerAsHero.winCount,
    };
  let convertedIMP = (playerAsHero.imp + 100) / 200; // turns -100 -> 100 into 0 -> 1
  return {
    convertedIMP: convertedIMP,
    heroMatchCount: playerAsHero.matchCount,
    winCount: playerAsHero.winCount,
  };
}

const createPlayerCards = (i) => {
  let playerRef;
  try {
    if (localStorage[`player${steamIds[i]}`] == "")
      throw "Stratz has no player data.";
    playerRef = JSON.parse(localStorage[`player${steamIds[i]}`]);
    document.querySelector(`.player${i} .player_name`).innerText =
      playerRef?.steamAccount?.name;
    let playeri = document.querySelector(`.player${i} .player_rank`);
    if (playerRef.steamAccount?.seasonRank) {
      let tier = playerRef.steamAccount.seasonRank.toString();
      let medal = tier.charAt(0),
        star = tier.charAt(1);

      switch (medal) {
        case "1":
          playeri.innerText = `Herald ${star}`;
          break;

        case "2":
          playeri.innerText = `Guardian ${star}`;
          break;

        case "3":
          playeri.innerText = `Crusader ${star}`;
          break;

        case "4":
          playeri.innerText = `Archon ${star}`;
          break;

        case "5":
          playeri.innerText = `Legend ${star}`;
          break;

        case "6":
          playeri.innerText = `Ancient ${star}`;
          break;

        case "7":
          playeri.innerText = `Divine ${star}`;
          i;
          break;

        case "8":
          playeri.innerText = `Immortal${
            playerRef.steamAccount.seasonLeaderboardRank
              ? " #" + playerRef.steamAccount.seasonLeaderboardRank
              : ""
          }`;
          break;

        default:
          playeri.innerText = `N/A`;
      }
    } else {
      playeri.innerText = `N/A`;
    }
  } catch {
    console.error(`Could not get player${i} name`);
    return (document.getElementById(`player${i}__noPlayerData`).style.display =
      "block");
  }
};

function useUrlQuery() {
  let url = new URL(window.location.href);
  let paramId = url.searchParams.getAll("id");
  let paramPos = url.searchParams.getAll("pos");
  patches = url.searchParams.get("patches");
  steamIds = paramId;
  for (let i = 0; i < steamIds.length; i++) {
    document.getElementById(`playerId${i}`).value = steamIds[i];
    document.getElementById(`playerRole${i}`).value = paramPos[i];
    document.getElementById(`patches`).value = patches;
  }
  let gameVersionToUseArray = [];
  for (let i = 0; i < patches; i++) {
    gameVersionToUseArray.push(gameVersions[i].id);
  }
  gameVersionsToUseString = gameVersionToUseArray.toString();
  promiseChain();
}

async function startProgram() {
  if (lastResetTime < Date.now() - expiration) {
    localStorage.clear();
    localStorage.setItem("lastResetTime", Date.now());
  }
  mayNeedReset = false;
  await getGlobalStats();
  useUrlQuery();
}

startProgram();
